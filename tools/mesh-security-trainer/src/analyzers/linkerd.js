const { BaseSecurityAnalyzer } = require('./base');

class LinkerdSecurityAnalyzer extends BaseSecurityAnalyzer {
  constructor() {
    super();
  }

  analyze(config) {
    this.reset();
    
    // Analyze overall structure
    if (!config) {
      this.addFinding({
        id: 'linkerd.invalid-empty-configuration-file',
        severity: 'Critical',
        category: 'File Format',
        issue: 'Invalid or empty configuration file',
        impact: 'Cannot perform security analysis on invalid configuration',
        requirement: 'Valid Linkerd configuration required for analysis',
        remediation: 'Provide a valid Linkerd configuration file',
        nistDocument: 'Configuration Error'
      });
      return this.findings;
    }
    
    // Check if it's a Linkerd configuration
    if (config.mesh_type !== 'linkerd') {
      this.addFinding({
        id: 'linkerd.file-not-linkerd-service-mesh',
        severity: 'Critical',
        category: 'Resource Type',
        issue: 'File is not a Linkerd service mesh configuration',
        impact: 'Cannot analyze non-Linkerd configurations for mesh security',
        requirement: 'Linkerd service mesh configuration required',
        remediation: 'Ensure the file is a valid Linkerd service mesh configuration',
        nistDocument: 'Configuration Error'
      });
      return this.findings;
    }
    
    // Run enhanced security checks for Linkerd
    this.checkTLS(config);
    this.checkIdentity(config);
    this.checkProxyConfig(config);
    this.checkPolicy(config);
    this.checkAuthenticationPolicy(config);
    this.checkTracing(config);
    this.checkMetrics(config);
    this.checkDestinationRules(config);
    
    // Add new 2024-specific checks
    this.checkProxyImagePinning(config);
    this.checkNIST800_233Compliance(config);
    
    return this.findings;
  }

  checkTLS(config) {
    // Check TLS settings
    const tls = config.tls || {};
    
    if (!tls.enabled) {
      this.addFinding({
        id: 'linkerd.tls-not-enabled-mesh',
        severity: 'Critical',
        category: 'TLS Security',
        issue: 'TLS is not enabled for the mesh',
        impact: 'Without TLS, traffic between services is transmitted in plaintext and may be intercepted or tampered with.',
        requirement: 'Section 4.1 requires: "All service-to-service communications must be encrypted using mutual TLS."',
        remediation: 'Set tls.enabled: true to enable TLS for service communications',
        nistDocument: 'NIST SP 800-204B',
        section: 'Section 4.1 - Transport Security',
        location: 'tls.enabled',
        nistControls: ['SC-8', 'SC-13', 'IA-5', 'SC-23']
      });
    }
    
    if (tls.enabled && !tls.enforced) {
      this.addFinding({
        id: 'linkerd.tls-enabled-but-not-enforced',
        severity: 'High',
        category: 'TLS Security',
        issue: 'TLS is enabled but not enforced (PERMISSIVE mode)',
        impact: 'Permissive mode allows unencrypted traffic to flow within the mesh, potentially exposing sensitive data.',
        requirement: 'Section 5.3 states: "TLS must be enforced for all communications, not merely enabled in permissive mode."',
        remediation: 'Set tls.enforced: true to enforce TLS for all traffic',
        nistDocument: 'NIST SP 800-204A',
        section: 'Section 5.3 - TLS Enforcement',
        location: 'tls.enforced',
        nistControls: ['SC-8', 'CM-6', 'CM-7']
      });
    }
    
    if (tls.cipherSuites) {
      const weakCiphers = tls.cipherSuites.filter(cipher => 
        cipher.includes('NULL') || 
        cipher.includes('EXPORT') || 
        cipher.includes('DES') || 
        cipher.includes('RC4') ||
        cipher.includes('MD5')
      );
      
      if (weakCiphers.length > 0) {
        this.addFinding({
        id: 'linkerd.weak-tls-cipher-suites-configured',
        severity: 'Critical',
          category: 'TLS Security',
          issue: 'Weak TLS cipher suites configured: ' + weakCiphers.join(', '),
          impact: 'These deprecated algorithms have known vulnerabilities and can be exploited to decrypt traffic.',
          requirement: 'Section 3.3 prohibits: "NULL, EXPORT, DES, RC4, and MD5 cipher suites must not be used."',
          remediation: 'Remove weak cipher suites and use only AEAD ciphers with forward secrecy',
          nistDocument: 'NIST SP 800-52 Rev 2',
          section: 'Section 3.3 - Cipher Suite Selection',
          location: 'tls.cipherSuites',
          nistControls: ['SC-8', 'SC-13', 'CM-6']
        });
      }
    }
    
    if (!tls.minimumVersion || tls.minimumVersion < 'TLSv1.2') {
      this.addFinding({
        id: 'linkerd.tls-minimum-version-below-tls',
        severity: 'High',
        category: 'TLS Security',
        issue: 'TLS minimum version is set below TLS 1.2',
        impact: 'Earlier versions of TLS have known vulnerabilities that cannot be mitigated through configuration.',
        requirement: 'Section 3.1 requires: "TLS 1.2 shall be configured as the minimum TLS version."',
        remediation: 'Set tls.minimumVersion to "TLSv1.2" or "TLSv1.3"',
        nistDocument: 'NIST SP 800-52 Rev 2',
        section: 'Section 3.1 - TLS Version Requirements',
        location: 'tls.minimumVersion',
        nistControls: ['SC-8', 'SC-13', 'CM-6']
      });
    }
  }

