import { getBasePath, getFrameworkConfig } from '@/data/framework-configs';
import type { Control, CrosswalkData, FrameworkData } from '@/data/types';
import { slugifyControlId as slugify } from '@/lib/slugify';
import fedrampRev5Json from '@/data/fedramp-rev5.json';
import fedrampKsiJson from '@/data/fedramp-20x-ksi.json';
import cmmcV2Json from '@/data/cmmc-v2.json';
import dodSrgJson from '@/data/dod-srg.json';
import nistCsfV2Json from '@/data/nist-csf-v2.json';
import csfNistCrosswalkJson from '@/data/csf-nist-crosswalk.json';

type CrosswalkIdMap = Record<string, string[]>;

const localFrameworkModules = import.meta.glob<FrameworkData>('../data/local/aiuc-1.json', {
  eager: true,
  import: 'default',
});

const localCrosswalkModules = import.meta.glob<Record<string, unknown>>(
  '../data/local/crosswalks/*.json',
  { eager: true, import: 'default' },
);

const BUILTIN_ASSESSMENT_DATASETS: Record<string, FrameworkData> = {
  'fedramp-rev5': fedrampRev5Json as unknown as FrameworkData,
  'fedramp-20x-ksi': fedrampKsiJson as unknown as FrameworkData,
  'cmmc-v2': cmmcV2Json as unknown as FrameworkData,
  'dod-srg': dodSrgJson as unknown as FrameworkData,
  'nist-csf-v2': nistCsfV2Json as unknown as FrameworkData,
};

function loadLocalOverlay(id: string): FrameworkData | undefined {
  return localFrameworkModules[`../data/local/${id}.json`];
}

export function hasAssessmentFrameworkData(frameworkId: string): boolean {
  const data = loadLocalOverlay(frameworkId) ?? BUILTIN_ASSESSMENT_DATASETS[frameworkId];
  return Array.isArray(data?.controls) && data.controls.length > 0;
}

export function getAssessmentFrameworkData(frameworkId: string): FrameworkData {
  const data = loadLocalOverlay(frameworkId) ?? BUILTIN_ASSESSMENT_DATASETS[frameworkId];
  if (!data) {
    throw new Error(`No assessment data loaded for framework: ${frameworkId}`);
  }
  return data;
}

export function getAssessmentAllControls(frameworkId: string): Control[] {
  const data = getAssessmentFrameworkData(frameworkId);
  const basePath = getBasePath(frameworkId);
  return data.controls.map((c) => ({
    ...c,
    url: `${basePath}/${frameworkId}/${slugify(c.control_id)}`,
  }));
}

export function getAssessmentAllFamilies(frameworkId: string): string[] {
  const families = new Set(getAssessmentAllControls(frameworkId).map((c) => c.family));
  return Array.from(families).sort((a, b) => {
    const aNum = parseInt(a, 10);
    const bNum = parseInt(b, 10);
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    return a.localeCompare(b);
  });
}

export function getAssessmentFamilyName(frameworkId: string, abbreviation: string): string {
  const data = getAssessmentFrameworkData(frameworkId);
  return data.families?.[abbreviation] || abbreviation;
}

export { getFrameworkConfig, getBasePath, slugify };

function loadLocalCrosswalk<T>(filename: string, fallback: T): T {
  return (localCrosswalkModules[`../data/local/crosswalks/${filename}`] as T | undefined) ?? fallback;
}

function mergeBridgeMaps(
  target: Record<string, CrosswalkIdMap>,
  frameworkId: string,
  source: CrosswalkIdMap,
): void {
  if (!source || Object.keys(source).length === 0) return;
  const existing = target[frameworkId];
  if (!existing) {
    target[frameworkId] = source;
    return;
  }
  const merged: CrosswalkIdMap = { ...existing };
  for (const [key, ids] of Object.entries(source)) {
    merged[key] = Array.from(new Set([...(merged[key] ?? []), ...ids]));
  }
  target[frameworkId] = merged;
}

const csfNistData = csfNistCrosswalkJson as CrosswalkData;

export function getNistControlsForCSF(csfId: string): string[] {
  return csfNistData.csf_to_nist[csfId] || [];
}

interface CCFCrosswalkShape {
  ccf_to_framework: Record<string, CrosswalkIdMap>;
  framework_to_ccf: Record<string, CrosswalkIdMap>;
}

const ccfData = loadLocalCrosswalk<CCFCrosswalkShape>('ccf-crosswalks.json', {
  ccf_to_framework: {},
  framework_to_ccf: {},
});
const ccfExtendedData = loadLocalCrosswalk<CCFCrosswalkShape>('ccf-extended-crosswalks.json', {
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
  cjis_to_fedramp: CrosswalkIdMap;
  fedramp_to_cjis: CrosswalkIdMap;
}>('cjis-fedramp-crosswalk.json', {
  cjis_to_fedramp: {},
  fedramp_to_cjis: {},
});

const frameworkToBridge: Record<string, CrosswalkIdMap> = {};
const bridgeToFramework: Record<string, CrosswalkIdMap> = {};

for (const [fwId, map] of Object.entries(ccfData.framework_to_ccf ?? {})) {
  mergeBridgeMaps(frameworkToBridge, fwId, map);
}
for (const [fwId, map] of Object.entries(ccfExtendedData.framework_to_ccf ?? {})) {
  mergeBridgeMaps(frameworkToBridge, fwId, map);
}
for (const [fwId, map] of Object.entries(ccfData.ccf_to_framework ?? {})) {
  mergeBridgeMaps(bridgeToFramework, fwId, map);
}
for (const [fwId, map] of Object.entries(ccfExtendedData.ccf_to_framework ?? {})) {
  mergeBridgeMaps(bridgeToFramework, fwId, map);
}

mergeBridgeMaps(frameworkToBridge, 'hipaa-security', hipaaCcfData.hipaa_to_ccf ?? {});
mergeBridgeMaps(bridgeToFramework, 'hipaa-security', hipaaCcfData.ccf_to_hipaa ?? {});
mergeBridgeMaps(frameworkToBridge, 'gdpr', gdprCcfData.gdpr_to_ccf ?? {});
mergeBridgeMaps(bridgeToFramework, 'gdpr', gdprCcfData.ccf_to_gdpr ?? {});
mergeBridgeMaps(frameworkToBridge, 'nis2', nis2CcfData.nis2_to_ccf ?? {});
mergeBridgeMaps(bridgeToFramework, 'nis2', nis2CcfData.ccf_to_nis2 ?? {});
mergeBridgeMaps(frameworkToBridge, 'ccpa', ccpaCcfData.ccpa_to_ccf ?? {});
mergeBridgeMaps(bridgeToFramework, 'ccpa', ccpaCcfData.ccf_to_ccpa ?? {});

export function getLoadedBridgeData() {
  return {
    frameworkToBridge,
    bridgeToFramework,
    cjisFedrampData,
  };
}
