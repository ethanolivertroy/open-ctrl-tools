/**
 * Cross-framework mapping utilities
 *
 * Direct pairwise crosswalks are registered declaratively in
 * CROSSWALK_REGISTRY. Built-in public-domain crosswalks ship directly in
 * src/data/, while optional/self-licensed crosswalks and bridge workbooks can be
 * dropped into the gitignored src/data/local/crosswalks/ directory and are
 * automatically discovered via import.meta.glob.
 */

import type { CrosswalkData, CrosswalkEntry, PCICrosswalkData, PCICrosswalkEntry, ISOCrosswalkData } from './types';
import { isSTIGControl } from './types';
import crosswalkData from './csf-nist-crosswalk.json';
import pciCrosswalkData from './csf-pci-crosswalk.json';
import isoCrosswalkData from './csf-iso-crosswalk.json';
import cisCrosswalkData from './cis-csf-crosswalk.json';
import cciCrosswalkData from './cci-nist-crosswalk.json';
import euAiActAirmfCrosswalkData from './eu-ai-act-airmf-crosswalk.json';
import cmmcNist171CrosswalkData from './cmmc-nist171-crosswalk.json';
import { getFrameworkData, hasFrameworkData } from './frameworks';
import { getControlBySlug, slugify, getControlById, getFrameworkConfig } from './controls';

/** Forward or reverse crosswalk lookup: control id -> mapped control ids */
export type CrosswalkIdMap = Record<string, string[]>;

// ─── Optional local crosswalk overlay discovery ──────────────────

const localCrosswalkModules = import.meta.glob<Record<string, unknown>>(
  './local/crosswalks/*.json',
  { eager: true, import: 'default' },
);

function loadLocalCrosswalk<T>(filename: string, fallback: T): T {
  return (localCrosswalkModules[`./local/crosswalks/${filename}`] as T | undefined) ?? fallback;
}

// ─── Typed views over built-in & optional local crosswalk JSON ───

const data = crosswalkData as CrosswalkData;
const pciData = pciCrosswalkData as PCICrosswalkData;
const isoData = isoCrosswalkData as ISOCrosswalkData;

const cisData = cisCrosswalkData as {
  metadata: { source: string; source_url: string; csf_version: string; cis_version: string; total_mappings: number; csf_controls: number; cis_controls: number };
  csf_to_cis: CrosswalkIdMap; cis_to_csf: CrosswalkIdMap;
};

const cciData = cciCrosswalkData as {
  metadata: { source: string; source_url: string; nist_version: string; description: string; total_ccis: number };
  cci_to_nist: CrosswalkIdMap; nist_to_cci: CrosswalkIdMap;
};

const euAiActAirmfData = euAiActAirmfCrosswalkData as {
  metadata: { source: string; source_url: string; eu_ai_act_version: string; ai_rmf_version: string; description: string; total_mappings: number; eu_ai_act_articles: number; ai_rmf_controls: number };
  eu_ai_act_to_ai_rmf: CrosswalkIdMap; ai_rmf_to_eu_ai_act: CrosswalkIdMap; eu_ai_act_articles: Record<string, string>;
};

const cmmcNist171Data = cmmcNist171CrosswalkData as {
  metadata: { source: string; cmmc_version: string; nist_version: string; total_mappings: number; description: string };
  mappings: Array<{ cmmc: string; nist_800_171: string }>;
};

interface SOC2MappingMeta { framework: string; version: string; total_mappings: number; tsc_criteria: number }
interface SOC2CrosswalkShape {
  metadata: {
    description: string; tsc_version: string; generated_from: string[];
    mappings: { csf: SOC2MappingMeta & { csf_elements: number }; iso: SOC2MappingMeta & { iso_controls: number }; nist: SOC2MappingMeta & { nist_controls: number } };
  };
  tsc_to_csf: CrosswalkIdMap; csf_to_tsc: CrosswalkIdMap;
  tsc_to_iso: CrosswalkIdMap; iso_to_tsc: CrosswalkIdMap;
  tsc_to_nist: CrosswalkIdMap; nist_to_tsc: CrosswalkIdMap;
}

const soc2Data = loadLocalCrosswalk<SOC2CrosswalkShape>('soc2-crosswalk.json', {
  metadata: {
    description: '',
    tsc_version: '',
    generated_from: [],
    mappings: {
      csf: { framework: 'NIST CSF', version: '2.0', total_mappings: 0, tsc_criteria: 0, csf_elements: 0 },
      iso: { framework: 'ISO 27001', version: '2022', total_mappings: 0, tsc_criteria: 0, iso_controls: 0 },
      nist: { framework: 'NIST 800-53', version: '5.2.0', total_mappings: 0, tsc_criteria: 0, nist_controls: 0 },
    },
  },
  tsc_to_csf: {}, csf_to_tsc: {},
  tsc_to_iso: {}, iso_to_tsc: {},
  tsc_to_nist: {}, nist_to_tsc: {},
});

