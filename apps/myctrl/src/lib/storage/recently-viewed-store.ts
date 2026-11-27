import {
  getDb,
  type RecentlyViewed,
} from '../db';
import type { MyCtrlDB } from '../db-runtime';

const MAX_RECENT_ITEMS = 10;

async function openDb(): Promise<MyCtrlDB> {
  return getDb();
}

export async function getRecentlyViewed(): Promise<RecentlyViewed[]> {
  if (typeof window === 'undefined') return [];
  try {
    const db = await openDb();
    return await db.recentlyViewed.orderBy('viewedAt').reverse().toArray();
  } catch {
    return [];
  }
}

export async function addRecentlyViewed(item: Omit<RecentlyViewed, 'viewedAt'>): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await openDb();

  await db.recentlyViewed.delete(item.href);
  await db.recentlyViewed.add({ ...item, viewedAt: Date.now() });

  const all = await db.recentlyViewed.orderBy('viewedAt').reverse().toArray();
  if (all.length > MAX_RECENT_ITEMS) {
    const toDelete = all.slice(MAX_RECENT_ITEMS).map(entry => entry.href);
    await db.recentlyViewed.bulkDelete(toDelete);
  }
}

export async function clearRecentlyViewed(): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await openDb();
  await db.recentlyViewed.clear();
}