  checkIdentity(config) {
    const identity = config.identity || {};
    
    if (!identity.enabled) {
      this.addFinding({
        id: 'linkerd.service-identity-feature-not-enabled',
        severity: 'Critical',
        category: 'Service Identity',
        issue: 'Service identity feature is not enabled',
        impact: 'Without service identity, the mesh cannot authenticate services, allowing unauthorized connections.',
        requirement: 'Section 3.1 requires: "All services must have cryptographic identities for authentication."',
        remediation: 'Set identity.enabled: true to enable service identity',
        nistDocument: 'NIST SP 800-204B',
        section: 'Section 3.1 - Service Identity',
        location: 'identity.enabled',
        nistControls: ['IA-2', 'IA-5', 'SC-8']
      });
    }
    
    // Check certificate issuer settings
    if (identity.issuer === 'self-signed') {
      this.addFinding({
        id: 'linkerd.using-self-signed-certificates-service',
        severity: 'Medium',
        category: 'Certificate Authority',
        issue: 'Using self-signed certificates for service identity',
        impact: 'Self-signed certificates lack auditing, revocation, and governance required for production.',
        requirement: 'Part 1 Rev 5 Section 6.2 recommends: "Production systems should use enterprise PKI with proper governance."',
        remediation: 'Integrate with external CA like Vault PKI or cert-manager for production',
        nistDocument: 'NIST SP 800-57',
        section: 'Part 1 Rev 5 Section 6.2',
        location: 'identity.issuer',
        nistControls: ['SC-12', 'IA-5']
      });
    }
    
    if (identity.certValidityPeriod && identity.certValidityPeriod > 8760) { // More than a year in hours
      this.addFinding({
        id: 'linkerd.certificate-validity-period-exceeds-recommended',
        severity: 'Medium',
        category: 'Certificate Security',
        issue: 'Certificate validity period exceeds recommended duration',
        impact: 'Long-lived certificates increase exposure window if compromised.',
        requirement: 'Part 1 Rev 5 Section 5.3 states: "Operational certificates should have validity periods of 90 days or less."',
        remediation: 'Set certValidityPeriod to 2160h (90 days) or less',
        nistDocument: 'NIST SP 800-57',
        section: 'Part 1 Rev 5 Section 5.3',
        location: 'identity.certValidityPeriod',
        nistControls: ['IA-5', 'SC-12']
      });
    }
    
    if (!identity.trustAnchorsPEM || identity.trustAnchorsPEM.length === 0) {
      this.addFinding({
        id: 'linkerd.no-trust-anchors-configured-identity',
        severity: 'High',
        category: 'Trust Chain',
        issue: 'No trust anchors configured for identity system',
        impact: 'Without trust anchors, the system cannot verify service identities, allowing unauthorized services.',
        requirement: 'Part 1 Rev 5 Section 4.2.3 requires: "Trust anchors must be established for certificate validation."',
        remediation: 'Configure identity.trustAnchorsPEM with root CA certificates',
        nistDocument: 'NIST SP 800-57',
        section: 'Part 1 Rev 5 Section 4.2.3',
        location: 'identity.trustAnchorsPEM',
        nistControls: ['IA-5', 'SC-12']
      });
    }
  }

