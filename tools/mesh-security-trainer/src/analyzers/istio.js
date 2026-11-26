const { BaseSecurityAnalyzer } = require('./base');

class IstioSecurityAnalyzer extends BaseSecurityAnalyzer {
  constructor() {
    super();
  }

  analyze(config) {
    this.reset();
    
    // Analyze overall structure
    if (!config) {
      this.addFinding({
        id: 'istio.invalid-empty-configuration-file',
        severity: 'Critical',
        category: 'File Format',
        issue: 'Invalid or empty configuration file',
        impact: 'Cannot perform security analysis on invalid configuration',
        requirement: 'Valid Istio MeshConfig required for analysis',
        remediation: 'Provide a valid Istio MeshConfig YAML or JSON file',
        nistDocument: 'Configuration Error'
      });
      return this.findings;
    }
    
    // Check if it's a valid Istio resource
    if (!config.kind || !config.apiVersion) {
      this.addFinding({
        id: 'istio.file-not-valid-kubernetes-resource',
        severity: 'Critical',
        category: 'Resource Type',
        issue: 'File is not a valid Kubernetes resource',
        impact: 'Invalid configuration cannot be analyzed for security compliance',
        requirement: 'Kubernetes resource specifications require apiVersion and kind fields',
        remediation: 'Add apiVersion and kind fields to the configuration',
        nistDocument: 'Configuration Error'
      });
      return this.findings;
    }
    
    // Check MeshConfig type
    if (config.kind !== 'MeshConfig') {
      this.addFinding({
        id: 'istio.expected-meshconfig-but-found',
        severity: 'Critical',
        category: 'Resource Type',
        issue: `Expected MeshConfig but found ${config.kind}`,
        impact: 'Cannot analyze non-MeshConfig resources for mesh security compliance',
        requirement: 'Istio MeshConfig is required for service mesh security analysis',
        remediation: 'Use a valid Istio MeshConfig resource',
        nistDocument: 'Configuration Error'
      });
      return this.findings;
    }

    // Run security checks
    this.checkMTLS(config);
    this.checkRootCertificates(config);
    this.checkPeerAuthentication(config);
    this.checkProxyConfig(config);
    this.checkSDS(config);
    this.checkTrustDomain(config);
    this.checkAuthorizationPolicies(config);
    this.checkTelemetry(config);
    this.checkRBAC(config);
    this.checkOutboundTrafficPolicy(config);
    
    // 2024-specific enhanced checks
    this.checkNIST800_233Compliance(config);
    this.checkProxyImageVulnerabilities(config);
    this.checkPolicyEnforcement(config);
    this.checkDNSConfiguration(config);
    this.checkResourceLimits(config);
    this.checkEncryptionAlgorithms(config);
    this.checkServiceDiscovery(config);
    this.checkExtensionProviders(config);
    
    return this.findings;
  }

  checkMTLS(config) {
    // Check if mTLS is enabled
    if (!config.meshMTLS || !config.meshMTLS.enabled) {
      this.addFinding({
        id: 'istio.mesh-wide-mtls-not-enabled',
        severity: 'High',
        category: 'mTLS',
        issue: 'Mesh-wide mTLS is not enabled',
        impact: 'Without mTLS, traffic between services can be intercepted, modified, or impersonated, violating zero trust principles and exposing sensitive data.',
        requirement: 'Section 4.1 requires: "All service-to-service communications within the mesh MUST be protected using mutual TLS authentication to ensure both confidentiality and integrity of data in transit."',
        remediation: 'Enable mTLS by setting meshMTLS.enabled: true in the mesh configuration',
        nistDocument: 'NIST SP 800-204B',
        section: 'Section 4.1',
        location: 'meshMTLS.enabled',
        nistControls: ['SC-8', 'SC-8(1)', 'SC-13', 'SC-23', 'IA-2', 'IA-3', 'AC-17(2)']
      });
    }
    
    // Check mTLS mode (STRICT is required by NIST)
    if (config.meshMTLS && config.meshMTLS.mode !== 'STRICT') {
      this.addFinding({
        id: 'istio.mtls-mode-instead-strict',
        severity: 'Medium',
        category: 'mTLS',
        issue: `mTLS mode is set to ${config.meshMTLS.mode || 'PERMISSIVE'} instead of STRICT`,
        impact: 'Permissive mode allows both encrypted and unencrypted traffic, creating security gaps exploitable for man-in-the-middle attacks.',
        requirement: 'Section 5.2.1 states: "Permissive mode should only be used during transition periods. Production deployments MUST enforce STRICT mTLS mode."',
        remediation: 'Set meshMTLS.mode: "STRICT" to enforce encryption for all service communications',
        nistDocument: 'NIST SP 800-204A',
        section: 'Section 5.2.1',
        location: 'meshMTLS.mode',
        nistControls: ['SC-8', 'SC-8(1)', 'CM-6', 'AC-3', 'AC-4']
      });
    }
  }

