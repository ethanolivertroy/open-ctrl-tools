/**
 * Assessment Scoring Engine
 *
 * Computes readiness scores for FedRAMP (and other framework) assessments
 * from ControlStatus records stored in Dexie.
 *
 * Designed for multi-framework extensibility — currently implements FedRAMP
 * baseline scoring, but the same pattern works for CMMC levels, CIS IGs, etc.
 */

import type { ImplementationStatus } from './db';
import {
  getAssessmentControls,
  getAssessmentFamilyNames,
  normalizeAssessmentBaseline,
  type AssessmentBaseline,
  type AssessmentFrameworkId,
} from './assessment-frameworks';
import fedrampData from '../data/fedramp-rev5.json';
import ksiData from '../data/fedramp-20x-ksi.json';
import {
  getAssessmentFrameworkData as getFrameworkData,
  hasAssessmentFrameworkData as hasFrameworkData,
} from './assessment-data';
import type { Control } from '@/data/types';

// === Types ===

export interface FamilyScore {
  family: string;
  familyName: string;
  total: number;
  implemented: number;
  partiallyImplemented: number;
  planned: number;
  notImplemented: number;
  notApplicable: number;
  notAssessed: number;
  /** Weighted completion: (impl×1.0 + partial×0.5 + planned×0.25) / applicable × 100 */
  percentComplete: number;
  /** How much of the baseline has been evaluated: (total - notAssessed) / total × 100 */
  percentAssessed: number;
}

export interface BaselineScore {
  baseline: string;
  totalControls: number;
  familyScores: FamilyScore[];
  overallPercentComplete: number;
  overallPercentAssessed: number;
  implementedCount: number;
  partialCount: number;
  plannedCount: number;
  notImplementedCount: number;
  notApplicableCount: number;
  notAssessedCount: number;
}

export interface StatusDistribution {
  status: ImplementationStatus;
  count: number;
  percent: number;
}

// === Scoring Weights ===

const STATUS_WEIGHT: Record<ImplementationStatus, number> = {
  'implemented': 1.0,
  'partially-implemented': 0.5,
  'planned': 0.25,
  'not-implemented': 0,
  'not-applicable': 0,  // excluded from denominator
  'not-assessed': 0,
};

function computeControlSetScore(
  frameworkId: string,
  baseline: string,
  controls: Control[],
  familyNames: Record<string, string>,
  statusMap: Map<string, ImplementationStatus>,
): BaselineScore {
  const familyGroups = new Map<string, Control[]>();
  for (const control of controls) {
    const group = familyGroups.get(control.family) || [];
    group.push(control);
    familyGroups.set(control.family, group);
  }

  const familyScores: FamilyScore[] = [];
  let totalImpl = 0, totalPartial = 0, totalPlanned = 0;
  let totalNotImpl = 0, totalNA = 0, totalNotAssessed = 0;

  for (const [family, familyControls] of familyGroups) {
    let impl = 0, partial = 0, planned = 0, notImpl = 0, na = 0, notAssessed = 0;

    for (const control of familyControls) {
      const status = statusMap.get(`${frameworkId}:${control.control_id}`) || 'not-assessed';
      switch (status) {
        case 'implemented': impl++; break;
        case 'partially-implemented': partial++; break;
        case 'planned': planned++; break;
        case 'not-implemented': notImpl++; break;
        case 'not-applicable': na++; break;
        default: notAssessed++; break;
      }
    }

    const applicable = familyControls.length - na;
    const percentComplete = applicable > 0
      ? Math.round(((impl * 1.0 + partial * 0.5 + planned * 0.25) / applicable) * 1000) / 10
      : 100;
    const percentAssessed = familyControls.length > 0
      ? Math.round(((familyControls.length - notAssessed) / familyControls.length) * 1000) / 10
      : 100;

    familyScores.push({
      family,
      familyName: familyNames[family] || family,
      total: familyControls.length,
      implemented: impl,
      partiallyImplemented: partial,
      planned,
      notImplemented: notImpl,
      notApplicable: na,
      notAssessed,
      percentComplete,
      percentAssessed,
    });

    totalImpl += impl;
    totalPartial += partial;
    totalPlanned += planned;
    totalNotImpl += notImpl;
    totalNA += na;
    totalNotAssessed += notAssessed;
  }

  const totalApplicable = controls.length - totalNA;
  const overallComplete = totalApplicable > 0
    ? Math.round(((totalImpl + totalPartial * 0.5 + totalPlanned * 0.25) / totalApplicable) * 1000) / 10
    : 100;
  const overallAssessed = controls.length > 0
    ? Math.round(((controls.length - totalNotAssessed) / controls.length) * 1000) / 10
    : 100;

  return {
    baseline,
    totalControls: controls.length,
    familyScores: familyScores.sort((a, b) => a.family.localeCompare(b.family)),
    overallPercentComplete: overallComplete,
    overallPercentAssessed: overallAssessed,
    implementedCount: totalImpl,
    partialCount: totalPartial,
    plannedCount: totalPlanned,
    notImplementedCount: totalNotImpl,
    notApplicableCount: totalNA,
    notAssessedCount: totalNotAssessed,
  };
}

