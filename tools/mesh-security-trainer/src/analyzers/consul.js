const { BaseSecurityAnalyzer } = require('./base');

class ConsulSecurityAnalyzer extends BaseSecurityAnalyzer {
  constructor() {
    super();
    // Flag to indicate whether we're evaluating for FedRAMP compliance
    this.fedRAMPMode = true;
  }

  analyze(config) {
    this.reset();
    
    // Analyze overall structure
    if (!config) {
      this.addFinding({
        id: 'consul.invalid-empty-configuration-file',
        severity: 'Critical',
        category: 'File Format',
        issue: 'Invalid or empty configuration file',
        impact: 'Cannot perform security analysis on invalid configuration',
        requirement: 'Valid Consul configuration required for analysis',
        remediation: 'Provide a valid Consul configuration file',
        nistDocument: 'Configuration Error'
      });
      return this.findings;
    }
    
    // Check if it's a Consul configuration
    if (config.mesh_type !== 'consul') {
      this.addFinding({
        id: 'consul.file-not-consul-service-mesh',
        severity: 'Critical',
        category: 'Resource Type',
        issue: 'File is not a Consul service mesh configuration',
        impact: 'Cannot analyze non-Consul configurations for mesh security',
        requirement: 'Consul service mesh configuration required',
        remediation: 'Ensure the file is a valid Consul service mesh configuration',
        nistDocument: 'Configuration Error'
      });
      return this.findings;
    }

    // Run security checks
    this.checkConnect(config);
    this.checkTLS(config);
    this.checkACL(config);
    this.checkTelemetry(config);
    this.checkAutoEncrypt(config);
    this.checkAutoConfig(config);
    this.checkGossipEncryption(config);
    
    // 2024 CVE-specific checks
    this.checkCVE2024Vulnerabilities(config);
    this.checkProxyConfiguration(config);
    this.checkRateLimiting(config);
    this.checkServiceDiscoverySettings(config);
    this.checkMeshGateway(config);
    
    if (this.fedRAMPMode) {
      this.checkFedRAMPCompliance(config);
    }
    
    return this.findings;
  }

  checkConnect(config) {
    const connect = config.connect || {};
    
    // Check if service mesh is enabled
    if (!connect.enabled) {
      this.addFinding({
        id: 'consul.consul-connect-service-mesh-not',
        severity: 'Critical',
        category: 'Service Mesh',
        issue: 'Consul Connect service mesh is not enabled',
        impact: 'Without Connect enabled, services communicate without encryption or authentication, allowing potential MITM attacks and unauthorized access.',
        requirement: 'Section 2.1 states: "Service mesh provides essential security controls including mutual TLS, service identity, and authorization policies."',
        remediation: 'Set connect.enabled: true to enable service mesh security features',
        nistDocument: 'NIST SP 800-204B',
        section: 'Section 2.1 - Service Mesh Security Controls',
        location: 'connect.enabled',
        nistControls: ['SC-8', 'SC-23', 'IA-2', 'AC-3']
      });
    }
    
    // Check proxy configuration
    const proxy = connect.proxy || {};
    if (proxy.allow_privileged === true) {
      this.addFinding({
        id: 'consul.proxies-allowed-run-privileged-mode',
        severity: 'High',
        category: 'Proxy Security',
        issue: 'Proxies allowed to run in privileged mode',
        impact: 'Privileged mode grants extensive host access, potentially allowing container escape and host compromise.',
        requirement: 'Section 4.4.3 requires: "Containers should run with the minimum privileges necessary and never run as root or with privileged access."',
        remediation: 'Set connect.proxy.allow_privileged: false to enforce least privilege',
        nistDocument: 'NIST SP 800-190',
        section: 'Section 4.4.3 - Container Runtime Security',
        location: 'connect.proxy.allow_privileged',
        nistControls: ['AC-6', 'CM-7', 'SC-39']
      });
    }
    
    // Check CA configuration
    const caConfig = connect.ca_config || {};
    
    if (connect.ca_provider === 'consul') {
      this.addFinding({
        id: 'consul.using-built-consul-ca-instead',
        severity: 'Medium',
        category: 'Certificate Authority',
        issue: 'Using built-in Consul CA instead of external CA',
        impact: 'Built-in CAs may lack advanced features like HSM support, comprehensive auditing, and compliance certifications required for production.',
        requirement: 'Part 1 Rev 5 Section 6.2 recommends: "Production environments should use enterprise-grade PKI systems with proper key management and auditing capabilities."',
        remediation: 'Consider integrating with Vault PKI, AWS Private CA, or other external CA providers',
        nistDocument: 'NIST SP 800-57',
        section: 'Part 1 Rev 5 Section 6.2 - PKI Systems',
        location: 'connect.ca_provider',
        nistControls: ['SC-12', 'SC-13', 'AU-10']
      });
    }
    
    // Check certificate TTL settings
    if (caConfig.root_cert_ttl && caConfig.root_cert_ttl.includes('h')) {
      const hours = parseInt(caConfig.root_cert_ttl);
      if (hours > 8760) { // More than a year in hours
        this.addFinding({
        id: 'consul.root-certificate-ttl-exceeds-recommended',
        severity: 'Medium',
          category: 'Certificate Security',
          issue: 'Root certificate TTL exceeds recommended duration',
          impact: 'Long-lived certificates increase the window of exposure if compromised and delay adoption of stronger cryptographic algorithms.',
          requirement: 'Part 1 Rev 5 Section 5.3 states: "Cryptoperiods should be limited to reduce the impact of key compromise. Root certificates should not exceed 10 years."',
          remediation: 'Reduce root_cert_ttl to 5 years (43800h) or less for better security',
          nistDocument: 'NIST SP 800-57',
          section: 'Part 1 Rev 5 Section 5.3 - Cryptoperiods',
          location: 'connect.ca_config.root_cert_ttl',
          nistControls: ['SC-12', 'IA-5']
        });
      }
    }
    
    if (!caConfig.leaf_cert_ttl) {
      this.addFinding({
        id: 'consul.leaf-certificate-ttl-not-explicitly',
        severity: 'Medium',
        category: 'Certificate Security',
        issue: 'Leaf certificate TTL not explicitly configured',
        impact: 'Without explicit configuration, default TTL values may be too long, increasing exposure window if certificates are compromised.',
        requirement: 'Part 1 Rev 5 Section 5.3 recommends: "End-entity certificates should have shorter validity periods than CA certificates, typically 1-2 years maximum."',
        remediation: 'Set leaf_cert_ttl to 72h-720h (3-30 days) for production environments',
        nistDocument: 'NIST SP 800-57',
        section: 'Part 1 Rev 5 Section 5.3 - Certificate Lifetimes',
        location: 'connect.ca_config.leaf_cert_ttl',
        nistControls: ['SC-12', 'IA-5']
      });
    }
  }