  checkRootCertificates(config) {
    const ca = config.ca || {};
    
    if (!ca.provider || ca.provider === 'istiod') {
      this.addFinding({
        id: 'istio.using-default-istiod-ca-instead',
        severity: 'Medium',
        category: 'Certificate Authority',
        issue: 'Using default istiod CA instead of production-grade CA',
        impact: 'Default istiod CA lacks HSMs, formal certificate lifecycle management, and audit capabilities required for FedRAMP compliance.',
        requirement: 'Part 1 Rev 5 Section 6.1 states: "Cryptographic keys shall be protected throughout their entire lifecycle using appropriate security controls including HSMs for high-value keys."',
        remediation: 'Configure an external CA provider with HSM backing (e.g., HashiCorp Vault, AWS ACM-PCA, or enterprise PKI)',
        nistDocument: 'NIST SP 800-57',
        section: 'Part 1 Rev 5 Section 6.1',
        location: 'ca.provider',
        nistControls: ['SC-12', 'SC-12(1)', 'SC-13', 'IA-5', 'IA-5(1)', 'AU-10']
      });
    }
    
    if (!ca.certValidityDuration) {
      this.addFinding({
        id: 'istio.certificate-validity-duration-not-specified',
        severity: 'Low',
        category: 'Certificate Validity',
        issue: 'Certificate validity duration not specified',
        impact: 'Unspecified certificate lifetimes may result in defaults that are too long (security risk) or too short (operational disruption).',
        requirement: 'Part 1 Section 5.3 requires: "Cryptoperiods shall be established for each key based on risk factors and operational requirements."',
        remediation: 'Set ca.certValidityDuration to an appropriate value (e.g., "2160h" for 90 days)',
        nistDocument: 'NIST SP 800-57',
        section: 'Part 1 Section 5.3',
        location: 'ca.certValidityDuration'
      });
    } else if (parseInt(ca.certValidityDuration) > 8760) { // More than a year
      this.addFinding({
        id: 'istio.certificate-validity-period-exceeds-one',
        severity: 'Low',
        category: 'Certificate Validity',
        issue: 'Certificate validity period exceeds one year',
        impact: 'Long-lived certificates increase the window of opportunity for compromised keys to be exploited.',
        requirement: 'Section 4.2 states: "Service mesh certificates should be rotated frequently, with validity periods not exceeding 90 days in high-security environments."',
        remediation: 'Reduce ca.certValidityDuration to 90 days ("2160h") or less for production environments',
        nistDocument: 'NIST SP 800-204B',
        section: 'Section 4.2',
        location: 'ca.certValidityDuration'
      });
    }
  }

  checkPeerAuthentication(config) {
    if (!config.peerAuthentication || !config.peerAuthentication.mode) {
      this.addFinding({
        id: 'istio.no-default-peer-authentication-policy',
        severity: 'High',
        category: 'Authentication',
        issue: 'No default peer authentication policy defined',
        impact: 'Without a default peer authentication policy, services may not properly authenticate each other, allowing potential impersonation attacks and unauthorized access to sensitive information.',
        requirement: 'Section 5.1 states: "A service mesh should enforce authentication of peer microservices to ensure that only legitimate services are communicating within the mesh."',
        remediation: 'Define a default peer authentication policy with STRICT mTLS mode',
        nistDocument: 'NIST SP 800-204A',
        section: 'Section 5.1 - Peer Authentication Requirements',
        location: 'peerAuthentication'
      });
    } else if (config.peerAuthentication.mode !== 'STRICT') {
      this.addFinding({
        id: 'istio.peer-authentication-mode-instead-strict',
        severity: 'Medium',
        category: 'Authentication',
        issue: `Peer authentication mode is set to ${config.peerAuthentication.mode} instead of STRICT`,
        impact: 'Permissive mode allows both authenticated and unauthenticated traffic, creating security gaps and inconsistent policy enforcement across the mesh.',
        requirement: 'Section 5.1.2 requires: "All network communication should require mutually authenticated TLS. Non-strict modes allow for unauthenticated traffic."',
        remediation: 'Set peerAuthentication.mode: "STRICT" to ensure all traffic is authenticated',
        nistDocument: 'NIST SP 800-204A',
        section: 'Section 5.1.2 - Authentication Modes',
        location: 'peerAuthentication.mode'
      });
    }
  }

