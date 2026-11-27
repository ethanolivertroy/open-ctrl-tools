import {
  DEFAULT_ASSESSMENT_ID,
  getDb,
  type Assessment,
  type AssessmentCryptoModule,
  type ControlStatus,
  type ImplementationStatus,
} from '../db';
import type { CmvpCertificateDetail, NormalizedCmvpModule } from '../cmvp';
import { detailToNormalizedCmvpModule } from '../cmvp';
import type { MyCtrlDB } from '../db-runtime';
import { getActiveProjectId } from './project-store';

async function openDb(): Promise<MyCtrlDB> {
  return getDb();
}

function makeAssessmentStatusId(assessmentId: string, frameworkId: string, controlId: string): string {
  return `${assessmentId}:${frameworkId}:${controlId}`;
}

function makeAssessmentModuleId(assessmentId: string, moduleId: string): string {
  return `${assessmentId}:${moduleId}`;
}

// === Assessment CRUD ===

export async function createAssessment(
  name: string,
  targetFrameworks: string[],
  description?: string,
  projectId?: string,
): Promise<Assessment> {
  if (typeof window === 'undefined') throw new Error('Not in browser');
  const db = await openDb();
  const resolvedProjectId = projectId ?? await getActiveProjectId();
  const assessment: Assessment = {
    id: crypto.randomUUID(),
    projectId: resolvedProjectId,
    name,
    description,
    targetFrameworks,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await db.assessments.put(assessment);
  await db.projects.update(resolvedProjectId, { updatedAt: Date.now() });
  return assessment;
}

export async function getAssessments(projectId?: string): Promise<Assessment[]> {
  if (typeof window === 'undefined') return [];
  try {
    const db = await openDb();
    const resolvedProjectId = projectId ?? await getActiveProjectId();
    const assessments = await db.assessments.where('projectId').equals(resolvedProjectId).toArray();
    return assessments.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function deleteAssessment(assessmentId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await openDb();
  const assessment = await db.assessments.get(assessmentId);
  await db.controlStatuses.where('assessmentId').equals(assessmentId).delete();
  await db.assessmentCryptoModules.where('assessmentId').equals(assessmentId).delete();
  await db.assessments.delete(assessmentId);
  if (assessment?.projectId) {
    await db.projects.update(assessment.projectId, { updatedAt: Date.now() });
  }
}

export async function duplicateAssessment(sourceId: string, newName: string): Promise<Assessment> {
  if (typeof window === 'undefined') throw new Error('Not in browser');
  const db = await openDb();
  const source = await db.assessments.get(sourceId);
  if (!source) throw new Error(`Assessment ${sourceId} not found`);

  const now = Date.now();
  const newAssessment: Assessment = {
    id: crypto.randomUUID(),
    projectId: source.projectId,
    name: newName,
    description: source.description,
    targetFrameworks: [...source.targetFrameworks],
    createdAt: now,
    updatedAt: now,
    assessorName: source.assessorName,
    assessorOrg: source.assessorOrg,
    systemName: source.systemName,
    targetBaseline: source.targetBaseline,
    crosswalkSources: source.crosswalkSources?.map((entry) => ({ ...entry })),
  };
  await db.assessments.put(newAssessment);

  const statuses = await db.controlStatuses.where('assessmentId').equals(sourceId).toArray();
  const clonedStatuses = statuses.map(status => ({
    ...status,
    id: makeAssessmentStatusId(newAssessment.id, status.frameworkId, status.controlId),
    assessmentId: newAssessment.id,
    updatedAt: now,
  }));
  await db.controlStatuses.bulkPut(clonedStatuses);

  const cryptoModules = await db.assessmentCryptoModules.where('assessmentId').equals(sourceId).toArray();
  const clonedModules = cryptoModules.map(module => ({
    ...module,
    id: makeAssessmentModuleId(newAssessment.id, module.moduleId),
    assessmentId: newAssessment.id,
    addedAt: now,
    updatedAt: now,
  }));
  await db.assessmentCryptoModules.bulkPut(clonedModules);
  await db.projects.update(source.projectId, { updatedAt: now });

  return newAssessment;
}

// === Assessment Crypto Inventory ===

export async function getAssessmentCryptoModules(
  assessmentId: string,
): Promise<AssessmentCryptoModule[]> {
  if (typeof window === 'undefined') return [];
  try {
    const db = await openDb();
    return await db.assessmentCryptoModules.where('assessmentId').equals(assessmentId).toArray();
  } catch {
    return [];
  }
}

export async function addAssessmentCryptoModule(
  assessmentId: string,
  module: NormalizedCmvpModule & Pick<AssessmentCryptoModule, 'componentName' | 'usageTypes' | 'notes'>,
  options?: {
    detailSnapshot?: CmvpCertificateDetail;
  },
): Promise<AssessmentCryptoModule> {
  const db = await openDb();
  const normalizedFromSnapshot = options?.detailSnapshot ? detailToNormalizedCmvpModule(options.detailSnapshot) : null;
  const record: AssessmentCryptoModule = {
    ...(normalizedFromSnapshot ?? module),
    id: makeAssessmentModuleId(assessmentId, module.id),
    moduleId: module.id,
    assessmentId,
    detailSnapshot: options?.detailSnapshot,
    snapshottedAt: options?.detailSnapshot ? Date.now() : undefined,
    sourceGeneratedAt: options?.detailSnapshot?.generatedAt ?? null,
    stale: false,
    usageTypes: module.usageTypes ?? [],
    addedAt: Date.now(),
    updatedAt: Date.now(),
  };
  await db.assessmentCryptoModules.put(record);
  return record;
}

export async function updateAssessmentCryptoModule(
  assessmentId: string,
  moduleId: string,
  updates: Partial<
    Pick<
      AssessmentCryptoModule,
      'componentName' | 'usageTypes' | 'notes' | 'detailSnapshot' | 'snapshottedAt' | 'sourceGeneratedAt' | 'stale'
    >
  >,
): Promise<void> {
  const db = await openDb();
  await db.assessmentCryptoModules.update(makeAssessmentModuleId(assessmentId, moduleId), {
    ...updates,
    updatedAt: Date.now(),
  });
}

export async function refreshAssessmentCryptoModuleSnapshot(
  assessmentId: string,
  moduleId: string,
  detailSnapshot: CmvpCertificateDetail,
): Promise<void> {
  const db = await openDb();
  const { id: _certificateId, ...normalizedFields } = detailToNormalizedCmvpModule(detailSnapshot);
  await db.assessmentCryptoModules.update(makeAssessmentModuleId(assessmentId, moduleId), {
    ...normalizedFields,
    detailSnapshot,
    snapshottedAt: Date.now(),
    sourceGeneratedAt: detailSnapshot.generatedAt ?? null,
    stale: false,
    updatedAt: Date.now(),
  });
}

export async function setAssessmentCryptoModuleStale(
  assessmentId: string,
  moduleId: string,
  stale: boolean,
  sourceGeneratedAt?: string | null,
): Promise<void> {
  const db = await openDb();
  const updates: Partial<AssessmentCryptoModule> = {
    stale,
    updatedAt: Date.now(),
  };
  if (sourceGeneratedAt !== undefined) {
    updates.sourceGeneratedAt = sourceGeneratedAt;
  }
  await db.assessmentCryptoModules.update(makeAssessmentModuleId(assessmentId, moduleId), updates);
}

export async function deleteAssessmentCryptoModule(assessmentId: string, moduleId: string): Promise<void> {
  const db = await openDb();
  await db.assessmentCryptoModules.delete(makeAssessmentModuleId(assessmentId, moduleId));

  const linkedStatuses = await db.controlStatuses.where('assessmentId').equals(assessmentId).toArray();
  for (const status of linkedStatuses) {
    const linkedIds = status.linkedCmvpModuleIds ?? [];
    if (!linkedIds.includes(moduleId)) continue;
    await db.controlStatuses.update(status.id, {
      linkedCmvpModuleIds: linkedIds.filter(linkedId => linkedId !== moduleId),
      updatedAt: Date.now(),
    });
  }
}

export async function setControlCmvpLinks(
  frameworkId: string,
  controlId: string,
  linkedCmvpModuleIds: string[],
  assessmentId: string = DEFAULT_ASSESSMENT_ID,
): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await openDb();
  const id = makeAssessmentStatusId(assessmentId, frameworkId, controlId);
  const existing = await db.controlStatuses.get(id);

  await db.controlStatuses.put({
    id,
    assessmentId,
    frameworkId,
    controlId,
    status: existing?.status || 'not-assessed',
    owner: existing?.owner,
    notes: existing?.notes,
    updatedAt: Date.now(),
    autoSuggested: existing?.autoSuggested ?? false,
    autoSuggestSource: existing?.autoSuggestSource,
    confidence: existing?.confidence,
    linkedCmvpModuleIds,
  });
}

// === Control Status (assessment-aware) ===

export async function getControlStatus(
  frameworkId: string,
  controlId: string,
  assessmentId: string = DEFAULT_ASSESSMENT_ID,
): Promise<ImplementationStatus> {
  if (typeof window === 'undefined') return 'not-assessed';
  try {
    const db = await openDb();
    const record = await db.controlStatuses.get(makeAssessmentStatusId(assessmentId, frameworkId, controlId));
    return record?.status || 'not-assessed';
  } catch {
    return 'not-assessed';
  }
}

export async function setControlStatus(
  frameworkId: string,
  controlId: string,
  status: ImplementationStatus,
  assessmentId: string = DEFAULT_ASSESSMENT_ID,
  owner?: string,
): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await openDb();
  const id = makeAssessmentStatusId(assessmentId, frameworkId, controlId);
  const existing = await db.controlStatuses.get(id);
  await db.controlStatuses.put({
    id,
    assessmentId,
    frameworkId,
    controlId,
    status,
    owner: owner ?? existing?.owner,
    notes: existing?.notes,
    updatedAt: Date.now(),
    autoSuggested: false,
    autoSuggestSource: existing?.autoSuggestSource,
    confidence: existing?.confidence,
    linkedCmvpModuleIds: existing?.linkedCmvpModuleIds,
  });
}

async function upsertControlStatusFields(
  frameworkId: string,
  controlId: string,
  assessmentId: string,
  fields: { owner?: string | undefined; notes?: string | undefined },
): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await openDb();
  const id = makeAssessmentStatusId(assessmentId, frameworkId, controlId);
  const applyUpdate = async () => {
    const existing = await db.controlStatuses.get(id);
    await db.controlStatuses.put({
      id,
      assessmentId,
      frameworkId,
      controlId,
      status: existing?.status || 'not-assessed',
      owner: 'owner' in fields ? fields.owner?.trim() || undefined : existing?.owner,
      notes: 'notes' in fields ? fields.notes?.trim() || undefined : existing?.notes,
      updatedAt: Date.now(),
      autoSuggested: existing?.autoSuggested ?? false,
      autoSuggestSource: existing?.autoSuggestSource,
      confidence: existing?.confidence,
      linkedCmvpModuleIds: existing?.linkedCmvpModuleIds,
    });
  };
  if (typeof db.transaction === 'function') {
    await db.transaction('rw', db.controlStatuses, applyUpdate);
  } else {
    await applyUpdate();
  }
}

