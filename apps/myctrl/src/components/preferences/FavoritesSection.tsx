import { useState, useEffect } from 'react';
import type { FavoriteFramework } from '@/lib/db';
import {
  getFavoriteFrameworks,
  updateFavoriteNotes,
  toggleFavorite,
} from '@/lib/storage/favorites-store';

interface FrameworkInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  type: 'framework' | 'risk-list';
  tags?: string[];
}

interface FavoritesSectionProps {
  frameworkConfigs: Record<string, FrameworkInfo>;
}

export function FavoritesSection({ frameworkConfigs }: FavoritesSectionProps) {
  const [favorites, setFavorites] = useState<FavoriteFramework[]>([]);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    getFavoriteFrameworks().then(setFavorites);
  }, []);

  const handleRemove = (frameworkId: string) => {
    toggleFavorite(frameworkId);
    setFavorites(prev => prev.filter(f => f.frameworkId !== frameworkId));
  };

  const handleEditNotes = (fav: FavoriteFramework) => {
    setEditingNotes(fav.frameworkId);
    setNoteText(fav.notes);
  };

  const handleSaveNotes = () => {
    if (editingNotes) {
      updateFavoriteNotes(editingNotes, noteText);
      setFavorites(prev =>
        prev.map(f => (f.frameworkId === editingNotes ? { ...f, notes: noteText } : f))
      );
      setEditingNotes(null);
      setNoteText('');
    }
  };

  const handleCancelEdit = () => {
    setEditingNotes(null);
    setNoteText('');
  };

  return (
    <section id="favorites" className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span className="text-primary">{'>'}</span> Favorites
      </h2>
      <p className="text-sm text-muted-foreground">
        Your starred frameworks. Add favorites from any framework page.
      </p>

      {favorites.length === 0 ? (
        <div className="text-center py-12 rounded-lg border border-border bg-card">
          <div className="text-4xl text-yellow-500 mb-3">&#9733;</div>
          <p className="text-muted-foreground text-sm">No favorites yet.</p>
          <a href="/all" className="text-primary text-sm hover:underline mt-1 inline-block">
            Browse frameworks
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {favorites.map(fav => {
            const config = frameworkConfigs[fav.frameworkId];
            const isEditing = editingNotes === fav.frameworkId;
            const basePath = config?.type === 'risk-list' ? '/risk-lists' : '/frameworks';

            if (!config) {
              return (
                <div key={fav.frameworkId} className="p-4 rounded-lg border border-border bg-card opacity-60 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Unknown: {fav.frameworkId}</p>
                  <button type="button" onClick={() => handleRemove(fav.frameworkId)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                    <XIcon />
                  </button>
                </div>
              );
            }

            return (
              <div key={fav.frameworkId} className="p-4 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-yellow-500">&#9733;</span>
                      <a
                        href={`${basePath}/${fav.frameworkId}`}
                        className="font-semibold hover:text-primary transition-colors truncate"
                      >
                        {config.name}
                      </a>
                      <span className="px-1.5 py-0.5 text-xs font-mono rounded border bg-primary/10 border-primary/20 text-primary">
                        v{config.version}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{config.description}</p>

                    {config.tags && config.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {config.tags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 text-xs rounded border border-border text-muted-foreground">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={noteText}
                          onChange={e => setNoteText(e.target.value)}
                          className="w-full p-3 text-sm rounded-lg border border-border bg-muted/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                          rows={3}
                          placeholder="Add notes about this framework..."
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button type="button" onClick={handleSaveNotes} className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
                            Save
                          </button>
                          <button type="button" onClick={handleCancelEdit} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : fav.notes ? (
                      <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                        <p className="text-sm whitespace-pre-wrap">{fav.notes}</p>
                        <button type="button" onClick={() => handleEditNotes(fav)} className="text-xs text-primary hover:underline mt-2">
                          Edit notes
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => handleEditNotes(fav)} className="text-xs text-muted-foreground hover:text-primary">
                        + Add notes
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemove(fav.frameworkId)}
                    className="shrink-0 p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="Remove from favorites"
                  >
                    <XIcon />
                  </button>
                </div>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground text-center pt-2">
            {favorites.length} favorite{favorites.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </section>
  );
}

function XIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