const aiRmfIso42001Data = loadLocalCrosswalk<{
  metadata: { source: string; source_url: string; ai_rmf_version: string; iso_version: string; description: string; total_mappings: number; ai_rmf_controls: number; iso_clauses: number };
  ai_rmf_to_iso42001: CrosswalkIdMap; iso42001_to_ai_rmf: CrosswalkIdMap; iso42001_clauses: Record<string, string>;
}>('ai-rmf-iso42001-crosswalk.json', {
  metadata: { source: '', source_url: '', ai_rmf_version: '', iso_version: '', description: '', total_mappings: 0, ai_rmf_controls: 0, iso_clauses: 0 },
  ai_rmf_to_iso42001: {}, iso42001_to_ai_rmf: {}, iso42001_clauses: {},
});

const aiRmfIso23894Data = loadLocalCrosswalk<{
  metadata: { source: string; source_url: string; ai_rmf_version: string; iso_version: string; description: string; total_mappings: number; ai_rmf_categories: number; iso_clauses: number };
  ai_rmf_to_iso23894: CrosswalkIdMap; iso23894_to_ai_rmf: CrosswalkIdMap; iso23894_clauses: Record<string, string>;
}>('ai-rmf-iso23894-crosswalk.json', {
  metadata: { source: '', source_url: '', ai_rmf_version: '', iso_version: '', description: '', total_mappings: 0, ai_rmf_categories: 0, iso_clauses: 0 },
  ai_rmf_to_iso23894: {}, iso23894_to_ai_rmf: {}, iso23894_clauses: {},
});

const aiucAirmfData = loadLocalCrosswalk<{
  metadata: { source: string; source_url: string; aiuc_version: string; ai_rmf_version: string; description: string; total_mappings: number; aiuc_controls: number; ai_rmf_controls: number };
  aiuc_to_ai_rmf: CrosswalkIdMap; ai_rmf_to_aiuc: CrosswalkIdMap;
}>('aiuc-1-airmf-crosswalk.json', {
  metadata: { source: '', source_url: '', aiuc_version: '', ai_rmf_version: '', description: '', total_mappings: 0, aiuc_controls: 0, ai_rmf_controls: 0 },
  aiuc_to_ai_rmf: {}, ai_rmf_to_aiuc: {},
});

const aiucOwaspLLMData = loadLocalCrosswalk<{
  metadata: { source: string; source_url: string; aiuc_version: string; owasp_llm_version: string; description: string; total_mappings: number; aiuc_controls_mapped: number; owasp_llm_risks: number };
  aiuc_to_owasp_llm: CrosswalkIdMap; owasp_llm_to_aiuc: CrosswalkIdMap;
}>('aiuc-1-owasp-llm-crosswalk.json', {
  metadata: { source: '', source_url: '', aiuc_version: '', owasp_llm_version: '', description: '', total_mappings: 0, aiuc_controls_mapped: 0, owasp_llm_risks: 0 },
  aiuc_to_owasp_llm: {}, owasp_llm_to_aiuc: {},
});

interface CCFCrosswalkShape {
  metadata: { source: string; description: string };
  ccf_to_framework: Record<string, CrosswalkIdMap>;
  framework_to_ccf: Record<string, CrosswalkIdMap>;
}

const ccfData = loadLocalCrosswalk<CCFCrosswalkShape>('ccf-crosswalks.json', {
  metadata: { source: '', description: '' },
  ccf_to_framework: {},
  framework_to_ccf: {},
});

const ccfExtendedData = loadLocalCrosswalk<CCFCrosswalkShape>('ccf-extended-crosswalks.json', {
  metadata: { source: '', description: '' },
  ccf_to_framework: {},
  framework_to_ccf: {},
});

const hipaaCcfData = loadLocalCrosswalk<{ hipaa_to_ccf: CrosswalkIdMap; ccf_to_hipaa: CrosswalkIdMap }>(
  'hipaa-ccf-crosswalk.json',
  { hipaa_to_ccf: {}, ccf_to_hipaa: {} },
);
const gdprCcfData = loadLocalCrosswalk<{ gdpr_to_ccf: CrosswalkIdMap; ccf_to_gdpr: CrosswalkIdMap }>(
  'gdpr-ccf-crosswalk.json',
  { gdpr_to_ccf: {}, ccf_to_gdpr: {} },
);
const nis2CcfData = loadLocalCrosswalk<{ nis2_to_ccf: CrosswalkIdMap; ccf_to_nis2: CrosswalkIdMap }>(
  'nis2-ccf-crosswalk.json',
  { nis2_to_ccf: {}, ccf_to_nis2: {} },
);
const ccpaCcfData = loadLocalCrosswalk<{ ccpa_to_ccf: CrosswalkIdMap; ccf_to_ccpa: CrosswalkIdMap }>(
  'ccpa-ccf-crosswalk.json',
  { ccpa_to_ccf: {}, ccf_to_ccpa: {} },
);