  checkProxyConfig(config) {
    const proxyConfig = config.defaultConfig || {};
    
    // Check privileged mode
    if (proxyConfig.privileged === true) {
      this.addFinding({
        id: 'istio.proxies-running-privileged-mode',
        severity: 'High',
        category: 'Proxy Configuration',
        issue: 'Proxies are running in privileged mode',
        impact: 'Running proxies in privileged mode grants unnecessary system access, violating zero trust principles and increasing attack surface.',
        requirement: 'Section 6.2 states: "Service mesh components should operate with minimal privileges following the principle of least privilege."',
        remediation: 'Set defaultConfig.privileged: false to follow least privilege principle',
        nistDocument: 'NIST SP 800-204A',
        section: 'Section 6.2 - Least Privilege',
        location: 'defaultConfig.privileged',
        nistControls: ['AC-6', 'AC-6(5)', 'CM-7', 'CM-7(1)']
      });
    }
    
    // Check proxy image version (placeholder - would need to be updated with version logic)
    if (proxyConfig.image && proxyConfig.image.includes(':')) {
      const version = proxyConfig.image.split(':')[1];
      if (version === 'latest' || version === 'master') {
        this.addFinding({
        id: 'istio.using-non-specific-proxy-image',
        severity: 'Medium',
          category: 'Proxy Configuration',
          issue: `Using non-specific proxy image version: ${version}`,
          impact: 'Using latest or master tags can lead to unexpected behavior when images are updated, potentially introducing vulnerabilities.',
          requirement: 'Section 4.4.2 requires: "Organizations should ensure that they use the specific version of the image that they have approved for production use."',
          remediation: 'Use specific, pinned versions of proxy images (e.g., proxyv2:1.18.2)',
          nistDocument: 'NIST SP 800-190',
          section: 'Section 4.4.2 - Image Version Control',
          location: 'defaultConfig.image',
          nistControls: ['CM-2', 'CM-3', 'CM-7(5)', 'SA-10']
        });
      }
    }
    
    // Check if holdApplicationUntilProxyStarts is set
    if (proxyConfig.holdApplicationUntilProxyStarts !== true) {
      this.addFinding({
        id: 'istio.applications-start-before-proxy-initialization',
        severity: 'Medium',
        category: 'Proxy Configuration',
        issue: 'Applications may start before proxy initialization is complete',
        impact: 'When applications start before the proxy is ready, traffic can bypass mesh controls, creating a potential security gap and data leak.',
        requirement: 'Section 5.3 requires: "All traffic must be intercepted by the proxy. Applications must not be allowed to send traffic before the proxy is ready."',
        remediation: 'Set defaultConfig.holdApplicationUntilProxyStarts: true to prevent traffic leaks',
        nistDocument: 'NIST SP 800-204B',
        section: 'Section 5.3 - Traffic Interception',
        location: 'defaultConfig.holdApplicationUntilProxyStarts',
        nistControls: ['CM-7', 'SC-7', 'AC-4', 'SC-8']
      });
    }
  }

  checkSDS(config) {
    // Check if SDS is being used
    const proxyConfig = config.defaultConfig || {};
    
    if (!proxyConfig.sds || !proxyConfig.sds.enabled) {
      this.addFinding({
        id: 'istio.sds-not-enabled-certificate-management',
        severity: 'Medium',
        category: 'Secret Discovery Service',
        issue: 'SDS is not enabled for certificate management',
        impact: 'Without SDS, certificate handling is less secure and requires manual management, increasing risk of key exposure.',
        requirement: 'Part 1 Section 7.2 requires: "Cryptographic materials should be securely provisioned and rotated using automated mechanisms."',
        remediation: 'Enable SDS by setting defaultConfig.sds.enabled: true',
        nistDocument: 'NIST SP 800-57',
        section: 'Part 1 Section 7.2 - Key Distribution',
        location: 'defaultConfig.sds.enabled',
        nistControls: ['SC-12', 'IA-5', 'SC-8', 'SC-13']
      });
    }
  }