  checkProxyConfig(config) {
    const proxy = config.proxy || {};
    
    if (proxy.privileged === true) {
      this.addFinding({
        id: 'linkerd.proxies-configured-run-privileged-mode',
        severity: 'High',
        category: 'Proxy Security',
        issue: 'Proxies configured to run in privileged mode',
        impact: 'Privileged mode grants host-level access that could enable container escape.',
        requirement: 'Section 4.4.3 states: "Containers must run with minimum privileges and never in privileged mode."',
        remediation: 'Set proxy.privileged: false to enforce least privilege',
        nistDocument: 'NIST SP 800-190',
        section: 'Section 4.4.3 - Runtime Security',
        location: 'proxy.privileged',
        nistControls: ['CM-7', 'AC-3', 'AC-6']
      });
    }
    
    // Check proxy image version
    if (proxy.image) {
      const imageStr = typeof proxy.image === 'string' ? proxy.image : 
                      (proxy.image.name ? `${proxy.image.name}:${proxy.image.version || 'latest'}` : '');
      
      if (imageStr.includes(':latest') || (proxy.image.version === 'latest')) {
        this.addFinding({
        id: 'linkerd.using-latest-tag-proxy-image',
        severity: 'Medium',
          category: 'Image Security',
          issue: 'Using :latest tag for proxy image instead of specific version',
          impact: 'Latest tags can introduce untested changes or vulnerabilities without notice.',
          requirement: 'Section 4.4 requires: "Container images must use specific version tags for reproducibility and security."',
          remediation: 'Pin proxy.image to specific version like "stable-2.14.1"',
          nistDocument: 'NIST SP 800-190',
          section: 'Section 4.4 - Image Management',
          location: 'proxy.image',
          nistControls: ['CM-2', 'CM-6']
        });
      }
    }
    
    if (!proxy.outboundConnectTimeout) {
      this.addFinding({
        id: 'linkerd.no-outbound-connection-timeout-configured',
        severity: 'Low',
        category: 'Proxy Configuration',
        issue: 'No outbound connection timeout configured',
        impact: 'Without timeouts, failed connections can accumulate and exhaust resources.',
        requirement: 'Section 5.4 recommends: "Connection timeouts must be configured to prevent resource exhaustion."',
        remediation: 'Set proxy.outboundConnectTimeout to 10s or appropriate value',
        nistDocument: 'NIST SP 800-233',
        section: 'Section 5.4 - Timeout Configuration',
        location: 'proxy.outboundConnectTimeout',
        nistControls: ['SI-4', 'SC-5', 'SC-6']
      });
    }
    
    // Check resource limits
    if (!proxy.resources || !proxy.resources.cpu || !proxy.resources.memory) {
      this.addFinding({
        id: 'linkerd.resource-limits-not-configured-proxies',
        severity: 'Medium',
        category: 'Resource Management',
        issue: 'Resource limits not configured for proxies',
        impact: 'Without limits, proxies can consume unlimited resources causing cluster instability.',
        requirement: 'Section 5.2 requires: "All proxies must have defined resource limits to prevent DoS."',
        remediation: 'Configure proxy.resources.cpu and proxy.resources.memory limits',
        nistDocument: 'NIST SP 800-233',
        section: 'Section 5.2 - Resource Management',
        location: 'proxy.resources',
        nistControls: ['SC-6', 'CM-2', 'CM-6']
      });
    }
  }