const cjisFedrampData = loadLocalCrosswalk<{
  metadata: {
    source_framework: string; target_framework: string; description: string; bridge: string; method: string;
    total_mappings: number; cjis_controls_mapped: number; fedramp_controls_mapped: number;
    cjis_controls_unmapped: number; unmapped_cjis_controls: string[];
  };
  cjis_to_fedramp: CrosswalkIdMap; fedramp_to_cjis: CrosswalkIdMap;
}>('cjis-fedramp-crosswalk.json', {
  metadata: {
    source_framework: 'cjis',
    target_framework: 'fedramp-rev5',
    description: '',
    bridge: '',
    method: '',
    total_mappings: 0,
    cjis_controls_mapped: 0,
    fedramp_controls_mapped: 0,
    cjis_controls_unmapped: 0,
    unmapped_cjis_controls: [],
  },
  cjis_to_fedramp: {},
  fedramp_to_cjis: {},
});

// ─── CMMC <-> NIST 800-171 lookup maps (built at init) ───────────

const cmmcToNist171 = new Map<string, string>();
const nist171ToCmmc = new Map<string, string[]>();

for (const mapping of cmmcNist171Data.mappings) {
  cmmcToNist171.set(mapping.cmmc, mapping.nist_800_171);
  const existing = nist171ToCmmc.get(mapping.nist_800_171) || [];
  existing.push(mapping.cmmc);
  nist171ToCmmc.set(mapping.nist_800_171, existing);
}

const cmmcToNist171Record: CrosswalkIdMap = Object.fromEntries(
  [...cmmcToNist171].map(([cmmc, nist]) => [cmmc, [nist]]),
);
const nist171ToCmmcRecord: CrosswalkIdMap = Object.fromEntries(nist171ToCmmc);

// ─── ID normalization helpers ────────────────────────────────────

const pciDssControlIds: string[] = hasFrameworkData('pci-dss-v4')
  ? getFrameworkData('pci-dss-v4').controls.map((c) => c.control_id)
  : [];

function normalizeControlIdForFramework(frameworkId: string, controlId: string): string {
  if (frameworkId === 'soc2-tsc') {
    return controlId.replace(/-POF\d+$/, '');
  }

  if (frameworkId === 'eu-ai-act') {
    if (!controlId.startsWith('Art.')) {
      const match = controlId.match(/^(\d+)\.(\d+)(\([a-z]\))?$/);
      if (match) {
        return `Art. ${match[1]}(${match[2]})${match[3] || ''}`;
      }
      return `Art. ${controlId}`;
    }
  }

  if (frameworkId === 'nist-ai-rmf') {
    return controlId.replace(' ', '-');
  }

  return controlId;
}

function deduplicateControlIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function expandPciDssIds(ids: string[]): string[] {
  if (pciDssControlIds.length === 0) {
    return deduplicateControlIds(ids);
  }
  const expanded: string[] = [];
  for (const id of ids) {
    if (pciDssControlIds.includes(id)) {
      expanded.push(id);
      continue;
    }
    const matchingSubReqs = pciDssControlIds.filter((controlId) => controlId.startsWith(id + '.'));
    expanded.push(...(matchingSubReqs.length > 0 ? matchingSubReqs : [id]));
  }
  return deduplicateControlIds(expanded);
}

function aiRmfCategoryKey(controlId: string): string {
  const match = controlId.match(/^([A-Z]+)-(\d+)/);
  return match ? `${match[1]} ${match[2]}` : controlId;
}

// ─── Declarative crosswalk registry ──────────────────────────────

export interface CrosswalkPairDef {
  a: string;
  b: string;
  aName: string;
  bName: string;
  aToB: CrosswalkIdMap;
  bToA: CrosswalkIdMap;
  normalizeAKey?: (controlId: string) => string;
  expandBIds?: (ids: string[]) => string[];
}

/** Sum of mapped ids across a crosswalk lookup map */
export function countMappings(map: CrosswalkIdMap): number {
  return Object.values(map).reduce((sum, ids) => sum + ids.length, 0);
}

