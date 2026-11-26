/**
 * Analyze-mode routes: scan a config the user brings, findings shown immediately.
 *
 * Behaviour is preserved verbatim from the pre-split monolith, including the two
 * (deliberately different) mesh-detection strategies -- upload detection is
 * stricter, paste detection falls back harder -- so existing tests keep passing.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const {
  IstioSecurityAnalyzer,
  ConsulSecurityAnalyzer,
  LinkerdSecurityAnalyzer
} = require('../analyzers');
const { summarize } = require('../lib/summarize');
const { findLineNumbersForPath } = require('../lib/locate');
const { referencesFor } = require('../knowledge/references');
const { lessonFor } = require('../knowledge/lessons');

const MESH_KEY = {
  Istio: 'istio', 'Istio (auto-detected)': 'istio', 'Unknown (defaulting to Istio checks)': 'istio',
  Consul: 'consul', 'Consul (auto-detected)': 'consul',
  Linkerd: 'linkerd', 'Linkerd (auto-detected)': 'linkerd'
};

/** Attach references + any authored lesson so Analyze mode teaches, not just reports. */
function enrich(findings, meshType) {
  const mesh = MESH_KEY[meshType] || null;
  return findings.map((finding) => ({
    ...finding,
    references: referencesFor(finding, mesh),
    lesson: lessonFor(finding.id)
  }));
}

function createAnalyzeRoutes(upload) {
  const router = express.Router();

  router.post('/analyze', upload.single('meshconfig'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const filePath = req.file.path;

    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');

      let config;
      let analyzer;
      let meshType;

      const fileExt = path.extname(req.file.originalname).toLowerCase();

      try {
        if (fileExt === '.json') {
          config = JSON.parse(fileContent);
        } else if (fileExt === '.hcl') {
          return res.status(400).json({
            success: false,
            message: 'HCL parsing not fully implemented. Please convert to JSON format.'
          });
        } else {
          config = yaml.load(fileContent);
        }
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: `Invalid file format (${fileExt}): ${e.message}`
        });
      }

      if (config.kind === 'MeshConfig' && config.apiVersion && config.apiVersion.includes('istio.io')) {
        meshType = 'Istio';
        analyzer = new IstioSecurityAnalyzer();
      } else if (config.mesh_type === 'consul') {
        meshType = 'Consul';
        analyzer = new ConsulSecurityAnalyzer();
      } else if (config.mesh_type === 'linkerd') {
        meshType = 'Linkerd';
        analyzer = new LinkerdSecurityAnalyzer();
      } else {
        if (config.connect && config.tls && config.acl) {
          meshType = 'Consul (auto-detected)';
          config.mesh_type = 'consul';
          analyzer = new ConsulSecurityAnalyzer();
        } else if (config.meshMTLS || config.defaultConfig || config.peerAuthentication) {
          meshType = 'Istio (auto-detected)';
          config.kind = 'MeshConfig';
          config.apiVersion = 'networking.istio.io/v1alpha1';
          analyzer = new IstioSecurityAnalyzer();
        } else if (config.identity && config.proxy && (config.tls || config.policy)) {
          meshType = 'Linkerd (auto-detected)';
          config.mesh_type = 'linkerd';
          analyzer = new LinkerdSecurityAnalyzer();
        } else {
          return res.status(400).json({
            success: false,
            message: 'Could not determine mesh type. Please ensure the file is a valid service mesh configuration (Istio, Consul, or Linkerd).'
          });
        }
      }

      analyzer.analyze(config);
      const findings = enrich(analyzer.getEnrichedFindings(), meshType);

      res.json({
        success: true,
        meshType: meshType,
        findings: findings,
        summary: summarize(findings)
      });
    } catch (error) {
      console.error('Error analyzing file:', error);
      res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    } finally {
      // Always discard the temp upload. Several validation paths above return
      // early, and each one used to leak its file into uploads/.
      fs.unlink(filePath, () => {});
    }
  });

  router.post('/analyze-content', express.json(), (req, res) => {
    try {
      const { content } = req.body;

      if (!content) {
        return res.status(400).json({ success: false, message: 'No content provided' });
      }

      let configData;
      let meshType = 'Unknown';

      try {
        configData = yaml.load(content);
      } catch (yamlError) {
        try {
          configData = JSON.parse(content);
        } catch (jsonError) {
          return res.status(400).json({
            success: false,
            message: 'Invalid configuration format. Please provide valid YAML or JSON.'
          });
        }
      }

      let analyzer;

      if (configData.mesh_type) {
        const meshTypeValue = configData.mesh_type.toLowerCase();
        if (meshTypeValue === 'consul') {
          meshType = 'Consul';
          analyzer = new ConsulSecurityAnalyzer();
        } else if (meshTypeValue === 'linkerd') {
          meshType = 'Linkerd';
          analyzer = new LinkerdSecurityAnalyzer();
        } else if (meshTypeValue === 'istio') {
          meshType = 'Istio';
          analyzer = new IstioSecurityAnalyzer();
        }
      }

      if (!analyzer && configData.kind) {
        if (configData.kind === 'MeshConfig' && configData.apiVersion && configData.apiVersion.includes('istio')) {
          meshType = 'Istio';
          analyzer = new IstioSecurityAnalyzer();
        } else if (configData.kind.toLowerCase().includes('linkerd')) {
          meshType = 'Linkerd';
          analyzer = new LinkerdSecurityAnalyzer();
        }
      }

      if (!analyzer) {
        if (configData.defaultConfig || configData.mesh || configData.meshConfig ||
            configData.meshMTLS || configData.outboundTrafficPolicy) {
          meshType = 'Istio';
          analyzer = new IstioSecurityAnalyzer();
        } else if (configData.connect || configData.services || configData.consul ||
                   (configData.acl && (configData.connect || configData.ports))) {
          meshType = 'Consul';
          analyzer = new ConsulSecurityAnalyzer();
        } else if (configData.identity || configData.proxy || configData.policy ||
                   configData.controlPlane) {
          meshType = 'Linkerd';
          analyzer = new LinkerdSecurityAnalyzer();
        }
      }

      if (!analyzer) {
        const contentStr = JSON.stringify(configData).toLowerCase();
        if (contentStr.includes('istio') || contentStr.includes('meshconfig')) {
          meshType = 'Istio (auto-detected)';
          analyzer = new IstioSecurityAnalyzer();
        } else if (contentStr.includes('consul') || contentStr.includes('service_mesh')) {
          meshType = 'Consul (auto-detected)';
          analyzer = new ConsulSecurityAnalyzer();
        } else if (contentStr.includes('linkerd')) {
          meshType = 'Linkerd (auto-detected)';
          analyzer = new LinkerdSecurityAnalyzer();
        } else {
          meshType = 'Unknown (defaulting to Istio checks)';
          analyzer = new IstioSecurityAnalyzer();
        }
      }

      analyzer.analyze(configData);

      const findings = enrich(
        analyzer.getEnrichedFindings().map((finding) => {
          if (finding.location && !finding.location.includes('line ')) {
            const lineNumber = findLineNumbersForPath(content, finding.location);
            if (lineNumber) finding.location = `line ${lineNumber}`;
          }
          return finding;
        }),
        meshType
      );

      res.json({ success: true, meshType, findings, summary: summarize(findings) });
    } catch (error) {
      console.error('Analysis error:', error);
      res.status(500).json({ success: false, message: 'An error occurred during analysis' });
    }
  });

  return router;
}

module.exports = { createAnalyzeRoutes };