// === FedRAMP Data Accessors ===

interface FedRAMPBaseline {
  included?: boolean;
  fedramp_parameters?: string;
  additional_requirements?: string | null;
  monitoring_periodicity?: string;
}

interface FedRAMPControl {
  control_id: string;
  title: string;
  family: string;
  description: string;
  baselines: {
    low?: FedRAMPBaseline;
    moderate?: FedRAMPBaseline;
    high?: FedRAMPBaseline;
    li_saas?: FedRAMPBaseline;
  };
  assessment_questions?: { category: string; questions: string[] }[];
}

const fedrampControls = (fedrampData as { controls: FedRAMPControl[] }).controls;
const fedrampFamilies = (fedrampData as { families: Record<string, string> }).families;

export const FEDRAMP_BASELINES = ['low', 'moderate', 'high', 'li_saas'] as const;
export type FedRampBaseline = typeof FEDRAMP_BASELINES[number];

export function isFedRampBaseline(value: string | undefined): value is FedRampBaseline {
  return FEDRAMP_BASELINES.includes(value as FedRampBaseline);
}

/**
 * Get FedRAMP control IDs included in a specific baseline.
 */
export function getBaselineControlIds(baseline: FedRampBaseline): Set<string> {
  const ids = new Set<string>();
  for (const c of fedrampControls) {
    const bl = c.baselines[baseline];
    if (bl?.included) {
      ids.add(c.control_id);
    }
  }
  return ids;
}

/**
 * Get all FedRAMP controls for a baseline.
 */
export function getBaselineControls(baseline: FedRampBaseline): FedRAMPControl[] {
  return fedrampControls.filter(c => c.baselines[baseline]?.included);
}

/**
 * Get baseline control counts.
 */
export function getBaselineCounts(): Record<string, number> {
  return {
    low: fedrampControls.filter(c => c.baselines.low?.included).length,
    moderate: fedrampControls.filter(c => c.baselines.moderate?.included).length,
    high: fedrampControls.filter(c => c.baselines.high?.included).length,
    li_saas: fedrampControls.filter(c => c.baselines.li_saas?.included).length,
  };
}

// === AIUC-1 Data Accessors ===

interface AIUCEvidence {
  evidence_id: string;
  evidence_title: string;
  control_text: string;
  control_application: string;
  typical_evidence: string;
  category: string;
  location: string;
}

interface AIUCControl {
  control_id: string;
  title: string;
  family: string;
  description: string;
  application: string;
  frequency: string;
  capabilities: string;
  controls_evidence: AIUCEvidence[];
}

function loadAiucData(): { controls: AIUCControl[]; families: Record<string, string> } {
  if (!hasFrameworkData('aiuc-1')) {
    return { controls: [], families: {} };
  }
  const data = getFrameworkData('aiuc-1');
  return {
    controls: data.controls as unknown as AIUCControl[],
    families: data.families ?? {},
  };
}

const aiucDataset = loadAiucData();
const aiucControls = aiucDataset.controls;
const aiucFamilies = aiucDataset.families;

/**
 * Get all AIUC-1 controls.
 */
export function getAIUCControls(): AIUCControl[] {
  return aiucControls;
}

/**
 * Get AIUC-1 control count.
 */
export function getAIUCControlCount(): number {
  return aiucControls.length;
}

/**
 * Get AIUC-1 family map.
 */
export function getAIUCFamilies(): Record<string, string> {
  return aiucFamilies;
}

// === Core Scoring Function ===

/**
 * Compute readiness score for a FedRAMP baseline.
 *
 * @param baseline - Which FedRAMP baseline to score against
 * @param statusMap - Map of "frameworkId:controlId" → ImplementationStatus (from getAllControlStatuses)
 */
export function computeBaselineScore(
  baseline: 'low' | 'moderate' | 'high' | 'li_saas',
  statusMap: Map<string, ImplementationStatus>,
): BaselineScore {
  return computeControlSetScore(
    'fedramp-rev5',
    baseline,
    getBaselineControls(baseline),
    fedrampFamilies,
    statusMap,
  );
}

/**
 * Get status distribution for display.
 */
export function getStatusDistribution(score: BaselineScore): StatusDistribution[] {
  const total = score.totalControls;
  if (total === 0) return [];

  const statuses: { status: ImplementationStatus; count: number }[] = [
    { status: 'implemented', count: score.implementedCount },
    { status: 'partially-implemented', count: score.partialCount },
    { status: 'planned', count: score.plannedCount },
    { status: 'not-implemented', count: score.notImplementedCount },
    { status: 'not-applicable', count: score.notApplicableCount },
    { status: 'not-assessed', count: score.notAssessedCount },
  ];

  return statuses.map(s => ({
    ...s,
    percent: Math.round((s.count / total) * 1000) / 10,
  }));
}

