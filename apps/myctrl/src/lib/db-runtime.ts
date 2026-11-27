import Dexie, { type Table } from 'dexie/dist/dexie.mjs';
import {
  DEFAULT_ASSESSMENT_ID,
  DEFAULT_PROJECT_ID,
  DEFAULT_PROJECT_NAME,
  type AgentConversation,
  type Assessment,
  type AssessmentCryptoModule,
  type ControlNote,
  type ControlStatus,
  type FavoriteFramework,
  type FilterPreset,
  type Project,
  type ProviderConfigRecord,
  type RecentlyViewed,
  type SavedView,
  type Setting,
  type WhiteboardMeta,
  type WhiteboardSnapshot,
} from './storage-types';

export class MyCtrlDB extends Dexie {
  favorites!: Table<FavoriteFramework & { userId?: string | null }, string>;
  controlNotes!: Table<ControlNote & { id: string; userId?: string | null }, string>;
  recentlyViewed!: Table<RecentlyViewed & { userId?: string | null }, string>;
  savedViews!: Table<SavedView & { userId?: string | null }, string>;
  filterPresets!: Table<FilterPreset & { userId?: string | null }, string>;
  settings!: Table<Setting, string>;
  providerConfigs!: Table<ProviderConfigRecord, string>;
  whiteboards!: Table<WhiteboardMeta, string>;
  whiteboardSnapshots!: Table<WhiteboardSnapshot, string>;
  projects!: Table<Project & { userId?: string | null }, string>;
  assessments!: Table<Assessment & { userId?: string | null }, string>;
  controlStatuses!: Table<ControlStatus & { userId?: string | null }, string>;
  assessmentCryptoModules!: Table<AssessmentCryptoModule & { userId?: string | null }, string>;
  agentConversations!: Table<AgentConversation, string>;