  checkTrustDomain(config) {
    if (!config.trustDomain) {
      this.addFinding({
        id: 'istio.trust-domain-not-explicitly-configured',
        severity: 'Medium',
        category: 'Trust Domain',
        issue: 'Trust domain not explicitly configured',
        impact: 'Without an explicitly configured trust domain, services may not be properly isolated, potentially allowing identity spoofing across different security contexts.',
        requirement: 'Section 3.4 requires: "Service mesh implementations must establish trust boundaries. Service identities must be bound to specific security domains."',
        remediation: 'Set a specific trust domain for your mesh (e.g., trustDomain: "your-org.local")',
        nistDocument: 'NIST SP 800-204B',
        section: 'Section 3.4 - Trust Boundaries',
        location: 'trustDomain',
        nistControls: ['IA-2', 'IA-5', 'AC-3', 'SC-16']
      });
    } else if (config.trustDomain === 'cluster.local') {
      this.addFinding({
        id: 'istio.using-default-trust-domain-cluster',
        severity: 'Low',
        category: 'Trust Domain',
        issue: 'Using default trust domain (cluster.local)',
        impact: 'Using the default trust domain reduces the ability to uniquely identify and isolate your mesh, potentially allowing identity conflicts.',
        requirement: 'Section 3.4.2 recommends: "Organizations should use custom trust domains specific to their organization to prevent identity conflicts."',
        remediation: 'Set a custom trust domain specific to your organization (e.g., trustDomain: "your-org.local")',
        nistDocument: 'NIST SP 800-204B',
        section: 'Section 3.4.2 - Custom Trust Domains',
        location: 'trustDomain',
        nistControls: ['IA-2', 'IA-5', 'AC-16']
      });
    }
  }

  checkAuthorizationPolicies(config) {
    // Check for default deny policy (this is a higher-level concept, might not be in MeshConfig directly)
    if (!config.defaultAuthorizationPolicy || config.defaultAuthorizationPolicy.action !== 'DENY') {
      this.addFinding({
        id: 'istio.no-default-deny-policy-configured',
        severity: 'High',
        category: 'Authorization',
        issue: 'No default deny policy is configured at mesh level',
        impact: 'Without a default deny policy, services may have unintended access to each other, violating the principle of least privilege.',
        requirement: 'Section 6.1 states: "Authorization policies should follow a default-deny approach where all traffic is denied unless explicitly allowed."',
        remediation: 'Configure a default DENY policy and explicitly allow required traffic',
        nistDocument: 'NIST SP 800-204A',
        section: 'Section 6.1 - Default Deny',
        location: 'defaultAuthorizationPolicy',
        nistControls: ['AC-3', 'AC-4', 'AC-6', 'SC-7']
      });
    }
  }

  checkTelemetry(config) {
    const telemetry = config.telemetry || {};
    
    if (!telemetry.enabled) {
      this.addFinding({
        id: 'istio.telemetry-collection-disabled',
        severity: 'Medium',
        category: 'Telemetry',
        issue: 'Telemetry collection is disabled',
        impact: 'Without telemetry collection, security teams lack visibility into service behavior, traffic patterns, and potential security violations.',
        requirement: 'Section 7.1 states: "Telemetry data is essential for detecting anomalies and security incidents within service meshes."',
        remediation: 'Enable telemetry by setting telemetry.enabled: true',
        nistDocument: 'NIST SP 800-204B',
        section: 'Section 7.1 - Telemetry Requirements',
        location: 'telemetry.enabled',
        nistControls: ['AU-2', 'AU-12', 'SI-4', 'IR-4', 'IR-5']
      });
    }
    
    if (!telemetry.accessLogging || !telemetry.accessLogging.enabled) {
      this.addFinding({
        id: 'istio.access-logging-not-enabled',
        severity: 'Medium',
        category: 'Access Logging',
        issue: 'Access logging is not enabled',
        impact: 'Without access logging, organizations cannot perform effective security analysis, forensic investigations, or demonstrate compliance.',
        requirement: 'Section 7.2 requires: "Detailed logs must be captured for all service interactions including source, destination, request paths, and response codes."',
        remediation: 'Enable access logging by setting telemetry.accessLogging.enabled: true',
        nistDocument: 'NIST SP 800-204A',
        section: 'Section 7.2 - Access Logging',
        location: 'telemetry.accessLogging.enabled',
        nistControls: ['AU-3', 'AU-12', 'AU-14', 'SI-4']
      });
    }
  }

