import { useEffect, useState } from 'react';
import { DEFAULT_PROJECT_ID } from '@/lib/db';
import {
  ACTIVE_PROJECT_CHANGED_EVENT,
  PROJECTS_CHANGED_EVENT,
  createProject,
  deleteProject,
  getActiveProjectId,
  getProjectSummaries,
  setActiveProject,
  type ProjectSummary,
} from '@/lib/storage/project-store';
import { useWindowEvents } from '@/hooks/useProjectChange';

export function ProjectsSection() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [activeProjectId, setActiveProjectId] = useState(DEFAULT_PROJECT_ID);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  async function load() {
    const [summaries, currentProjectId] = await Promise.all([
      getProjectSummaries(),
      getActiveProjectId(),
    ]);
    setProjects(summaries);
    setActiveProjectId(currentProjectId);
  }

  useEffect(() => {
    load();
  }, []);

  useWindowEvents([PROJECTS_CHANGED_EVENT, ACTIVE_PROJECT_CHANGED_EVENT], load);

  async function handleCreate() {
    if (!projectName.trim()) return;
    setIsCreating(true);
    try {
      const project = await createProject(projectName.trim(), projectDescription.trim() || undefined);
      await setActiveProject(project.id);
      setProjectName('');
      setProjectDescription('');
      await load();
    } finally {
      setIsCreating(false);
    }
  }

  async function handleActivate(projectId: string) {
    await setActiveProject(projectId);
    setActiveProjectId(projectId);
  }

  async function handleDelete(projectId: string, projectNameToDelete: string) {
    if (!confirm(`Delete project "${projectNameToDelete}" and all of its notes and assessments?`)) return;
    await deleteProject(projectId);
    await load();
  }

  return (
    <section id="projects" className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span className="text-primary">{'>'}</span> Projects
      </h2>
      <p className="text-sm text-muted-foreground">
        Organize control notes and gap assessments into reusable buckets for different systems, clients, or frameworks.
      </p>

      <div className="grid gap-3">
        {projects.map(project => {
          const isActive = project.id === activeProjectId;
          const isDefault = project.id === DEFAULT_PROJECT_ID;
          return (
            <div
              key={project.id}
              className={`p-4 rounded-lg border transition-colors ${
                isActive ? 'border-primary bg-primary/5' : 'border-border bg-card'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{project.name}</h3>
                    {isActive && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
                        Active
                      </span>
                    )}
                    {isDefault && (
                      <span className="px-2 py-0.5 text-xs rounded-full border border-border text-muted-foreground">
                        Default
                      </span>
                    )}
                  </div>
                  {project.description && (
                    <p className="text-sm text-muted-foreground">{project.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {project.assessmentCount} assessment{project.assessmentCount !== 1 ? 's' : ''} and {project.noteCount} note{project.noteCount !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => handleActivate(project.id)}
                      className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      Make Active
                    </button>
                  )}
                  {!isDefault && (
                    <button
                      type="button"
                      onClick={() => handleDelete(project.id, project.name)}
                      className="px-3 py-1.5 text-xs rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 rounded-lg border border-border bg-card space-y-3">
        <div>
          <h3 className="font-medium">Create Project</h3>
          <p className="text-xs text-muted-foreground mt-1">
            New notes and assessments will save into whichever project is active.
          </p>
        </div>
        <input
          type="text"
          value={projectName}
          onChange={event => setProjectName(event.target.value)}
          placeholder="Project name"
          className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <textarea
          value={projectDescription}
          onChange={event => setProjectDescription(event.target.value)}
          placeholder="Optional description"
          rows={3}
          className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={!projectName.trim() || isCreating}
          className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isCreating ? 'Creating...' : 'Create Project'}
        </button>
      </div>
    </section>
  );
}