  checkPolicy(config) {
    const policy = config.policy || {};
    
    if (!policy.enabled) {
      this.addFinding({
        id: 'linkerd.policy-enforcement-not-enabled',
        severity: 'High',
        category: 'Authorization',
        issue: 'Policy enforcement is not enabled',
        impact: 'Without policies, any authenticated service can access any other service.',
        requirement: 'Section 5.1 requires: "Authorization policies must be enforced for all service communications."',
        remediation: 'Set policy.enabled: true to enable authorization',
        nistDocument: 'NIST SP 800-204B',
        section: 'Section 5.1 - Authorization',
        location: 'policy.enabled',
        nistControls: ['AC-3', 'AC-4', 'CM-7']
      });
    }
    
    if (policy.enabled && !policy.defaultDeny) {
      this.addFinding({
        id: 'linkerd.default-allow-policy-violates-zero',
        severity: 'Medium',
        category: 'Authorization',
        issue: 'Default allow policy violates zero-trust principles',
        impact: 'Default allow permits all traffic unless denied, enabling lateral movement.',
        requirement: 'Section 7.1 states: "Zero trust requires explicit authorization for all access attempts."',
        remediation: 'Set policy.defaultDeny: true and explicitly allow required traffic',
        nistDocument: 'NIST SP 800-207',
        section: 'Section 7.1 - Zero Trust',
        location: 'policy.defaultDeny',
        nistControls: ['AC-3', 'CM-7', 'AC-4']
      });
    }
    
    if (policy.enabled && policy.serverPolicies && policy.serverPolicies.length === 0) {
      this.addFinding({
        id: 'linkerd.no-server-policies-defined-authorization',
        severity: 'Medium',
        category: 'Authorization',
        issue: 'No server policies defined for authorization',
        impact: 'Without policies, the authorization system cannot make access decisions.',
        requirement: 'Section 5.2 requires: "Specific authorization rules must be defined for each service."',
        remediation: 'Define server policies specifying allowed client access patterns',
        nistDocument: 'NIST SP 800-204B',
        section: 'Section 5.2 - Policy Definition',
        location: 'policy.serverPolicies',
        nistControls: ['AC-3', 'AC-4', 'AC-5', 'CM-7']
      });
    }
    
    // Check for policy consistency
    if (policy.enabled && policy.serverPolicies && policy.serverPolicies.length > 0) {
      // Check for overly permissive policies
      const permissivePolicies = policy.serverPolicies.filter(p => 
        p.clients && p.clients.some(c => !c.namespace || c.namespace === '*')
      );
      
      if (permissivePolicies.length > 0) {
        this.addFinding({
        id: 'linkerd.overly-permissive-policies-wildcard-selectors',
        severity: 'Medium',
          category: 'Authorization',
          issue: 'Overly permissive policies with wildcard selectors',
          impact: 'Wildcard selectors violate least privilege and enable unauthorized access.',
          requirement: 'Section 7.3 states: "Access policies must specify explicit principals, not wildcards."',
          remediation: 'Replace wildcard namespace selectors with explicit namespace lists',
          nistDocument: 'NIST SP 800-207',
          section: 'Section 7.3 - Policy Specificity',
          location: 'policy.serverPolicies[].clients[].namespace',
          nistControls: ['AC-3', 'AC-6', 'CM-7']
        });
      }
    }
  }

