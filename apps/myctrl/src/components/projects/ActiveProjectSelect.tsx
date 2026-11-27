import { useEffect, useState } from 'react';
import type { Project } from '@/lib/db';
import {
  ACTIVE_PROJECT_CHANGED_EVENT,
  PROJECTS_CHANGED_EVENT,
  getActiveProjectId,
  getProjects,
  setActiveProject,
} from '@/lib/storage/project-store';
import { useWindowEvents } from '@/hooks/useProjectChange';

interface ActiveProjectSelectProps {
  label?: string;
  beforeChange?: (projectId: string) => boolean | Promise<boolean>;
  onChange?: (projectId: string) => void | Promise<void>;
  showManageLink?: boolean;
  manageHref?: string;
  className?: string;
}

export function ActiveProjectSelect({
  label = 'Project',
  beforeChange,
  onChange,
  showManageLink = false,
  manageHref = '/preferences#projects',
  className = '',
}: ActiveProjectSelectProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState('');

  async function load() {
    const [allProjects, currentProjectId] = await Promise.all([
      getProjects(),
      getActiveProjectId(),
    ]);
    setProjects(allProjects);
    setActiveProjectId(currentProjectId);
  }

  useEffect(() => {
    load();
  }, []);

  useWindowEvents([PROJECTS_CHANGED_EVENT, ACTIVE_PROJECT_CHANGED_EVENT], load);

  async function handleChange(nextProjectId: string) {
    if (nextProjectId === activeProjectId) return;
    const shouldContinue = await beforeChange?.(nextProjectId);
    if (shouldContinue === false) return;
    setActiveProjectId(nextProjectId);
    await setActiveProject(nextProjectId);
    await onChange?.(nextProjectId);
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <label className="text-sm text-muted-foreground">{label}</label>
      <select
        value={activeProjectId}
        onChange={(event) => handleChange(event.target.value)}
        className="px-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        {projects.map(project => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      {showManageLink && (
        <a href={manageHref} className="text-xs text-primary hover:underline">
          Manage projects
        </a>
      )}
    </div>
  );
}