/**
 * Compute scores for all three baselines simultaneously.
 */
export function computeAllBaselineScores(
  statusMap: Map<string, ImplementationStatus>,
): { low: BaselineScore; moderate: BaselineScore; high: BaselineScore } {
  return {
    low: computeBaselineScore('low', statusMap),
    moderate: computeBaselineScore('moderate', statusMap),
    high: computeBaselineScore('high', statusMap),
  };
}

// === AIUC-1 Scoring ===

/**
 * Compute readiness score for AIUC-1 (all 51 controls, no baselines).
 */
export function computeAIUCScore(
  statusMap: Map<string, ImplementationStatus>,
): BaselineScore {
  return computeControlSetScore(
    'aiuc-1',
    'all',
    aiucControls,
    aiucFamilies,
    statusMap,
  );
}

// === FedRAMP 20x KSI Data Accessors ===

interface KSIControl {
  control_id: string;
  fka: string;
  title: string;
  family: string;
  description: string;
  impact_low: boolean;
  impact_moderate: boolean;
  related_controls: string[];
  references: { title: string; url: string }[];
  updated: { date: string; comment: string }[];
  terms: string[];
  assessment_questions: { category: string; questions: string[] }[];
}

const ksiControls = (ksiData as unknown as { controls: KSIControl[] }).controls;
const ksiFamilies = (ksiData as { families: Record<string, string> }).families;

/**
 * Get 20x KSI controls for a given impact level.
 */
export function get20xKSIControls(impactLevel: 'low' | 'moderate'): KSIControl[] {
  const key = impactLevel === 'low' ? 'impact_low' : 'impact_moderate';
  return ksiControls.filter(c => c[key]);
}

/**
 * Get KSIs that are only in Moderate (not in Low) — the "differential" set.
 */
export function get20xDifferentialKSIs(): KSIControl[] {
  return ksiControls.filter(c => c.impact_moderate && !c.impact_low);
}

/**
 * Get 20x KSI control count for an impact level.
 */
export function get20xKSIControlCount(impactLevel: 'low' | 'moderate'): number {
  return get20xKSIControls(impactLevel).length;
}

/**
 * Get 20x KSI family map.
 */
export function get20xKSIFamilies(): Record<string, string> {
  return ksiFamilies;
}

// === FedRAMP 20x KSI Scoring ===

/**
 * Compute readiness score for FedRAMP 20x KSI at a given impact level.
 * Follows the same BaselineScore/FamilyScore pattern as Rev 5 and AIUC-1.
 */
export function compute20xScore(
  impactLevel: 'low' | 'moderate',
  statusMap: Map<string, ImplementationStatus>,
): BaselineScore {
  return computeControlSetScore(
    'fedramp-20x-ksi',
    impactLevel,
    get20xKSIControls(impactLevel),
    ksiFamilies,
    statusMap,
  );
}

export function computeCMMCScore(
  level: 'level-1' | 'level-2' | 'level-3',
  statusMap: Map<string, ImplementationStatus>,
): BaselineScore {
  return computeControlSetScore(
    'cmmc-v2',
    level,
    getAssessmentControls('cmmc-v2', level),
    getAssessmentFamilyNames('cmmc-v2'),
    statusMap,
  );
}

export function computeDoDSRGScore(
  impactLevel: 'il4-mod' | 'il4-high' | 'il5' | 'il6',
  statusMap: Map<string, ImplementationStatus>,
): BaselineScore {
  return computeControlSetScore(
    'dod-srg',
    impactLevel,
    getAssessmentControls('dod-srg', impactLevel),
    getAssessmentFamilyNames('dod-srg'),
    statusMap,
  );
}

// === Unified Dispatcher ===

/**
 * Compute score for any supported framework.
 * Centralizes the branching so callers don't need to know the framework-specific functions.
 */
export function computeFrameworkScore(
  frameworkId: AssessmentFrameworkId,
  statusMap: Map<string, ImplementationStatus>,
  baseline?: string,
): BaselineScore {
  const resolvedBaseline = normalizeAssessmentBaseline(frameworkId, baseline);

  switch (frameworkId) {
    case 'aiuc-1':
      return computeAIUCScore(statusMap);
    case 'fedramp-20x-ksi':
      return compute20xScore(
        (resolvedBaseline === 'low' ? 'low' : 'moderate') as 'low' | 'moderate',
        statusMap,
      );
    case 'cmmc-v2':
      return computeCMMCScore(
        resolvedBaseline as Extract<AssessmentBaseline, 'level-1' | 'level-2' | 'level-3'>,
        statusMap,
      );
    case 'dod-srg':
      return computeDoDSRGScore(
        resolvedBaseline as Extract<AssessmentBaseline, 'il4-mod' | 'il4-high' | 'il5' | 'il6'>,
        statusMap,
      );
    default:
      return computeBaselineScore(
        resolvedBaseline as Extract<AssessmentBaseline, 'low' | 'moderate' | 'high' | 'li_saas'>,
        statusMap,
      );
  }
}
