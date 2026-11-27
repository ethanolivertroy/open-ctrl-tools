import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CmvpCertificateDetail } from '@/lib/cmvp';
import type {
  Assessment,
  AssessmentCryptoModule,
  ControlStatus,
  Project,
} from '@/lib/db';

type TableMap<T extends { id: string }> = Map<string, T>;

function createFakeDb() {
  const projects: TableMap<Project> = new Map();
  const assessments: TableMap<Assessment> = new Map();
  const controlStatuses: TableMap<ControlStatus> = new Map();
  const assessmentCryptoModules: TableMap<AssessmentCryptoModule> = new Map();

  const makeTable = <T extends { id: string }>(
    store: TableMap<T>,
    indexGetter?: (item: T, field: string) => string | undefined,
  ) => ({
    get: vi.fn(async (id: string) => {
      const item = store.get(id);
      return item ? structuredClone(item) : undefined;
    }),
    put: vi.fn(async (item: T) => {
      store.set(item.id, structuredClone(item));
      return item.id;
    }),
    bulkPut: vi.fn(async (items: T[]) => {
      for (const item of items) {
        store.set(item.id, structuredClone(item));
      }
    }),
    update: vi.fn(async (id: string, changes: Partial<T>) => {
      const current = store.get(id);
      if (!current) return 0;
      const updated = { ...current, ...changes };
      if ('id' in changes && changes.id && changes.id !== id) {
        store.delete(id);
      }
      store.set(updated.id, structuredClone(updated));
      return 1;
    }),
    where: (field: string) => ({
      equals: (value: string) => ({
        toArray: async () =>
          Array.from(store.values())
            .filter((item) => (indexGetter ? indexGetter(item, field) : (item as Record<string, unknown>)[field]) === value)
            .map((item) => structuredClone(item)),
      }),
    }),
  });

  return {
    stores: { projects, assessments, controlStatuses, assessmentCryptoModules },
    projects: makeTable(projects),
    assessments: makeTable(assessments),
    controlStatuses: makeTable(controlStatuses),
    assessmentCryptoModules: makeTable(assessmentCryptoModules),
    transaction: vi.fn(async (_mode: string, _table: unknown, fn: () => Promise<void>) => fn()),
  };
}

let fakeDb: ReturnType<typeof createFakeDb>;

vi.mock('@/lib/db', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db')>('@/lib/db');
  return {
    ...actual,
    getDb: vi.fn(async () => fakeDb),
  };
});

import {
  duplicateAssessment,
  refreshAssessmentCryptoModuleSnapshot,
  setControlNotes,
  setControlOwner,
  setControlOwnerAndNotes,
} from '@/lib/storage/assessment-store';
import { updateControlOwnerAndNotes } from '@/lib/services/assessment-actions';

