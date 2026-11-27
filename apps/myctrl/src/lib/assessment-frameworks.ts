import {
  getAllControls,
  getAllFamilies,
  getBasePath,
  getControlsByBaseline,
  getControlsByDoDImpactLevel,
  getControlsByImpactLevel,
  getFamilyName,
  hasFrameworkData,
  slugify,
} from '@/data/controls';
import type {
  Control,
  CMMCLevel,
  DoDImpactLevel,
  DoDSRGControl,
  FedRAMPControl,
} from '@/data/types';
import {
  isCMMCControl,
  isDoDSRGControl,
  isFedRAMPControl,
} from '@/data/types';

export const ASSESSMENT_FRAMEWORK_IDS = [
  'fedramp-rev5',
  'fedramp-20x-ksi',
  'aiuc-1',
  'cmmc-v2',
  'dod-srg',
] as const;

export type AssessmentFrameworkId = typeof ASSESSMENT_FRAMEWORK_IDS[number];

export const ASSESSMENT_TARGET_BASELINES = [
  'low',
  'moderate',
  'high',
  'li_saas',
  'level-1',
  'level-2',
  'level-3',
  'il4-mod',
  'il4-high',
  'il5',
  'il6',
] as const;

export type AssessmentTargetBaseline = typeof ASSESSMENT_TARGET_BASELINES[number];
export type AssessmentBaseline = AssessmentTargetBaseline | 'all';
export const ASSESSMENT_BASELINES = [
  ...ASSESSMENT_TARGET_BASELINES,
  'all',
] as const;

export interface AssessmentBaselineOption {
  value: AssessmentTargetBaseline;
  label: string;
  count: number;
}

export interface AssessmentParameterInfo {
  label: string;
  text: string;
}

const FEDRAMP_BASELINE_LABELS = {
  low: 'FedRAMP Low',
  moderate: 'FedRAMP Moderate',
  high: 'FedRAMP High',
  li_saas: 'LI-SaaS',
} as const;

const FEDRAMP_20X_LABELS = {
  low: 'FedRAMP 20x Low',
  moderate: 'FedRAMP 20x Moderate',
} as const;

const CMMC_LEVEL_LABELS = {
  'level-1': 'CMMC Level 1',
  'level-2': 'CMMC Level 2',
  'level-3': 'CMMC Level 3',
} as const;

const DOD_SRG_LABELS = {
  'il4-mod': 'DoD IL4 Moderate',
  'il4-high': 'DoD IL4 High',
  il5: 'DoD IL5',
  il6: 'DoD IL6',
} as const;

const FRAMEWORK_LABELS: Record<AssessmentFrameworkId, string> = {
  'fedramp-rev5': 'FedRAMP',
  'fedramp-20x-ksi': 'FedRAMP 20x',
  'aiuc-1': 'AIUC-1',
  'cmmc-v2': 'CMMC',
  'dod-srg': 'DoD SRG',
};

const FRAMEWORK_SCOPE_FIELD_LABELS: Record<AssessmentFrameworkId, string> = {
  'fedramp-rev5': 'Target Baseline',
  'fedramp-20x-ksi': 'Impact Level',
  'aiuc-1': 'Standard',
  'cmmc-v2': 'CMMC Level',
  'dod-srg': 'Impact Level',
};

const FRAMEWORK_COUNT_NOUNS: Record<AssessmentFrameworkId, string> = {
  'fedramp-rev5': 'controls',
  'fedramp-20x-ksi': 'KSIs',
  'aiuc-1': 'requirements',
  'cmmc-v2': 'practices',
  'dod-srg': 'controls',
};

const FEDRAMP_BASELINE_MAP = {
  low: 'LOW',
  moderate: 'MODERATE',
  high: 'HIGH',
  li_saas: 'LI_SAAS',
} as const;

const FEDRAMP_20X_IMPACT_MAP = {
  low: 'LOW',
  moderate: 'MODERATE',
} as const;

const DOD_SRG_IMPACT_MAP = {
  'il4-mod': 'IL4_MOD',
  'il4-high': 'IL4_HIGH',
  il5: 'IL5',
  il6: 'IL6',
} as const;

const CMMC_LEVEL_MAP = {
  'level-1': 1,
  'level-2': 2,
  'level-3': 3,
} as const satisfies Record<'level-1' | 'level-2' | 'level-3', CMMCLevel>;

const DEFAULT_BASELINES: Record<AssessmentFrameworkId, AssessmentBaseline> = {
  'fedramp-rev5': 'moderate',
  'fedramp-20x-ksi': 'moderate',
  'aiuc-1': 'all',
  'cmmc-v2': 'level-2',
  'dod-srg': 'il4-mod',
};

function joinParameterSections(sections: Array<[string, string | null | undefined]>): string | null {
  const rendered = sections
    .map(([label, value]) => {
      const trimmed = value?.trim();
      if (!trimmed) return null;
      return label ? `${label}:\n${trimmed}` : trimmed;
    })
    .filter((value): value is string => !!value);

  return rendered.length > 0 ? rendered.join('\n\n') : null;
}

