/**
 * Verified links for every source the analyzers cite.
 *
 * These URLs are hand-verified, not generated from document numbers. Generated
 * URLs 404 silently, and a dead link in a teaching tool is worse than no link.
 * A test asserts that every document cited by any check has an entry here.
 *
 * Verified 2026-07-12 against csrc.nist.gov.
 */

/** NIST Special Publications, keyed by the exact `nistDocument` string checks use. */
const NIST_DOCUMENTS = {
  'NIST SP 800-204A': {
    url: 'https://csrc.nist.gov/pubs/sp/800/204/a/final',
    title: 'Building Secure Microservices-based Applications Using Service-Mesh Architecture'
  },
  'NIST SP 800-204B': {
    url: 'https://csrc.nist.gov/pubs/sp/800/204/b/final',
    title: 'Attribute-based Access Control for Microservices-based Applications using a Service Mesh'
  },
  'NIST SP 800-204C': {
    url: 'https://csrc.nist.gov/pubs/sp/800/204/c/final',
    title: 'Implementation of DevSecOps for a Microservices-based Application with Service Mesh'
  },
  'NIST SP 800-233': {
    url: 'https://csrc.nist.gov/pubs/sp/800/233/final',
    title: 'Service Mesh Proxy Models for Cloud-Native Applications'
  },
  'NIST SP 800-207': {
    url: 'https://csrc.nist.gov/pubs/sp/800/207/final',
    title: 'Zero Trust Architecture'
  },
  'NIST SP 800-57': {
    url: 'https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final',
    title: 'Recommendation for Key Management, Part 1: General (Rev. 5)'
  },
  'NIST SP 800-137': {
    url: 'https://csrc.nist.gov/pubs/sp/800/137/final',
    title: 'Information Security Continuous Monitoring (ISCM) for Federal Information Systems and Organizations'
  },
  'NIST SP 800-190': {
    url: 'https://csrc.nist.gov/pubs/sp/800/190/final',
    title: 'Application Container Security Guide'
  },
  'NIST SP 800-52 Rev 2': {
    url: 'https://csrc.nist.gov/pubs/sp/800/52/r2/final',
    title: 'Guidelines for the Selection, Configuration, and Use of Transport Layer Security (TLS) Implementations'
  },
  // SP 800-81-2 was withdrawn (March 2026) and superseded by Rev. 3. The checks
  // used to cite the withdrawn number; they now cite the live document.
  'NIST SP 800-81 Rev 3': {
    url: 'https://csrc.nist.gov/pubs/sp/800/81/r3/final',
    title: 'Secure Domain Name System (DNS) Deployment Guide (Rev. 3)'
  },
  'NIST SP 800-40 Rev 4': {
    url: 'https://csrc.nist.gov/pubs/sp/800/40/r4/final',
    title: 'Guide to Enterprise Patch Management Planning'
  },
  'NIST SP 800-92': {
    url: 'https://csrc.nist.gov/pubs/sp/800/92/final',
    title: 'Guide to Computer Security Log Management'
  },
  'NIST SP 800-128': {
    url: 'https://csrc.nist.gov/pubs/sp/800/128/upd1/final',
    title: 'Guide for Security-Focused Configuration Management of Information Systems'
  },
  'NIST SP 800-186': {
    url: 'https://csrc.nist.gov/pubs/sp/800/186/final',
    title: 'Recommendations for Discrete Logarithm-based Cryptography: Elliptic Curve Domain Parameters'
  },
  'NIST SP 800-53 Rev 5': {
    url: 'https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final',
    title: 'Security and Privacy Controls for Information Systems and Organizations'
  }
};

/**
 * NIST has no stable per-control deep link any more -- the old NVD scheme
 * (nvd.nist.gov/800-53/Rev5/control/AC-3) is dead, and the current CPRT browser
 * is a single-page app whose URL fragments return 200 for *any* control id, so
 * a typo would fail silently. Rather than generate links that may not resolve,
 * controls link to the official catalog and their text is shown in-app from the
 * 800-53 catalog the analyzers already carry.
 */
const NIST_CONTROL_CATALOG_URL = 'https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final';

/** Vendor hardening guidance, per mesh. */
const VENDOR_GUIDANCE = {
  istio: {
    url: 'https://istio.io/latest/docs/ops/best-practices/security/',
    title: 'Istio — Security Best Practices'
  },
  consul: {
    url: 'https://developer.hashicorp.com/consul/docs/secure-mesh/best-practice',
    title: 'Consul — Best Practices for Service Mesh Security'
  },
  linkerd: {
    url: 'https://linkerd.io/2-edge/features/automatic-mtls/',
    title: 'Linkerd — Automatic mTLS'
  }
};

const CIS_BENCHMARK = {
  url: 'https://www.cisecurity.org/benchmark/kubernetes',
  title: 'CIS Kubernetes Benchmark'
};

/**
 * Build the reference links for a single finding.
 *
 * @param {object} finding  An analyzer finding.
 * @param {string} [mesh]   'istio' | 'consul' | 'linkerd', for vendor guidance.
 * @returns {object} { document, controlCatalog, vendor, cis }
 */
function referencesFor(finding, mesh) {
  const document = NIST_DOCUMENTS[finding.nistDocument] || null;

  return {
    // The NIST publication the check cites, with a real URL.
    document: document
      ? { ...document, name: finding.nistDocument, section: finding.section || null }
      : null,
    // Where to read the 800-53 controls this finding maps to.
    controlCatalog: (finding.nistControls && finding.nistControls.length > 0)
      ? { url: NIST_CONTROL_CATALOG_URL, title: 'NIST SP 800-53 Rev. 5 control catalog' }
      : null,
    vendor: (mesh && VENDOR_GUIDANCE[mesh]) || null,
    cis: CIS_BENCHMARK
  };
}

module.exports = {
  NIST_DOCUMENTS,
  NIST_CONTROL_CATALOG_URL,
  VENDOR_GUIDANCE,
  CIS_BENCHMARK,
  referencesFor
};
