export interface BackupTableHandle {
  count(): Promise<number>;
  toArray(): Promise<unknown[]>;
  bulkPut(records: unknown[]): Promise<unknown>;
}

export interface BackupDbLike {
  table(name: string): BackupTableHandle;
}

export const BACKUP_TABLE_LABELS: Record<string, string> = {
  favorites: 'Favorites',
  controlNotes: 'Control Notes',
  recentlyViewed: 'Recently Viewed',
  savedViews: 'Saved Views',
  filterPresets: 'Filter Presets',
  settings: 'Settings',
  whiteboards: 'Whiteboards',
  whiteboardSnapshots: 'Whiteboard Data',
  projects: 'Projects',
  assessments: 'Assessments',
  controlStatuses: 'Control Statuses',
  assessmentCryptoModules: 'Crypto Modules',
};

export type BackupImportStatus = 'v2' | 'v1' | 'invalid';

/** Export allowlisted IndexedDB tables for JSON backup, stripping the API key unless requested. */
export async function exportBackupTables(
  db: BackupDbLike,
  options: { includeApiKey: boolean },
): Promise<Record<string, unknown[]>> {
  const data: Record<string, unknown[]> = {};
  for (const name of Object.keys(BACKUP_TABLE_LABELS)) {
    if (name === 'settings' && !options.includeApiKey) {
      try {
        const all = await db.table(name).toArray() as Array<{ key?: unknown }>;
        data[name] = all.filter(setting => setting.key !== 'api-key');
      } catch {
        // skip unreadable table
      }
      continue;
    }
    try {
      data[name] = await db.table(name).toArray();
    } catch {
      // skip unreadable table
    }
  }
  return data;
}

/** Validate a parsed backup payload and restore allowlisted v2 tables into IndexedDB. */
export async function importBackupPayload(
  db: BackupDbLike,
  parsed: unknown,
): Promise<BackupImportStatus> {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return 'invalid';
  }
  const candidate = parsed as { version?: unknown; data?: unknown };
  if (candidate.version === 2 && candidate.data && typeof candidate.data === 'object' && !Array.isArray(candidate.data)) {
    for (const [tableName, records] of Object.entries(candidate.data as Record<string, unknown>)) {
      if (!Object.hasOwn(BACKUP_TABLE_LABELS, tableName)) continue;
      if (Array.isArray(records)) {
        await db.table(tableName).bulkPut(records);
      }
    }
    return 'v2';
  }
  if (candidate.version === 1 && candidate.data) {
    return 'v1';
  }
  return 'invalid';
}
