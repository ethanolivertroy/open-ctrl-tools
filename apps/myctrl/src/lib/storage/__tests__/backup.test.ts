import { describe, expect, it } from 'vitest';
import {
  BACKUP_TABLE_LABELS,
  exportBackupTables,
  importBackupPayload,
  type BackupDbLike,
} from '@/lib/storage/backup';

function createFakeBackupDb(initial: Record<string, unknown[]> = {}): {
  db: BackupDbLike;
  tables: Record<string, unknown[]>;
} {
  const tables: Record<string, unknown[]> = {
    favorites: [],
    controlNotes: [],
    recentlyViewed: [],
    savedViews: [],
    filterPresets: [],
    settings: [],
    whiteboards: [],
    whiteboardSnapshots: [],
    projects: [],
    assessments: [],
    controlStatuses: [],
    assessmentCryptoModules: [],
    providerConfigs: [],
    ...initial,
  };

  return {
    tables,
    db: {
      table(name: string) {
        return {
          async count() {
            return (tables[name] ?? []).length;
          },
          async toArray() {
            return structuredClone(tables[name] ?? []);
          },
          async bulkPut(records: unknown[]) {
            tables[name] = [...(tables[name] ?? []), ...structuredClone(records)];
          },
        };
      },
    },
  };
}

describe('browser backup and restore', () => {
  it('includes projects and assessment tables while excluding providerConfigs', () => {
    expect(Object.keys(BACKUP_TABLE_LABELS)).toEqual(
      expect.arrayContaining([
        'favorites',
        'controlNotes',
        'recentlyViewed',
        'savedViews',
        'filterPresets',
        'settings',
        'whiteboards',
        'whiteboardSnapshots',
        'projects',
        'assessments',
        'controlStatuses',
        'assessmentCryptoModules',
      ]),
    );
    expect(Object.hasOwn(BACKUP_TABLE_LABELS, 'providerConfigs')).toBe(false);
  });

  it('exports all project and assessment records and respects includeApiKey', async () => {
    const { db } = createFakeBackupDb({
      settings: [
        { key: 'theme', value: 'dracula' },
        { key: 'api-key', value: 'sk-secret-value' },
      ],
      projects: [{ id: 'proj-1', name: 'Prod', createdAt: 1, updatedAt: 1 }],
      assessments: [{ id: 'assess-1', projectId: 'proj-1', name: 'FedRAMP High', targetFrameworks: ['fedramp-rev5'], createdAt: 1, updatedAt: 1 }],
      controlStatuses: [{ id: 'assess-1:fedramp-rev5:AC-1', assessmentId: 'assess-1', frameworkId: 'fedramp-rev5', controlId: 'AC-1', status: 'implemented', updatedAt: 1 }],
      assessmentCryptoModules: [{ id: 'assess-1:5203', assessmentId: 'assess-1', moduleId: '5203' }],
      providerConfigs: [{ providerId: 'openai', apiKey: 'sk-should-not-export' }],
    });

    const redactedExport = await exportBackupTables(db, { includeApiKey: false });
    expect(redactedExport.settings).toEqual([{ key: 'theme', value: 'dracula' }]);
    expect(redactedExport.projects).toHaveLength(1);
    expect(redactedExport.assessments).toHaveLength(1);
    expect(redactedExport.controlStatuses).toHaveLength(1);
    expect(redactedExport.assessmentCryptoModules).toHaveLength(1);
    expect(redactedExport.providerConfigs).toBeUndefined();

    const withKeyExport = await exportBackupTables(db, { includeApiKey: true });
    expect(withKeyExport.settings).toHaveLength(2);
  });

  it('restores project and assessment tables and ignores non-allowlisted or prototype keys', async () => {
    const { db, tables } = createFakeBackupDb();
    const rawJson = JSON.stringify({
      version: 2,
      exportedAt: '2026-11-27T00:00:00Z',
      data: {
        projects: [{ id: 'proj-1', name: 'Prod' }],
        assessments: [{ id: 'assess-1', projectId: 'proj-1', name: 'Baseline' }],
        controlStatuses: [{ id: 'assess-1:fedramp-rev5:AC-1', status: 'implemented' }],
        assessmentCryptoModules: [{ id: 'assess-1:5203', moduleId: '5203' }],
        providerConfigs: [{ providerId: 'openai', apiKey: 'injected' }],
        constructor: [{ bad: true }],
        toString: [{ bad: true }],
        __proto__: [{ bad: true }],
      },
    });

    const status = await importBackupPayload(db, JSON.parse(rawJson));
    expect(status).toBe('v2');
    expect(tables.projects).toEqual([{ id: 'proj-1', name: 'Prod' }]);
    expect(tables.assessments).toEqual([{ id: 'assess-1', projectId: 'proj-1', name: 'Baseline' }]);
    expect(tables.controlStatuses).toEqual([{ id: 'assess-1:fedramp-rev5:AC-1', status: 'implemented' }]);
    expect(tables.assessmentCryptoModules).toEqual([{ id: 'assess-1:5203', moduleId: '5203' }]);
    expect(tables.providerConfigs).toEqual([]);

    expect(await importBackupPayload(db, { version: 1, data: {} })).toBe('v1');
    expect(await importBackupPayload(db, { version: 99 })).toBe('invalid');
    expect(await importBackupPayload(db, null)).toBe('invalid');
  });
});