  checkAuthenticationPolicy(config) {
    const authn = config.authentication || {};
    
    if (!authn.enabled) {
      this.addFinding({
        id: 'linkerd.authentication-policy-enforcement-not-enabled',
        severity: 'Critical',
        category: 'Authentication',
        issue: 'Authentication policy enforcement is not enabled',
        impact: 'Without authentication, services cannot verify caller identity, allowing impersonation.',
        requirement: 'Section 4.1 requires: "All service communications must be authenticated using cryptographic identities."',
        remediation: 'Set authentication.enabled: true to enforce authentication',
        nistDocument: 'NIST SP 800-204A',
        section: 'Section 4.1 - Authentication',
        location: 'authentication.enabled',
        nistControls: ['IA-2', 'IA-5', 'SC-8']
      });
    }
    
    if (authn.enabled && authn.mode !== 'strict') {
      this.addFinding({
        id: 'linkerd.authentication-mode-not-strict',
        severity: 'High',
        category: 'Authentication',
        issue: 'Authentication mode not set to strict',
        impact: 'Non-strict modes allow unauthenticated traffic, creating security gaps.',
        requirement: 'Section 4.2 states: "Authentication must be strictly enforced without exceptions."',
        remediation: 'Set authentication.mode: "strict" to require authentication',
        nistDocument: 'NIST SP 800-204B',
        section: 'Section 4.2 - Strict Enforcement',
        location: 'authentication.mode',
        nistControls: ['IA-2', 'SC-8', 'CM-6']
      });
    }
  }

  checkTracing(config) {
    const tracing = config.tracing || {};
    
    if (!tracing.enabled) {
      this.addFinding({
        id: 'linkerd.distributed-tracing-not-enabled',
        severity: 'Medium',
        category: 'Observability',
        issue: 'Distributed tracing is not enabled',
        impact: 'Without tracing, incident investigation and attack detection capabilities are limited.',
        requirement: 'Section 3.3 requires: "Organizations must implement tracing for security monitoring and forensics."',
        remediation: 'Set tracing.enabled: true to enable distributed tracing',
        nistDocument: 'NIST SP 800-137',
        section: 'Section 3.3 - Monitoring Capabilities',
        location: 'tracing.enabled',
        nistControls: ['AU-2', 'AU-3', 'SI-4']
      });
    }
    
    if (tracing.enabled && !tracing.sampling) {
      this.addFinding({
        id: 'linkerd.tracing-sampling-rate-not-configured',
        severity: 'Low',
        category: 'Observability',
        issue: 'Tracing sampling rate not configured',
        impact: 'Default sampling may be too high (performance impact) or too low (insufficient visibility).',
        requirement: 'Section 3.4 recommends: "Sampling rates should balance visibility with performance impact."',
        remediation: 'Configure tracing.sampling between 1-10% for production',
        nistDocument: 'NIST SP 800-137',
        section: 'Section 3.4 - Sampling Strategy',
        location: 'tracing.sampling',
        nistControls: ['AU-2', 'CM-6', 'AU-12']
      });
    }
    
    // Check collector configuration
    if (tracing.enabled && (!tracing.collector || !tracing.collector.service)) {
      this.addFinding({
        id: 'linkerd.tracing-collector-service-not-configured',
        severity: 'Medium',
        category: 'Observability',
        issue: 'Tracing collector service not configured',
        impact: 'Without a collector, traces are lost, preventing incident investigation.',
        requirement: 'Section 3.5 requires: "Trace data must be collected and stored for analysis."',
        remediation: 'Configure tracing.collector.service with Jaeger or similar',
        nistDocument: 'NIST SP 800-137',
        section: 'Section 3.5 - Data Collection',
        location: 'tracing.collector.service',
        nistControls: ['AU-3', 'AU-12', 'SI-4']
      });
    }
  }