  checkRBAC(config) {
    if (!config.rbac || config.rbac.mode !== 'ON') {
      this.addFinding({
        id: 'istio.rbac-enforcement-not-enabled',
        severity: 'Critical',
        category: 'RBAC',
        issue: 'RBAC enforcement is not enabled',
        impact: 'Without RBAC, any authenticated service can access any other service in the mesh, violating the principle of least privilege.',
        requirement: 'Section 6.2 requires: "Authorization policies provide a more secure deployment by limiting which services can communicate with each other."',
        remediation: 'Enable RBAC by setting rbac.mode: "ON"',
        nistDocument: 'NIST SP 800-204B',
        section: 'Section 6.2 - Authorization Policies',
        location: 'rbac.mode',
        nistControls: ['AC-3', 'AC-4', 'CM-7']
      });
    }
  }

  checkOutboundTrafficPolicy(config) {
    const outboundTrafficPolicy = config.outboundTrafficPolicy || {};
    
    if (outboundTrafficPolicy.mode !== 'REGISTRY_ONLY') {
      this.addFinding({
        id: 'istio.outbound-traffic-external-services-allowed',
        severity: 'High',
        category: 'Traffic Policy',
        issue: 'Outbound traffic to external services is allowed by default',
        impact: 'Allowing unrestricted outbound access creates risk of data leakage and communication with malicious external services.',
        requirement: 'Section 5.4 states: "Outbound traffic should be restricted to explicitly registered external services to prevent data exfiltration."',
        remediation: 'Set outboundTrafficPolicy.mode: "REGISTRY_ONLY" to restrict external access',
        nistDocument: 'NIST SP 800-204A',
        section: 'Section 5.4 - Outbound Traffic Control',
        location: 'outboundTrafficPolicy.mode',
        nistControls: ['AC-4', 'SC-7', 'CM-7', 'CA-3']
      });
    }
  }
  
  // Enhanced 2024-specific security checks
  checkNIST800_233Compliance(config) {
    // NIST SP 800-233 (July 2024) - Service Mesh Proxy Configuration
    if (!config.defaultConfig || !config.defaultConfig.proxyMetadata) {
      this.addFinding({
        id: 'istio.proxy-metadata-configuration-missing',
        severity: 'Medium',
        category: 'Proxy Configuration',
        issue: 'Proxy metadata configuration is missing',
        impact: 'Without proper proxy metadata, the mesh cannot enforce identity-based policies or track service communications accurately.',
        requirement: 'Section 3.2 requires: "Service mesh proxies must be configured with appropriate metadata for identity and policy enforcement."',
        remediation: 'Configure defaultConfig.proxyMetadata with appropriate service identity and policy metadata',
        nistDocument: 'NIST SP 800-233',
        section: 'Section 3.2 - Proxy Configuration',
        location: 'defaultConfig.proxyMetadata',
        nistControls: ['IA-2', 'IA-4', 'AC-3']
      });
    }
    
    // Check for protocol detection timeout (new in 800-233)
    if (config.protocolDetectionTimeout === '0s' || config.protocolDetectionTimeout === 0) {
      this.addFinding({
        id: 'istio.protocol-detection-timeout-disabled',
        severity: 'Medium',
        category: 'Proxy Configuration',
        issue: 'Protocol detection timeout is disabled',
        impact: 'Disabled timeouts can lead to DoS attacks through resource exhaustion when malicious actors send ambiguous protocol data.',
        requirement: 'Section 4.3 states: "Automatic protocol detection must have reasonable timeouts to prevent resource exhaustion attacks."',
        remediation: 'Set protocolDetectionTimeout to a reasonable value like "30s"',
        nistDocument: 'NIST SP 800-233',
        section: 'Section 4.3 - Protocol Detection',
        location: 'protocolDetectionTimeout',
        nistControls: ['SC-5', 'SI-10', 'SI-11']
      });
    }
  }
  
