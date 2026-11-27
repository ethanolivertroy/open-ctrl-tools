import { useState, useEffect } from 'react';
import type { Project, SavedView } from '@/lib/db';
import { ACTIVE_PROJECT_CHANGED_EVENT, getActiveProject } from '@/lib/storage/project-store';
import { useWindowEvents } from '@/hooks/useProjectChange';
import {
  SAVED_VIEWS_CHANGED_EVENT,
  deleteSavedView,
  getSavedViews,
} from '@/lib/storage/saved-view-store';
import { ActiveProjectSelect } from '@/components/projects/ActiveProjectSelect';

export function SavedViewsSection() {
  const [views, setViews] = useState<SavedView[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  async function load() {
    const [savedViews, project] = await Promise.all([
      getSavedViews(),
      getActiveProject(),
    ]);
    setViews(savedViews);
    setActiveProject(project);
  }

  useEffect(() => {
    load();
  }, []);

  useWindowEvents([ACTIVE_PROJECT_CHANGED_EVENT, SAVED_VIEWS_CHANGED_EVENT], load);

  const handleDelete = async (id: string) => {
    await deleteSavedView(id);
    await load();
  };

  return (
    <section id="saved-views" className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span className="text-primary">{'>'}</span> Saved Views
      </h2>
      <p className="text-sm text-muted-foreground">
        AI-generated views you've saved.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ActiveProjectSelect onChange={() => load()} showManageLink />
        {activeProject && (
          <p className="text-xs text-muted-foreground">
            Viewing saved views for <span className="font-medium text-foreground">{activeProject.name}</span>
          </p>
        )}
      </div>

      {views.length === 0 ? (
        <div className="text-center py-12 rounded-lg border border-border bg-card">
          <p className="text-muted-foreground text-sm">No saved views in this project.</p>
          <p className="text-muted-foreground text-xs mt-1">Save views from the AI assistant on any control page.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {views.map(view => (
            <div key={view.id} className="p-4 rounded-lg border border-border bg-card flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{view.name}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{view.prompt}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(view.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(view.id)}
                className="shrink-0 p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Delete view"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