  constructor() {
    super('myctrl');

    this.version(1).stores({
      favorites: 'frameworkId',
      controlNotes: 'id, frameworkId',
      recentlyViewed: 'href, viewedAt',
      savedViews: 'id, createdAt',
      filterPresets: 'id',
      settings: 'key',
      whiteboards: 'id, updatedAt',
      whiteboardSnapshots: 'boardId',
    });

    this.version(2).stores({
      favorites: 'frameworkId, userId',
      controlNotes: 'id, frameworkId, userId',
      recentlyViewed: 'href, viewedAt, userId',
      savedViews: 'id, createdAt, userId',
      filterPresets: 'id, userId',
      settings: 'key',
      whiteboards: 'id, updatedAt, userId',
      whiteboardSnapshots: 'boardId',
    });

    this.version(3).stores({
      favorites: 'frameworkId, userId',
      controlNotes: 'id, frameworkId, userId',
      recentlyViewed: 'href, viewedAt, userId',
      savedViews: 'id, createdAt, userId',
      filterPresets: 'id, userId',
      settings: 'key',
      providerConfigs: 'providerId',
      whiteboards: 'id, updatedAt, userId',
      whiteboardSnapshots: 'boardId',
    });

    this.version(4).stores({
      favorites: 'frameworkId, userId',
      controlNotes: 'id, frameworkId, userId',
      recentlyViewed: 'href, viewedAt, userId',
      savedViews: 'id, createdAt, userId',
      filterPresets: 'id, userId',
      settings: 'key',
      providerConfigs: 'providerId',
      whiteboards: 'id, updatedAt, userId',
      whiteboardSnapshots: 'boardId',
      controlStatuses: 'id, frameworkId, status',
    });

    this.version(5).stores({
      favorites: 'frameworkId, userId',
      controlNotes: 'id, frameworkId, userId',
      recentlyViewed: 'href, viewedAt, userId',
      savedViews: 'id, createdAt, userId',
      filterPresets: 'id, userId',
      settings: 'key',
      providerConfigs: 'providerId',
      whiteboards: 'id, updatedAt, userId',
      whiteboardSnapshots: 'boardId',
      assessments: 'id, userId, updatedAt',
      controlStatuses: 'id, assessmentId, frameworkId, status, userId',
    }).upgrade(tx => {
      return tx.table('controlStatuses').toCollection().modify(record => {
        if (!record.assessmentId) {
          record.assessmentId = DEFAULT_ASSESSMENT_ID;
          record.id = `${DEFAULT_ASSESSMENT_ID}:${record.frameworkId}:${record.controlId}`;
        }
      });
    });

    this.version(6).stores({
      favorites: 'frameworkId, userId',
      controlNotes: 'id, frameworkId, userId',
      recentlyViewed: 'href, viewedAt, userId',
      savedViews: 'id, createdAt, userId',
      filterPresets: 'id, userId',
      settings: 'key',
      providerConfigs: 'providerId',
      whiteboards: 'id, updatedAt, userId',
      whiteboardSnapshots: 'boardId',
      assessments: 'id, userId, updatedAt',
      controlStatuses: 'id, assessmentId, frameworkId, status, userId',
      agentConversations: 'id, [assessmentId+controlId], controlId, frameworkId, updatedAt, userId',
    });

    this.version(7).stores({
      favorites: 'frameworkId, userId',
      controlNotes: 'id, frameworkId, userId',
      recentlyViewed: 'href, viewedAt, userId',
      savedViews: 'id, createdAt, userId',
      filterPresets: 'id, userId',
      settings: 'key',
      providerConfigs: 'providerId',
      whiteboards: 'id, updatedAt, userId',
      whiteboardSnapshots: 'boardId',
      assessments: 'id, userId, updatedAt',
      controlStatuses: 'id, assessmentId, frameworkId, status, userId',
      assessmentCryptoModules: 'id, assessmentId, moduleId, certificateNumber, dataset, userId',
      agentConversations: 'id, [assessmentId+controlId], controlId, frameworkId, updatedAt, userId',
    });

    this.version(8).stores({
      favorites: 'frameworkId, userId',
      controlNotes: 'id, frameworkId, userId',
      recentlyViewed: 'href, viewedAt, userId',
      savedViews: 'id, createdAt, userId',
      filterPresets: 'id, userId',
      settings: 'key',
      providerConfigs: 'providerId',
      whiteboards: 'id, updatedAt, userId',
      whiteboardSnapshots: 'boardId',
      assessments: 'id, userId, updatedAt',
      controlStatuses: 'id, assessmentId, frameworkId, status, userId',
      assessmentCryptoModules: 'id, assessmentId, moduleId, certificateNumber, dataset, userId',
      agentConversations: 'id, [assessmentId+controlId], controlId, frameworkId, updatedAt, userId',
    });

    this.version(9).stores({
      favorites: 'frameworkId, userId',
      controlNotes: 'id, frameworkId, projectId, [projectId+frameworkId], userId',
      recentlyViewed: 'href, viewedAt, userId',
      savedViews: 'id, createdAt, userId',
      filterPresets: 'id, userId',
      settings: 'key',
      providerConfigs: 'providerId',
      whiteboards: 'id, updatedAt, userId',
      whiteboardSnapshots: 'boardId',
      projects: 'id, updatedAt, userId',
      assessments: 'id, projectId, userId, updatedAt',
      controlStatuses: 'id, assessmentId, frameworkId, status, userId',
      assessmentCryptoModules: 'id, assessmentId, moduleId, certificateNumber, dataset, userId',
      agentConversations: 'id, [assessmentId+controlId], controlId, frameworkId, updatedAt, userId',
    }).upgrade(async tx => {
      const now = Date.now();
      const settingsTable = tx.table('settings');
      const projectsTable = tx.table('projects');

      await projectsTable.put({
        id: DEFAULT_PROJECT_ID,
        name: DEFAULT_PROJECT_NAME,
        description: 'Default project for existing notes and assessments.',
        createdAt: now,
        updatedAt: now,
      });

      const activeProject = await settingsTable.get('active-project-id');
      if (!activeProject) {
        await settingsTable.put({ key: 'active-project-id', value: DEFAULT_PROJECT_ID });
      }

      await tx.table('controlNotes').toCollection().modify(record => {
        if (!record.projectId) {
          record.projectId = DEFAULT_PROJECT_ID;
        }
      });

      await tx.table('assessments').toCollection().modify(record => {
        if (!record.projectId) {
          record.projectId = DEFAULT_PROJECT_ID;
        }
      });
    });

    this.version(10).stores({
      favorites: 'frameworkId, userId',
      controlNotes: 'id, frameworkId, projectId, [projectId+frameworkId], userId',
      recentlyViewed: 'href, viewedAt, userId',
      savedViews: 'id, createdAt, projectId, userId',
      filterPresets: 'id, userId',
      settings: 'key',
      providerConfigs: 'providerId',
      whiteboards: 'id, updatedAt, projectId, userId',
      whiteboardSnapshots: 'boardId',
      projects: 'id, updatedAt, userId',
      assessments: 'id, projectId, userId, updatedAt',
      controlStatuses: 'id, assessmentId, frameworkId, status, userId',
      assessmentCryptoModules: 'id, assessmentId, moduleId, certificateNumber, dataset, userId',
      agentConversations: 'id, [assessmentId+controlId], controlId, frameworkId, updatedAt, userId',
    }).upgrade(async tx => {
      await tx.table('savedViews').toCollection().modify(record => {
        if (!record.projectId) {
          record.projectId = DEFAULT_PROJECT_ID;
        }
      });

      await tx.table('whiteboards').toCollection().modify(record => {
        if (!record.projectId) {
          record.projectId = DEFAULT_PROJECT_ID;
        }
      });
    });
  }
}

export const db = new MyCtrlDB();