  checkTLS(config) {
    const tls = config.tls || {};
    const defaults = tls.defaults || {};
    const internalRpc = tls.internal_rpc || {};
    
    // Check incoming verification
    if (defaults.verify_incoming !== true) {
      this.addFinding({
        id: 'consul.tls-verify-incoming-not-enabled',
        severity: 'High',
        category: 'TLS Security',
        issue: 'TLS verify_incoming is not enabled',
        impact: 'Without incoming certificate verification, the system cannot verify the authenticity of client connections, potentially allowing unauthorized clients to establish connections and bypassing an essential security control.',
        requirement: 'NIST SP 800-52 Rev. 2 ("Guidelines for TLS Implementations") requires certificate validation, stating that "certificates presented to a relying party shall be validated to ensure that they are legitimate, and have not been revoked or compromised."',
        remediation: 'Enable tls.defaults.verify_incoming to validate client certificates',
        nistDocument: 'NIST SP 800-52 Rev 2',
        section: 'Section 3.2',
        location: 'tls.defaults.verify_incoming',
        nistControls: ['SC-8', 'SC-13', 'IA-2', 'IA-5'],
        nistGuidance: 'NIST SP 800-52 Rev. 2 ("Guidelines for TLS Implementations") emphasizes the importance of certificate validation. Without incoming certificate verification, the system cannot verify the authenticity of client connections, potentially allowing unauthorized clients to establish connections. NIST states that "certificates presented to a relying party shall be validated to ensure that they are legitimate, and have not been revoked or compromised." Disabling this setting bypasses this essential security control.'
      });
    }
    
    // Check outgoing verification
    if (defaults.verify_outgoing !== true) {
      this.addFinding({
        id: 'consul.tls-verify-outgoing-not-enabled',
        severity: 'High',
        category: 'TLS Security',
        issue: 'TLS verify_outgoing is not enabled',
        impact: 'Without outgoing certificate verification, clients cannot verify server identities, exposing the system to man-in-the-middle attacks, server impersonation, and credential theft.',
        requirement: 'NIST SP 800-52 Rev. 2 requires TLS clients to validate server certificates: "a client that receives a certificate shall validate the TLS server\'s certificate in accordance with the certification path validation rules specified in Section 6 of RFC 5280."',
        remediation: 'Enable tls.defaults.verify_outgoing to validate server certificates',
        nistDocument: 'NIST SP 800-52 Rev 2',
        section: 'Section 4.2',
        location: 'tls.defaults.verify_outgoing',
        nistControls: ['SC-8', 'SC-13', 'SC-23'],
        nistGuidance: 'NIST SP 800-52 Rev. 2 requires TLS implementations to validate server certificates. Without outgoing certificate verification, clients cannot verify server identities, making them vulnerable to man-in-the-middle attacks. According to NIST, "a client that receives a certificate shall validate the TLS server\'s certificate in accordance with the certification path validation rules specified in Section 6 of RFC 5280." Disabling outgoing verification exposes the system to potential impersonation and credential theft.'
      });
    }
    
    // Check hostname verification
    if (internalRpc.verify_server_hostname !== true) {
      this.addFinding({
        id: 'consul.server-hostname-verification-not-enabled',
        severity: 'High',
        category: 'TLS Security',
        issue: 'Server hostname verification is not enabled for internal RPC',
        impact: 'Without hostname verification, an attacker holding a valid certificate for one hostname could impersonate a server with a different hostname, enabling lateral movement within the mesh — especially damaging on internal RPC paths that carry privileged operations.',
        requirement: 'NIST SP 800-52 Rev. 2 requires hostname verification as part of certificate validation: "the client shall verify the server identity, as described in Section 6 of RFC 6125."',
        remediation: 'Enable tls.internal_rpc.verify_server_hostname to prevent MITM attacks',
        nistDocument: 'NIST SP 800-52 Rev 2',
        section: 'Section 4.2.1',
        location: 'tls.internal_rpc.verify_server_hostname',
        nistControls: ['SC-8', 'SC-23', 'IA-5'],
        nistGuidance: 'NIST SP 800-52 Rev. 2 specifically requires hostname verification as part of certificate validation. According to NIST, "the client shall verify the server identity, as described in Section 6 of RFC 6125." Without hostname verification, an attacker with a valid certificate for one hostname could impersonate a server with a different hostname, allowing for lateral movement within the service mesh. This is particularly critical for internal RPC communications, which often involve privileged operations.'
      });
    }
  }

