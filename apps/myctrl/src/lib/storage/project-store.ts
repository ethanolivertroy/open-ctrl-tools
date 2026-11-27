import { DEFAULT_PROJECT_ID, DEFAULT_PROJECT_NAME, getDb, type Project } from '../db';
import type { MyCtrlDB } from '../db-runtime';

const ACTIVE_PROJECT_KEY = 'active-project-id';
export const PROJECTS_CHANGED_EVENT = 'myctrl:projects-changed';
export const ACTIVE_PROJECT_CHANGED_EVENT = 'myctrl:active-project-changed';

export interface ProjectSummary extends Project {
  noteCount: number;
  assessmentCount: number;
  savedViewCount: number;
  whiteboardCount: number;
}

async function openDb(): Promise<MyCtrlDB> {
  return getDb();
}

function dispatchProjectEvent(name: string, detail?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

async function ensureDefaultProject(db?: MyCtrlDB): Promise<MyCtrlDB> {
  const resolvedDb = db ?? await openDb();
  const existing = await resolvedDb.projects.get(DEFAULT_PROJECT_ID);
  if (!existing) {
    const now = Date.now();
    await resolvedDb.projects.put({
      id: DEFAULT_PROJECT_ID,
      name: DEFAULT_PROJECT_NAME,
      description: 'Default project for general notes and assessments.',
      createdAt: now,
      updatedAt: now,
    });
  }

  const activeSetting = await resolvedDb.settings.get(ACTIVE_PROJECT_KEY);
  if (!activeSetting?.value) {
    await resolvedDb.settings.put({ key: ACTIVE_PROJECT_KEY, value: DEFAULT_PROJECT_ID });
  }

  return resolvedDb;
}

export async function getProjects(): Promise<Project[]> {
  if (typeof window === 'undefined') return [];
  try {
    const db = await ensureDefaultProject();
    const projects = await db.projects.orderBy('updatedAt').reverse().toArray();
    const defaultProject = projects.find(project => project.id === DEFAULT_PROJECT_ID);
    const otherProjects = projects.filter(project => project.id !== DEFAULT_PROJECT_ID);
    return defaultProject ? [defaultProject, ...otherProjects] : projects;
  } catch {
    return [];
  }
}

export async function getProject(projectId: string): Promise<Project | null> {
  if (typeof window === 'undefined') return null;
  try {
    const db = await ensureDefaultProject();
    return (await db.projects.get(projectId)) || null;
  } catch {
    return null;
  }
}

export async function createProject(name: string, description?: string): Promise<Project> {
  if (typeof window === 'undefined') throw new Error('Not in browser');
  const db = await ensureDefaultProject();
  const project: Project = {
    id: crypto.randomUUID(),
    name,
    description,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await db.projects.put(project);
  dispatchProjectEvent(PROJECTS_CHANGED_EVENT, { projectId: project.id, action: 'created' });
  return project;
}

export async function updateProject(projectId: string, updates: Partial<Pick<Project, 'name' | 'description'>>): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await ensureDefaultProject();
  await db.projects.update(projectId, {
    ...updates,
    updatedAt: Date.now(),
  });
  dispatchProjectEvent(PROJECTS_CHANGED_EVENT, { projectId, action: 'updated' });
}

export async function getActiveProjectId(): Promise<string> {
  if (typeof window === 'undefined') return DEFAULT_PROJECT_ID;
  try {
    const db = await ensureDefaultProject();
    const setting = await db.settings.get(ACTIVE_PROJECT_KEY);
    return setting?.value || DEFAULT_PROJECT_ID;
  } catch {
    return DEFAULT_PROJECT_ID;
  }
}

export async function getActiveProject(): Promise<Project | null> {
  const projectId = await getActiveProjectId();
  return getProject(projectId);
}

export async function setActiveProject(projectId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await ensureDefaultProject();
  const project = await db.projects.get(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  await db.settings.put({ key: ACTIVE_PROJECT_KEY, value: projectId });
  dispatchProjectEvent(ACTIVE_PROJECT_CHANGED_EVENT, { projectId });
}

export async function getProjectSummaries(): Promise<ProjectSummary[]> {
  if (typeof window === 'undefined') return [];
  const db = await ensureDefaultProject();
  const projects = await getProjects();
  const summaries = await Promise.all(projects.map(async project => ({
    ...project,
    noteCount: await db.controlNotes.where('projectId').equals(project.id).count(),
    assessmentCount: await db.assessments.where('projectId').equals(project.id).count(),
    savedViewCount: await db.savedViews.where('projectId').equals(project.id).count(),
    whiteboardCount: await db.whiteboards.where('projectId').equals(project.id).count(),
  })));
  return summaries;
}

export async function deleteProject(projectId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  if (projectId === DEFAULT_PROJECT_ID) {
    throw new Error('The default project cannot be deleted.');
  }

  const db = await ensureDefaultProject();
  await db.transaction(
    'rw',
    [
      db.projects,
      db.settings,
      db.controlNotes,
      db.savedViews,
      db.whiteboards,
      db.whiteboardSnapshots,
      db.assessments,
      db.controlStatuses,
      db.assessmentCryptoModules,
      db.agentConversations,
    ],
    async () => {
      const assessments = await db.assessments.where('projectId').equals(projectId).toArray();
      const assessmentIds = assessments.map(assessment => assessment.id);
      const whiteboards = await db.whiteboards.where('projectId').equals(projectId).toArray();
      const whiteboardIds = whiteboards.map(board => board.id);

      await db.controlNotes.where('projectId').equals(projectId).delete();
      await db.savedViews.where('projectId').equals(projectId).delete();

      for (const assessmentId of assessmentIds) {
        await db.controlStatuses.where('assessmentId').equals(assessmentId).delete();
        await db.assessmentCryptoModules.where('assessmentId').equals(assessmentId).delete();
      }

      if (whiteboardIds.length > 0) {
        await db.whiteboardSnapshots.bulkDelete(whiteboardIds);
      }
      await db.whiteboards.where('projectId').equals(projectId).delete();

      const conversations = await db.agentConversations.toArray();
      const conversationIds = conversations
        .filter(conversation => assessmentIds.includes(conversation.assessmentId))
        .map(conversation => conversation.id);
      if (conversationIds.length > 0) {
        await db.agentConversations.bulkDelete(conversationIds);
      }

      await db.assessments.where('projectId').equals(projectId).delete();
      await db.projects.delete(projectId);

      const activeProjectId = (await db.settings.get(ACTIVE_PROJECT_KEY))?.value;
      if (!activeProjectId || activeProjectId === projectId) {
        await db.settings.put({ key: ACTIVE_PROJECT_KEY, value: DEFAULT_PROJECT_ID });
      }
    },
  );

  dispatchProjectEvent(PROJECTS_CHANGED_EVENT, { projectId, action: 'deleted' });
  dispatchProjectEvent(ACTIVE_PROJECT_CHANGED_EVENT, { projectId: DEFAULT_PROJECT_ID });
}
