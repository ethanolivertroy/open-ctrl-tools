import { DEFAULT_PROJECT_ID, getDb, type ControlNote } from '../db';
import type { MyCtrlDB } from '../db-runtime';
import { getActiveProjectId } from './project-store';

async function openDb(): Promise<MyCtrlDB> {
  return getDb();
}

function makeControlKey(projectId: string, frameworkId: string, controlSlug: string): string {
  if (projectId === DEFAULT_PROJECT_ID) {
    return `${frameworkId}:${controlSlug}`;
  }
  return `${projectId}:${frameworkId}:${controlSlug}`;
}

async function resolveProjectId(projectId?: string): Promise<string> {
  return projectId ?? await getActiveProjectId();
}

export async function getControlNote(
  frameworkId: string,
  controlSlug: string,
  projectId?: string,
): Promise<string> {
  if (typeof window === 'undefined') return '';
  try {
    const resolvedProjectId = await resolveProjectId(projectId);
    const db = await openDb();
    const key = makeControlKey(resolvedProjectId, frameworkId, controlSlug);
    return (await db.controlNotes.get(key))?.notes || '';
  } catch {
    return '';
  }
}

export async function setControlNote(
  frameworkId: string,
  controlSlug: string,
  noteText: string,
  projectId?: string,
): Promise<void> {
  const resolvedProjectId = await resolveProjectId(projectId);
  const db = await openDb();
  const key = makeControlKey(resolvedProjectId, frameworkId, controlSlug);
  if (noteText.trim() === '') {
    await db.controlNotes.delete(key);
  } else {
    await db.controlNotes.put({
      id: key,
      projectId: resolvedProjectId,
      frameworkId,
      controlSlug,
      notes: noteText,
      updatedAt: Date.now(),
    });
  }
  await db.projects.update(resolvedProjectId, { updatedAt: Date.now() });
}

export async function deleteControlNote(
  frameworkId: string,
  controlSlug: string,
  projectId?: string,
): Promise<void> {
  const resolvedProjectId = await resolveProjectId(projectId);
  const db = await openDb();
  await db.controlNotes.delete(makeControlKey(resolvedProjectId, frameworkId, controlSlug));
  await db.projects.update(resolvedProjectId, { updatedAt: Date.now() });
}

export async function getAllControlNotes(projectId?: string): Promise<ControlNote[]> {
  if (typeof window === 'undefined') return [];
  try {
    const resolvedProjectId = await resolveProjectId(projectId);
    const db = await openDb();
    const notes = await db.controlNotes.where('projectId').equals(resolvedProjectId).toArray();
    return notes.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function getControlNotesForFramework(
  frameworkId: string,
  projectId?: string,
): Promise<ControlNote[]> {
  const resolvedProjectId = await resolveProjectId(projectId);
  const db = await openDb();
  const notes = await db.controlNotes.where('[projectId+frameworkId]').equals([resolvedProjectId, frameworkId]).toArray();
  return notes.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getControlNoteUpdatedAt(
  frameworkId: string,
  controlSlug: string,
  projectId?: string,
): Promise<number | null> {
  const resolvedProjectId = await resolveProjectId(projectId);
  const db = await openDb();
  const note = await db.controlNotes.get(makeControlKey(resolvedProjectId, frameworkId, controlSlug));
  return note?.updatedAt || null;
}