  checkACL(config) {
    const acl = config.acl || {};
    
    // Check if ACL system is enabled
    if (acl.enabled !== true) {
      this.addFinding({
        id: 'consul.acl-system-not-enabled',
        severity: 'Critical',
        category: 'Access Control',
        issue: 'ACL system is not enabled',
        impact: 'With ACLs disabled there is no mechanism to restrict which entities can reach Consul resources and APIs, allowing unrestricted access to service registrations, the key-value store, and other sensitive cluster resources.',
        requirement: 'NIST SP 800-53 Rev. 5 (AC-3) requires that "the system enforces approved authorizations for logical access to information and system resources," and NIST SP 800-204B recommends implementing access control for all service mesh components.',
        remediation: 'Enable acl.enabled to control access to Consul resources',
        nistDocument: 'NIST SP 800-53 Rev 5',
        section: 'AC-3 - Access Enforcement',
        location: 'acl.enabled',
        nistControls: ['AC-3', 'AC-4', 'AC-17', 'CM-7'],
        nistGuidance: 'NIST SP 800-204B recommends implementing access control for all service mesh components. Without ACLs, there is no mechanism to restrict which entities can access Consul resources and APIs. NIST SP 800-53 Rev. 5 (AC-3) requires that "the system enforces approved authorizations for logical access to information and system resources." Disabled ACLs allow unrestricted access to service registrations, key-value store, and other sensitive resources within the Consul deployment.'
      });
    }
    
    // Check default policy
    if (acl.default_policy === 'allow') {
      this.addFinding({
        id: 'consul.acl-default-policy-allow',
        severity: 'High',
        category: 'Access Control',
        issue: 'ACL default policy is set to "allow"',
        impact: 'A default policy of "allow" permits all actions unless explicitly denied, contradicting least privilege and potentially granting unauthorized access to cluster resources.',
        requirement: 'NIST SP 800-53 Rev. 5 (CM-7) requires systems be configured for least functionality, "providing only essential capabilities," and NIST SP 800-204B advocates deny-by-default access control in line with zero trust principles.',
        remediation: 'Set acl.default_policy to "deny" and explicitly allow required operations',
        nistDocument: 'NIST SP 800-53 Rev 5',
        section: 'CM-7 - Least Functionality',
        location: 'acl.default_policy',
        nistControls: ['AC-3', 'CM-7', 'CM-6'],
        nistGuidance: 'NIST SP 800-204B advocates for deny-by-default access control policies in line with zero trust principles. According to NIST SP 800-53 Rev. 5 (CM-7), systems should be configured using least functionality, "providing only essential capabilities." A default policy of "allow" contradicts this principle by permitting all actions unless explicitly denied, potentially allowing unauthorized access and violating the principle of least privilege.'
      });
    }
    
    // Check for token configuration
    const tokens = acl.tokens || {};
    if (!tokens.agent || tokens.agent === '') {
      this.addFinding({
        id: 'consul.agent-token-not-configured',
        severity: 'High',
        category: 'Access Control',
        issue: 'Agent token is not configured',
        impact: 'Without a configured agent token, Consul agents may fall back to the anonymous token or other default credentials, reducing accountability and increasing the risk of unauthorized access to the cluster.',
        requirement: 'NIST SP 800-53 Rev. 5 (IA-5) requires organizations to "create, implement, and maintain specific procedures and configurations for organization-defined authenticators," and NIST SP 800-204A emphasizes properly configured service identity.',
        remediation: 'Set a specific agent token with appropriate permissions',
        nistDocument: 'NIST SP 800-53 Rev 5',
        section: 'IA-5 - Authenticator Management',
        location: 'acl.tokens.agent',
        nistControls: ['IA-2', 'IA-5', 'AC-3'],
        nistGuidance: 'NIST SP 800-204A emphasizes the importance of properly configured service identity. Per NIST SP 800-53 Rev. 5 (IA-5), systems must "create, implement, and maintain specific procedures and configurations for organization-defined authenticators." Without a configured agent token, Consul agents may use the anonymous token or other default credentials, reducing accountability and increasing the risk of unauthorized access to the Consul cluster.'
      });
    }
    
    if (!tokens.default || tokens.default === '') {
      this.addFinding({
        id: 'consul.default-token-not-configured',
        severity: 'Medium',
        category: 'Access Control',
        issue: 'Default token is not configured',
        impact: 'An unconfigured default token may fall back to anonymous access or overly permissive default permissions, potentially allowing unauthorized operations within the Consul cluster.',
        requirement: 'NIST SP 800-53 Rev. 5 (CM-6) requires organizations to "establish and document configuration settings" consistent with least functionality, and NIST SP 800-204B recommends restricting default access.',
        remediation: 'Set a specific default token with minimal permissions',
        nistDocument: 'NIST SP 800-53 Rev 5',
        section: 'CM-6 - Configuration Settings',
        location: 'acl.tokens.default',
        nistControls: ['IA-5', 'AC-3', 'CM-6'],
        nistGuidance: 'NIST SP 800-204B recommends restricting default access. According to NIST SP 800-53 Rev. 5 (CM-6), organizations should "establish and document configuration settings" that are consistent with least functionality principles. An unconfigured default token may fall back to using anonymous access or default permissions that are too permissive, potentially allowing unauthorized operations within the Consul cluster.'
      });
    }
  }

  checkTelemetry(config) {
    const telemetry = config.telemetry || {};
    
    if (telemetry.enable_service_metrics !== true) {
      this.addFinding({
        id: 'consul.service-metrics-collection-disabled',
        severity: 'Medium',
        category: 'Monitoring',
        issue: 'Service metrics collection is disabled',
        impact: 'Without service metrics, organizations cannot detect performance anomalies, security incidents, or compliance violations in real-time.',
        requirement: 'Section 3.2.1 requires: "Organizations must implement continuous monitoring to maintain ongoing awareness of information security, vulnerabilities, and threats."',
        remediation: 'Set telemetry.enable_service_metrics: true to enable monitoring',
        nistDocument: 'NIST SP 800-137',
        section: 'Section 3.2.1 - Continuous Monitoring Strategy',
        location: 'telemetry.enable_service_metrics',
        nistControls: ['AU-12', 'CA-7', 'SI-4']
      });
    }
  }

