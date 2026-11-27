/**
 * SavedViewsList Component
 *
 * Displays the user's saved AI views with options to load or delete them.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ACTIVE_PROJECT_CHANGED_EVENT,
  getActiveProject,
} from '@/lib/storage/project-store';
import { useWindowEvents } from '@/hooks/useProjectChange';
import { deleteSavedView, getSavedViews, SAVED_VIEWS_CHANGED_EVENT } from '@/lib/storage/saved-view-store';
import type { Project, SavedView } from '@/lib/storage-types';
import { ActiveProjectSelect } from '@/components/projects/ActiveProjectSelect';
import { Bookmark, Trash2, Clock, ExternalLink } from 'lucide-react';

interface SavedViewsListProps {
  onLoadView?: (view: SavedView) => void;
}

export function SavedViewsList({ onLoadView }: SavedViewsListProps) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [isClient, setIsClient] = useState(false);

  const load = useCallback(async () => {
    const [savedViews, project] = await Promise.all([
      getSavedViews(),
      getActiveProject(),
    ]);
    setViews(savedViews);
    setActiveProject(project);
  }, []);

  useEffect(() => {
    setIsClient(true);
    load();

  }, [load]);

  useWindowEvents([ACTIVE_PROJECT_CHANGED_EVENT, SAVED_VIEWS_CHANGED_EVENT], load);

  const handleDelete = useCallback((id: string) => {
    if (confirm('Delete this saved view?')) {
      deleteSavedView(id).then(() => {
        load();
      });
    }
  }, [load]);

  const handleLoad = useCallback((view: SavedView) => {
    if (onLoadView) {
      onLoadView(view);
      return;
    }
    window.location.href = `/build?savedView=${encodeURIComponent(view.id)}`;
  }, [onLoadView]);

  // Don't render on server
  if (!isClient) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bookmark className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Saved Views</h2>
          <span className="text-sm text-muted-foreground">({views.length})</span>
        </div>
        <ActiveProjectSelect onChange={() => load()} showManageLink />
      </div>
      {activeProject && (
        <p className="text-sm text-muted-foreground">
          Viewing saved views for <span className="font-medium text-foreground">{activeProject.name}</span>
        </p>
      )}

      {views.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">No saved views in this project yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {views.map((view) => (
            <Card
              key={view.id}
              className="bg-card border-border hover:border-primary/30 transition-colors group"
            >
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {view.name}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(view.id);
                      }}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-all text-muted-foreground hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {view.prompt}
                  </p>

                  <div className="flex flex-wrap gap-1">
                    {view.source && (
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                        {view.source}
                      </Badge>
                    )}
                    {view.controlId && (
                      <Badge variant="secondary" className="text-[10px] font-mono">
                        {view.controlId}
                      </Badge>
                    )}
                    {!view.controlId && view.assessmentId && (
                      <Badge variant="secondary" className="text-[10px]">
                        Assessment view
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(view.createdAt)}
                    </span>
                    <button
                      onClick={() => handleLoad(view)}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      Load
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) {
      const minutes = Math.floor(diff / 60000);
      return minutes < 1 ? 'Just now' : `${minutes}m ago`;
    }
    return `${hours}h ago`;
  }

  // Less than 7 days
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  }

  // Format as date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export default SavedViewsList;