export function isAssessmentFrameworkId(value: string): value is AssessmentFrameworkId {
  return ASSESSMENT_FRAMEWORK_IDS.includes(value as AssessmentFrameworkId);
}

/**
 * Frameworks from ASSESSMENT_FRAMEWORK_IDS that have loaded control datasets
 * (excludes external-only frameworks unless supplied in src/data/local/).
 */
export function getAvailableAssessmentFrameworks(): AssessmentFrameworkId[] {
  return ASSESSMENT_FRAMEWORK_IDS.filter((id) => hasFrameworkData(id));
}

export function getPrimaryAssessmentFrameworkId(
  targetFrameworks?: readonly string[],
): AssessmentFrameworkId {
  const frameworkId = targetFrameworks?.[0];
  return frameworkId && isAssessmentFrameworkId(frameworkId) ? frameworkId : 'fedramp-rev5';
}

export function getAssessmentFrameworkLabel(frameworkId: AssessmentFrameworkId): string {
  return FRAMEWORK_LABELS[frameworkId];
}

export function getAssessmentScopeFieldLabel(frameworkId: AssessmentFrameworkId): string {
  return FRAMEWORK_SCOPE_FIELD_LABELS[frameworkId];
}

export function getAssessmentCountNoun(frameworkId: AssessmentFrameworkId): string {
  return FRAMEWORK_COUNT_NOUNS[frameworkId];
}

export function normalizeAssessmentBaseline(
  frameworkId: AssessmentFrameworkId,
  baseline?: string,
): AssessmentBaseline {
  if (frameworkId === 'aiuc-1') {
    return 'all';
  }

  if (frameworkId === 'fedramp-20x-ksi') {
    return baseline === 'low' ? 'low' : DEFAULT_BASELINES[frameworkId];
  }

  if (frameworkId === 'fedramp-rev5') {
    if (baseline === 'low' || baseline === 'high' || baseline === 'li_saas') {
      return baseline;
    }
    return DEFAULT_BASELINES[frameworkId];
  }

  if (frameworkId === 'cmmc-v2') {
    if (baseline === 'level-1' || baseline === 'level-2' || baseline === 'level-3') {
      return baseline;
    }
    return DEFAULT_BASELINES[frameworkId];
  }

  if (baseline === 'il4-high' || baseline === 'il5' || baseline === 'il6') {
    return baseline;
  }

  return DEFAULT_BASELINES[frameworkId];
}

export function normalizeStoredAssessmentBaseline(
  frameworkId: AssessmentFrameworkId,
  baseline?: string,
): AssessmentTargetBaseline | undefined {
  const normalized = normalizeAssessmentBaseline(frameworkId, baseline);
  return normalized === 'all' ? undefined : normalized;
}

export function getDefaultAssessmentBaseline(
  frameworkId: AssessmentFrameworkId,
): AssessmentBaseline {
  return DEFAULT_BASELINES[frameworkId];
}

export function getAssessmentLabel(
  frameworkId: AssessmentFrameworkId,
  baseline?: string,
): string {
  const normalized = normalizeAssessmentBaseline(frameworkId, baseline);

  if (frameworkId === 'aiuc-1') {
    return 'AIUC-1';
  }

  if (frameworkId === 'fedramp-20x-ksi') {
    return FEDRAMP_20X_LABELS[normalized as keyof typeof FEDRAMP_20X_LABELS];
  }

  if (frameworkId === 'fedramp-rev5') {
    return FEDRAMP_BASELINE_LABELS[normalized as keyof typeof FEDRAMP_BASELINE_LABELS];
  }

  if (frameworkId === 'cmmc-v2') {
    return CMMC_LEVEL_LABELS[normalized as keyof typeof CMMC_LEVEL_LABELS];
  }

  return DOD_SRG_LABELS[normalized as keyof typeof DOD_SRG_LABELS];
}

export function getAssessmentCreateTitle(frameworkId: AssessmentFrameworkId): string {
  return `New ${getAssessmentFrameworkLabel(frameworkId)} Gap Analysis`;
}

export function getAssessmentCreateDescription(frameworkId: AssessmentFrameworkId): string {
  switch (frameworkId) {
    case 'aiuc-1':
      return 'Assess your AI agent system against the AIUC-1 security standard';
    case 'fedramp-20x-ksi':
      return 'Assess your system against FedRAMP 20x Key Security Indicators';
    case 'cmmc-v2':
      return 'Assess your system against CMMC 2.0 practices for the selected certification level';
    case 'dod-srg':
      return 'Assess your system against DoD SRG cloud security controls for the selected impact level';
    default:
      return 'Assess your system against FedRAMP security baselines';
  }
}

export function getAssessmentNamePlaceholder(frameworkId: AssessmentFrameworkId): string {
  switch (frameworkId) {
    case 'aiuc-1':
      return 'e.g., AIUC-1 Agent Security - Q2 2026';
    case 'fedramp-20x-ksi':
      return 'e.g., FedRAMP 20x Moderate - Q2 2026';
    case 'cmmc-v2':
      return 'e.g., CMMC Level 2 - Q2 2026';
    case 'dod-srg':
      return 'e.g., DoD IL5 - Q2 2026';
    default:
      return 'e.g., FedRAMP Moderate - Q2 2026';
  }
}