const ALL_CROSSWALK_PAIRS: readonly CrosswalkPairDef[] = [
  { a: 'nist-csf-v2', aName: 'NIST CSF 2.0', b: 'nist-800-53-r5', bName: 'NIST SP 800-53 r5', aToB: data.csf_to_nist, bToA: data.nist_to_csf },
  { a: 'nist-csf-v2', aName: 'NIST CSF 2.0', b: 'pci-dss-v4', bName: 'PCI DSS v4.0.1', aToB: pciData.csf_to_pci, bToA: pciData.pci_to_csf },
  { a: 'nist-csf-v2', aName: 'NIST CSF 2.0', b: 'iso-27001-2022', bName: 'ISO 27001:2022', aToB: isoData.csf_to_iso, bToA: isoData.iso_to_csf },
  { a: 'nist-csf-v2', aName: 'NIST CSF 2.0', b: 'soc2-tsc', bName: 'SOC 2 TSC', aToB: soc2Data.csf_to_tsc, bToA: soc2Data.tsc_to_csf },
  { a: 'nist-csf-v2', aName: 'NIST CSF 2.0', b: 'cis-controls-v8', bName: 'CIS Controls v8', aToB: cisData.csf_to_cis, bToA: cisData.cis_to_csf },
  { a: 'soc2-tsc', aName: 'SOC 2 TSC', b: 'iso-27001-2022', bName: 'ISO 27001:2022', aToB: soc2Data.tsc_to_iso, bToA: soc2Data.iso_to_tsc },
  { a: 'soc2-tsc', aName: 'SOC 2 TSC', b: 'nist-800-53-r5', bName: 'NIST SP 800-53 r5', aToB: soc2Data.tsc_to_nist, bToA: soc2Data.nist_to_tsc },
  { a: 'nist-ai-rmf', aName: 'NIST AI RMF', b: 'iso-42001', bName: 'ISO/IEC 42001', aToB: aiRmfIso42001Data.ai_rmf_to_iso42001, bToA: aiRmfIso42001Data.iso42001_to_ai_rmf },
  { a: 'nist-ai-rmf', aName: 'NIST AI RMF', b: 'iso-23894', bName: 'ISO/IEC 23894', aToB: aiRmfIso23894Data.ai_rmf_to_iso23894, bToA: aiRmfIso23894Data.iso23894_to_ai_rmf, normalizeAKey: aiRmfCategoryKey },
  { a: 'nist-ai-rmf', aName: 'NIST AI RMF', b: 'eu-ai-act', bName: 'EU AI Act', aToB: euAiActAirmfData.ai_rmf_to_eu_ai_act, bToA: euAiActAirmfData.eu_ai_act_to_ai_rmf },
  { a: 'nist-ai-rmf', aName: 'NIST AI RMF', b: 'aiuc-1', bName: 'AIUC-1', aToB: aiucAirmfData.ai_rmf_to_aiuc, bToA: aiucAirmfData.aiuc_to_ai_rmf },
  { a: 'aiuc-1', aName: 'AIUC-1', b: 'owasp-llm-top10', bName: 'OWASP Top 10 for LLMs', aToB: aiucOwaspLLMData.aiuc_to_owasp_llm, bToA: aiucOwaspLLMData.owasp_llm_to_aiuc },
  { a: 'cmmc-v2', aName: 'CMMC', b: 'nist-800-171-r2', bName: 'NIST SP 800-171', aToB: cmmcToNist171Record, bToA: nist171ToCmmcRecord },
  { a: 'cjis', aName: 'FBI CJIS', b: 'fedramp-rev5', bName: 'FedRAMP Rev 5', aToB: cjisFedrampData.cjis_to_fedramp, bToA: cjisFedrampData.fedramp_to_cjis },
];

/** Active direct crosswalk pairs (populated from built-in and local overlays) */
export const CROSSWALK_REGISTRY: readonly CrosswalkPairDef[] = ALL_CROSSWALK_PAIRS.filter(
  (pair) => countMappings(pair.aToB) > 0 || countMappings(pair.bToA) > 0,
);

const CROSSWALK_PAIRS: Array<[string, string]> = CROSSWALK_REGISTRY.map((pair) => [pair.a, pair.b]);

// ─── Optional local crosswalk bridge ─────────────────────────────

const frameworkToBridge: Record<string, CrosswalkIdMap> = {};
const bridgeToFramework: Record<string, CrosswalkIdMap> = {};

function mergeBridgeMaps(target: Record<string, CrosswalkIdMap>, frameworkId: string, source: CrosswalkIdMap): void {
  if (!source || Object.keys(source).length === 0) return;
  const existing = target[frameworkId];
  if (!existing) {
    target[frameworkId] = source;
    return;
  }
  const merged: CrosswalkIdMap = { ...existing };
  for (const [key, ids] of Object.entries(source)) {
    merged[key] = deduplicateControlIds([...(merged[key] ?? []), ...ids]);
  }
  target[frameworkId] = merged;
}

for (const [fwId, map] of Object.entries(ccfData.framework_to_ccf ?? {})) mergeBridgeMaps(frameworkToBridge, fwId, map);
for (const [fwId, map] of Object.entries(ccfExtendedData.framework_to_ccf ?? {})) mergeBridgeMaps(frameworkToBridge, fwId, map);
for (const [fwId, map] of Object.entries(ccfData.ccf_to_framework ?? {})) mergeBridgeMaps(bridgeToFramework, fwId, map);
for (const [fwId, map] of Object.entries(ccfExtendedData.ccf_to_framework ?? {})) mergeBridgeMaps(bridgeToFramework, fwId, map);

