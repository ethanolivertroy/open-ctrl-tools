/**
 * Assessment mutation workflows.
 *
 * Thin service boundary between render components (json-render assessment
 * queues) and the IndexedDB assessment store. Components call these workflows
 * instead of importing @/lib/storage/assessment-store directly, keeping
 * storage mutations out of render code.
 */

import type { ImplementationStatus } from '@/lib/db';
import {
  bulkApplyControlNotesTemplate,
  bulkSetControlOwner,
  bulkSetControlStatus,
  setControlNotes,
  setControlOwner,
} from '@/lib/storage/assessment-store';

export interface AssessmentScope {
  frameworkId: string;
  assessmentId: string;
}

/** Assign (or clear, when owner is blank) an owner across a set of controls. */
export async function bulkAssignOwner(
  scope: AssessmentScope,
  controlIds: string[],
  owner: string,
): Promise<void> {
  await bulkSetControlOwner(scope.frameworkId, controlIds, owner, scope.assessmentId);
}

/** Apply one implementation status across a set of controls. */
export async function bulkUpdateStatus(
  scope: AssessmentScope,
  controlIds: string[],
  status: ImplementationStatus,
): Promise<void> {
  await bulkSetControlStatus(scope.frameworkId, controlIds, status, scope.assessmentId);
}

/** Stamp a notes template across a set of controls (append or replace). */
export async function bulkApplyNotesTemplate(
  scope: AssessmentScope,
  controlIds: string[],
  template: string,
  mode: 'append' | 'replace',
): Promise<void> {
  await bulkApplyControlNotesTemplate(
    scope.frameworkId,
    controlIds,
    template,
    { mode },
    scope.assessmentId,
  );
}

/** Save owner and implementation notes for a single control together. */
export async function updateControlOwnerAndNotes(
  scope: AssessmentScope,
  controlId: string,
  owner: string,
  notes: string,
): Promise<void> {
  await Promise.all([
    setControlOwner(scope.frameworkId, controlId, owner, scope.assessmentId),
    setControlNotes(scope.frameworkId, controlId, notes, scope.assessmentId),
  ]);
}

/** Save notes for a single control. */
export async function updateControlNotes(
  scope: AssessmentScope,
  controlId: string,
  notes: string,
): Promise<void> {
  await setControlNotes(scope.frameworkId, controlId, notes, scope.assessmentId);
}
