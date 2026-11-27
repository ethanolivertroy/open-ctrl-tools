import { useState, useEffect } from 'react';
import type { ControlNote, Project } from '@/lib/db';
import {
  ACTIVE_PROJECT_CHANGED_EVENT,
  PROJECTS_CHANGED_EVENT,
  getActiveProject,
} from '@/lib/storage/project-store';
import {
  getAllControlNotes,
  deleteControlNote,
} from '@/lib/storage/control-note-store';
import { ActiveProjectSelect } from '@/components/projects/ActiveProjectSelect';
import { useWindowEvents } from '@/hooks/useProjectChange';

export function ControlNotesSection() {
  const [notes, setNotes] = useState<ControlNote[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [filter, setFilter] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function load() {
    const [allNotes, project] = await Promise.all([
      getAllControlNotes(),
      getActiveProject(),
    ]);
    setNotes(allNotes);
    setActiveProject(project);
  }

  useEffect(() => {
    load();
  }, []);

  useWindowEvents([ACTIVE_PROJECT_CHANGED_EVENT, PROJECTS_CHANGED_EVENT], load);

  const handleDelete = (frameworkId: string, controlSlug: string) => {
    const key = `${frameworkId}:${controlSlug}`;
    if (confirmDelete === key) {
      deleteControlNote(frameworkId, controlSlug);
      setNotes(prev => prev.filter(n => !(n.frameworkId === frameworkId && n.controlSlug === controlSlug)));
      setConfirmDelete(null);
    } else {
      setConfirmDelete(key);
    }
  };

  const filtered = filter
    ? notes.filter(n =>
        n.frameworkId.toLowerCase().includes(filter.toLowerCase()) ||
        n.controlSlug.toLowerCase().includes(filter.toLowerCase()) ||
        n.notes.toLowerCase().includes(filter.toLowerCase())
      )
    : notes;

  // Group by framework
  const grouped = filtered.reduce<Record<string, ControlNote[]>>((acc, note) => {
    (acc[note.frameworkId] ??= []).push(note);
    return acc;
  }, {});

  return (
    <section id="notes" className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span className="text-primary">{'>'}</span> Control Notes
      </h2>
      <p className="text-sm text-muted-foreground">
        Notes from the active project bucket. Click a control to view it.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ActiveProjectSelect onChange={() => load()} showManageLink />
        {activeProject && (
          <p className="text-xs text-muted-foreground">
            Viewing notes for <span className="font-medium text-foreground">{activeProject.name}</span>
          </p>
        )}
      </div>

      {notes.length === 0 ? (
        <div className="text-center py-12 rounded-lg border border-border bg-card">
          <p className="text-muted-foreground text-sm">No control notes in this project yet.</p>
          <p className="text-muted-foreground text-xs mt-1">Add notes from any control detail page while this project is active.</p>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter notes..."
            className="w-full px-3 py-2 text-sm rounded-md border border-border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/50"
          />

          <div className="space-y-6">
            {Object.entries(grouped).map(([frameworkId, frameworkNotes]) => (
              <div key={frameworkId}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                  {frameworkId}
                  <span className="ml-2 text-xs font-normal">({frameworkNotes.length})</span>
                </h3>
                <div className="space-y-2">
                  {frameworkNotes.map(note => {
                    const key = `${note.frameworkId}:${note.controlSlug}`;
                    const isConfirming = confirmDelete === key;
                    return (
                      <div key={key} className="p-3 rounded-lg border border-border bg-card flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <a
                            href={`/frameworks/${note.frameworkId}/${note.controlSlug}`}
                            className="text-sm font-medium hover:text-primary transition-colors"
                          >
                            {note.controlSlug}
                          </a>
                          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-3">
                            {note.notes}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(note.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDelete(note.frameworkId, note.controlSlug)}
                          className={`shrink-0 px-2 py-1 text-xs rounded transition-colors ${
                            isConfirming
                              ? 'bg-destructive text-destructive-foreground'
                              : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                          }`}
                        >
                          {isConfirming ? 'Confirm' : 'Delete'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            {filtered.length} note{filtered.length !== 1 ? 's' : ''}{filter ? ' (filtered)' : ''}
          </p>
        </>
      )}
    </section>
  );
}
