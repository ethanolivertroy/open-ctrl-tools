import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { Assessment, SavedView } from '@/lib/db';
import {
  deleteSavedView,
  getSavedViewsForAssessment,
  SAVED_VIEWS_CHANGED_EVENT,
} from '@/lib/storage/saved-view-store';
import { Bookmark, ExternalLink, Trash2 } from 'lucide-react';

interface AssessmentSavedViewsProps {
  assessment: Assessment;
  onOpenView: (view: SavedView) => void;
}

export function AssessmentSavedViews({
  assessment,
  onOpenView,
}: AssessmentSavedViewsProps) {
  const [views, setViews] = useState<SavedView[]>([]);

  const load = useCallback(async () => {
    const savedViews = await getSavedViewsForAssessment(assessment.id);
    setViews(savedViews);
  }, [assessment.id]);

  useEffect(() => {
    void load();

    const reload = () => {
      void load();
    };

    window.addEventListener(SAVED_VIEWS_CHANGED_EVENT, reload as EventListener);
    return () => {
      window.removeEventListener(SAVED_VIEWS_CHANGED_EVENT, reload as EventListener);
    };
  }, [load]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteSavedView(id);
    await load();
  }, [load]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-primary" />
              Saved AI Views
              <span className="text-xs text-muted-foreground font-normal">({views.length})</span>
            </CardTitle>
            <CardDescription>
              Resume saved workbenches for this assessment without rebuilding them from scratch.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {views.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            No saved AI views for this assessment yet.
          </div>
        ) : (
          <div className="space-y-3">
            {views.map(view => (
              <div
                key={view.id}
                className="rounded-lg border border-border bg-card/50 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{view.name}</p>
                      {view.controlId && (
                        <Badge variant="secondary" className="text-[10px] font-mono">
                          {view.controlId}
                        </Badge>
                      )}
                      {view.source && (
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          {view.source}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{view.prompt}</p>
                    <p className="text-xs text-muted-foreground">
                      Saved {formatRelativeDate(view.createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(view.id)}
                    className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete saved view"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => onOpenView(view)}>
                    Open in AI Builder
                  </Button>
                  <a
                    href={`/build?savedView=${encodeURIComponent(view.id)}`}
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Open full page
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatRelativeDate(timestamp: number): string {
  const date = new Date(timestamp);
  const diff = Date.now() - date.getTime();

  if (diff < 3_600_000) {
    const minutes = Math.max(1, Math.floor(diff / 60_000));
    return `${minutes}m ago`;
  }

  if (diff < 86_400_000) {
    const hours = Math.max(1, Math.floor(diff / 3_600_000));
    return `${hours}h ago`;
  }

  if (diff < 604_800_000) {
    const days = Math.max(1, Math.floor(diff / 86_400_000));
    return `${days}d ago`;
  }

  return date.toLocaleDateString();
}
