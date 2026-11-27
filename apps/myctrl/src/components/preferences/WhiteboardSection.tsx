import { useState, useEffect } from 'react';
import type { Project, WhiteboardMeta } from '@/lib/db';
import { ACTIVE_PROJECT_CHANGED_EVENT, getActiveProject } from '@/lib/storage/project-store';
import {
  WHITEBOARDS_CHANGED_EVENT,
  deleteWhiteboard,
  getWhiteboards,
  renameWhiteboard,
} from '@/lib/storage/whiteboard-store';
import { ActiveProjectSelect } from '@/components/projects/ActiveProjectSelect';
import { useWindowEvents } from '@/hooks/useProjectChange';

export function WhiteboardSection() {
  const [boards, setBoards] = useState<WhiteboardMeta[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function load() {
    const [nextBoards, project] = await Promise.all([
      getWhiteboards(),
      getActiveProject(),
    ]);
    setBoards(nextBoards);
    setActiveProject(project);
  }

  useEffect(() => {
    load();
  }, []);

  useWindowEvents([ACTIVE_PROJECT_CHANGED_EVENT, WHITEBOARDS_CHANGED_EVENT], load);

  const handleRename = async (id: string) => {
    if (editName.trim()) {
      await renameWhiteboard(id, editName.trim());
      await load();
    }
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId === id) {
      await deleteWhiteboard(id);
      await load();
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
    }
  };

  return (
    <section id="whiteboard" className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span className="text-primary">{'>'}</span> Whiteboards
      </h2>
      <p className="text-sm text-muted-foreground">
        Your saved whiteboards. Open the{' '}
        <a href="/whiteboard" className="text-primary hover:underline">whiteboard</a>{' '}
        to create or edit.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ActiveProjectSelect onChange={() => load()} showManageLink />
        {activeProject && (
          <p className="text-xs text-muted-foreground">
            Viewing whiteboards for <span className="font-medium text-foreground">{activeProject.name}</span>
          </p>
        )}
      </div>

      {boards.length === 0 ? (
        <div className="text-center py-12 rounded-lg border border-border bg-card">
          <p className="text-muted-foreground text-sm">No whiteboards in this project yet.</p>
          <a href="/whiteboard" className="text-primary text-sm hover:underline mt-1 inline-block">
            Create one
          </a>
        </div>
      ) : (
        <div className="space-y-2">
          {boards.map(board => (
            <div key={board.id} className="p-3 rounded-lg border border-border bg-card flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                {editingId === board.id ? (
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onBlur={() => handleRename(board.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRename(board.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="w-full px-2 py-1 text-sm bg-transparent border-b border-border outline-none focus:border-primary"
                    autoFocus
                  />
                ) : (
                  <div>
                    <p className="text-sm font-medium truncate">{board.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Updated {new Date(board.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => { setEditingId(board.id); setEditName(board.name); }}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Rename"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(board.id)}
                  className={`p-1.5 rounded transition-colors ${
                    confirmDeleteId === board.id
                      ? 'text-destructive bg-destructive/10'
                      : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                  }`}
                  title={confirmDeleteId === board.id ? 'Confirm delete' : 'Delete'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground text-center pt-2">
            {boards.length} board{boards.length !== 1 ? 's' : ''} (max 20)
          </p>
        </div>
      )}
    </section>
  );
}
