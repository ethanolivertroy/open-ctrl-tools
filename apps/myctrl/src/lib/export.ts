import type { Control, FrameworkConfig } from '../data/types';
import {
  isNistControl,
  isPciControl,
  isCISControl,
  isFedRAMPControl,
  isGovRAMPControl,
  isSTIGControl,
  isAIRMFControl,
  isEUAIActControl,
  isITSG33Control,
  isCMMCControl,
  isNIST171Control,
  isDoDSRGControl,
  isNistCSFControl,
} from '../data/types';

export interface ExportMetadata {
  frameworkId: string;
  frameworkName: string;
  version: string;
  exportDate: string;
  totalControls: number;
  filters?: Record<string, string>;
  license: string;
  source?: string;
}

// Get CSV headers based on framework type
function getCSVHeaders(controls: Control[], frameworkId: string): string[] {
  const baseHeaders = ['control_id', 'title', 'family', 'description'];

  if (controls.length === 0) return baseHeaders;

  const sample = controls[0];

  if (isNistControl(sample)) {
    return [...baseHeaders, 'baseline_low', 'baseline_moderate', 'baseline_high', 'baseline_privacy', 'related_controls'];
  }
  if (isCISControl(sample)) {
    return [...baseHeaders, 'ig1', 'ig2', 'ig3', 'asset_type', 'security_function'];
  }
  if (isPciControl(sample)) {
    return [...baseHeaders, 'section', 'testing_procedures', 'guidance'];
  }
  if (isGovRAMPControl(sample)) {
    return [...baseHeaders, 'baseline_low', 'baseline_moderate', 'core_control', 'discussion'];
  }
  if (isFedRAMPControl(sample)) {
    return [...baseHeaders, 'baseline_low', 'baseline_moderate', 'baseline_high', 'baseline_li_saas', 'discussion'];
  }
  if (isDoDSRGControl(sample)) {
    return [...baseHeaders, 'il4_mod', 'il4_high', 'il5', 'il6', 'discussion'];
  }
  if (isSTIGControl(sample)) {
    return [...baseHeaders, 'stig_id', 'severity', 'check_content', 'fix_text', 'cci_refs'];
  }
  if (isAIRMFControl(sample)) {
    return [...baseHeaders, 'category', 'ai_actors', 'suggested_actions'];
  }
  if (isEUAIActControl(sample)) {
    return [...baseHeaders, 'article', 'risk_tier', 'applies_to', 'deadline', 'penalty_tier'];
  }
  if (isITSG33Control(sample)) {
    return [...baseHeaders, 'pbmm_included', 'pbmm_priority', 'secret_included', 'secret_priority'];
  }
  if (isCMMCControl(sample)) {
    return [...baseHeaders, 'cmmc_level', 'nist_800_171', 'nist_800_172'];
  }
  if (isNIST171Control(sample)) {
    return [...baseHeaders, 'requirement_type', 'discussion'];
  }
  if (isNistCSFControl(sample)) {
    return [...baseHeaders, 'category', 'category_title', 'implementation_examples'];
  }

  return [...baseHeaders, 'related_controls'];
}

// Escape CSV value (handle quotes and commas)
function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Flatten a control to a record for CSV export
function flattenControl(control: Control, frameworkId: string): Record<string, unknown> {
  const flat: Record<string, unknown> = {
    control_id: control.control_id,
    title: control.title,
    family: control.family,
    description: control.description,
    related_controls: control.related_controls?.join('; ') || '',
  };

  if (isNistControl(control)) {
    flat.baseline_low = control.baseline_low;
    flat.baseline_moderate = control.baseline_moderate;
    flat.baseline_high = control.baseline_high;
    flat.baseline_privacy = control.baseline_privacy;
  }

  if (isCISControl(control)) {
    flat.ig1 = control.ig1;
    flat.ig2 = control.ig2;
    flat.ig3 = control.ig3;
    flat.asset_type = control.asset_type || '';
    flat.security_function = control.security_function || '';
  }

  if (isPciControl(control)) {
    flat.section = control.section || '';
    flat.testing_procedures = control.testing_procedures?.map(tp => tp.text).join(' | ') || '';
    flat.guidance = control.guidance?.purpose || '';
  }

  if (isGovRAMPControl(control)) {
    flat.baseline_low = control.baselines.low?.included || false;
    flat.baseline_moderate = control.baselines.moderate?.included || false;
    flat.core_control = control.core_control;
    flat.discussion = control.discussion || '';
  }

  if (isFedRAMPControl(control)) {
    flat.baseline_low = control.baselines.low?.included || false;
    flat.baseline_moderate = control.baselines.moderate?.included || false;
    flat.baseline_high = control.baselines.high?.included || false;
    flat.baseline_li_saas = control.baselines.li_saas?.included || false;
    flat.discussion = control.discussion || '';
  }

  if (isDoDSRGControl(control)) {
    flat.il4_mod = control.impact_levels.il4_mod?.included || false;
    flat.il4_high = control.impact_levels.il4_high?.included || false;
    flat.il5 = control.impact_levels.il5?.included || false;
    flat.il6 = control.impact_levels.il6?.included || false;
    flat.discussion = control.discussion || '';
  }

  if (isSTIGControl(control)) {
    flat.stig_id = control.stig_id;
    flat.severity = control.severity;
    flat.check_content = control.check_content;
    flat.fix_text = control.fix_text;
    flat.cci_refs = control.cci_refs?.join('; ') || '';
  }

  if (isAIRMFControl(control)) {
    flat.category = control.category;
    flat.ai_actors = control.ai_actors?.join('; ') || '';
    flat.suggested_actions = control.suggested_actions || '';
  }

  if (isEUAIActControl(control)) {
    flat.article = control.article;
    flat.risk_tier = control.risk_tier;
    flat.applies_to = control.applies_to?.join('; ') || '';
    flat.deadline = control.deadline || '';
    flat.penalty_tier = control.penalty_tier || '';
  }

  if (isITSG33Control(control)) {
    flat.pbmm_included = control.profiles.pbmm?.included || false;
    flat.pbmm_priority = control.profiles.pbmm?.priority || '';
    flat.secret_included = control.profiles.secret?.included || false;
    flat.secret_priority = control.profiles.secret?.priority || '';
  }

  if (isCMMCControl(control)) {
    flat.cmmc_level = control.cmmc_level;
    flat.nist_800_171 = control.nist_800_171 || '';
    flat.nist_800_172 = control.nist_800_172 || '';
  }

  if (isNIST171Control(control)) {
    flat.requirement_type = control.requirement_type;
    flat.discussion = control.discussion || '';
  }

  if (isNistCSFControl(control)) {
    flat.category = control.category || '';
    flat.category_title = control.category_title || '';
    flat.implementation_examples = control.implementation_examples?.join(' | ') || '';
  }

  return flat;
}