mergeBridgeMaps(frameworkToBridge, 'hipaa-security', hipaaCcfData.hipaa_to_ccf ?? {});
mergeBridgeMaps(bridgeToFramework, 'hipaa-security', hipaaCcfData.ccf_to_hipaa ?? {});
mergeBridgeMaps(frameworkToBridge, 'gdpr', gdprCcfData.gdpr_to_ccf ?? {});
mergeBridgeMaps(bridgeToFramework, 'gdpr', gdprCcfData.ccf_to_gdpr ?? {});
mergeBridgeMaps(frameworkToBridge, 'nis2', nis2CcfData.nis2_to_ccf ?? {});
mergeBridgeMaps(bridgeToFramework, 'nis2', nis2CcfData.ccf_to_nis2 ?? {});
mergeBridgeMaps(frameworkToBridge, 'ccpa', ccpaCcfData.ccpa_to_ccf ?? {});
mergeBridgeMaps(bridgeToFramework, 'ccpa', ccpaCcfData.ccf_to_ccpa ?? {});

function normalizeBridgeTargetIds(frameworkId: string, ids: string[]): string[] {
  const normalized = deduplicateControlIds(ids.map((id) => normalizeControlIdForFramework(frameworkId, id)));
  return frameworkId === 'pci-dss-v4' ? expandPciDssIds(normalized) : normalized;
}

/** All framework ids that participate in an active local crosswalk bridge */
export function getBridgeFrameworkIds(): string[] {
  return Object.keys(frameworkToBridge);
}

/** Bridge ids for a control (empty when no local bridge overlay is loaded) */
export function getBridgeIdsForControl(frameworkId: string, controlId: string): string[] {
  return frameworkToBridge[frameworkId]?.[controlId] ?? [];
}

/** Read-only view of loaded bridge & optional CJIS crosswalk maps */
export function getLoadedBridgeData() {
  return {
    frameworkToBridge,
    bridgeToFramework,
    ccfData,
    ccfExtendedData,
    cjisFedrampData,
  };
}

/** Look up an active registered direct pair between two frameworks (in either order) */
export function getCrosswalkPairMaps(fwA: string, fwB: string): CrosswalkPairDef | null {
  return CROSSWALK_REGISTRY.find(
    (pair) => (pair.a === fwA && pair.b === fwB) || (pair.a === fwB && pair.b === fwA),
  ) ?? null;
}

/** Derive controls in a target framework via the local crosswalk bridge */
export function getBridgeDerivedControlIds(
  sourceFrameworkId: string,
  controlId: string,
  targetFrameworkId: string,
): string[] {
  const bridgeIds = frameworkToBridge[sourceFrameworkId]?.[controlId];
  if (!bridgeIds || bridgeIds.length === 0) return [];
  const targetMap = bridgeToFramework[targetFrameworkId];
  if (!targetMap) return [];

  const targetIds: string[] = [];
  for (const bridgeId of bridgeIds) {
    const mapped = targetMap[bridgeId];
    if (mapped) targetIds.push(...mapped);
  }
  return normalizeBridgeTargetIds(targetFrameworkId, targetIds);
}

/** Count derived (source control, target control) pairs between two frameworks via the local bridge */
export function countBridgeDerivedMappings(sourceFrameworkId: string, targetFrameworkId: string): number {
  const sourceMap = frameworkToBridge[sourceFrameworkId];
  const targetMap = bridgeToFramework[targetFrameworkId];
  if (!sourceMap || !targetMap) return 0;

  let count = 0;
  for (const bridgeIds of Object.values(sourceMap)) {
    for (const bridgeId of bridgeIds) {
      count += targetMap[bridgeId]?.length ?? 0;
    }
  }
  return count;
}

// ─── Generic mapping lookups ─────────────────────────────────────

export interface CrossFrameworkMapping {
  frameworkId: string;
  controlIds: string[];
  frameworkName: string;
  derived?: boolean;
}

function frameworkDisplayName(frameworkId: string): string | null {
  try {
    return getFrameworkConfig(frameworkId).name;
  } catch {
    return null;
  }
}

export function getCrossFrameworkMappings(
  controlId: string,
  frameworkId: string,
): CrossFrameworkMapping[] {
  const mappings: CrossFrameworkMapping[] = [];
  let inRegistry = false;

  for (const pair of CROSSWALK_REGISTRY) {
    if (pair.a === frameworkId) {
      inRegistry = true;
      const key = pair.normalizeAKey ? pair.normalizeAKey(controlId) : controlId;
      const ids = pair.aToB[key];
      if (ids && ids.length > 0) {
        mappings.push({
          frameworkId: pair.b,
          frameworkName: pair.bName,
          controlIds: pair.expandBIds ? pair.expandBIds(ids) : ids,
        });
      }
    } else if (pair.b === frameworkId) {
      inRegistry = true;
      const ids = pair.bToA[controlId];
      if (ids && ids.length > 0) {
        mappings.push({ frameworkId: pair.a, frameworkName: pair.aName, controlIds: ids });
      }
    }
  }

  if (!inRegistry) {
    const nistControls = getSTIGNistMappings(frameworkId, controlId);
    if (nistControls && nistControls.length > 0) {
      mappings.push({
        frameworkId: 'nist-800-53-r5',
        frameworkName: 'NIST SP 800-53 r5',
        controlIds: nistControls,
      });
    }
  }

  const bridgeIds = frameworkToBridge[frameworkId]?.[controlId];
  if (bridgeIds && bridgeIds.length > 0) {
    const covered = new Set(mappings.map((m) => m.frameworkId));
    const derivedMappings: CrossFrameworkMapping[] = [];

    for (const targetId of Object.keys(bridgeToFramework)) {
      if (targetId === frameworkId || covered.has(targetId)) continue;
      const frameworkName = frameworkDisplayName(targetId);
      if (!frameworkName) continue;

      const controlIds = getBridgeDerivedControlIds(frameworkId, controlId, targetId);
      if (controlIds.length > 0) {
        derivedMappings.push({ frameworkId: targetId, frameworkName, controlIds, derived: true });
      }
    }

    derivedMappings.sort((a, b) => a.frameworkName.localeCompare(b.frameworkName));
    mappings.push(...derivedMappings);
  }

  return mappings;
}

