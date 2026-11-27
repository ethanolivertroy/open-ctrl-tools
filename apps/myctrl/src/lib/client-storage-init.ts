import { migrateFromLocalStorage } from './storage/local-storage-migration';

let initPromise: Promise<void> | null = null;

export function initClientStorage(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (!initPromise) {
    initPromise = (async () => {
      try {
        await migrateFromLocalStorage();
      } catch (error) {
        console.error('Client storage initialization failed:', error);
      }
    })();
  }

  return initPromise;
}
