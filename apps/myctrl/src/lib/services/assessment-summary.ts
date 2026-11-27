import type { Assessment, ImplementationStatus } from '@/lib/db';
import {
  computeAllBaselineScores,
  computeBaselineScore,
  computeFrameworkScore,
  type BaselineScore,
} from '@/lib/assessment-scoring';
import {
  getPrimaryAssessmentFrameworkId,
  normalizeAssessmentBaseline,
  supportsAssessmentBaselineComparison,
  type AssessmentBaseline,
  type AssessmentFrameworkId,
} from '@/lib/assessment-frameworks';
import { getAllControlStatuses } from '@/lib/storage/assessment-store';

export interface AssessmentScoreSummary {
  frameworkId: AssessmentFrameworkId;
  baseline: AssessmentBaseline;
  score: BaselineScore;
  allScores: { low: BaselineScore; moderate: BaselineScore; high: BaselineScore } | null;
  statusMap: Map<string, ImplementationStatus>;
}

export async function loadAssessmentScoreSummary(
  assessment: Assessment,
): Promise<AssessmentScoreSummary> {
  const statusMap = await getAllControlStatuses(assessment.id);
  return computeAssessmentScoreSummary(assessment, statusMap);
}

export function computeAssessmentScoreSummary(
  assessment: Assessment,
  statusMap: Map<string, ImplementationStatus>,
): AssessmentScoreSummary {
  const frameworkId = getPrimaryAssessmentFrameworkId(assessment.targetFrameworks);
  const baseline = normalizeAssessmentBaseline(frameworkId, assessment.targetBaseline);

  if (supportsAssessmentBaselineComparison(frameworkId)) {
    const comparableBaseline = baseline as Extract<AssessmentBaseline, 'low' | 'moderate' | 'high' | 'li_saas'>;
    return {
      frameworkId,
      baseline,
      score: computeBaselineScore(comparableBaseline, statusMap),
      allScores: computeAllBaselineScores(statusMap),
      statusMap,
    };
  }

  return {
    frameworkId,
    baseline,
    score: computeFrameworkScore(frameworkId, statusMap, assessment.targetBaseline),
    allScores: null,
    statusMap,
  };
}