  checkAutoEncrypt(config) {
    const autoEncrypt = config.auto_encrypt || {};
    
    if (autoEncrypt.tls !== true) {
      this.addFinding({
        id: 'consul.auto-encrypt-tls-feature-disabled',
        severity: 'Medium',
        category: 'Encryption',
        issue: 'Auto-encrypt TLS feature is disabled',
        impact: 'Manual certificate distribution is error-prone and may lead to expired certificates or misconfiguration.',
        requirement: 'Section 4.3 states: "Automated certificate management reduces operational overhead and ensures consistent security posture across the mesh."',
        remediation: 'Set auto_encrypt.tls: true to enable automatic TLS certificate distribution',
        nistDocument: 'NIST SP 800-204B',
        section: 'Section 4.3 - Certificate Management',
        location: 'auto_encrypt.tls',
        nistControls: ['SC-8', 'SC-12', 'CM-2']
      });
    }
  }

  checkAutoConfig(config) {
    const autoConfig = config.auto_config || {};
    
    if (autoConfig.enabled !== true) {
      this.addFinding({
        id: 'consul.auto-config-feature-not-enabled',
        severity: 'Low',
        category: 'Configuration Management',
        issue: 'Auto-config feature is not enabled',
        impact: 'Manual configuration is prone to errors and inconsistencies across cluster nodes.',
        requirement: 'Section 2.2 recommends: "Automated configuration management ensures consistent security settings and reduces configuration drift."',
        remediation: 'Consider setting auto_config.enabled: true for automated secure configuration',
        nistDocument: 'NIST SP 800-128',
        section: 'Section 2.2 - Configuration Management',
        location: 'auto_config.enabled',
        nistControls: ['CM-2', 'CM-3', 'CM-6']
      });
    }
    
    if (autoConfig.authorization && autoConfig.authorization.enabled !== true) {
      this.addFinding({
        id: 'consul.auto-config-authorization-disabled',
        severity: 'Medium',
        category: 'Authorization',
        issue: 'Auto-config authorization is disabled',
        impact: 'Without authorization, malicious actors could inject unauthorized configurations into the cluster.',
        requirement: 'Section 3.4 requires: "All automated configuration processes must include proper authorization checks to prevent unauthorized changes."',
        remediation: 'Set auto_config.authorization.enabled: true to require authorization',
        nistDocument: 'NIST SP 800-204B',
        section: 'Section 3.4 - Authorization Controls',
        location: 'auto_config.authorization.enabled',
        nistControls: ['AC-3', 'CM-5', 'CM-6']
      });
    }
  }
  
  checkGossipEncryption(config) {
    const gossip = config.gossip || {};
    
    if (!gossip.encryption || !gossip.encryption.key) {
      this.addFinding({
        id: 'consul.gossip-encryption-key-not-configured',
        severity: 'Critical',
        category: 'Gossip Security',
        issue: 'Gossip encryption key is not configured',
        impact: 'Without gossip encryption, cluster state — including service addresses and health data — is transmitted in plaintext, letting attackers gather intelligence about the mesh infrastructure or inject false information into the gossip stream.',
        requirement: 'NIST SP 800-53 Rev. 5 (SC-8) requires the protection of transmitted information, and NIST SP 800-204B requires inter-node communications such as gossip protocols to be encrypted to prevent eavesdropping and tampering.',
        remediation: 'Configure gossip.encryption.key to encrypt Consul gossip protocol communications',
        nistDocument: 'NIST SP 800-53 Rev 5',
        section: 'SC-8 - Transmission Confidentiality and Integrity',
        location: 'gossip.encryption.key',
        nistControls: ['SC-8', 'SC-12', 'SC-13'],
        nistGuidance: 'NIST SP 800-53 Rev. 5 requires the protection of transmitted information (SC-8). According to NIST SP 800-204B, inter-node communications like gossip protocols must be encrypted to prevent eavesdropping and tampering. Without gossip encryption, cluster state information, including service addresses and health data, is transmitted in plaintext, potentially allowing attackers to gather intelligence about the service mesh infrastructure or inject false information into the gossip stream.'
      });
    } else if (gossip.encryption.key.length < 32) {
      this.addFinding({
        id: 'consul.gossip-encryption-key-short',
        severity: 'High',
        category: 'Gossip Security',
        issue: 'Gossip encryption key may be too short',
        impact: 'Short gossip encryption keys provide inadequate cryptographic strength and can be vulnerable to brute force attacks, exposing cluster gossip traffic to decryption.',
        requirement: 'NIST SP 800-57 ("Recommendation for Key Management") requires cryptographic keys to have sufficient length to provide the required security strength, recommending symmetric keys of at least 128 bits (32 hexadecimal characters) for adequate protection through 2030.',
        remediation: 'Use a strong encryption key of at least 32 characters for gossip encryption',
        nistDocument: 'NIST SP 800-57',
        section: 'Part 1 Rev 5, Section 5.6.1 - Key Lengths',
        location: 'gossip.encryption.key',
        nistControls: ['SC-12', 'SC-13', 'IA-5'],
        nistGuidance: 'NIST SP 800-57 ("Recommendation for Key Management") provides guidelines for cryptographic key length based on the required security strength. According to NIST, keys must have sufficient length to provide the required cryptographic strength. Short encryption keys can be vulnerable to brute force attacks. NIST recommends symmetric keys of at least 128 bits (which corresponds to 32 hexadecimal characters) for adequate security protection through 2030.'
      });
    }
    
    if (gossip.verify_incoming !== true || gossip.verify_outgoing !== true) {
      this.addFinding({
        id: 'consul.gossip-message-verification-not-fully',
        severity: 'High',
        category: 'Gossip Security',
        issue: 'Gossip message verification is not fully enabled',
        impact: 'Without both incoming and outgoing gossip message verification, an attacker could inject malicious gossip messages into the cluster, causing denial of service or routing traffic to attacker-controlled nodes.',
        requirement: 'NIST SP 800-53 Rev. 5 (SC-8) requires the protection of transmission integrity, and NIST SP 800-204B requires authentication of all inter-service and inter-node communications.',
        remediation: 'Enable both gossip.verify_incoming and gossip.verify_outgoing for secure cluster communication',
        nistDocument: 'NIST SP 800-53 Rev 5',
        section: 'SC-8 - Transmission Confidentiality and Integrity',
        location: 'gossip.verify_incoming/outgoing',
        nistControls: ['SC-8', 'SC-23', 'IA-2'],
        nistGuidance: 'NIST SP 800-53 Rev. 5 (SC-8) requires the protection of transmission integrity. NIST SP 800-204B emphasizes the importance of authenticating all inter-service and inter-node communications. Without message verification, an attacker could potentially inject malicious gossip messages into the cluster, causing denial of service or routing to malicious nodes. Enabling both incoming and outgoing verification ensures that nodes only process legitimate gossip messages from authenticated sources.'
      });
    }
  }
  