  checkProxyImageVulnerabilities(config) {
    const proxyConfig = config.defaultConfig || {};
    
    // Check for latest/unpinned versions (CVE risk)
    if (proxyConfig.image && (proxyConfig.image.includes(':latest') || 
        proxyConfig.image.includes(':master') || 
        !proxyConfig.image.includes(':'))) {
      this.addFinding({
        id: 'istio.proxy-image-uses-unpinned-latest',
        severity: 'Medium',
        category: 'Image Security',
        issue: 'Proxy image uses unpinned or latest tag',
        impact: 'Using latest/master tags can inadvertently introduce vulnerabilities when images are updated without testing.',
        requirement: 'Section 4.4.2 requires: "Container images must use specific version tags, not latest or master tags."',
        remediation: 'Pin proxy image to specific version (e.g., proxyv2:1.19.3 or newer stable version)',
        nistDocument: 'NIST SP 800-190',
        section: 'Section 4.4.2 - Container Image Management',
        location: 'defaultConfig.image',
        nistControls: ['CM-2', 'CM-3', 'CM-4', 'SA-10']
      });
    }
    
    // Check for known vulnerable versions (example patterns)
    if (proxyConfig.image && proxyConfig.image.includes('proxyv2')) {
      const versionMatch = proxyConfig.image.match(/:(\d+)\.(\d+)\.(\d+)/);
      if (versionMatch) {
        const major = parseInt(versionMatch[1]);
        const minor = parseInt(versionMatch[2]);
        
        // Older Istio proxies ship older Envoy builds carrying known CVEs.
        if (major === 1 && minor < 18) {
          this.addFinding({
        id: 'istio.proxy-version-outdated-contain-known',
        severity: 'High',
            category: 'Image Security',
            issue: 'Proxy version is outdated and may contain known vulnerabilities',
            impact: 'Older Istio proxies bundle older Envoy builds affected by known CVEs (for example the Envoy OAuth2/HMAC and gRPC access-logger issues fixed in Envoy 1.26.4/1.27.0).',
            requirement: 'Section 3.2 requires: "Organizations must maintain current patch levels for all software components."',
            remediation: 'Upgrade to Istio proxy version 1.19.3 or newer',
            nistDocument: 'NIST SP 800-40 Rev 4',
            section: 'Section 3.2 - Patch Management',
            location: 'defaultConfig.image',
            nistControls: ['SI-2', 'SI-3', 'RA-5']
          });
        }
      }
    }
  }
  
  checkPolicyEnforcement(config) {
    // Check for fail-open behavior
    if (config.policyCheckFailOpen === true) {
      this.addFinding({
        id: 'istio.policy-check-configured-fail-open',
        severity: 'High',
        category: 'Authorization',
        issue: 'Policy check is configured to fail open',
        impact: 'Fail-open configuration allows traffic to pass without authorization when policy servers are down, creating security gaps.',
        requirement: 'Section 6.3 states: "Policy enforcement must fail closed to prevent unauthorized access when policy servers are unavailable."',
        remediation: 'Set policyCheckFailOpen: false to ensure fail-closed behavior',
        nistDocument: 'NIST SP 800-204B',
        section: 'Section 6.3 - Policy Enforcement',
        location: 'policyCheckFailOpen',
        nistControls: ['AC-3', 'AC-4', 'AC-24']
      });
    }
    
    // Check for auto mTLS
    if (config.enableAutoMtls === false) {
      this.addFinding({
        id: 'istio.automatic-mtls-disabled',
        severity: 'Medium',
        category: 'mTLS',
        issue: 'Automatic mTLS is disabled',
        impact: 'Manual mTLS configuration is error-prone and may result in services communicating without encryption.',
        requirement: 'Section 5.2.3 recommends: "Automatic mTLS simplifies configuration and reduces human error in TLS setup."',
        remediation: 'Enable automatic mTLS by setting enableAutoMtls: true',
        nistDocument: 'NIST SP 800-204A',
        section: 'Section 5.2.3 - Automatic mTLS',
        location: 'enableAutoMtls',
        nistControls: ['SC-8', 'SC-13', 'CM-2']
      });
    }
  }
  