export function hasCrossFrameworkMappings(controlId: string, frameworkId: string): boolean {
  let inRegistry = false;

  for (const pair of CROSSWALK_REGISTRY) {
    if (pair.a === frameworkId) {
      inRegistry = true;
      const key = pair.normalizeAKey ? pair.normalizeAKey(controlId) : controlId;
      if ((pair.aToB[key]?.length || 0) > 0) return true;
    } else if (pair.b === frameworkId) {
      inRegistry = true;
      if ((pair.bToA[controlId]?.length || 0) > 0) return true;
    }
  }

  if (!inRegistry) {
    const nistControls = getSTIGNistMappings(frameworkId, controlId);
    if (nistControls && nistControls.length > 0) return true;
  }

  return (frameworkToBridge[frameworkId]?.[controlId]?.length || 0) > 0;
}

function getSTIGNistMappings(frameworkId: string, controlId: string): string[] | null {
  try {
    const config = getFrameworkConfig(frameworkId);
    if (config.hasSeverityLevels) {
      const control = getControlById(frameworkId, controlId);
      if (control && isSTIGControl(control)) {
        return getNISTForCCIs(control.cci_refs);
      }
    }
  } catch {
    // Framework not found, ignore
  }
  return null;
}

export function hasFrameworkCrosswalk(frameworkId: string): boolean {
  return CROSSWALK_PAIRS.some(([a, b]) => a === frameworkId || b === frameworkId)
    || frameworkId in frameworkToBridge;
}

export function getFrameworkCrosswalkTargets(frameworkId: string): string[] {
  const targets: string[] = [];
  for (const [a, b] of CROSSWALK_PAIRS) {
    if (a === frameworkId) targets.push(b);
    else if (b === frameworkId) targets.push(a);
  }
  return targets;
}

export function buildBridgeArtifact(): Array<[string, CrosswalkIdMap, CrosswalkIdMap]> {
  return Object.keys(frameworkToBridge).map((fwId) => {
    const fromBridgeRaw = bridgeToFramework[fwId] ?? {};
    const fromBridge: CrosswalkIdMap = Object.fromEntries(
      Object.entries(fromBridgeRaw).map(([bridgeId, ids]) => [bridgeId, normalizeBridgeTargetIds(fwId, ids)]),
    );
    return [fwId, frameworkToBridge[fwId], fromBridge];
  });
}

// ─── Per-pair getters ────────────────────────────────────────────

export function getNIST171ForCMMC(cmmcId: string): string | null { return cmmcToNist171.get(cmmcId) || null; }
export function getCMMCForNIST171(nist171Id: string): string[] { return nist171ToCmmc.get(nist171Id) || []; }
export function getCMMCNist171Metadata() { return cmmcNist171Data.metadata; }

export function getFedRAMPForCJIS(cjisId: string): string[] { return cjisFedrampData.cjis_to_fedramp[cjisId] || []; }
export function getCJISForFedRAMP(fedrampId: string): string[] { return cjisFedrampData.fedramp_to_cjis[fedrampId] || []; }
export function getCJISFedRAMPMetadata() { return cjisFedrampData.metadata; }

export function getISO42001ForAIRMF(controlId: string): string[] { return aiRmfIso42001Data.ai_rmf_to_iso42001[controlId] || []; }
export function getAIRMFForISO42001(clauseId: string): string[] { return aiRmfIso42001Data.iso42001_to_ai_rmf[clauseId] || []; }
export function getAIRMFISO42001Metadata() { return aiRmfIso42001Data.metadata; }

export function getISO23894ForAIRMFCategory(categoryId: string): string[] { return aiRmfIso23894Data.ai_rmf_to_iso23894[categoryId] || []; }
export function getAIRMFCategoriesForISO23894(clauseId: string): string[] { return aiRmfIso23894Data.iso23894_to_ai_rmf[clauseId] || []; }
export function getAIRMFISO23894Metadata() { return aiRmfIso23894Data.metadata; }

