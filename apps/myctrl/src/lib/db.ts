import type { MyCtrlDB } from './db-runtime';

export * from './storage-types';

let dbPromise: Promise<MyCtrlDB> | null = null;

export async function getDb(): Promise<MyCtrlDB> {
  if (typeof window === 'undefined') {
    throw new Error('getDb() can only be called in the browser.');
  }

  if (!dbPromise) {
    dbPromise = import('./db-runtime')
      .then(({ db }) => db)
      .catch(error => {
        dbPromise = null;
        throw error;
      });
  }

  return dbPromise;
}
