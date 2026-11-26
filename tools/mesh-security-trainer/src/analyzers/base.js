// Shared analyzer foundation: the finding schema, its validation, and the
// NIST 800-53 control catalog every analyzer draws on.

// Ordered most- to least-severe; the UI sorts and filters on these exact values.
const SEVERITY_LEVELS = ['Critical', 'High', 'Medium', 'Low'];

// Fields without which a finding cannot be rendered or acted upon.
// `id` is the stable key that exercise answer keys, authored lesson content,
// and learner progress all reference. Prose may be reworded; the id may not.
const REQUIRED_FINDING_FIELDS = ['id', 'severity', 'category', 'issue', 'remediation'];

// e.g. "NIST SP 800-204A", "NIST SP 800-52 Rev 2", "NIST SP 800-207",
// and multi-part numbers such as "NIST SP 800-81 Rev 3".
const NIST_DOCUMENT_PATTERN = /^NIST SP \d{3}(-\d+[A-Z]?)*( Rev \d+)?$/;

// Base analyzer class with common functionality
class BaseSecurityAnalyzer {
  constructor() {
    this.findings = [];
    this.nistControls = this.getNISTControls();
  }

  reset() {
    this.findings = [];
  }

  /**
   * Resolve a finding's NIST control IDs against the 800-53 catalog.
   *
   * Findings store bare IDs (['AC-3']) because that is what the checks know.
   * The UI needs {id, title, description} to render its control tooltips, so
   * the join happens here, at the response boundary. Unknown IDs degrade to a
   * bare id/title rather than disappearing.
   */
  expandNistControls(controlIds = []) {
    return controlIds.map((id) => this.nistControls[id] || { id, title: id, description: '' });
  }

  /** Findings with NIST controls resolved to full objects, ready for the API/UI. */
  getEnrichedFindings() {
    return this.findings.map((finding) => ({
      ...finding,
      nistControls: this.expandNistControls(finding.nistControls)
    }));
  }

  /**
   * Record a security finding.
   *
   * Takes a single named-argument object. This is deliberate: the previous
   * positional signature was silently mis-called by 15 call sites after a
   * schema change, and every one of those findings was discarded at runtime —
   * the analyzer reported "clean" on genuinely vulnerable configs. Named
   * arguments make that class of drift impossible.
   *
   * @param {object}   finding
   * @param {string}   finding.severity      One of SEVERITY_LEVELS. Drives UI ranking/filtering.
   * @param {string}   finding.category      Grouping label, e.g. 'Access Control'.
   * @param {string}   finding.issue         What is wrong.
   * @param {string}   finding.remediation   How to fix it.
   * @param {string}  [finding.impact]       Security impact of the misconfiguration.
   * @param {string}  [finding.requirement]  What the cited NIST document requires.
   * @param {string}  [finding.nistDocument] e.g. 'NIST SP 800-204B'.
   * @param {string}  [finding.section]      e.g. 'Section 4.1'.
   * @param {string}  [finding.location]     Config path, e.g. 'acl.enabled'.
   * @param {string[]}[finding.nistControls] NIST 800-53 Rev 5 controls, e.g. ['AC-3'].
   * @param {string}  [finding.nistGuidance] Longer-form NIST rationale, if available.
   */
  addFinding(finding) {
    this.validateFinding(finding);

    const {
      id, severity, category, issue, remediation,
      impact = null, requirement = null,
      nistDocument = null, section = null,
      location = null, nistControls = [], nistGuidance = null
    } = finding;

    this.findings.push({
      id,            // Stable key, e.g. 'consul.acl-system-not-enabled'
      severity,      // 'Critical' | 'High' | 'Medium' | 'Low'
      category,      // e.g. 'Access Control'
      issue,         // Clear description of the problem
      impact,        // Security impact
      requirement,   // Direct quote or summary from NIST
      remediation,   // How to fix
      nistDocument,  // e.g. 'NIST SP 800-204A'
      section,       // e.g. 'Section 4.2.1'
      location,      // Where in the config
      nistControls,  // Array of NIST 800-53 Rev 5 controls, e.g. ['AC-3', 'SC-8']
      nistGuidance   // Longer-form rationale, where the check provides one
    });
  }

  /**
   * Assert a finding is well-formed.
   *
   * Throws rather than returning false. A malformed finding can only come from
   * a coding error in an analyzer — never from user input — so failing loudly
   * surfaces it in tests. The one thing we must never do is drop it: a security
   * scanner that silently discards findings reports vulnerable configs as clean.
   */
  validateFinding(finding) {
    if (!finding || typeof finding !== 'object') {
      throw new TypeError('addFinding() expects a finding object, got: ' + typeof finding);
    }

    const missing = REQUIRED_FINDING_FIELDS.filter((f) => !finding[f]);
    if (missing.length > 0) {
      throw new Error(
        `Malformed finding: missing required field(s) [${missing.join(', ')}] ` +
        `for issue "${finding.issue || '<no issue>'}"`
      );
    }

    if (!SEVERITY_LEVELS.includes(finding.severity)) {
      throw new Error(
        `Malformed finding: invalid severity "${finding.severity}" ` +
        `for issue "${finding.issue}". Expected one of: ${SEVERITY_LEVELS.join(', ')}`
      );
    }

    // NIST metadata is optional, but when present it must be well-formed so
    // that compliance output stays citable.
    const { nistDocument, requirement } = finding;
    if (nistDocument && nistDocument !== 'Configuration Error' && !NIST_DOCUMENT_PATTERN.test(nistDocument)) {
      throw new Error(
        `Malformed finding: invalid NIST document "${nistDocument}" for issue "${finding.issue}". ` +
        `Expected a format like "NIST SP 800-204A" or "NIST SP 800-52 Rev 2"`
      );
    }

    // Only meaningful for findings that actually cite a NIST publication;
    // a "Configuration Error" has no document to quote.
    const citesNist = nistDocument && nistDocument !== 'Configuration Error';
    if (citesNist && requirement && !/"|Section|states|requires/.test(requirement)) {
      console.warn(
        `Finding "${finding.issue}" cites ${nistDocument} but its requirement quotes no text ` +
        `or section reference.`
      );
    }
  }
  