  checkDNSConfiguration(config) {
    const proxyMetadata = config.defaultConfig?.proxyMetadata || {};
    
    // Check DNS capture settings
    if (proxyMetadata.DNS_CAPTURE === 'false' || 
        proxyMetadata.ISTIO_META_DNS_CAPTURE === 'false') {
      this.addFinding({
        id: 'istio.dns-capture-disabled-proxy-configuration',
        severity: 'Medium',
        category: 'Traffic Security',
        issue: 'DNS capture is disabled in proxy configuration',
        impact: 'Disabled DNS capture allows services to bypass mesh DNS policies and potentially communicate with malicious domains.',
        requirement: 'Section 4.3 states: "DNS queries must be monitored and controlled to prevent DNS-based attacks and data exfiltration."',
        remediation: 'Enable DNS capture in proxyMetadata settings',
        nistDocument: 'NIST SP 800-81 Rev 3',
        section: 'Section 4.3 - DNS Security',
        location: 'defaultConfig.proxyMetadata.DNS_CAPTURE',
        nistControls: ['SC-20', 'SC-21', 'SC-22']
      });
    }
    
    // Check DNS refresh rate
    if (config.dnsRefreshRate && parseInt(config.dnsRefreshRate) > 300) {
      this.addFinding({
        id: 'istio.dns-refresh-rate-long',
        severity: 'Low',
        category: 'Traffic Security',
        issue: 'DNS refresh rate is too long',
        impact: 'Long DNS refresh rates can lead to services using outdated DNS information, potentially routing to compromised endpoints.',
        requirement: 'Section 7.2 recommends: "DNS cache entries should be refreshed frequently to prevent stale DNS attacks."',
        remediation: 'Set dnsRefreshRate to 60s or less for production environments',
        nistDocument: 'NIST SP 800-81 Rev 3',
        section: 'Section 7.2 - DNS Cache Management',
        location: 'dnsRefreshRate',
        nistControls: ['SC-20', 'SC-21']
      });
    }
  }
  
  checkResourceLimits(config) {
    const proxyConfig = config.defaultConfig || {};
    
    // Check for missing resource limits
    if (!proxyConfig.resources || 
        !proxyConfig.resources.limits || 
        (!proxyConfig.resources.limits.cpu && !proxyConfig.resources.limits.memory)) {
      this.addFinding({
        id: 'istio.proxy-containers-lack-resource-limits',
        severity: 'Medium',
        category: 'Resource Management',
        issue: 'Proxy containers lack resource limits',
        impact: 'Without resource limits, a compromised or misbehaving proxy can consume all available resources, causing DoS.',
        requirement: 'Section 4.2.3 requires: "Container resource limits must be set to prevent resource exhaustion attacks."',
        remediation: 'Set CPU and memory limits in defaultConfig.resources.limits',
        nistDocument: 'NIST SP 800-190',
        section: 'Section 4.2.3 - Resource Management',
        location: 'defaultConfig.resources',
        nistControls: ['SC-5', 'SC-6', 'SI-10']
      });
    }
    
    // Check concurrency settings
    if (proxyConfig.concurrency === 0 || !proxyConfig.concurrency) {
      this.addFinding({
        id: 'istio.proxy-concurrency-not-limited',
        severity: 'Medium',
        category: 'Resource Management',
        issue: 'Proxy concurrency is not limited',
        impact: 'Unlimited concurrency can lead to resource exhaustion under load or during attacks.',
        requirement: 'Section 5.2 states: "Proxy worker threads should be limited based on available resources to prevent resource exhaustion."',
        remediation: 'Set defaultConfig.concurrency to an appropriate value (e.g., 2 for standard workloads)',
        nistDocument: 'NIST SP 800-233',
        section: 'Section 5.2 - Concurrency Control',
        location: 'defaultConfig.concurrency',
        nistControls: ['SC-5', 'SI-10']
      });
    }
  }
  
  checkEncryptionAlgorithms(config) {
    // Check for weak TLS configuration in extension providers
    const extensionProviders = config.extensionProviders || [];
    
    extensionProviders.forEach((provider, index) => {
      if (provider.envoyOAuthProvider && provider.envoyOAuthProvider.port === 80) {
        this.addFinding({
        id: 'istio.oauth-provider-uses-unencrypted-http',
        severity: 'High',
          category: 'TLS Security',
          issue: `OAuth provider "${provider.name}" uses unencrypted HTTP`,
          impact: 'Using HTTP for OAuth exposes authentication tokens and credentials to interception.',
          requirement: 'Section 3.1 requires: "All authentication traffic must be encrypted using TLS 1.2 or higher."',
          remediation: `Configure OAuth provider to use HTTPS (port 443) with TLS 1.2+`,
          nistDocument: 'NIST SP 800-52 Rev 2',
          section: 'Section 3.1 - TLS Requirements',
          location: `extensionProviders[${index}].port`,
          nistControls: ['SC-8', 'SC-13', 'IA-2']
        });
      }
      
      if (provider.zipkin && provider.zipkin.port && !provider.zipkin.useSSL) {
        this.addFinding({
        id: 'istio.tracing-provider-sends-traces-unencrypted',
        severity: 'Medium',
          category: 'Encryption',
          issue: `Tracing provider "${provider.name}" sends traces unencrypted`,
          impact: 'Unencrypted traces can leak sensitive application data, request paths, and user information.',
          requirement: 'Section 7.3 states: "Telemetry data may contain sensitive information and must be encrypted in transit."',
          remediation: `Enable SSL for tracing provider or use port 443 with TLS`,
          nistDocument: 'NIST SP 800-204B',
          section: 'Section 7.3 - Telemetry Security',
          location: `extensionProviders[${index}].useSSL`,
          nistControls: ['SC-8', 'AU-9', 'AU-10']
        });
      }
    });
  }
  