  checkMetrics(config) {
    const metrics = config.metrics || {};
    
    if (!metrics.enabled) {
      this.addFinding({
        id: 'linkerd.metrics-collection-not-enabled',
        severity: 'Medium',
        category: 'Observability',
        issue: 'Metrics collection is not enabled',
        impact: 'Without metrics, anomaly detection and security monitoring are severely limited.',
        requirement: 'Section 3.2.1 requires: "Continuous monitoring must include performance and security metrics."',
        remediation: 'Set metrics.enabled: true to enable metrics collection',
        nistDocument: 'NIST SP 800-137',
        section: 'Section 3.2.1 - Metrics Requirements',
        location: 'metrics.enabled',
        nistControls: ['SI-4', 'AU-2', 'AU-12']
      });
    }
    
    if (metrics.enabled && (!metrics.prometheus || !metrics.prometheus.enabled)) {
      this.addFinding({
        id: 'linkerd.prometheus-metrics-endpoint-not-enabled',
        severity: 'Low',
        category: 'Observability',
        issue: 'Prometheus metrics endpoint not enabled',
        impact: 'Without Prometheus endpoint, metrics cannot integrate with monitoring tools.',
        requirement: 'Section 3.6 recommends: "Use standard metrics formats for tool integration."',
        remediation: 'Set metrics.prometheus.enabled: true for Prometheus integration',
        nistDocument: 'NIST SP 800-137',
        section: 'Section 3.6 - Integration Standards',
        location: 'metrics.prometheus.enabled',
        nistControls: ['SI-4', 'AU-2', 'AU-6']
      });
    }
    
    // Check metrics retention
    if (metrics.enabled && (!metrics.retention || parseInt(metrics.retention) < 4)) {
      const retentionTime = metrics.retention ? metrics.retention : 'not configured';
      this.addFinding({
        id: 'linkerd.metrics-retention-period-insufficient-analysis',
        severity: 'Low',
        category: 'Observability',
        issue: `Metrics retention period (${retentionTime}) insufficient for analysis`,
        impact: 'Short retention limits incident investigation and trend analysis.',
        requirement: 'Section 3.7 requires: "Metrics must be retained for at least 30 days for forensic analysis."',
        remediation: 'Set metrics.retention to at least 720h (30 days)',
        nistDocument: 'NIST SP 800-137',
        section: 'Section 3.7 - Data Retention',
        location: 'metrics.retention',
        nistControls: ['AU-4', 'AU-11', 'SI-4']
      });
    }
  }

  checkDestinationRules(config) {
    const destinationRules = config.destinationRules || [];
    
    // Check for destination rules without TLS settings
    const rulesWithoutTLS = destinationRules.filter(rule => !rule.tls || !rule.tls.mode);
    if (rulesWithoutTLS.length > 0) {
      this.addFinding({
        id: 'linkerd.destination-rules-lack-tls-configuration',
        severity: 'Medium',
        category: 'Traffic Security',
        issue: `${rulesWithoutTLS.length} destination rules lack TLS configuration`,
        impact: 'Rules without TLS settings may allow unencrypted traffic.',
        requirement: 'Section 4.5 requires: "All traffic rules must specify TLS requirements explicitly."',
        remediation: 'Add TLS configuration to all destination rules',
        nistDocument: 'NIST SP 800-204B',
        section: 'Section 4.5 - Traffic Encryption',
        location: 'destinationRules[].tls',
        nistControls: ['SC-8', 'CM-6', 'SC-13']
      });
    }
    
    // Check for rules using plaintext mode
    const plaintextRules = destinationRules.filter(rule => rule.tls && rule.tls.mode === 'DISABLE');
    if (plaintextRules.length > 0) {
      this.addFinding({
        id: 'linkerd.destination-rules-explicitly-disable-tls',
        severity: 'High',
        category: 'Traffic Security',
        issue: `${plaintextRules.length} destination rules explicitly disable TLS`,
        impact: 'Disabled TLS allows interception and modification of traffic.',
        requirement: 'Section 4.1 prohibits: "Plaintext communication must not be allowed within the mesh."',
        remediation: 'Remove TLS disable settings from destination rules',
        nistDocument: 'NIST SP 800-204B',
        section: 'Section 4.1 - Mandatory Encryption',
        location: 'destinationRules[].tls.mode',
        nistControls: ['SC-8', 'SC-13', 'CM-7', 'SC-23']
      });
    }
    
    // Check for rules with system namespaces that should be protected
    const systemNamespaceRules = destinationRules.filter(rule => 
      rule.host && (
        rule.host.includes("kube-system") || 
        rule.host.includes("istio-system") || 
        rule.host.includes("linkerd-") || 
        rule.host.includes("consul-")
      ) && (!rule.tls || rule.tls.mode === 'DISABLE')
    );
    
    if (systemNamespaceRules.length > 0) {
      this.addFinding({
        id: 'linkerd.rules-disable-tls-system-namespaces',
        severity: 'Critical',
        category: 'System Security',
        issue: `${systemNamespaceRules.length} rules disable TLS for system namespaces`,
        impact: 'Unencrypted control plane traffic enables complete mesh compromise.',
        requirement: 'Section 6.1 mandates: "Control plane communications must always use mTLS without exceptions."',
        remediation: 'Enforce TLS for all system namespace communications',
        nistDocument: 'NIST SP 800-204C',
        section: 'Section 6.1 - Control Plane Security',
        location: 'destinationRules[].host',
        nistControls: ['SC-8', 'AC-3', 'SC-23', 'CM-7']
      });
    }
  }
  
