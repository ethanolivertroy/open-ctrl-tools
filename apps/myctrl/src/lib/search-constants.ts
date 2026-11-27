/**
 * Shared search constants and utilities used by both
 * CommandSearch (Cmd+K modal) and FullPageSearch (/search page).
 */

// Single framework prefixes
export const PREFIX_MAP: Record<string, string> = {
  'nist': 'nist-800-53-r5',
  'pci': 'pci-dss-v4',
  'fedramp20x': 'fedramp-20x-ksi',
  'fedrampr5': 'fedramp-rev5',
  'fedramprev5': 'fedramp-rev5',
  'llm': 'owasp-llm-top10',
  'web': 'owasp-web-top10',
  'api': 'owasp-api-top10',
  'mobile': 'owasp-mobile-top10',
  'sc': 'owasp-smart-contract-top10',
  'smartcontract': 'owasp-smart-contract-top10',
  'cis': 'cis-controls-v8',
  'iso': 'iso-27001-2022',
  'soc': 'soc2-tsc',
  'csf': 'nist-csf-v2',
  'k8s': 'kubernetes-stig-v2r4',
  'ai': 'nist-ai-rmf',
  '42001': 'iso-42001',
  '23894': 'iso-23894',
  'euai': 'eu-ai-act',
  '171': 'nist-800-171-r2',
  '800-171': 'nist-800-171-r2',
  'cui': 'nist-800-171-r2',
  'cmmc': 'cmmc-v2',
  'hipaa': 'hipaa-security',
  'gdpr': 'gdpr',
  'nis2': 'nis2',
  'ccpa': 'ccpa',
  'govramp': 'govramp',
  'aiuc': 'aiuc-1',
};

// Category prefixes that map to multiple frameworks
export const CATEGORY_PREFIX_MAP: Record<string, string[]> = {
  'fed': ['nist-800-53-r5', 'nist-csf-v2', 'ssdf', 'fedramp-rev5', 'fedramp-20x-ksi', 'dod-srg', 'kubernetes-stig-v2r4', 'itsg-33', 'nist-800-171-r2', 'cmmc-v2', 'govramp'],
  'federal': ['nist-800-53-r5', 'nist-csf-v2', 'ssdf', 'fedramp-rev5', 'fedramp-20x-ksi', 'dod-srg', 'kubernetes-stig-v2r4', 'itsg-33', 'nist-800-171-r2', 'cmmc-v2', 'govramp'],
  'fedramp': ['fedramp-rev5', 'fedramp-20x-ksi'],
  'ai': ['nist-ai-rmf', 'iso-42001', 'iso-23894', 'eu-ai-act', 'owasp-llm-top10', 'aiuc-1'],
  'ent': ['pci-dss-v4', 'iso-27001-2022', 'soc2-tsc', 'cis-controls-v8'],
  'enterprise': ['pci-dss-v4', 'iso-27001-2022', 'soc2-tsc', 'cis-controls-v8'],
  'owasp': ['owasp-web-top10', 'owasp-api-top10', 'owasp-mobile-top10', 'owasp-llm-top10', 'owasp-smart-contract-top10'],
  'dod': ['cmmc-v2', 'dod-srg', 'kubernetes-stig-v2r4'],
  'privacy': ['hipaa-security', 'gdpr', 'ccpa', 'india-dpdpa', 'sa-pdpl', 'apec-privacy', 'iso-27701', 'iso-29100', 'oecd-privacy', 'dpmp', 'us-dpf', 'fipps', 'nv-reg5', 'or-cpa', 'tn-ipa', 'tx-cdpa', 'va-cdpa', 'nis2'],
  'priv': ['hipaa-security', 'gdpr', 'ccpa', 'india-dpdpa', 'sa-pdpl', 'apec-privacy', 'iso-27701', 'iso-29100', 'oecd-privacy', 'dpmp', 'us-dpf', 'fipps', 'nv-reg5', 'or-cpa', 'tn-ipa', 'tx-cdpa', 'va-cdpa', 'nis2'],
  'eu': ['gdpr', 'nis2', 'eu-ai-act'],
  'intl': ['canada-itsp', 'canada-osfi-b13', 'au-essential-8', 'au-ism', 'china-csl', 'india-dpdpa', 'india-sebi', 'nz-hisf', 'nz-hisf-suppliers', 'sa-iot', 'sa-pdpl', 'spain-ens', 'uae-niaf', 'uk-caf', 'uk-defstan', 'apec-privacy', 'iec-60601', 'imo-maritime', 'oecd-privacy', 'sparta'],
  'international': ['canada-itsp', 'canada-osfi-b13', 'au-essential-8', 'au-ism', 'china-csl', 'india-dpdpa', 'india-sebi', 'nz-hisf', 'nz-hisf-suppliers', 'sa-iot', 'sa-pdpl', 'spain-ens', 'uae-niaf', 'uk-caf', 'uk-defstan', 'apec-privacy', 'iec-60601', 'imo-maritime', 'oecd-privacy', 'sparta'],
};