  checkFedRAMPCompliance(config) {
    // Check TLS certificate expiration (FedRAMP requires shorter periods)
    const connect = config.connect || {};
    const caConfig = connect.ca_config || {};
    
    // Check for strong TLS ciphers
    const tls = config.tls || {};
    if (!tls.cipher_suites || tls.cipher_suites.length === 0) {
      this.addFinding({
        id: 'consul.no-explicit-tls-cipher-suites',
        severity: 'High',
        category: 'FedRAMP Compliance',
        issue: 'No explicit TLS cipher suites configured',
        impact: 'Without explicit cipher suite configuration, the system may negotiate weak or non-compliant ciphers that fail federal cryptographic requirements, weakening confidentiality of data in transit.',
        requirement: 'NIST SP 800-52 Rev. 2 requires approved cipher suites, stating that "servers that support government-only applications shall be configured to use cipher suites that are composed entirely of FIPS-approved algorithms"; FedRAMP further mandates FIPS 140-2 validated cryptographic modules.',
        remediation: 'Explicitly configure FIPS-compliant cipher suites in tls.cipher_suites for FedRAMP compliance',
        nistDocument: 'NIST SP 800-52 Rev 2',
        section: 'Section 3.3.1',
        location: 'tls.cipher_suites',
        nistControls: ['SC-8', 'SC-13', 'CM-6'],
        nistGuidance: 'NIST SP 800-52 Rev. 2 requires the use of specific cipher suites that provide adequate security. According to NIST, "servers that support government-only applications shall be configured to use cipher suites that are composed entirely of FIPS-approved algorithms." FedRAMP builds on this requirement by mandating FIPS 140-2 validated cryptographic modules. Without explicit cipher suite configuration, the system may use weak or non-compliant ciphers that do not meet federal security requirements.'
      });
    }
    
    // Check minimum TLS version (FedRAMP requires TLS 1.2 or higher)
    if (!tls.min_version || tls.min_version < "TLSv1.2") {
      this.addFinding({
        id: 'consul.tls-minimum-version-not-tls',
        severity: 'Critical',
        category: 'FedRAMP Compliance',
        issue: 'TLS minimum version not set to TLS 1.2 or higher',
        impact: 'Allowing TLS 1.0/1.1 exposes traffic to known, unmitigable protocol vulnerabilities, compromising the confidentiality and integrity of data in transit and breaking FedRAMP compliance.',
        requirement: 'NIST SP 800-52 Rev. 2 explicitly requires TLS 1.2 or higher for federal systems: "Servers that support government-only applications shall be configured to use TLS 1.2, and should be configured to use TLS 1.3 as well."',
        remediation: 'Configure tls.min_version to "TLSv1.2" or higher for FedRAMP compliance',
        nistDocument: 'NIST SP 800-52 Rev 2',
        section: 'Section 3.1',
        location: 'tls.min_version',
        nistControls: ['SC-8', 'SC-13', 'CM-6'],
        nistGuidance: 'NIST SP 800-52 Rev. 2 explicitly requires the use of TLS 1.2 or higher for all federal systems. Earlier versions of TLS (1.0 and 1.1) have known vulnerabilities that cannot be mitigated. NIST states: "Servers that support government-only applications shall be configured to use TLS 1.2, and should be configured to use TLS 1.3 as well." FedRAMP compliance requires adherence to this standard to protect the confidentiality and integrity of data in transit.'
      });
    }
    
    // Check for secure bootstrap
    if (!config.secure_bootstrap || config.secure_bootstrap !== true) {
      this.addFinding({
        id: 'consul.secure-bootstrapping-not-enabled',
        severity: 'High',
        category: 'FedRAMP Compliance',
        issue: 'Secure bootstrapping is not enabled',
        impact: 'Without secure bootstrapping, the cluster initializes without enforced authentication and encryption, leaving it vulnerable to tampering or compromise during the critical startup phase.',
        requirement: 'NIST SP 800-53 Rev. 5 emphasizes secure system initialization, and NIST SP 800-124 states that "organizations should implement and test a secure configuration prior to deployment."',
        remediation: 'Enable secure_bootstrap for ensuring secure cluster initialization',
        nistDocument: 'NIST SP 800-53 Rev 5',
        section: 'CM-6 - Configuration Settings',
        location: 'secure_bootstrap',
        nistControls: ['CM-2', 'CM-6', 'SC-7', 'SC-8'],
        nistGuidance: 'NIST SP 800-53 Rev. 5 emphasizes the importance of secure system initialization. According to NIST SP 800-124, "organizations should implement and test a secure configuration prior to deployment." Secure bootstrapping ensures that Consul clusters initialize with proper authentication and encryption, preventing unauthorized access during the critical startup phase. Without secure bootstrapping, the cluster may be vulnerable to tampering or compromise during initialization.'
      });
    }
    
    // Check for certificate rotation settings
    if (!caConfig.rotation_period || !caConfig.rotate_cert_ttl) {
      this.addFinding({
        id: 'consul.certificate-rotation-settings-not-fully',
        severity: 'Medium',
        category: 'FedRAMP Compliance',
        issue: 'Certificate rotation settings not fully configured',
        impact: 'Without configured rotation settings, certificates remain valid for extended periods, enlarging the window of exposure if a key or certificate is compromised.',
        requirement: 'NIST SP 800-57 ("Recommendation for Key Management") mandates regular rotation of cryptographic keys and certificates, noting that "a compromise of the system or storage media on which keys are stored may result in the unauthorized disclosure of those keys"; FedRAMP requires documented key rotation processes.',
        remediation: 'Configure connect.ca_config.rotation_period and rotate_cert_ttl for regular certificate rotation',
        nistDocument: 'NIST SP 800-57',
        section: 'Part 1 Rev 5, Section 5.3 - Cryptoperiods',
        location: 'connect.ca_config.rotation_period',
        nistControls: ['SC-12', 'IA-5', 'SC-13'],
        nistGuidance: 'NIST SP 800-57 ("Recommendation for Key Management") mandates that cryptographic keys and certificates be rotated regularly to minimize the impact of potential compromises. According to NIST, "a compromise of the system or storage media on which keys are stored may result in the unauthorized disclosure of those keys." FedRAMP builds on this by requiring documented key rotation processes. Without proper rotation settings, certificates may remain valid for extended periods, increasing the risk window if compromised.'
      });
    }
    
    // Check for audit logging
    if (!config.audit || config.audit.enabled !== true) {
      this.addFinding({
        id: 'consul.audit-logging-not-enabled',
        severity: 'Critical',
        category: 'FedRAMP Compliance',
        issue: 'Audit logging is not enabled',
        impact: 'With audit logging disabled, the system cannot record access attempts, configuration changes, or other security-critical events, severely limiting detection and incident response capabilities.',
        requirement: 'NIST SP 800-53 Rev. 5 requires comprehensive audit logging of security-relevant events, stating that "organizations must identify the subset of events that are relevant to security concerns and focus logging efforts accordingly"; FedRAMP specifically mandates audit logging for all authentication and authorization decisions.',
        remediation: 'Enable audit.enabled for capturing security events required by FedRAMP',
        nistDocument: 'NIST SP 800-53 Rev 5',
        section: 'AU-2 - Event Logging',
        location: 'audit.enabled',
        nistControls: ['AU-2', 'AU-3', 'AU-12', 'SI-4'],
        nistGuidance: 'NIST SP 800-53 Rev. 5 requires comprehensive audit logging for security-relevant events. According to NIST, "organizations must identify the subset of events that are relevant to security concerns and focus logging efforts accordingly." FedRAMP specifically mandates audit logging for all authentication and authorization decisions. Without audit logging enabled, the system cannot track access attempts, configuration changes, or other security-critical events, severely limiting incident response capabilities.'
      });
    }
    
    // Check service registration configuration
    if (config.services) {
      const services = Array.isArray(config.services) ? config.services : [config.services];
      
      services.forEach((service, index) => {
        if (service.connect && !service.connect.sidecar_service) {
          this.addFinding({
        id: 'consul.service-lacks-sidecar-proxy-configuration',
        severity: 'High',
            category: 'Proxy Configuration',
            issue: `Service "${service.name || index}" lacks sidecar proxy configuration`,
            impact: 'Services without sidecar proxies bypass mesh security controls and communicate without encryption or policy enforcement.',
            requirement: 'Section 5.1 states: "All services in the mesh must use sidecar proxies to enforce security policies and enable mTLS."',
            remediation: 'Configure connect.sidecar_service with appropriate proxy settings',
            nistDocument: 'NIST SP 800-204B',
            section: 'Section 5.1 - Sidecar Proxy Requirements',
            location: `services[${index}].connect.sidecar_service`,
            nistControls: ['SC-8', 'SC-23', 'AC-4']
          });
        }
        
        // Check proxy configuration for security
        if (service.connect && service.connect.sidecar_service && service.connect.sidecar_service.proxy) {
          const proxy = service.connect.sidecar_service.proxy;
          
          if (proxy.local_service_address !== "127.0.0.1" && proxy.local_service_address !== "localhost") {
            this.addFinding({
        id: 'consul.service-proxy-binds-non-localhost',
        severity: 'High',
              category: 'Proxy Security',
              issue: `Service "${service.name || index}" proxy binds to non-localhost address`,
              impact: 'Non-localhost binding allows bypassing the proxy, potentially exposing unencrypted service endpoints.',
              requirement: 'Section 5.2 requires: "Sidecar proxies must bind only to localhost to prevent direct external access to services."',
              remediation: 'Set local_service_address to "127.0.0.1" to enforce proxy-only access',
              nistDocument: 'NIST SP 800-204B',
              section: 'Section 5.2 - Proxy Network Security',
              location: `services[${index}].connect.sidecar_service.proxy.local_service_address`,
              nistControls: ['SC-7', 'SC-8', 'AC-4']
            });
          }
        }
      });
    }
    
    // FedRAMP requires explicit settings for default policies
    const acl = config.acl || {};
    if (acl.default_policy !== "deny") {
      this.addFinding({
        id: 'consul.acl-default-policy-not-configured',
        severity: 'Critical',
        category: 'FedRAMP Compliance',
        issue: 'ACL default policy not configured for zero-trust',
        impact: 'A default-allow policy violates zero-trust principles and may grant unintended access to resources.',
        requirement: 'Section 7.1 states: "Zero trust architectures must default to denying access unless explicitly authorized."',
        remediation: 'Set acl.default_policy: "deny" to implement zero-trust access control',
        nistDocument: 'NIST SP 800-207',
        section: 'Section 7.1 - Zero Trust Principles',
        location: 'acl.default_policy',
        nistControls: ['AC-3', 'AC-4', 'CM-7']
      });
    }
  }
  