export function getAIRMFForEUAIAct(articleId: string): string[] { return euAiActAirmfData.eu_ai_act_to_ai_rmf[articleId] || []; }
export function getEUAIActForAIRMF(controlId: string): string[] { return euAiActAirmfData.ai_rmf_to_eu_ai_act[controlId] || []; }
export function getEUAIActAIRMFMetadata() { return euAiActAirmfData.metadata; }

export function getAIRMFForAIUC(controlId: string): string[] { return aiucAirmfData.aiuc_to_ai_rmf[controlId] || []; }
export function getAIUCForAIRMF(controlId: string): string[] { return aiucAirmfData.ai_rmf_to_aiuc[controlId] || []; }
export function getAIUCAIRMFMetadata() { return aiucAirmfData.metadata; }

export function getOwaspLLMForAIUC(controlId: string): string[] { return aiucOwaspLLMData.aiuc_to_owasp_llm[controlId] || []; }
export function getAIUCForOwaspLLM(controlId: string): string[] { return aiucOwaspLLMData.owasp_llm_to_aiuc[controlId] || []; }

export function getNISTForCCI(cciId: string): string[] { return cciData.cci_to_nist[cciId] || []; }
export function getCCIsForNIST(nistId: string): string[] { return cciData.nist_to_cci[nistId] || []; }

export function getNISTForCCIs(cciRefs: string[]): string[] {
  const nistControls = new Set<string>();
  for (const cci of cciRefs) {
    for (const control of getNISTForCCI(cci)) {
      nistControls.add(control);
    }
  }
  return Array.from(nistControls).sort();
}

export function getNistControlsForCSF(csfId: string): string[] { return data.csf_to_nist[csfId] || []; }
export function getCSFSubcategoriesForNist(nistId: string): string[] { return data.nist_to_csf[nistId] || []; }
export function getPCIControlsForCSF(csfId: string): string[] { return pciData.csf_to_pci[csfId] || []; }
export function getCSFSubcategoriesForPCI(pciId: string): string[] { return pciData.pci_to_csf[pciId] || []; }
export function getISOControlsForCSF(csfId: string): string[] { return isoData.csf_to_iso[csfId] || []; }
export function getCSFSubcategoriesForISO(isoId: string): string[] { return isoData.iso_to_csf[isoId] || []; }
export function getCISControlsForCSF(csfId: string): string[] { return cisData.csf_to_cis[csfId] || []; }
export function getCSFForCIS(cisId: string): string[] { return cisData.cis_to_csf[cisId] || []; }

export function getCSFForSOC2(tscId: string): string[] { return soc2Data.tsc_to_csf[tscId] || []; }
export function getSOC2ForCSF(csfId: string): string[] { return soc2Data.csf_to_tsc[csfId] || []; }
export function getISOForSOC2(tscId: string): string[] { return soc2Data.tsc_to_iso[tscId] || []; }
export function getSOC2ForISO(isoId: string): string[] { return soc2Data.iso_to_tsc[isoId] || []; }
export function getNISTForSOC2(tscId: string): string[] { return soc2Data.tsc_to_nist[tscId] || []; }
export function getSOC2ForNIST(nistId: string): string[] { return soc2Data.nist_to_tsc[nistId] || []; }

// ─── Crosswalk table entries ─────────────────────────────────────

interface CrosswalkTableRow { fromId: string; fromTitle: string; toId: string; toTitle: string }

function buildCrosswalkTableRows(map: CrosswalkIdMap, fromFramework: string, toFramework: string): CrosswalkTableRow[] {
  const fromTitles = new Map<string, string>();
  const toTitles = new Map<string, string>();

  const titleFor = (cache: Map<string, string>, frameworkId: string, id: string): string => {
    if (!cache.has(id)) {
      try {
        const control = getControlBySlug(frameworkId, slugify(id));
        if (control) cache.set(id, control.title);
      } catch {
        // Control not found, use ID as title
      }
    }
    return cache.get(id) || id;
  };

  const rows: CrosswalkTableRow[] = [];
  for (const [fromId, toIds] of Object.entries(map)) {
    const fromTitle = titleFor(fromTitles, fromFramework, fromId);
    for (const toId of toIds) {
      rows.push({ fromId, fromTitle, toId, toTitle: titleFor(toTitles, toFramework, toId) });
    }
  }
  return rows;
}

export function getAllCrosswalkEntries(): CrosswalkEntry[] {
  return buildCrosswalkTableRows(data.csf_to_nist, 'nist-csf-v2', 'nist-800-53-r5')
    .map((row) => ({ csf_id: row.fromId, csf_title: row.fromTitle, nist_id: row.toId, nist_title: row.toTitle }));
}

export function getCrosswalkMetadata() { return data.metadata; }

export function getAllCSFPCICrosswalkEntries(): PCICrosswalkEntry[] {
  return buildCrosswalkTableRows(pciData.csf_to_pci, 'nist-csf-v2', 'pci-dss-v4')
    .map((row) => ({ csf_id: row.fromId, csf_title: row.fromTitle, pci_id: row.toId, pci_title: row.toTitle }));
}

