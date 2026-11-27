import {
  computeFrameworkScore,
  getStatusDistribution,
  type BaselineScore,
  type StatusDistribution,
} from '../assessment-scoring';
import {
  buildAssessmentControlUrl,
  getAssessmentControls,
  normalizeAssessmentBaseline,
  type AssessmentBaseline,
  type AssessmentFrameworkId,
} from '../assessment-frameworks';
import type { Assessment, ControlStatus, ImplementationStatus } from '../db';
import {
  getAllControlStatusRecords,
  getAssessments,
} from '../storage/assessment-store';
import type { Control } from '@/data/types';
import { isAIUCControl } from '@/data/types';

export interface AssessmentControlDescriptor {
  controlId: string;
  title: string;
  family: string;
  url: string;
}

export interface AssessmentGapItem extends AssessmentControlDescriptor {
  status: ImplementationStatus;
}

export interface AssessmentRemediationItem extends AssessmentGapItem {
  owner?: string;
  notes?: string;
  autoSuggestSource?: string;
  confidence?: ControlStatus['confidence'];
  linkedCmvpModuleCount: number;
  assessmentQuestionCount: number;
  evidenceItemCount: number;
  needsOwner: boolean;
  needsNotes: boolean;
}

export interface AssessmentEvidenceItem extends AssessmentGapItem {
  notes?: string;
  needsNotes: boolean;
  assessmentQuestionCount: number;
  evidenceItemCount: number;
  evidenceHighlights: string[];
  application?: string;
  frequency?: string;
  linkedCmvpModuleCount: number;
}

export interface AssessmentViewSnapshot {
  assessment: Assessment;
  frameworkId: AssessmentFrameworkId;
  baseline: AssessmentBaseline;
  score: BaselineScore;
  distribution: StatusDistribution[];
  gaps: AssessmentGapItem[];
  remediationQueue: AssessmentRemediationItem[];
  evidenceQueue: AssessmentEvidenceItem[];
}

export interface AssessmentViewRequest {
  frameworkId: AssessmentFrameworkId;
  assessmentId?: string;
  baseline?: AssessmentBaseline;
  includeStatuses?: ImplementationStatus[];
}

const DEFAULT_GAP_STATUSES: ImplementationStatus[] = [
  'not-assessed',
  'not-implemented',
  'partially-implemented',
  'planned',
];

const GAP_STATUS_RANK: Record<ImplementationStatus, number> = {
  'not-assessed': 0,
  'not-implemented': 1,
  'partially-implemented': 2,
  planned: 3,
  implemented: 4,
  'not-applicable': 5,
};

const REMEDIATION_STATUS_RANK: Record<ImplementationStatus, number> = {
  'not-implemented': 0,
  'partially-implemented': 1,
  planned: 2,
  'not-assessed': 3,
  implemented: 4,
  'not-applicable': 5,
};

export { normalizeAssessmentBaseline };

function getAssessmentQuestionCount(control: Control): number {
  return control.assessment_questions?.reduce((total, group) => total + group.questions.length, 0) ?? 0;
}

function getEvidenceHighlights(control: Control): string[] {
  if (isAIUCControl(control)) {
    return control.controls_evidence
      .slice(0, 3)
      .map(item => `${item.evidence_id}: ${item.typical_evidence}`);
  }

  return control.assessment_questions
    ?.slice(0, 3)
    .map(group => {
      const firstQuestion = group.questions[0];
      return firstQuestion ? `${group.category}: ${firstQuestion}` : group.category;
    }) ?? [];
}

function getEvidenceItemCount(control: Control): number {
  return isAIUCControl(control) ? control.controls_evidence.length : 0;
}

function getControlStatusFromRecord(record: ControlStatus | undefined): ImplementationStatus {
  return record?.status ?? 'not-assessed';
}

export function buildAssessmentControlDescriptors(
  frameworkId: AssessmentFrameworkId,
  baseline?: AssessmentBaseline,
): AssessmentControlDescriptor[] {
  return getAssessmentControls(frameworkId, baseline).map(control => ({
    controlId: control.control_id,
    title: control.title,
    family: control.family,
    url: control.url ?? buildAssessmentControlUrl(frameworkId, control.control_id),
  }));
}

