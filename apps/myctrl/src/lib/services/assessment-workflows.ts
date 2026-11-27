import { getDb, type Assessment } from '../db';
import {
  getAssessmentLabel,
  type AssessmentFrameworkId,
  type AssessmentTargetBaseline,
  normalizeStoredAssessmentBaseline,
} from '../assessment-frameworks';
import { createAssessment } from '../storage/assessment-store';

export interface CreateAssessmentInput {
  name: string,
  framework: AssessmentFrameworkId,
  baseline: AssessmentTargetBaseline,
  systemName?: string,
  assessorName?: string,
  assessorOrg?: string,
}

export async function createAssessmentWithMetadata(
  input: CreateAssessmentInput,
): Promise<Assessment> {
  const db = await getDb();
  const targetBaseline = normalizeStoredAssessmentBaseline(input.framework, input.baseline);
  const assessment = await createAssessment(
    input.name.trim(),
    [input.framework],
    `${getAssessmentLabel(input.framework, input.baseline)} gap analysis`,
  );

  await db.assessments.update(assessment.id, {
    targetBaseline,
    systemName: input.systemName?.trim() || undefined,
    assessorName: input.assessorName?.trim() || undefined,
    assessorOrg: input.assessorOrg?.trim() || undefined,
  });

  const updated = await db.assessments.get(assessment.id);
  return (updated as Assessment | undefined) ?? assessment;
}

export async function resetAssessmentProgress(
  assessmentId: string,
): Promise<Assessment | undefined> {
  const db = await getDb();
  await db.controlStatuses.where('assessmentId').equals(assessmentId).delete();
  await db.assessments.update(assessmentId, {
    crosswalkSources: [],
    updatedAt: Date.now(),
  });
  return await db.assessments.get(assessmentId) as Assessment | undefined;
}

export async function clearAssessmentAutoSuggestions(
  assessmentId: string,
): Promise<Assessment | undefined> {
  const db = await getDb();
  const autoSuggested = await db.controlStatuses
    .where('assessmentId').equals(assessmentId)
    .filter(record => record.autoSuggested === true)
    .toArray();

  await db.controlStatuses.bulkDelete(autoSuggested.map(record => record.id));
  await db.assessments.update(assessmentId, {
    crosswalkSources: [],
    updatedAt: Date.now(),
  });

  return await db.assessments.get(assessmentId) as Assessment | undefined;
}
