import {
  getDb,
  type SavedView,
} from '../db';
import type { MyCtrlDB } from '../db-runtime';
import { getActiveProjectId } from './project-store';

const MAX_SAVED_VIEWS = 20;
export const SAVED_VIEWS_CHANGED_EVENT = 'myctrl:saved-views-changed';

export interface SaveViewOptions {
  projectId?: string;
  source?: SavedView['source'];
  frameworkId?: string;
  controlId?: string;
  family?: string;
  assessmentId?: string;
  baseline?: string;
  systemName?: string;
}

async function openDb(): Promise<MyCtrlDB> {
  return getDb();
}

function dispatchSavedViewEvent(detail?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SAVED_VIEWS_CHANGED_EVENT, { detail }));
}

async function resolveProjectId(projectId?: string): Promise<string> {
  return projectId ?? await getActiveProjectId();
}

async function touchProject(db: MyCtrlDB, projectId: string): Promise<void> {
  await db.projects.update(projectId, { updatedAt: Date.now() });
}

export async function getSavedViews(projectId?: string): Promise<SavedView[]> {
  if (typeof window === 'undefined') return [];
  try {
    const db = await openDb();
    const resolvedProjectId = await resolveProjectId(projectId);
    const views = await db.savedViews.where('projectId').equals(resolvedProjectId).toArray();
    return views.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function saveView(
  name: string,
  prompt: string,
  viewJson: string,
  options: SaveViewOptions = {},
): Promise<SavedView> {
  const db = await openDb();
  const resolvedProjectId = await resolveProjectId(options.projectId);
  const inferredSource = options.source
    ?? (options.controlId ? 'control' : options.assessmentId ? 'assessment' : 'build');
  const newView: SavedView = {
    id: crypto.randomUUID(),
    projectId: resolvedProjectId,
    name,
    prompt,
    viewJson,
    source: inferredSource,
    frameworkId: options.frameworkId,
    controlId: options.controlId,
    family: options.family,
    assessmentId: options.assessmentId,
    baseline: options.baseline,
    systemName: options.systemName,
    createdAt: Date.now(),
    version: 2,
  };
  await db.savedViews.add(newView);
  await touchProject(db, resolvedProjectId);

  const all = await getSavedViews(resolvedProjectId);
  if (all.length > MAX_SAVED_VIEWS) {
    const toDelete = all.slice(MAX_SAVED_VIEWS).map(view => view.id);
    await db.savedViews.bulkDelete(toDelete);
  }

  dispatchSavedViewEvent({
    projectId: resolvedProjectId,
    savedViewId: newView.id,
    action: 'created',
  });

  return newView;
}

export async function deleteSavedView(id: string): Promise<void> {
  const db = await openDb();
  const existing = await db.savedViews.get(id);
  await db.savedViews.delete(id);
  if (existing?.projectId) {
    await touchProject(db, existing.projectId);
  }
  dispatchSavedViewEvent({
    projectId: existing?.projectId,
    savedViewId: id,
    action: 'deleted',
  });
}

export async function getSavedViewById(id: string): Promise<SavedView | null> {
  const db = await openDb();
  const view = await db.savedViews.get(id);
  return view || null;
}

export async function getSavedViewsForAssessment(
  assessmentId: string,
  projectId?: string,
): Promise<SavedView[]> {
  const views = await getSavedViews(projectId);
  return views.filter(view => view.assessmentId === assessmentId);
}

export async function getSavedViewsForControl(
  assessmentId: string,
  controlId: string,
  projectId?: string,
): Promise<SavedView[]> {
  const views = await getSavedViewsForAssessment(assessmentId, projectId);
  return views.filter(view => view.controlId === controlId);
}

export async function loadSavedViewJson(id: string): Promise<{ viewJson: string; version: number } | null> {
  const db = await openDb();
  const saved = await db.savedViews.get(id);
  if (!saved) return null;
  return { viewJson: saved.viewJson, version: saved.version || 1 };
}
