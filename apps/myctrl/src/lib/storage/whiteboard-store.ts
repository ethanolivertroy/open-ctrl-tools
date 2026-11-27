import {
  getDb,
  type WhiteboardMeta,
} from '../db';
import type { MyCtrlDB } from '../db-runtime';
import { getActiveProjectId } from './project-store';

const MAX_WHITEBOARDS = 20;
export const WHITEBOARDS_CHANGED_EVENT = 'myctrl:whiteboards-changed';

async function openDb(): Promise<MyCtrlDB> {
  return getDb();
}

function dispatchWhiteboardEvent(detail: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(WHITEBOARDS_CHANGED_EVENT, { detail }));
}

async function resolveProjectId(projectId?: string): Promise<string> {
  return projectId ?? await getActiveProjectId();
}

async function touchProject(db: MyCtrlDB, projectId: string): Promise<void> {
  await db.projects.update(projectId, { updatedAt: Date.now() });
}

export async function getWhiteboards(projectId?: string): Promise<WhiteboardMeta[]> {
  if (typeof window === 'undefined') return [];
  try {
    const db = await openDb();
    const resolvedProjectId = await resolveProjectId(projectId);
    const boards = await db.whiteboards.where('projectId').equals(resolvedProjectId).toArray();
    return boards.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function createWhiteboard(name: string, projectId?: string): Promise<WhiteboardMeta> {
  const db = await openDb();
  const resolvedProjectId = await resolveProjectId(projectId);
  const existingCount = await db.whiteboards.where('projectId').equals(resolvedProjectId).count();
  if (existingCount >= MAX_WHITEBOARDS) {
    throw new Error(`Project already has ${MAX_WHITEBOARDS} whiteboards.`);
  }

  const now = Date.now();
  const board: WhiteboardMeta = {
    id: crypto.randomUUID(),
    projectId: resolvedProjectId,
    name,
    createdAt: now,
    updatedAt: now,
  };
  await db.whiteboards.add(board);
  await touchProject(db, resolvedProjectId);
  dispatchWhiteboardEvent({ projectId: resolvedProjectId, boardId: board.id, action: 'created' });
  return board;
}

export async function renameWhiteboard(id: string, name: string): Promise<void> {
  const db = await openDb();
  const board = await db.whiteboards.get(id);
  if (!board) return;

  const now = Date.now();
  await db.whiteboards.update(id, { name, updatedAt: now });
  await touchProject(db, board.projectId);
  dispatchWhiteboardEvent({ projectId: board.projectId, boardId: id, action: 'renamed' });
}

export async function deleteWhiteboard(id: string): Promise<void> {
  const db = await openDb();
  const board = await db.whiteboards.get(id);
  if (!board) return;

  await db.transaction('rw', db.whiteboards, db.whiteboardSnapshots, async () => {
    await db.whiteboards.delete(id);
    await db.whiteboardSnapshots.delete(id);
  });
  await touchProject(db, board.projectId);
  dispatchWhiteboardEvent({ projectId: board.projectId, boardId: id, action: 'deleted' });
}

export async function getWhiteboardSnapshot(boardId: string): Promise<unknown | null> {
  const db = await openDb();
  const saved = await db.whiteboardSnapshots.get(boardId);
  return saved?.snapshot ?? null;
}

export async function deleteWhiteboardSnapshot(boardId: string): Promise<void> {
  const db = await openDb();
  await db.whiteboardSnapshots.delete(boardId);
}

export async function saveWhiteboardSnapshot(boardId: string, snapshot: unknown): Promise<void> {
  const db = await openDb();
  const board = await db.whiteboards.get(boardId);
  if (!board) return;

  const now = Date.now();
  await db.whiteboardSnapshots.put({ boardId, snapshot });
  await db.whiteboards.update(boardId, { updatedAt: now });
  await touchProject(db, board.projectId);
}