export function resolveAssessmentForView(
  assessments: Assessment[],
  frameworkId: AssessmentFrameworkId,
  baseline?: AssessmentBaseline,
  assessmentId?: string,
): Assessment | null {
  if (assessmentId) {
    return assessments.find(assessment => assessment.id === assessmentId) ?? null;
  }

  const matchingFramework = assessments.filter(assessment => assessment.targetFrameworks.includes(frameworkId));
  if (matchingFramework.length === 0) {
    return null;
  }

  const resolvedBaseline = normalizeAssessmentBaseline(frameworkId, baseline);
  if (resolvedBaseline === 'all') {
    return matchingFramework[0] ?? null;
  }

  const exactBaseline = matchingFramework.find(assessment => assessment.targetBaseline === resolvedBaseline);
  if (exactBaseline) {
    return exactBaseline;
  }

  const unspecifiedBaseline = matchingFramework.find(assessment => !assessment.targetBaseline);
  if (unspecifiedBaseline) {
    return unspecifiedBaseline;
  }

  return matchingFramework[0] ?? null;
}

export function buildAssessmentGapItems(
  controls: AssessmentControlDescriptor[],
  frameworkId: AssessmentFrameworkId,
  statusMap: Map<string, ImplementationStatus>,
  includeStatuses: ImplementationStatus[] = DEFAULT_GAP_STATUSES,
): AssessmentGapItem[] {
  return controls
    .map(control => ({
      ...control,
      status: statusMap.get(`${frameworkId}:${control.controlId}`) ?? 'not-assessed',
    }))
    .filter(control => includeStatuses.includes(control.status))
    .sort((left, right) => {
      const rankDelta = GAP_STATUS_RANK[left.status] - GAP_STATUS_RANK[right.status];
      if (rankDelta !== 0) {
        return rankDelta;
      }
      const familyDelta = left.family.localeCompare(right.family);
      if (familyDelta !== 0) {
        return familyDelta;
      }
      return left.controlId.localeCompare(right.controlId, undefined, { numeric: true });
    });
}

export function buildAssessmentRemediationItems(
  controls: Control[],
  frameworkId: AssessmentFrameworkId,
  statusRecords: Map<string, ControlStatus>,
  includeStatuses: ImplementationStatus[] = DEFAULT_GAP_STATUSES,
): AssessmentRemediationItem[] {
  return controls
    .map(control => {
      const key = `${frameworkId}:${control.control_id}`;
      const record = statusRecords.get(key);
      const status = getControlStatusFromRecord(record);
      const notes = record?.notes?.trim() || undefined;
      const owner = record?.owner?.trim() || undefined;

      return {
        controlId: control.control_id,
        title: control.title,
        family: control.family,
        url: control.url ?? buildAssessmentControlUrl(frameworkId, control.control_id),
        status,
        owner,
        notes,
        autoSuggestSource: record?.autoSuggestSource,
        confidence: record?.confidence,
        linkedCmvpModuleCount: record?.linkedCmvpModuleIds?.length ?? 0,
        assessmentQuestionCount: getAssessmentQuestionCount(control),
        evidenceItemCount: getEvidenceItemCount(control),
        needsOwner: !owner,
        needsNotes: !notes,
      };
    })
    .filter(item => includeStatuses.includes(item.status))
    .sort((left, right) => {
      const rankDelta = REMEDIATION_STATUS_RANK[left.status] - REMEDIATION_STATUS_RANK[right.status];
      if (rankDelta !== 0) return rankDelta;

      if (left.needsOwner !== right.needsOwner) {
        return left.needsOwner ? -1 : 1;
      }

      if (left.needsNotes !== right.needsNotes) {
        return left.needsNotes ? -1 : 1;
      }

      const evidenceDelta = right.evidenceItemCount - left.evidenceItemCount;
      if (evidenceDelta !== 0) return evidenceDelta;

      const questionDelta = right.assessmentQuestionCount - left.assessmentQuestionCount;
      if (questionDelta !== 0) return questionDelta;

      const familyDelta = left.family.localeCompare(right.family);
      if (familyDelta !== 0) return familyDelta;

      return left.controlId.localeCompare(right.controlId, undefined, { numeric: true });
    });
}