// Generate CSV string from controls
export function generateCSV(
  controls: Control[],
  config: FrameworkConfig,
  filters?: Record<string, string>
): string {
  const headers = getCSVHeaders(controls, config.id);
  const rows: string[] = [headers.map(h => escapeCSV(h)).join(',')];

  for (const control of controls) {
    const flat = flattenControl(control, config.id);
    const row = headers.map(header => escapeCSV(flat[header]));
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

// Generate JSON export object
export function generateJSON(
  controls: Control[],
  config: FrameworkConfig,
  filters?: Record<string, string>
): object {
  const metadata: ExportMetadata = {
    frameworkId: config.id,
    frameworkName: config.name,
    version: config.version,
    exportDate: new Date().toISOString(),
    totalControls: controls.length,
    license: config.license,
  };

  if (filters && Object.keys(filters).length > 0) {
    metadata.filters = filters;
  }

  if (config.officialUrl) {
    metadata.source = config.officialUrl;
  }

  return {
    metadata,
    controls,
  };
}

// Trigger file download in browser
export function downloadFile(
  content: string | object,
  filename: string,
  mimeType: string
): void {
  const data = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

// Generate filename with date and optional filters
export function generateFilename(
  frameworkId: string,
  format: 'csv' | 'json',
  filters?: Record<string, string>
): string {
  const date = new Date().toISOString().split('T')[0];
  let filename = frameworkId;

  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value) {
        filename += `-${key}-${value}`;
      }
    }
  }

  return `${filename}-${date}.${format}`;
}

// Main export function
export function exportControls(
  controls: Control[],
  config: FrameworkConfig,
  format: 'csv' | 'json',
  filters?: Record<string, string>
): void {
  const filename = generateFilename(config.id, format, filters);

  if (format === 'csv') {
    const csv = generateCSV(controls, config, filters);
    downloadFile(csv, filename, 'text/csv;charset=utf-8');
  } else {
    const json = generateJSON(controls, config, filters);
    downloadFile(json, filename, 'application/json');
  }
}

// Official download URLs for proprietary frameworks
const PROPRIETARY_DOWNLOAD_URLS: Record<string, string> = {
  'pci-dss-v4': 'https://www.pcisecuritystandards.org/document_library/',
  'iso-27001-2022': 'https://www.iso.org/standard/82875.html',
  'iso-42001': 'https://www.iso.org/standard/81230.html',
  'iso-23894': 'https://www.iso.org/standard/77304.html',
  'soc2-tsc': 'https://www.aicpa-cima.com/resources/download/2017-trust-services-criteria-with-revised-points-of-focus-2022',
};

// Check if framework is proprietary (requires official source redirect)
export function isProprietaryFramework(frameworkId: string): boolean {
  return frameworkId in PROPRIETARY_DOWNLOAD_URLS;
}

// Check if framework requires redirect to official source (not exportable locally)
export function isProtectedFramework(frameworkId: string, _config: FrameworkConfig): boolean {
  return isProprietaryFramework(frameworkId);
}

// Get official download URL for protected frameworks
// Returns null if framework allows local export
export function getOfficialDownloadUrl(frameworkId: string, _config: FrameworkConfig): string | null {
  return PROPRIETARY_DOWNLOAD_URLS[frameworkId] ?? null;
}

// Get display label for official download button
export function getOfficialDownloadLabel(frameworkId: string, _config: FrameworkConfig): string {
  if (frameworkId.startsWith('iso-')) return 'Official ISO Store';
  if (frameworkId === 'pci-dss-v4') return 'PCI Document Library';
  if (frameworkId === 'soc2-tsc') return 'Official AICPA Download';
  return 'Official Download';
}