  // Proxy image-pinning check.
  checkProxyImagePinning(config) {
    const proxy = config.proxy || {};

    // Unpinned / floating proxy image tags.
    if (proxy.image && proxy.image.version) {
      if (proxy.image.version === 'latest' || proxy.image.version === 'edge' ||
          !proxy.image.version.match(/^\d+\.\d+\.\d+$/)) {
        this.addFinding({
        id: 'linkerd.linkerd-proxy-using-unpinned-vulnerable',
        severity: 'High',
          category: 'Image Security',
          issue: 'Linkerd proxy using an unpinned image tag',
          impact: 'Floating tags like latest/edge can silently pull a proxy build affected by known CVEs (for example CVE-2024-40632, an SSRF-triggered denial of service on the proxy admin endpoint fixed in edge-24.6.2 / stable-2.14.10).',
          requirement: 'Section 4.4 requires: "Container images must use specific version tags to prevent inadvertent vulnerability introduction."',
          remediation: 'Pin proxy image to a specific stable version (e.g., stable-2.14.1 or newer)',
          nistDocument: 'NIST SP 800-190',
          section: 'Section 4.4 - Container Security',
          location: 'proxy.image.version',
          nistControls: ['CM-2', 'CM-3', 'SI-2', 'RA-5']
        });
      }
    }
    
    // Check for vulnerable proxy settings
    if (proxy.disableIdentity === true) {
      this.addFinding({
        id: 'linkerd.proxy-identity-verification-disabled',
        severity: 'Critical',
        category: 'Service Identity',
        issue: 'Proxy identity verification disabled',
        impact: 'Disabling identity verification removes authentication checks and allows unauthorized service access.',
        requirement: 'Section 3.2 states: "All service communications must be authenticated with verifiable identities."',
        remediation: 'Remove disableIdentity setting or set to false',
        nistDocument: 'NIST SP 800-204B',
        section: 'Section 3.2 - Service Identity',
        location: 'proxy.disableIdentity',
        nistControls: ['IA-2', 'IA-3', 'IA-4']
      });
    }
    
    // Check for debug endpoints
    if (proxy.disableTap === false) {
      this.addFinding({
        id: 'linkerd.tap-feature-enabled-production',
        severity: 'Medium',
        category: 'Proxy Security',
        issue: 'Tap feature enabled in production',
        impact: 'The tap feature allows traffic inspection which could expose sensitive data.',
        requirement: 'Section 7.4 warns: "Debug features must be disabled in production to prevent information disclosure."',
        remediation: 'Set proxy.disableTap: true for production deployments',
        nistDocument: 'NIST SP 800-204A',
        section: 'Section 7.4 - Debug Features',
        location: 'proxy.disableTap',
        nistControls: ['AC-4', 'SC-8', 'SI-11']
      });
    }
  }
  