export async function setControlOwner(
  frameworkId: string,
  controlId: string,
  owner: string | undefined,
  assessmentId: string = DEFAULT_ASSESSMENT_ID,
): Promise<void> {
  await upsertControlStatusFields(frameworkId, controlId, assessmentId, { owner });
}

export async function setControlNotes(
  frameworkId: string,
  controlId: string,
  notes: string | undefined,
  assessmentId: string = DEFAULT_ASSESSMENT_ID,
): Promise<void> {
  await upsertControlStatusFields(frameworkId, controlId, assessmentId, { notes });
}

export async function setControlOwnerAndNotes(
  frameworkId: string,
  controlId: string,
  owner: string | undefined,
  notes: string | undefined,
  assessmentId: string = DEFAULT_ASSESSMENT_ID,
): Promise<void> {
  await upsertControlStatusFields(frameworkId, controlId, assessmentId, { owner, notes });
}

export async function bulkSetControlOwner(
  frameworkId: string,
  controlIds: string[],
  owner: string | undefined,
  assessmentId: string = DEFAULT_ASSESSMENT_ID,
): Promise<void> {
  if (typeof window === 'undefined' || controlIds.length === 0) return;
  const db = await openDb();
  const normalizedOwner = owner?.trim() || undefined;
  const existingRecords = await db.controlStatuses.where('assessmentId').equals(assessmentId).toArray();
  const existingMap = new Map(
    existingRecords
      .filter((record) => record.frameworkId === frameworkId)
      .map((record) => [record.controlId, record] as const),
  );

  const timestamp = Date.now();
  await db.controlStatuses.bulkPut(controlIds.map((controlId) => {
    const existing = existingMap.get(controlId);
    return {
      id: makeAssessmentStatusId(assessmentId, frameworkId, controlId),
      assessmentId,
      frameworkId,
      controlId,
      status: existing?.status || 'not-assessed',
      owner: normalizedOwner,
      notes: existing?.notes,
      updatedAt: timestamp,
      autoSuggested: existing?.autoSuggested ?? false,
      autoSuggestSource: existing?.autoSuggestSource,
      confidence: existing?.confidence,
      linkedCmvpModuleIds: existing?.linkedCmvpModuleIds,
    };
  }));
}