  checkServiceDiscovery(config) {
    // Check locality load balancing configuration
    const localityLbSetting = config.localityLbSetting || {};
    
    if (localityLbSetting.enabled && (!localityLbSetting.failover || 
        localityLbSetting.failover.length === 0)) {
      this.addFinding({
        id: 'istio.locality-load-balancing-lacks-failover',
        severity: 'Low',
        category: 'Traffic Policy',
        issue: 'Locality load balancing lacks failover configuration',
        impact: 'Without failover configuration, services may become unavailable during zone or region failures.',
        requirement: 'Section 6.2 requires: "Service discovery must include failover mechanisms for high availability."',
        remediation: 'Configure localityLbSetting.failover with appropriate failover priorities',
        nistDocument: 'NIST SP 800-233',
        section: 'Section 6.2 - High Availability',
        location: 'localityLbSetting.failover',
        nistControls: ['CP-10', 'SC-36', 'SI-13']
      });
    }
    
    // Check endpoint slices configuration
    if (config.enableEndpointSlices === false) {
      this.addFinding({
        id: 'istio.endpoint-slices-disabled',
        severity: 'Low',
        category: 'Configuration Management',
        issue: 'Endpoint slices are disabled',
        impact: 'Disabled endpoint slices can cause performance issues in large clusters and increase API server load.',
        requirement: 'Section 6.3 recommends: "Use endpoint slices for improved scalability and reduced API server load."',
        remediation: 'Enable endpoint slices for better performance',
        nistDocument: 'NIST SP 800-233',
        section: 'Section 6.3 - Scalability',
        location: 'enableEndpointSlices',
        nistControls: ['SC-5', 'SC-6']
      });
    }
  }
  
  checkExtensionProviders(config) {
    const providers = config.extensionProviders || [];
    const defaultProviders = config.defaultProviders || {};
    
    // Check if metrics providers are configured
    if (!defaultProviders.metrics || defaultProviders.metrics.length === 0) {
      this.addFinding({
        id: 'istio.no-metrics-provider-configured',
        severity: 'Medium',
        category: 'Monitoring',
        issue: 'No metrics provider configured',
        impact: 'Without metrics collection, organizations cannot detect performance degradation, attacks, or compliance violations.',
        requirement: 'Section 3.2.1 requires: "Continuous monitoring capabilities must be implemented for all critical infrastructure."',
        remediation: 'Configure a metrics provider (e.g., Prometheus) in defaultProviders.metrics',
        nistDocument: 'NIST SP 800-137',
        section: 'Section 3.2.1 - Continuous Monitoring',
        location: 'defaultProviders.metrics',
        nistControls: ['AU-12', 'SI-4', 'CA-7']
      });
    }
    
    // Check access log configuration
    if (!config.accessLogFile || config.accessLogFile === '') {
      this.addFinding({
        id: 'istio.access-logging-not-configured',
        severity: 'Medium',
        category: 'Access Logging',
        issue: 'Access logging is not configured',
        impact: 'Without access logs, security incidents cannot be investigated and compliance cannot be demonstrated.',
        requirement: 'Section 3.1 states: "Organizations must log all security-relevant events including access attempts and authentication."',
        remediation: 'Set accessLogFile to a valid path (e.g., "/dev/stdout" or a file path)',
        nistDocument: 'NIST SP 800-92',
        section: 'Section 3.1 - Log Management',
        location: 'accessLogFile',
        nistControls: ['AU-2', 'AU-3', 'AU-12']
      });
    }
  }
}

module.exports = { IstioSecurityAnalyzer };