  // Cryptographic key-strength checks.
  checkCVE2024Vulnerabilities(config) {
    const connect = config.connect || {};
    const caConfig = connect.ca_config || {};

    // Weak RSA key size.
    if (caConfig.private_key_bits && caConfig.private_key_bits < 2048) {
      this.addFinding({
        id: 'consul.rsa-key-size-below-2048',
        severity: 'High',
        category: 'Certificate Security',
        issue: 'RSA key size is below 2048 bits',
        impact: 'Keys smaller than 2048 bits are vulnerable to factorization attacks and no longer provide adequate security.',
        requirement: 'Part 1 Rev 5 Section 5.6.1 requires: "RSA keys must be at least 2048 bits for current security strength."',
        remediation: 'Set connect.ca_config.private_key_bits to at least 2048 (recommend 3072 or 4096)',
        nistDocument: 'NIST SP 800-57',
        section: 'Part 1 Rev 5 Section 5.6.1',
        location: 'connect.ca_config.private_key_bits',
        nistControls: ['SC-12', 'SC-13', 'IA-5']
      });
    }
    
    // Weaker elliptic curve than recommended for long-term federal use.
    if (caConfig.private_key_type === 'ec' && (!caConfig.ec_key_algorithm ||
        caConfig.ec_key_algorithm === 'secp256r1')) {
      this.addFinding({
        id: 'consul.using-potentially-weak-ec-curve',
        severity: 'Medium',
        category: 'Certificate Security',
        issue: 'Using a weaker EC curve (P-256) than recommended for long-term security',
        impact: 'The secp256r1 (P-256) curve may not provide sufficient security for sensitive applications.',
        requirement: 'Section 3.1 recommends: "Use P-384 or P-521 curves for federal applications requiring long-term security."',
        remediation: 'Use P-384 or P-521 curves for enhanced security',
        nistDocument: 'NIST SP 800-186',
        section: 'Section 3.1 - Elliptic Curve Selection',
        location: 'connect.ca_config.ec_key_algorithm',
        nistControls: ['SC-12', 'SC-13']
      });
    }
    
    // Check for insecure script execution
    if (config.enable_script_checks === true || config.enable_local_script_checks === true) {
      this.addFinding({
        id: 'consul.script-based-health-checks-enabled',
        severity: 'High',
        category: 'System Security',
        issue: 'Script-based health checks are enabled (potential RCE vulnerability)',
        impact: 'Script checks can be exploited to execute arbitrary commands on the host system.',
        requirement: 'Section 6.4 states: "Health checks should not execute arbitrary scripts that could be exploited for code execution."',
        remediation: 'Disable enable_script_checks and use HTTP/TCP/gRPC health checks instead',
        nistDocument: 'NIST SP 800-204A',
        section: 'Section 6.4 - Health Check Security',
        location: 'enable_script_checks',
        nistControls: ['SI-10', 'SI-11', 'CM-7']
      });
    }
    
    // Check for remote execution
    if (config.disable_remote_exec === false) {
      this.addFinding({
        id: 'consul.remote-command-execution-enabled',
        severity: 'High',
        category: 'System Security',
        issue: 'Remote command execution is enabled',
        impact: 'Remote exec allows arbitrary command execution across the cluster, creating a significant security risk.',
        requirement: 'Control AC-17(9) states: "The information system protects against unauthorized remote execution of privileged commands."',
        remediation: 'Set disable_remote_exec: true to prevent remote command execution',
        nistDocument: 'NIST SP 800-53 Rev 5',
        section: 'AC-17(9) - Remote Access',
        location: 'disable_remote_exec',
        nistControls: ['AC-17', 'AC-3', 'CM-7']
      });
    }
  }
  