export function getCSFPCICrosswalkMetadata() { return pciData.metadata; }

// ─── Crosswalk page catalog ──────────────────────────────────────

export interface CrosswalkCatalogEntry {
  fromId: string;
  toId: string;
  title: string;
  description: string;
  href: string;
  tags: string[];
  mappingCount: number;
}

const RAW_CROSSWALK_CATALOG: readonly CrosswalkCatalogEntry[] = [
  { fromId: 'nist-csf-v2', toId: 'nist-800-53-r5', title: 'CSF 2.0 to NIST 800-53', description: 'NIST Cybersecurity Framework to NIST SP 800-53 control mappings', href: '/crosswalk/csf-nist', tags: ['Federal'], mappingCount: countMappings(data.csf_to_nist) },
  { fromId: 'nist-csf-v2', toId: 'pci-dss-v4', title: 'CSF 2.0 to PCI-DSS v4', description: 'NIST CSF to PCI-DSS v4.0.1 requirement ID mappings (NIST OLIR)', href: '/crosswalk/csf-pci', tags: ['Enterprise'], mappingCount: countMappings(pciData.csf_to_pci) },
  { fromId: 'nist-csf-v2', toId: 'iso-27001-2022', title: 'CSF 2.0 to ISO 27001', description: 'NIST CSF to ISO/IEC 27001:2022 control ID mappings (NIST OLIR)', href: '/crosswalk/visualize#explorer', tags: ['International'], mappingCount: countMappings(isoData.csf_to_iso) },
  { fromId: 'nist-csf-v2', toId: 'cis-controls-v8', title: 'CSF 2.0 to CIS Controls v8', description: 'NIST CSF to CIS Controls v8 safeguard ID mappings', href: '/crosswalk/visualize#explorer', tags: ['Enterprise'], mappingCount: countMappings(cisData.csf_to_cis) },
  { fromId: 'soc2-tsc', toId: 'nist-csf-v2', title: 'SOC 2 TSC to CSF, ISO, NIST', description: 'SOC 2 Trust Services Criteria cross-framework mappings', href: '/crosswalk/visualize#explorer', tags: ['Enterprise'], mappingCount: countMappings(soc2Data.tsc_to_csf) + countMappings(soc2Data.tsc_to_iso) + countMappings(soc2Data.tsc_to_nist) },
  { fromId: 'kubernetes-stig-v2r4', toId: 'nist-800-53-r5', title: 'CCI to NIST 800-53', description: 'Control Correlation Identifier to NIST 800-53 mappings for STIGs', href: '/crosswalk/visualize#explorer', tags: ['Federal'], mappingCount: countMappings(cciData.cci_to_nist) },
  { fromId: 'nist-ai-rmf', toId: 'iso-42001', title: 'AI RMF to ISO 42001', description: 'NIST AI Risk Management Framework to ISO/IEC 42001 mappings', href: '/crosswalk/visualize#explorer', tags: ['AI'], mappingCount: countMappings(aiRmfIso42001Data.ai_rmf_to_iso42001) },
  { fromId: 'nist-ai-rmf', toId: 'iso-23894', title: 'AI RMF to ISO 23894', description: 'NIST AI RMF to ISO/IEC 23894 risk management mappings', href: '/crosswalk/visualize#explorer', tags: ['AI'], mappingCount: countMappings(aiRmfIso23894Data.ai_rmf_to_iso23894) },
  { fromId: 'eu-ai-act', toId: 'nist-ai-rmf', title: 'EU AI Act to AI RMF', description: 'EU AI Act article to NIST AI RMF control mappings', href: '/crosswalk/visualize#explorer', tags: ['AI'], mappingCount: countMappings(euAiActAirmfData.eu_ai_act_to_ai_rmf) },
  { fromId: 'cmmc-v2', toId: 'nist-800-171-r2', title: 'CMMC v2 to NIST 800-171', description: 'CMMC v2.0 practice to NIST SP 800-171 requirement mappings', href: '/crosswalk/visualize#explorer', tags: ['Federal'], mappingCount: cmmcNist171Data.mappings.length },
  { fromId: '', toId: '', title: 'Cross-Framework Control Mappings', description: 'Browse published public-domain crosswalks and optional local bridge overlays', href: '/crosswalk', tags: ['Enterprise'], mappingCount: Object.values(ccfData.ccf_to_framework ?? {}).reduce((sum, map) => sum + countMappings(map), 0) || 1 },
  { fromId: '', toId: '', title: 'Crosswalk Visualizer', description: 'Interactive visualization of cross-framework control mappings', href: '/crosswalk/visualize', tags: [], mappingCount: 1 },
];

export const CROSSWALK_CATALOG: readonly CrosswalkCatalogEntry[] = RAW_CROSSWALK_CATALOG.filter(
  (entry) => entry.mappingCount > 0 || !entry.fromId,
);
