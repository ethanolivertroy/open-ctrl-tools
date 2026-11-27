/**
 * FedRAMP 20x ↔ Rev 5 Bidirectional Crosswalk
 *
 * Builds forward (KSI → Rev 5) and reverse (Rev 5 → KSI) indexes
 * from the `related_controls` field in fedramp-20x-ksi.json.
 *
 * The crosswalk is informational only — Rev 5 gaps do NOT determine
 * KSI compliance. FedRAMP 20x is outcome-based.
 */

import ksiData from '../data/fedramp-20x-ksi.json';
import fedrampData from '../data/fedramp-rev5.json';
import { getAssessments, getAllControlStatuses } from './storage/assessment-store';
import type { ImplementationStatus, Assessment } from './storage-types';

interface KSIControlRaw {
  control_id: string;
  title: string;
  related_controls: string[];
}

interface Rev5ControlRaw {
  control_id: string;
  title: string;
}

const ksiControls = (ksiData as { controls: KSIControlRaw[] }).controls;
const rev5Controls = (fedrampData as { controls: Rev5ControlRaw[] }).controls;

// Build a Rev 5 control ID → title map for display
const rev5TitleMap = new Map<string, string>();
for (const c of rev5Controls) {
  rev5TitleMap.set(c.control_id, c.title);
}

// Build a KSI control ID → title map for display
const ksiTitleMap = new Map<string, string>();
for (const c of ksiControls) {
  ksiTitleMap.set(c.control_id, c.title);
}

// === ID Normalization ===

/**
 * Normalize a KSI related_controls ID to match Rev 5 format.
 * Examples:
 *   "ac-3"    → "AC-3"
 *   "ac-17.1" → "AC-17(1)"
 *   "si-4.5"  → "SI-4(5)"
 */
export function normalizeKSIRelatedControlId(raw: string): string {
  const upper = raw.toUpperCase();
  // Convert dot-notation to parenthesis: AC-17.1 → AC-17(1)
  return upper.replace(/\.(\d+)$/, '($1)');
}

// === Index Builders (memoized) ===

let _ksiToRev5: Map<string, string[]> | null = null;
let _rev5ToKSI: Map<string, string[]> | null = null;

/**
 * Forward index: KSI control ID → normalized Rev 5 control IDs.
 */
export function buildKSItoRev5Map(): Map<string, string[]> {
  if (_ksiToRev5) return _ksiToRev5;
  _ksiToRev5 = new Map();
  for (const c of ksiControls) {
    const normalized = c.related_controls.map(normalizeKSIRelatedControlId);
    _ksiToRev5.set(c.control_id, normalized);
  }
  return _ksiToRev5;
}

/**
 * Reverse index: Rev 5 control ID → KSI control IDs that reference it.
 */
export function buildRev5toKSIMap(): Map<string, string[]> {
  if (_rev5ToKSI) return _rev5ToKSI;
  _rev5ToKSI = new Map();
  const forward = buildKSItoRev5Map();
  for (const [ksiId, rev5Ids] of forward) {
    for (const rev5Id of rev5Ids) {
      const existing = _rev5ToKSI.get(rev5Id) || [];
      existing.push(ksiId);
      _rev5ToKSI.set(rev5Id, existing);
    }
  }
  return _rev5ToKSI;
}

// === Cross-Assessment Lookups ===

export interface RelatedControlStatus {
  controlId: string;
  title: string;
  status: ImplementationStatus | null;
  /** true if the control exists in the FedRAMP Rev 5 baseline */
  inBaseline: boolean;
}

/**
 * Find the most recently updated assessment for a given framework.
 */
export async function findLatestAssessmentForFramework(
  frameworkId: string,
): Promise<Assessment | null> {
  const assessments = await getAssessments();
  const matching = assessments.filter(a => a.targetFrameworks.includes(frameworkId));
  if (matching.length === 0) return null;
  // Already sorted by updatedAt desc from getAssessments()
  return matching[0];
}

/**
 * For a given KSI, get related Rev 5 controls with their statuses.
 * If rev5AssessmentId is not provided, auto-discovers the latest Rev 5 assessment.
 */
export async function getRelatedRev5Statuses(
  ksiId: string,
  rev5AssessmentId?: string,
): Promise<RelatedControlStatus[]> {
  const forward = buildKSItoRev5Map();
  const rev5Ids = forward.get(ksiId);
  if (!rev5Ids || rev5Ids.length === 0) return [];

  let statusMap: Map<string, ImplementationStatus> | null = null;
  if (rev5AssessmentId) {
    statusMap = await getAllControlStatuses(rev5AssessmentId);
  } else {
    const latest = await findLatestAssessmentForFramework('fedramp-rev5');
    if (latest) {
      statusMap = await getAllControlStatuses(latest.id);
    }
  }

  return rev5Ids.map(rev5Id => ({
    controlId: rev5Id,
    title: rev5TitleMap.get(rev5Id) || rev5Id,
    status: statusMap?.get(`fedramp-rev5:${rev5Id}`) ?? null,
    inBaseline: rev5TitleMap.has(rev5Id),
  }));
}

/**
 * For a given Rev 5 control, get related 20x KSIs with their statuses.
 * If ksi20xAssessmentId is not provided, auto-discovers the latest 20x assessment.
 */
export async function getRelatedKSIStatuses(
  rev5ControlId: string,
  ksi20xAssessmentId?: string,
): Promise<RelatedControlStatus[]> {
  const reverse = buildRev5toKSIMap();
  const ksiIds = reverse.get(rev5ControlId);
  if (!ksiIds || ksiIds.length === 0) return [];

  let statusMap: Map<string, ImplementationStatus> | null = null;
  if (ksi20xAssessmentId) {
    statusMap = await getAllControlStatuses(ksi20xAssessmentId);
  } else {
    const latest = await findLatestAssessmentForFramework('fedramp-20x-ksi');
    if (latest) {
      statusMap = await getAllControlStatuses(latest.id);
    }
  }

  return ksiIds.map(ksiId => ({
    controlId: ksiId,
    title: ksiTitleMap.get(ksiId) || ksiId,
    status: statusMap?.get(`fedramp-20x-ksi:${ksiId}`) ?? null,
    inBaseline: true, // All KSIs are in the 20x framework
  }));
}

/**
 * Check if a Rev 5 control has any related 20x KSIs.
 */
export function hasRelatedKSIs(rev5ControlId: string): boolean {
  const reverse = buildRev5toKSIMap();
  return (reverse.get(rev5ControlId)?.length ?? 0) > 0;
}

/**
 * Get KSI IDs related to a Rev 5 control (synchronous, no status lookup).
 */
export function getRelatedKSIIds(rev5ControlId: string): string[] {
  const reverse = buildRev5toKSIMap();
  return reverse.get(rev5ControlId) || [];
}

/**
 * Get Rev 5 control IDs related to a KSI (synchronous, no status lookup).
 */
export function getRelatedRev5Ids(ksiId: string): string[] {
  const forward = buildKSItoRev5Map();
  return forward.get(ksiId) || [];
}
