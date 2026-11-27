import {
  DEFAULT_PROJECT_ID,
  getDb,
  type ControlNote,
  type FavoriteFramework,
  type FilterPreset,
  type RecentlyViewed,
  type SavedView,
} from '../db';
import type { MyCtrlDB } from '../db-runtime';

const MIGRATED_KEY = 'myctrl-dexie-migrated';

async function openDb(): Promise<MyCtrlDB> {
  return getDb();
}

export async function migrateFromLocalStorage(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(MIGRATED_KEY)) return;

  try {
    const db = await openDb();
    const favoritesRaw = localStorage.getItem('myctrl-favorite-frameworks');
    const notesRaw = localStorage.getItem('myctrl-control-notes');
    const recentRaw = localStorage.getItem('myctrl-recently-viewed');
    const viewsRaw = localStorage.getItem('myctrl-saved-views');
    const presetsRaw = localStorage.getItem('myctrl-filter-presets');
    const navScope = localStorage.getItem('myctrl-nav-scope');
    const aiPref = localStorage.getItem('myctrl-ai-data-preference');
    const apiKey = localStorage.getItem('myctrl-anthropic-api-key');

    await db.transaction('rw', [db.favorites, db.controlNotes, db.recentlyViewed, db.savedViews, db.filterPresets, db.settings], async () => {
      if (favoritesRaw) {
        const parsed = JSON.parse(favoritesRaw);
        let favorites: FavoriteFramework[];
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
          favorites = parsed.map((id: string) => ({ frameworkId: id, notes: '', addedAt: Date.now() }));
        } else {
          favorites = parsed;
        }
        const validFavorites = favorites.filter((f: any) => f.frameworkId);
        if (validFavorites.length > 0) await db.favorites.bulkPut(validFavorites);
      }

      if (notesRaw) {
        const notesMap: Record<string, Omit<ControlNote, 'projectId'> & Partial<Pick<ControlNote, 'projectId'>>> = JSON.parse(notesRaw);
        const entries = Object.entries(notesMap)
          .filter(([key, note]: any) => key && note)
          .map(([key, note]) => ({
            id: key,
            projectId: note.projectId || DEFAULT_PROJECT_ID,
            ...note,
          }));
        if (entries.length > 0) {
          await db.controlNotes.bulkPut(entries);
        }
      }

      if (recentRaw) {
        const items: RecentlyViewed[] = JSON.parse(recentRaw);
        const validItems = items.filter((item: any) => item.href);
        if (validItems.length > 0) {
          await db.recentlyViewed.bulkPut(validItems);
        }
      }

      if (viewsRaw) {
        const views: SavedView[] = JSON.parse(viewsRaw);
        const validViews = views
          .filter((v: any) => v.id)
          .map(view => ({
            ...view,
            projectId: view.projectId || DEFAULT_PROJECT_ID,
          }));
        if (validViews.length > 0) {
          await db.savedViews.bulkPut(validViews);
        }
      }

      if (presetsRaw) {
        const presets: FilterPreset[] = JSON.parse(presetsRaw);
        const validPresets = presets.filter((p: any) => p.id);
        if (validPresets.length > 0) {
          await db.filterPresets.bulkPut(validPresets);
        }
      }

      if (navScope) {
        await db.settings.put({ key: 'nav-scope', value: navScope });
      }

      if (aiPref) {
        await db.settings.put({ key: 'ai-data-pref', value: aiPref });
      }

      if (apiKey) {
        await db.settings.put({ key: 'api-key', value: apiKey });
      }
    });

    localStorage.setItem(MIGRATED_KEY, 'true');
  } catch (e) {
    console.error('Dexie migration failed:', e);
  }
}
