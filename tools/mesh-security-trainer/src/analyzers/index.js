const { BaseSecurityAnalyzer, SEVERITY_LEVELS, REQUIRED_FINDING_FIELDS, NIST_DOCUMENT_PATTERN } = require('./base');
const { IstioSecurityAnalyzer } = require('./istio');
const { ConsulSecurityAnalyzer } = require('./consul');
const { LinkerdSecurityAnalyzer } = require('./linkerd');

/** Analyzer for each supported mesh, keyed by the mesh id used across the app. */
const ANALYZERS = {
  istio: IstioSecurityAnalyzer,
  consul: ConsulSecurityAnalyzer,
  linkerd: LinkerdSecurityAnalyzer
};

module.exports = {
  ANALYZERS,
  BaseSecurityAnalyzer,
  IstioSecurityAnalyzer,
  ConsulSecurityAnalyzer,
  LinkerdSecurityAnalyzer,
  SEVERITY_LEVELS,
  REQUIRED_FINDING_FIELDS,
  NIST_DOCUMENT_PATTERN
};