export function supportsAssessmentBaselineComparison(frameworkId: AssessmentFrameworkId): boolean {
  return frameworkId === 'fedramp-rev5';
}

export function getAssessmentControls(
  frameworkId: AssessmentFrameworkId,
  baseline?: string,
): Control[] {
  const normalized = normalizeAssessmentBaseline(frameworkId, baseline);

  switch (frameworkId) {
    case 'aiuc-1':
      return getAllControls(frameworkId);
    case 'fedramp-20x-ksi':
      return getControlsByImpactLevel(
        frameworkId,
        FEDRAMP_20X_IMPACT_MAP[normalized as keyof typeof FEDRAMP_20X_IMPACT_MAP],
      );
    case 'fedramp-rev5':
      return getControlsByBaseline(
        frameworkId,
        FEDRAMP_BASELINE_MAP[normalized as keyof typeof FEDRAMP_BASELINE_MAP],
      );
    case 'cmmc-v2': {
      const maxLevel = CMMC_LEVEL_MAP[normalized as keyof typeof CMMC_LEVEL_MAP];
      return getAllControls(frameworkId).filter(control => isCMMCControl(control) && control.cmmc_level <= maxLevel);
    }
    case 'dod-srg':
      return getControlsByDoDImpactLevel(
        frameworkId,
        DOD_SRG_IMPACT_MAP[normalized as keyof typeof DOD_SRG_IMPACT_MAP] as DoDImpactLevel,
      );
  }
}

export function buildAssessmentControlUrl(
  frameworkId: AssessmentFrameworkId,
  controlId: string,
): string {
  return `${getBasePath(frameworkId)}/${frameworkId}/${slugify(controlId)}`;
}

export function getAssessmentControlCount(
  frameworkId: AssessmentFrameworkId,
  baseline?: string,
): number {
  return getAssessmentControls(frameworkId, baseline).length;
}

export function getAssessmentBaselineOptions(
  frameworkId: AssessmentFrameworkId,
): AssessmentBaselineOption[] {
  switch (frameworkId) {
    case 'fedramp-rev5':
      return (['low', 'moderate', 'high', 'li_saas'] as const).map(value => ({
        value,
        label: FEDRAMP_BASELINE_LABELS[value],
        count: getAssessmentControlCount(frameworkId, value),
      }));
    case 'fedramp-20x-ksi':
      return (['low', 'moderate'] as const).map(value => ({
        value,
        label: FEDRAMP_20X_LABELS[value],
        count: getAssessmentControlCount(frameworkId, value),
      }));
    case 'cmmc-v2':
      return (['level-1', 'level-2', 'level-3'] as const).map(value => ({
        value,
        label: CMMC_LEVEL_LABELS[value],
        count: getAssessmentControlCount(frameworkId, value),
      }));
    case 'dod-srg':
      return (['il4-mod', 'il4-high', 'il5', 'il6'] as const).map(value => ({
        value,
        label: DOD_SRG_LABELS[value],
        count: getAssessmentControlCount(frameworkId, value),
      }));
    default:
      return [];
  }
}

export function getAssessmentFamilyNames(
  frameworkId: AssessmentFrameworkId,
): Record<string, string> {
  return getAllFamilies(frameworkId).reduce<Record<string, string>>((acc, family) => {
    acc[family] = getFamilyName(frameworkId, family);
    return acc;
  }, {});
}

export function getAssessmentParameterInfo(
  frameworkId: AssessmentFrameworkId,
  control: Control,
  baseline?: string,
): AssessmentParameterInfo | null {
  const normalized = normalizeAssessmentBaseline(frameworkId, baseline);
  if (normalized === 'all') {
    return null;
  }

  if (frameworkId === 'fedramp-rev5' && isFedRAMPControl(control)) {
    const data = control.baselines[normalized as keyof FedRAMPControl['baselines']];
    const text = joinParameterSections([
      ['', data?.fedramp_parameters],
      ['Additional requirements', data?.additional_requirements],
      ['Monitoring periodicity', data?.monitoring_periodicity],
    ]);
    return text ? { label: 'FedRAMP Parameters', text } : null;
  }

  if (frameworkId === 'dod-srg' && isDoDSRGControl(control)) {
    const key = DOD_SRG_IMPACT_MAP[normalized as keyof typeof DOD_SRG_IMPACT_MAP].toLowerCase() as Lowercase<DoDImpactLevel>;
    const data = control.impact_levels[key];
    const text = joinParameterSections([
      ['Inherited FedRAMP parameters', data?.fedramp_parameters],
      ['DoD parameters', data?.dod_parameters],
      ['Additional requirements', data?.additional_requirements],
    ]);
    return text ? { label: 'DoD SRG Parameters', text } : null;
  }

  return null;
}