  checkProxyConfiguration(config) {
    const proxy = config.proxy || {};
    const proxyConfig = proxy.config || {};
    
    // Check for binding to all interfaces
    if (proxyConfig.bind_address === '0.0.0.0') {
      this.addFinding({
        id: 'consul.proxy-binding-all-network-interfaces',
        severity: 'High',
        category: 'Proxy Security',
        issue: 'Proxy is binding to all network interfaces',
        impact: 'Binding to 0.0.0.0 exposes the proxy to all network interfaces, potentially allowing external access.',
        requirement: 'Section 5.2 recommends: "Service proxies should bind only to localhost or specific interfaces to minimize attack surface."',
        remediation: 'Set proxy.config.bind_address to "127.0.0.1" or a specific interface',
        nistDocument: 'NIST SP 800-204B',
        section: 'Section 5.2 - Proxy Network Configuration',
        location: 'proxy.config.bind_address',
        nistControls: ['SC-7', 'CM-7', 'AC-4']
      });
    }
    
    // Check for connection limits
    if (proxyConfig.max_inbound_connections === 0 || !proxyConfig.max_inbound_connections) {
      this.addFinding({
        id: 'consul.no-inbound-connection-limits-configured',
        severity: 'Medium',
        category: 'Resource Management',
        issue: 'No inbound connection limits configured for proxies',
        impact: 'Without connection limits, proxies are vulnerable to connection flooding and DoS attacks.',
        requirement: 'Section 5.3 states: "Connection limits must be enforced to prevent resource exhaustion attacks."',
        remediation: 'Set proxy.config.max_inbound_connections to an appropriate limit',
        nistDocument: 'NIST SP 800-233',
        section: 'Section 5.3 - Resource Management',
        location: 'proxy.config.max_inbound_connections',
        nistControls: ['SC-5', 'SI-10']
      });
    }
    
    // Check protocol configuration
    if (proxyConfig.protocol === 'http') {
      this.addFinding({
        id: 'consul.proxy-configured-use-unencrypted-http',
        severity: 'High',
        category: 'TLS Security',
        issue: 'Proxy configured to use unencrypted HTTP',
        impact: 'HTTP traffic can be intercepted and modified, exposing sensitive data.',
        requirement: 'Section 3.1 requires: "All network communications must use TLS 1.2 or higher."',
        remediation: 'Configure proxy to use HTTPS or gRPC with TLS',
        nistDocument: 'NIST SP 800-52 Rev 2',
        section: 'Section 3.1 - TLS Requirements',
        location: 'proxy.config.protocol',
        nistControls: ['SC-8', 'SC-13', 'SC-23']
      });
    }
  }
  