  checkNIST800_233Compliance(config) {
    const proxy = config.proxy || {};
    const controlPlane = config.controlPlane || {};
    
    // NIST SP 800-233 (July 2024) - Service Mesh Proxy Models
    if (proxy.defaultInboundPolicy === 'all-unauthenticated') {
      this.addFinding({
        id: 'linkerd.default-inbound-policy-allows-unauthenticated',
        severity: 'Critical',
        category: 'Access Control',
        issue: 'Default inbound policy allows unauthenticated traffic',
        impact: 'Allowing unauthenticated traffic violates zero-trust principles and exposes services to unauthorized access.',
        requirement: 'Section 4.1 requires: "Service mesh proxies must enforce authentication by default."',
        remediation: 'Set proxy.defaultInboundPolicy to "all-authenticated" or "cluster-authenticated"',
        nistDocument: 'NIST SP 800-233',
        section: 'Section 4.1 - Default Security Posture',
        location: 'proxy.defaultInboundPolicy',
        nistControls: ['AC-3', 'AC-4', 'IA-2']
      });
    }
    
    // Check for resource limits per 800-233
    if (!proxy.resources || !proxy.resources.cpu || !proxy.resources.memory) {
      this.addFinding({
        id: 'linkerd.proxy-resource-limits-not-configured',
        severity: 'Medium',
        category: 'Resource Management',
        issue: 'Proxy resource limits not configured',
        impact: 'Without resource limits, proxies can consume unlimited resources leading to cluster instability.',
        requirement: 'Section 5.2 states: "Resource limits must be enforced to prevent denial of service."',
        remediation: 'Configure proxy.resources.cpu and proxy.resources.memory limits',
        nistDocument: 'NIST SP 800-233',
        section: 'Section 5.2 - Resource Management',
        location: 'proxy.resources',
        nistControls: ['SC-5', 'SC-6', 'SI-10']
      });
    }
    
    // Check control plane configuration
    if (controlPlane.enablePprof === true) {
      this.addFinding({
        id: 'linkerd.profiling-endpoints-enabled-on-control',
        severity: 'Medium',
        category: 'System Security',
        issue: 'Profiling endpoints enabled on control plane',
        impact: 'Pprof endpoints can expose sensitive performance data and create DoS vectors.',
        requirement: 'Section 6.1 warns: "Debug and profiling endpoints must be disabled in production."',
        remediation: 'Set controlPlane.enablePprof: false',
        nistDocument: 'NIST SP 800-233',
        section: 'Section 6.1 - Control Plane Security',
        location: 'controlPlane.enablePprof',
        nistControls: ['AC-4', 'SI-11', 'SC-5']
      });
    }
    
    // Check cluster networks configuration
    if (controlPlane.clusterNetworks === '0.0.0.0/0') {
      this.addFinding({
        id: 'linkerd.cluster-networks-unrestricted',
        severity: 'High',
        category: 'Access Control',
        issue: 'Cluster networks unrestricted',
        impact: 'Allowing all networks (0.0.0.0/0) removes network-based security boundaries.',
        requirement: 'Section 4.3 requires: "Service mesh must restrict cluster network ranges to actual cluster CIDRs."',
        remediation: 'Configure controlPlane.clusterNetworks with specific cluster CIDR ranges',
        nistDocument: 'NIST SP 800-233',
        section: 'Section 4.3 - Network Segmentation',
        location: 'controlPlane.clusterNetworks',
        nistControls: ['SC-7', 'AC-4', 'SC-32']
      });
    }
    
    // Check for high availability configuration
    if (config.highAvailability === false) {
      this.addFinding({
        id: 'linkerd.high-availability-not-configured',
        severity: 'Low',
        category: 'Configuration Management',
        issue: 'High availability not configured',
        impact: 'Without HA configuration, control plane failures will cause mesh-wide outages.',
        requirement: 'Section 7.1 recommends: "Production deployments should implement high availability for resilience."',
        remediation: 'Enable highAvailability for production deployments',
        nistDocument: 'NIST SP 800-233',
        section: 'Section 7.1 - Resilience',
        location: 'highAvailability',
        nistControls: ['CP-10', 'SC-36', 'SI-13']
      });
    }
  }
}

module.exports = { LinkerdSecurityAnalyzer };
