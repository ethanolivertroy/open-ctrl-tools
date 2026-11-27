import { useState, useEffect, useCallback } from 'react';
import type { Project, WhiteboardMeta } from '@/lib/db';
import { ACTIVE_PROJECT_CHANGED_EVENT, getActiveProject } from '@/lib/storage/project-store';
import {
  WHITEBOARDS_CHANGED_EVENT,
  createWhiteboard,
  deleteWhiteboard,
  getWhiteboards,
  renameWhiteboard,
} from '@/lib/storage/whiteboard-store';
import { ActiveProjectSelect } from '@/components/projects/ActiveProjectSelect';
import { useWindowEvents } from '@/hooks/useProjectChange';
import { BoardSwitcher } from './BoardSwitcher';
import { WhiteboardCanvas } from './WhiteboardCanvas';

export function WhiteboardApp() {
  const [boards, setBoards] = useState<WhiteboardMeta[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBoards = useCallback(async () => {
    try {
      const [all, project] = await Promise.all([
        getWhiteboards(),
        getActiveProject(),
      ]);
      setActiveProject(project);
      if (all.length === 0) {
        const newBoard = await createWhiteboard('Untitled Board');
        setBoards([newBoard]);
        setActiveBoardId(newBoard.id);
      } else {
        setBoards(all);
        setActiveBoardId(prev => {
          if (prev && all.some(b => b.id === prev)) return prev;
          return all[0].id;
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBoards();
  }, [loadBoards]);

  useWindowEvents([ACTIVE_PROJECT_CHANGED_EVENT, WHITEBOARDS_CHANGED_EVENT], loadBoards);

  const handleCreateBoard = async () => {
    if (boards.length >= 20) return;
    const newBoard = await createWhiteboard(`Board ${boards.length + 1}`);
    setBoards(prev => [newBoard, ...prev]);
    setActiveBoardId(newBoard.id);
  };

  const handleRenameBoard = async (id: string, name: string) => {
    await renameWhiteboard(id, name);
    await loadBoards();
  };

  const handleDeleteBoard = async (id: string) => {
    if (boards.length <= 1) return;
    await deleteWhiteboard(id);
    const remaining = boards.filter(b => b.id !== id);
    setBoards(remaining);
    if (activeBoardId === id) {
      setActiveBoardId(remaining[0]?.id || null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-10rem)] text-zinc-500">
        Loading whiteboards...
      </div>
    );
  }

  if (!activeBoardId) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 border-b border-zinc-800 bg-zinc-950/70">
        <ActiveProjectSelect onChange={() => loadBoards()} showManageLink />
        {activeProject && (
          <p className="text-xs text-zinc-400">
            Whiteboards for <span className="font-medium text-zinc-100">{activeProject.name}</span>
          </p>
        )}
      </div>
      <BoardSwitcher
        boards={boards}
        activeBoardId={activeBoardId}
        onSelectBoard={setActiveBoardId}
        onCreateBoard={handleCreateBoard}
        onRenameBoard={handleRenameBoard}
        onDeleteBoard={handleDeleteBoard}
      />
      <div className="flex-1 min-h-0">
        <WhiteboardCanvas key={activeBoardId} boardId={activeBoardId} />
      </div>
    </div>
  );
}