  checkRateLimiting(config) {
    const limits = config.limits || {};
    
    // Check HTTP connection limits
    if (limits.http_max_conns_per_client === 0 || !limits.http_max_conns_per_client) {
      this.addFinding({
        id: 'consul.no-http-connection-limits-per',
        severity: 'Medium',
        category: 'Resource Management',
        issue: 'No HTTP connection limits per client',
        impact: 'Without per-client limits, a single client can exhaust server resources.',
        requirement: 'Section 4.2 requires: "Rate limiting must be implemented to prevent abuse and ensure fair resource usage."',
        remediation: 'Set limits.http_max_conns_per_client to a reasonable value (e.g., 100)',
        nistDocument: 'NIST SP 800-233',
        section: 'Section 4.2 - Rate Limiting',
        location: 'limits.http_max_conns_per_client',
        nistControls: ['SC-5', 'SI-10']
      });
    }
    
    // Check RPC rate limits
    if (limits.rpc_rate === -1 || !limits.rpc_rate) {
      this.addFinding({
        id: 'consul.rpc-rate-limiting-disabled',
        severity: 'Medium',
        category: 'Resource Management',
        issue: 'RPC rate limiting is disabled',
        impact: 'Unlimited RPC rates can lead to resource exhaustion and service degradation.',
        requirement: 'Section 6.5 states: "API rate limiting is essential for preventing denial of service attacks."',
        remediation: 'Set limits.rpc_rate to a positive value',
        nistDocument: 'NIST SP 800-204B',
        section: 'Section 6.5 - API Security',
        location: 'limits.rpc_rate',
        nistControls: ['SC-5', 'SI-10']
      });
    }
    
    // Check request limits
    const requestLimits = limits.request_limits || {};
    if (requestLimits.mode === 'disabled') {
      this.addFinding({
        id: 'consul.request-rate-limiting-disabled',
        severity: 'Medium',
        category: 'Resource Management',
        issue: 'Request rate limiting is disabled',
        impact: 'Disabled rate limiting allows unlimited requests, potentially causing DoS.',
        requirement: 'Section 4.2 requires: "Request rate limiting must be enforced to prevent abuse."',
        remediation: 'Set limits.request_limits.mode to "enforce" with appropriate rates',
        nistDocument: 'NIST SP 800-233',
        section: 'Section 4.2 - Rate Limiting',
        location: 'limits.request_limits.mode',
        nistControls: ['SC-5', 'SI-10']
      });
    }
  }
  
  checkServiceDiscoverySettings(config) {
    // Check DNS configuration
    if (config.recursors && config.recursors.length > 0) {
      config.recursors.forEach((recursor, index) => {
        // Check for public DNS servers
        if (recursor === '8.8.8.8' || recursor === '8.8.4.4' || 
            recursor === '1.1.1.1' || recursor === '1.0.0.1') {
          this.addFinding({
        id: 'consul.using-public-dns-resolver',
        severity: 'Medium',
            category: 'Service Discovery',
            issue: `Using public DNS resolver: ${recursor}`,
            impact: 'Public DNS servers may log queries and are not under organizational control.',
            requirement: 'Section 3.2 recommends: "Organizations should use internal DNS servers and avoid public resolvers for internal queries."',
            remediation: 'Use internal DNS servers or configure Consul as authoritative for service discovery',
            nistDocument: 'NIST SP 800-81 Rev 3',
            section: 'Section 3.2 - DNS Architecture',
            location: `recursors[${index}]`,
            nistControls: ['SC-20', 'SC-21', 'SC-22']
          });
        }
      });
    }
    
    // Check discovery max stale
    if (config.discovery_max_stale) {
      const staleTime = parseInt(config.discovery_max_stale);
      if (staleTime > 72) { // hours
        this.addFinding({
        id: 'consul.service-discovery-stale-read-window',
        severity: 'Medium',
          category: 'Service Discovery',
          issue: 'Service discovery stale read window is too long',
          impact: 'Long stale read windows may result in routing to unhealthy or decommissioned services.',
          requirement: 'Section 6.4 states: "Stale reads should be limited to prevent using outdated service information."',
          remediation: 'Reduce discovery_max_stale to 72h or less',
          nistDocument: 'NIST SP 800-233',
          section: 'Section 6.4 - Service Discovery',
          location: 'discovery_max_stale',
          nistControls: ['SI-11', 'SC-36']
        });
      }
    }
  }
  
  checkMeshGateway(config) {
    const connect = config.connect || {};
    
    // Check mesh gateway configuration
    if (connect.enable_mesh_gateway_wan_federation === true) {
      // Check for secure WAN federation settings
      if (!config.verify_incoming || !config.verify_outgoing || !config.verify_server_hostname) {
        this.addFinding({
        id: 'consul.mesh-gateway-wan-federation-enabled',
        severity: 'High',
          category: 'TLS Security',
          issue: 'Mesh gateway WAN federation enabled without full TLS verification',
          impact: 'WAN federation without proper TLS verification is vulnerable to MITM attacks.',
          requirement: 'Section 4.3 requires: "Cross-datacenter communication must enforce mutual TLS with hostname verification."',
          remediation: 'Enable verify_incoming, verify_outgoing, and verify_server_hostname for WAN federation',
          nistDocument: 'NIST SP 800-204C',
          section: 'Section 4.3 - Multi-Datacenter Security',
          location: 'connect.enable_mesh_gateway_wan_federation',
          nistControls: ['SC-8', 'SC-23', 'IA-3']
        });
      }
      
      // Check for gateway service configuration
      if (!config.primary_gateways || config.primary_gateways.length === 0) {
        this.addFinding({
        id: 'consul.wan-federation-enabled-without-configured',
        severity: 'Medium',
          category: 'Configuration Management',
          issue: 'WAN federation enabled without configured primary gateways',
          impact: 'Missing gateway configuration can lead to insecure cross-datacenter communication.',
          requirement: 'Section 4.4 states: "Mesh gateways must be explicitly configured with appropriate security controls."',
          remediation: 'Configure primary_gateways with specific gateway addresses',
          nistDocument: 'NIST SP 800-204C',
          section: 'Section 4.4 - Gateway Configuration',
          location: 'primary_gateways',
          nistControls: ['SC-7', 'AC-4']
        });
      }
    }
  }
}

module.exports = { ConsulSecurityAnalyzer };