describe('assessment-store Codex P2 fixes', () => {
  beforeEach(() => {
    fakeDb = createFakeDb();
    vi.stubGlobal('window', {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('preserves targetBaseline, system/assessor metadata, crosswalkSources, and child records when duplicating', async () => {
    fakeDb.stores.projects.set('proj-1', {
      id: 'proj-1',
      name: 'FedRAMP System',
      createdAt: 100,
      updatedAt: 100,
    });
    fakeDb.stores.assessments.set('assess-1', {
      id: 'assess-1',
      projectId: 'proj-1',
      name: 'Original High',
      description: 'Annual assessment',
      targetFrameworks: ['fedramp-rev5', 'dod-srg'],
      targetBaseline: 'high',
      systemName: 'Alpha Platform',
      assessorName: 'Alex Assessor',
      assessorOrg: 'Audit Co',
      crosswalkSources: [{ frameworkId: 'nist-csf-v2', complianceLevel: 'full' }],
      createdAt: 100,
      updatedAt: 200,
    });
    fakeDb.stores.controlStatuses.set('assess-1:fedramp-rev5:AC-2', {
      id: 'assess-1:fedramp-rev5:AC-2',
      assessmentId: 'assess-1',
      frameworkId: 'fedramp-rev5',
      controlId: 'AC-2',
      status: 'implemented',
      owner: 'Platform',
      notes: 'SSO enforced',
      updatedAt: 200,
    });
    fakeDb.stores.assessmentCryptoModules.set('assess-1:5203', {
      id: 'assess-1:5203',
      moduleId: '5203',
      assessmentId: 'assess-1',
      dataset: 'active',
      certificateNumber: '5203',
      vendorName: 'OVH SAS',
      moduleName: 'OpenSSL Provider',
      standard: 'FIPS 140-3',
      status: 'Active',
      moduleType: 'Software',
      overallLevel: 1,
      validationDate: '3/21/2026',
      sunsetDate: '3/10/2030',
      algorithms: ['AES'],
      securityPolicyUrl: null,
      certificateDetailUrl: null,
      caveat: null,
      description: null,
      embodiment: null,
      componentName: 'Edge TLS',
      usageTypes: ['in-transit'],
      addedAt: 200,
      updatedAt: 200,
    });

    const copy = await duplicateAssessment('assess-1', 'Original High (copy)');

    expect(copy.id).not.toBe('assess-1');
    expect(copy.name).toBe('Original High (copy)');
    expect(copy.projectId).toBe('proj-1');
    expect(copy.description).toBe('Annual assessment');
    expect(copy.targetFrameworks).toEqual(['fedramp-rev5', 'dod-srg']);
    expect(copy.targetBaseline).toBe('high');
    expect(copy.systemName).toBe('Alpha Platform');
    expect(copy.assessorName).toBe('Alex Assessor');
    expect(copy.assessorOrg).toBe('Audit Co');
    expect(copy.crosswalkSources).toEqual([{ frameworkId: 'nist-csf-v2', complianceLevel: 'full' }]);
    expect(copy.crosswalkSources).not.toBe(fakeDb.stores.assessments.get('assess-1')?.crosswalkSources);

    const storedCopy = fakeDb.stores.assessments.get(copy.id);
    expect(storedCopy?.targetBaseline).toBe('high');
    expect(storedCopy?.systemName).toBe('Alpha Platform');

    const clonedStatus = fakeDb.stores.controlStatuses.get(`${copy.id}:fedramp-rev5:AC-2`);
    expect(clonedStatus?.status).toBe('implemented');
    expect(clonedStatus?.owner).toBe('Platform');

    const clonedModule = fakeDb.stores.assessmentCryptoModules.get(`${copy.id}:5203`);
    expect(clonedModule?.componentName).toBe('Edge TLS');
    expect(clonedModule?.assessmentId).toBe(copy.id);
  });

  it('preserves composite primary key when refreshing a CMVP module snapshot', async () => {
    fakeDb.stores.assessmentCryptoModules.set('assess-1:5203', {
      id: 'assess-1:5203',
      moduleId: '5203',
      assessmentId: 'assess-1',
      dataset: 'active',
      certificateNumber: '5203',
      vendorName: 'Old Vendor',
      moduleName: 'Old Module',
      standard: 'FIPS 140-3',
      status: 'Active',
      moduleType: 'Software',
      overallLevel: 1,
      validationDate: null,
      sunsetDate: null,
      algorithms: ['AES'],
      securityPolicyUrl: null,
      certificateDetailUrl: null,
      caveat: null,
      description: null,
      embodiment: null,
      componentName: 'Gateway',
      usageTypes: ['in-transit'],
      addedAt: 100,
      updatedAt: 100,
      stale: true,
    });

    const detail: CmvpCertificateDetail = {
      certificateNumber: '5203',
      dataset: 'active',
      generatedAt: '2026-08-30T00:00:00Z',
      nistPageUrl: 'https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/5203',
      certificateDetailUrl: 'https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/5203',
      securityPolicyUrl: null,
      vendorName: 'Updated Vendor',
      moduleName: 'Updated Module',
      standard: 'FIPS 140-3',
      status: 'Active',
      moduleType: 'Software',
      embodiment: null,
      overallLevel: 3,
      validationDate: '08/30/2026',
      validationDates: ['08/30/2026'],
      sunsetDate: '08/30/2031',
      caveat: null,
      description: 'Updated description',
      securityLevelExceptions: [],
      relatedFiles: [],
      validationHistory: [],
      vendor: {
        name: 'Updated Vendor',
        websiteUrl: null,
        addressLines: [],
        country: null,
        contactName: null,
        contactEmail: null,
        contactPhone: null,
      },
      algorithms: ['AES', 'SHA-256'],
    };

    await refreshAssessmentCryptoModuleSnapshot('assess-1', '5203', detail);

    expect(fakeDb.assessmentCryptoModules.update).toHaveBeenCalledTimes(1);
    const [key, changes] = fakeDb.assessmentCryptoModules.update.mock.calls[0]!;
    expect(key).toBe('assess-1:5203');
    expect('id' in (changes as Record<string, unknown>)).toBe(false);

    const record = fakeDb.stores.assessmentCryptoModules.get('assess-1:5203');
    expect(record?.id).toBe('assess-1:5203');
    expect(record?.vendorName).toBe('Updated Vendor');
    expect(record?.overallLevel).toBe(3);
    expect(record?.stale).toBe(false);
    expect(record?.sourceGeneratedAt).toBe('2026-08-30T00:00:00Z');
  });

  it('updates owner and notes atomically in one transaction without losing existing control metadata', async () => {
    fakeDb.stores.controlStatuses.set('assess-1:fedramp-rev5:AC-3', {
      id: 'assess-1:fedramp-rev5:AC-3',
      assessmentId: 'assess-1',
      frameworkId: 'fedramp-rev5',
      controlId: 'AC-3',
      status: 'partially-implemented',
      owner: 'Old Owner',
      notes: 'Old notes',
      updatedAt: 100,
      autoSuggested: true,
      autoSuggestSource: 'nist-csf-v2',
      confidence: 'high',
      linkedCmvpModuleIds: ['5203'],
    });

    await updateControlOwnerAndNotes(
      { frameworkId: 'fedramp-rev5', assessmentId: 'assess-1' },
      'AC-3',
      '  Security  ',
      '  RBAC policy enforced in IAM  ',
    );

    expect(fakeDb.transaction).toHaveBeenCalledTimes(1);
    expect(fakeDb.controlStatuses.put).toHaveBeenCalledTimes(1);

    const saved = fakeDb.stores.controlStatuses.get('assess-1:fedramp-rev5:AC-3');
    expect(saved).toMatchObject({
      status: 'partially-implemented',
      owner: 'Security',
      notes: 'RBAC policy enforced in IAM',
      autoSuggested: true,
      autoSuggestSource: 'nist-csf-v2',
      confidence: 'high',
      linkedCmvpModuleIds: ['5203'],
    });

    await setControlOwner('fedramp-rev5', 'AC-3', '', 'assess-1');
    expect(fakeDb.stores.controlStatuses.get('assess-1:fedramp-rev5:AC-3')).toMatchObject({
      owner: undefined,
      notes: 'RBAC policy enforced in IAM',
    });

    await setControlOwnerAndNotes('fedramp-rev5', 'AC-3', 'DevOps', undefined, 'assess-1');
    expect(fakeDb.stores.controlStatuses.get('assess-1:fedramp-rev5:AC-3')).toMatchObject({
      owner: 'DevOps',
      notes: undefined,
    });

    await setControlNotes('fedramp-rev5', 'AC-3', 'Updated notes', 'assess-1');
    expect(fakeDb.stores.controlStatuses.get('assess-1:fedramp-rev5:AC-3')).toMatchObject({
      owner: 'DevOps',
      notes: 'Updated notes',
    });
  });
});
