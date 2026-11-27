import {
  getDb,
  type FilterPreset,
} from '../db';
import type { MyCtrlDB } from '../db-runtime';

async function openDb(): Promise<MyCtrlDB> {
  return getDb();
}

export async function getPresets(): Promise<FilterPreset[]> {
  if (typeof window === 'undefined') return [];
  try {
    const db = await openDb();
    return await db.filterPresets.toArray();
  } catch {
    return [];
  }
}

export async function savePreset(preset: Omit<FilterPreset, 'id' | 'createdAt'>): Promise<FilterPreset> {
  const db = await openDb();
  const newPreset: FilterPreset = {
    ...preset,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  await db.filterPresets.add(newPreset);
  return newPreset;
}

export async function deletePreset(id: string): Promise<void> {
  const db = await openDb();
  await db.filterPresets.delete(id);
}