  getNISTControls() {
    // NIST 800-53 Rev 5 Controls - focused on relevant security controls for service meshes
    return {
      "AC-3": {
        id: "AC-3",
        title: "Access Enforcement",
        description: "The information system enforces approved authorizations for logical access to information and system resources in accordance with applicable access control policies."
      },
      "AC-4": {
        id: "AC-4",
        title: "Information Flow Enforcement",
        description: "The information system enforces approved authorizations for controlling the flow of information within the system and between connected systems based on applicable information flow control policies."
      },
      "AC-17": {
        id: "AC-17",
        title: "Remote Access",
        description: "The organization establishes and documents usage restrictions, configuration/connection requirements, and implementation guidance for each type of remote access allowed."
      },
      "AU-2": {
        id: "AU-2",
        title: "Audit Events",
        description: "The information system generates audit records containing information that establishes what type of event occurred, when the event occurred, where the event occurred, the source of the event, the outcome of the event, and the identity of any individuals or subjects associated with the event."
      },
      "AU-3": {
        id: "AU-3",
        title: "Content of Audit Records",
        description: "The information system generates audit records containing information that establishes what type of event occurred, when the event occurred, where the event occurred, the source of the event, the outcome of the event, and the identity of any individuals or subjects associated with the event."
      },
      "AU-12": {
        id: "AU-12",
        title: "Audit Generation",
        description: "The information system provides audit record generation capability for the auditable events defined in AU-2 a. at all information system components where audit capability is deployed."
      },
      "CA-3": {
        id: "CA-3",
        title: "System Interconnections",
        description: "The organization authorizes connections from the information system to other information systems through the use of Interconnection Security Agreements and monitors the system connections on an ongoing basis."
      },
      "CM-2": {
        id: "CM-2",
        title: "Baseline Configuration",
        description: "The organization develops, documents, and maintains under configuration control, a current baseline configuration of the information system."
      },
      "CM-6": {
        id: "CM-6", 
        title: "Configuration Settings",
        description: "The organization establishes and documents configuration settings for information technology products employed within the information system that reflect the most restrictive mode consistent with operational requirements."
      },
      "CM-7": {
        id: "CM-7",
        title: "Least Functionality",
        description: "The organization configures the information system to provide only essential capabilities and specifically prohibits or restricts the use of functions, ports, protocols, and/or services as defined in the security plan."
      },
      "IA-2": {
        id: "IA-2",
        title: "Identification and Authentication",
        description: "The information system uniquely identifies and authenticates organizational users (or processes acting on behalf of organizational users)."
      },
      "IA-5": {
        id: "IA-5",
        title: "Authenticator Management",
        description: "The organization manages information system authenticators by establishing and implementing administrative procedures for initial authenticator distribution, for lost/compromised, or damaged authenticators, and for revoking authenticators."
      },
      "SC-7": {
        id: "SC-7",
        title: "Boundary Protection",
        description: "The information system monitors and controls communications at the external boundary of the system and at key internal boundaries within the system and implements subnetworks for publicly accessible system components that are physically or logically separated from internal organizational networks."
      },
      "SC-8": {
        id: "SC-8",
        title: "Transmission Confidentiality and Integrity",
        description: "The information system protects the confidentiality and integrity of transmitted information."
      },
      "SC-12": {
        id: "SC-12",
        title: "Cryptographic Key Establishment and Management",
        description: "The organization establishes and manages cryptographic keys for required cryptography employed within the information system in accordance with requirements for key generation, distribution, storage, access, and destruction."
      },
      "SC-13": {
        id: "SC-13",
        title: "Cryptographic Protection",
        description: "The information system implements cryptographic uses and type of cryptography required for each use in accordance with applicable laws, executive orders, directives, policies, regulations, and standards."
      },
      "SC-23": {
        id: "SC-23",
        title: "Session Authenticity",
        description: "The information system protects the authenticity of communications sessions."
      },
      "SI-4": {
        id: "SI-4",
        title: "Information System Monitoring",
        description: "The organization monitors the information system to detect attacks and indicators of potential attacks, unauthorized local, network, and remote connections."
      }
    };
  }
}

module.exports = {
  BaseSecurityAnalyzer,
  SEVERITY_LEVELS,
  REQUIRED_FINDING_FIELDS,
  NIST_DOCUMENT_PATTERN
};