export async function bulkSetControlStatus(
  frameworkId: string,
  controlIds: string[],
  status: ImplementationStatus,
  assessmentId: string = DEFAULT_ASSESSMENT_ID,
): Promise<void> {
  if (typeof window === 'undefined' || controlIds.length === 0) return;
  const db = await openDb();
  const existingRecords = await db.controlStatuses.where('assessmentId').equals(assessmentId).toArray();
  const existingMap = new Map(
    existingRecords
      .filter((record) => record.frameworkId === frameworkId)
      .map((record) => [record.controlId, record] as const),
  );

  const timestamp = Date.now();
  await db.controlStatuses.bulkPut(controlIds.map((controlId) => {
    const existing = existingMap.get(controlId);
    return {
      id: makeAssessmentStatusId(assessmentId, frameworkId, controlId),
      assessmentId,
      frameworkId,
      controlId,
      status,
      owner: existing?.owner,
      notes: existing?.notes,
      updatedAt: timestamp,
      autoSuggested: false,
      autoSuggestSource: existing?.autoSuggestSource,
      confidence: existing?.confidence,
      linkedCmvpModuleIds: existing?.linkedCmvpModuleIds,
    };
  }));
}

export async function bulkApplyControlNotesTemplate(
  frameworkId: string,
  controlIds: string[],
  template: string,
  options?: {
    mode?: 'append' | 'replace';
  },
  assessmentId: string = DEFAULT_ASSESSMENT_ID,
): Promise<void> {
  if (typeof window === 'undefined' || controlIds.length === 0) return;
  const db = await openDb();
  const mode = options?.mode ?? 'append';
  const normalizedTemplate = template.trim();
  if (!normalizedTemplate) return;

  const existingRecords = await db.controlStatuses.where('assessmentId').equals(assessmentId).toArray();
  const existingMap = new Map(
    existingRecords
      .filter((record) => record.frameworkId === frameworkId)
      .map((record) => [record.controlId, record] as const),
  );

  const timestamp = Date.now();
  await db.controlStatuses.bulkPut(controlIds.map((controlId) => {
    const existing = existingMap.get(controlId);
    const existingNotes = existing?.notes?.trim();
    const nextNotes = mode === 'replace'
      ? normalizedTemplate
      : existingNotes
        ? `${existingNotes}\n\n${normalizedTemplate}`
        : normalizedTemplate;

    return {
      id: makeAssessmentStatusId(assessmentId, frameworkId, controlId),
      assessmentId,
      frameworkId,
      controlId,
      status: existing?.status || 'not-assessed',
      owner: existing?.owner,
      notes: nextNotes,
      updatedAt: timestamp,
      autoSuggested: existing?.autoSuggested ?? false,
      autoSuggestSource: existing?.autoSuggestSource,
      confidence: existing?.confidence,
      linkedCmvpModuleIds: existing?.linkedCmvpModuleIds,
    };
  }));
}