export function buildAssessmentEvidenceItems(
  controls: Control[],
  frameworkId: AssessmentFrameworkId,
  statusRecords: Map<string, ControlStatus>,
  includeStatuses: ImplementationStatus[] = DEFAULT_GAP_STATUSES,
): AssessmentEvidenceItem[] {
  return controls
    .map(control => {
      const key = `${frameworkId}:${control.control_id}`;
      const record = statusRecords.get(key);
      const status = getControlStatusFromRecord(record);
      const notes = record?.notes?.trim() || undefined;
      const assessmentQuestionCount = getAssessmentQuestionCount(control);
      const evidenceItemCount = getEvidenceItemCount(control);

      return {
        controlId: control.control_id,
        title: control.title,
        family: control.family,
        url: control.url ?? buildAssessmentControlUrl(frameworkId, control.control_id),
        status,
        notes,
        needsNotes: !notes,
        assessmentQuestionCount,
        evidenceItemCount,
        evidenceHighlights: getEvidenceHighlights(control),
        application: isAIUCControl(control) ? control.application : undefined,
        frequency: isAIUCControl(control) ? control.frequency : undefined,
        linkedCmvpModuleCount: record?.linkedCmvpModuleIds?.length ?? 0,
      };
    })
    .filter(item => includeStatuses.includes(item.status))
    .filter(item => item.evidenceItemCount > 0 || item.assessmentQuestionCount > 0 || item.needsNotes)
    .sort((left, right) => {
      if (left.needsNotes !== right.needsNotes) {
        return left.needsNotes ? -1 : 1;
      }

      const evidenceDelta = right.evidenceItemCount - left.evidenceItemCount;
      if (evidenceDelta !== 0) return evidenceDelta;

      const questionDelta = right.assessmentQuestionCount - left.assessmentQuestionCount;
      if (questionDelta !== 0) return questionDelta;

      const rankDelta = GAP_STATUS_RANK[left.status] - GAP_STATUS_RANK[right.status];
      if (rankDelta !== 0) return rankDelta;

      const familyDelta = left.family.localeCompare(right.family);
      if (familyDelta !== 0) return familyDelta;

      return left.controlId.localeCompare(right.controlId, undefined, { numeric: true });
    });
}

export async function loadAssessmentViewSnapshot(
  request: AssessmentViewRequest,
): Promise<AssessmentViewSnapshot | null> {
  const assessments = await getAssessments();
  const assessment = resolveAssessmentForView(
    assessments,
    request.frameworkId,
    request.baseline,
    request.assessmentId,
  );

  if (!assessment) {
    return null;
  }

  const baseline = normalizeAssessmentBaseline(
    request.frameworkId,
    request.baseline ?? assessment.targetBaseline,
  );
  const statusRecords = await getAllControlStatusRecords(assessment.id);
  const statusMap = new Map<string, ImplementationStatus>();
  for (const [key, record] of statusRecords.entries()) {
    statusMap.set(key, record.status);
  }
  const score = computeFrameworkScore(
    request.frameworkId,
    statusMap,
    baseline === 'all' ? undefined : baseline,
  );
  const distribution = getStatusDistribution(score);
  const rawControls = getAssessmentControls(request.frameworkId, baseline);
  const controls = rawControls.map(control => ({
    controlId: control.control_id,
    title: control.title,
    family: control.family,
    url: control.url ?? buildAssessmentControlUrl(request.frameworkId, control.control_id),
  }));
  const gaps = buildAssessmentGapItems(
    controls,
    request.frameworkId,
    statusMap,
    request.includeStatuses ?? DEFAULT_GAP_STATUSES,
  );
  const remediationQueue = buildAssessmentRemediationItems(
    rawControls,
    request.frameworkId,
    statusRecords,
    request.includeStatuses ?? DEFAULT_GAP_STATUSES,
  );
  const evidenceQueue = buildAssessmentEvidenceItems(
    rawControls,
    request.frameworkId,
    statusRecords,
    request.includeStatuses ?? DEFAULT_GAP_STATUSES,
  );

  return {
    assessment,
    frameworkId: request.frameworkId,
    baseline,
    score,
    distribution,
    gaps,
    remediationQueue,
    evidenceQueue,
  };
}