// Reverse map for display
export const FRAMEWORK_LABELS: Record<string, string> = {
  'nist-800-53-r5': 'NIST',
  'pci-dss-v4': 'PCI',
  'fedramp-20x-ksi': 'FedRAMP',
  'owasp-llm-top10': 'LLM',
  'owasp-web-top10': 'Web',
  'owasp-api-top10': 'API',
  'owasp-mobile-top10': 'Mobile',
  'owasp-smart-contract-top10': 'Smart Contract',
  'cis-controls-v8': 'CIS',
  'iso-27001-2022': 'ISO',
  'soc2-tsc': 'SOC2',
  'nist-csf-v2': 'CSF',
  'kubernetes-stig-v2r4': 'K8s',
  'nist-ai-rmf': 'AI RMF',
  'iso-42001': 'ISO 42001',
  'iso-23894': 'ISO 23894',
  'eu-ai-act': 'EU AI Act',
  'nist-800-171-r2': '800-171',
  'cmmc-v2': 'CMMC',
  'hipaa-security': 'HIPAA',
  'gdpr': 'GDPR',
  'nis2': 'NIS2',
  'ccpa': 'CCPA',
  'govramp': 'GovRAMP',
  'aiuc-1': 'AIUC-1',
};

// Category labels for display
export const CATEGORY_LABELS: Record<string, string> = {
  'fed': 'Federal',
  'federal': 'Federal',
  'fedramp': 'FedRAMP',
  'ai': 'AI',
  'ent': 'Enterprise',
  'enterprise': 'Enterprise',
  'owasp': 'OWASP',
  'dod': 'DoD',
  'privacy': 'Privacy',
  'priv': 'Privacy',
  'intl': 'International',
  'international': 'International',
  'eu': 'EU',
};

// 6 category pills for simplified filtering UI
export const CATEGORY_FILTERS = [
  { id: 'fed', label: 'Federal', prefix: 'fed:', frameworks: CATEGORY_PREFIX_MAP['fed'], colorClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20' },
  { id: 'ai', label: 'AI', prefix: 'ai:', frameworks: CATEGORY_PREFIX_MAP['ai'], colorClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20' },
  { id: 'ent', label: 'Enterprise', prefix: 'ent:', frameworks: CATEGORY_PREFIX_MAP['ent'], colorClass: 'bg-teal-500/10 text-teal-400 border-teal-500/30 hover:bg-teal-500/20' },
  { id: 'owasp', label: 'OWASP', prefix: 'owasp:', frameworks: CATEGORY_PREFIX_MAP['owasp'], colorClass: 'bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20' },
  { id: 'priv', label: 'Privacy', prefix: 'priv:', frameworks: CATEGORY_PREFIX_MAP['priv'], colorClass: 'bg-pink-500/10 text-pink-400 border-pink-500/30 hover:bg-pink-500/20' },
  { id: 'intl', label: 'International', prefix: 'intl:', frameworks: CATEGORY_PREFIX_MAP['intl'], colorClass: 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20' },
];

// Parse search query for prefix (e.g., "nist:ac-2" -> { prefix: "nist", term: "ac-2" })
// Supports both single framework prefixes and category prefixes
export function parseSearchQuery(query: string): {
  frameworkId: string | null;
  frameworkIds: string[] | null;
  categoryLabel: string | null;
  term: string;
} {
  // Check for category prefix first (fed:, federal:, fedramp:, ai:, ent:, enterprise:, owasp:, dod:, privacy:, priv:, intl:, international:, eu:)
  const categoryMatch = query.match(/^(fed|federal|fedramp|ai|ent|enterprise|owasp|dod|privacy|priv|intl|international|eu):(.*)$/i);
  if (categoryMatch) {
    const prefix = categoryMatch[1].toLowerCase();
    return {
      frameworkId: null,
      frameworkIds: CATEGORY_PREFIX_MAP[prefix] || null,
      categoryLabel: CATEGORY_LABELS[prefix] || null,
      term: categoryMatch[2].trim()
    };
  }

  // Check for single framework prefix
  const match = query.match(/^(nist|pci|fedramp20x|fedrampr5|fedramprev5|llm|web|api|mobile|sc|smartcontract|cis|iso|soc|csf|k8s|ai|42001|23894|euai|govramp|aiuc):(.*)$/i);
  if (match) {
    const prefix = match[1].toLowerCase();
    return {
      frameworkId: PREFIX_MAP[prefix] || null,
      frameworkIds: null,
      categoryLabel: null,
      term: match[2].trim()
    };
  }
  return { frameworkId: null, frameworkIds: null, categoryLabel: null, term: query };
}
