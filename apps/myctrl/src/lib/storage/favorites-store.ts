import {
  getDb,
  type FavoriteFramework,
} from '../db';
import type { MyCtrlDB } from '../db-runtime';

async function openDb(): Promise<MyCtrlDB> {
  return getDb();
}

export async function getFavoriteFrameworks(): Promise<FavoriteFramework[]> {
  if (typeof window === 'undefined') return [];
  try {
    const db = await openDb();
    return await db.favorites.toArray();
  } catch {
    return [];
  }
}

export async function getFavorites(): Promise<string[]> {
  const favs = await getFavoriteFrameworks();
  return favs.map(f => f.frameworkId);
}

export async function toggleFavorite(frameworkId: string): Promise<boolean> {
  const db = await openDb();
  const existing = await db.favorites.get(frameworkId);
  if (existing) {
    await db.favorites.delete(frameworkId);
    return false;
  }

  await db.favorites.add({ frameworkId, notes: '', addedAt: Date.now() });
  return true;
}

export async function isFavorite(frameworkId: string): Promise<boolean> {
  const db = await openDb();
  const existing = await db.favorites.get(frameworkId);
  return !!existing;
}

export async function updateFavoriteNotes(frameworkId: string, notes: string): Promise<void> {
  const db = await openDb();
  await db.favorites.update(frameworkId, { notes });
}

export async function getFavoriteNotes(frameworkId: string): Promise<string> {
  const db = await openDb();
  const fav = await db.favorites.get(frameworkId);
  return fav?.notes || '';
}
