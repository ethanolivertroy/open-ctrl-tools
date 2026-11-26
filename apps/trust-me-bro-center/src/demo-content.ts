import { normalizeImportBundle, type ImportBundle } from './domain';

export function demoImportBundle(): ImportBundle {
  return normalizeImportBundle({
    source: 'manual',
    site: {
      companyName: 'Northstar Labs',
      title: '',
      headline: 'Security should be easy to inspect.',
      summary: 'Review our security program, data practices, subprocessors, and current assurance materials in one place.',
      securityEmail: 'security@northstar.example',
      location: 'United States',
      accent: '#1f6b52',
      secondaryColor: '#0f3d2e',
      privacyPolicyUrl: 'https://northstar.example/privacy',
      isPublic: true,
      bannerSetting: 'GRADIENT',
      bannerStartColor: '#1f6b52',
      bannerEndColor: '#0f3d2e',
      controlVisibilityMode: 'SHOW_ALL_WITH_STATUS',
      dataCollectedHeading: 'Data we collect'
    },
    certifications: [
      { name: 'SOC 2 Type II', status: 'Current', description: 'Independent examination covering security and availability controls.', standard: 'soc2', visible: true, sortOrder: 1 },
      { name: 'ISO 27001', status: 'Aligned', description: 'Security program mapped to ISO 27001 control domains.', standard: 'iso27001', visible: true, sortOrder: 2 },
      { name: 'GDPR', status: 'Supported', description: 'Contractual and operational measures for applicable privacy obligations.', standard: 'gdpr', visible: true, sortOrder: 3 }
    ],
    documents: [
      {
        title: 'Security overview',
        description: 'A concise summary of program ownership, access control, encryption, resilience, and incident response.',
        category: 'Security',
        visibility: 'public',
        url: '/demo/security-overview.txt',
        version: '1.0',
        publishedAt: '2026-08-30',
        reviewAt: '2027-08-30',
        visible: true
      },
      {
        title: 'SOC 2 Type II report',
        description: 'Available to qualified customers and prospects after review.',
        category: 'Audit',
        visibility: 'request',
        version: '2026',
        publishedAt: '2026-08-30',
        reviewAt: '2027-08-30',
        visible: true
      },
      {
        title: 'Penetration test summary',
        description: 'Executive findings summary from the latest independent assessment.',
        category: 'Testing',
        visibility: 'request',
        version: '2026',
        publishedAt: '2026-07-15',
        reviewAt: '2027-07-15',
        visible: true
      }
    ],
    faqs: [
      { question: 'Where is customer data hosted?', answer: 'Production customer data is hosted on Cloudflare in the United States. Regional commitments are documented in the applicable agreement.', category: 'Data handling', visible: true, sortOrder: 1 },
      { question: 'Is customer data encrypted?', answer: 'Yes. Data is encrypted in transit using modern TLS and encrypted at rest using Cloudflare-managed encryption controls.', category: 'Data handling', visible: true, sortOrder: 2 },
      { question: 'Is customer data used to train shared AI models?', answer: 'No. Customer data is not used to train models shared across customers.', category: 'Data handling', visible: true, sortOrder: 3 },
      { question: 'How do I report a security issue?', answer: 'Email the security contact listed on this page. Include a concise description and reproduction details when possible.', category: 'Program', visible: true, sortOrder: 4 }
    ],
    subprocessors: [
      { name: 'Cloudflare', description: 'Global edge network and developer platform.', purpose: 'Edge delivery, application security, trust-center hosting, data storage, and transactional email.', location: 'Global', url: 'https://www.cloudflare.com/', visible: true, sortOrder: 1 }
    ],
    updates: [
      { title: 'Annual assurance materials refreshed', body: 'The current security overview and independent assessment dates have been updated for the annual review cycle.', category: 'COMPLIANCE', visibilityType: 'PUBLIC', publishedAt: '2026-08-30T00:00:00.000Z', visible: true },
      { title: 'Subprocessor register reviewed', body: 'The public subprocessor register was reviewed and confirmed current.', category: 'PRIVACY', visibilityType: 'PUBLIC', publishedAt: '2026-07-12T00:00:00.000Z', visible: true }
    ],
    videos: [],
    controlCategories: [
      {
        name: 'Access control',
        visibility: 'PUBLIC',
        controls: [
          { name: 'Single sign-on and MFA', description: 'Workforce access to production systems requires SSO with phishing-resistant multi-factor authentication.', status: 'OK', tags: { domain: ['identity'] } },
          { name: 'Least-privilege access reviews', description: 'Production access is reviewed quarterly and removed within one business day of role change or departure.', status: 'OK', tags: { domain: ['identity'] } }
        ]
      },
      {
        name: 'Data protection',
        visibility: 'PUBLIC',
        controls: [
          { name: 'Encryption in transit and at rest', description: 'TLS 1.2 or later for all external traffic. Data at rest is encrypted with provider-managed keys.', status: 'OK', tags: { domain: ['cryptography'] } },
          { name: 'Backup and restore testing', description: 'Backups are taken daily and restore procedures are exercised at least annually.', status: 'UNMAPPED', tags: { domain: ['resilience'] } }
        ]
      },
      {
        name: 'Internal audit evidence',
        visibility: 'SHAREABLE',
        controls: [
          { name: 'Vulnerability remediation SLAs', description: 'Critical findings are remediated within 7 days, high within 30 days. Evidence is available to approved viewers.', status: 'OK', tags: { domain: ['vulnerability-management'] } }
        ]
      }
    ],
    dataCollected: [
      { dataCollected: 'Business contact information', status: 'COLLECTED' },
      { dataCollected: 'Product usage telemetry', status: 'COLLECTED' },
      { dataCollected: 'Payment card numbers', status: 'NOT_COLLECTED' },
      { dataCollected: 'Precise geolocation', status: 'NOT_COLLECTED' }
    ]
  }).bundle;
}

export function demoImportCounts(): Record<string, number> {
  return normalizeImportBundle(demoImportBundle()).counts;
}