export async function getAllControlOwners(
  assessmentId: string = DEFAULT_ASSESSMENT_ID,
): Promise<Map<string, string>> {
  if (typeof window === 'undefined') return new Map();
  try {
    const db = await openDb();
    const records = await db.controlStatuses.where('assessmentId').equals(assessmentId).toArray();
    const map = new Map<string, string>();
    for (const record of records) {
      if (record.owner) {
        map.set(`${record.frameworkId}:${record.controlId}`, record.owner);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function getAllControlStatuses(
  assessmentId: string = DEFAULT_ASSESSMENT_ID,
): Promise<Map<string, ImplementationStatus>> {
  if (typeof window === 'undefined') return new Map();
  try {
    const db = await openDb();
    const records = await db.controlStatuses.where('assessmentId').equals(assessmentId).toArray();
    const map = new Map<string, ImplementationStatus>();
    for (const record of records) {
      map.set(`${record.frameworkId}:${record.controlId}`, record.status);
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function getAllControlStatusRecords(
  assessmentId: string = DEFAULT_ASSESSMENT_ID,
): Promise<Map<string, ControlStatus>> {
  if (typeof window === 'undefined') return new Map();
  try {
    const db = await openDb();
    const records = await db.controlStatuses.where('assessmentId').equals(assessmentId).toArray();
    const map = new Map<string, ControlStatus>();
    for (const record of records) {
      map.set(`${record.frameworkId}:${record.controlId}`, record);
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function compareAssessments(
  assessmentA: string,
  assessmentB: string,
): Promise<{ controlId: string; frameworkId: string; statusA: ImplementationStatus; statusB: ImplementationStatus }[]> {
  const [mapA, mapB] = await Promise.all([
    getAllControlStatuses(assessmentA),
    getAllControlStatuses(assessmentB),
  ]);

  const diffs: { controlId: string; frameworkId: string; statusA: ImplementationStatus; statusB: ImplementationStatus }[] = [];
  const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);

  for (const key of allKeys) {
    const statusA = mapA.get(key) || 'not-assessed';
    const statusB = mapB.get(key) || 'not-assessed';
    if (statusA !== statusB) {
      const [frameworkId, ...controlParts] = key.split(':');
      diffs.push({
        controlId: controlParts.join(':'),
        frameworkId,
        statusA,
        statusB,
      });
    }
  }

  return diffs;
}
