import { useState, useRef, useEffect } from 'react';
import type { WhiteboardMeta } from '@/lib/db';

interface BoardSwitcherProps {
  boards: WhiteboardMeta[];
  activeBoardId: string;
  onSelectBoard: (id: string) => void;
  onCreateBoard: () => void;
  onRenameBoard: (id: string, name: string) => void;
  onDeleteBoard: (id: string) => void;
}

export function BoardSwitcher({
  boards,
  activeBoardId,
  onSelectBoard,
  onCreateBoard,
  onRenameBoard,
  onDeleteBoard,
}: BoardSwitcherProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleDoubleClick = (board: WhiteboardMeta) => {
    setEditingId(board.id);
    setEditName(board.name);
  };

  const handleRenameSubmit = () => {
    if (editingId && editName.trim()) {
      onRenameBoard(editingId, editName.trim());
    }
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (confirmDeleteId === id) {
      onDeleteBoard(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
    }
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 bg-zinc-900/80 border-b border-zinc-800 overflow-hidden">
      <div ref={scrollRef} className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 min-w-0">
        {boards.map(board => (
          <button
            type="button"
            key={board.id}
            aria-label={`Switch to board: ${board.name}`}
            aria-current={board.id === activeBoardId ? 'true' : undefined}
            className={`group flex items-center gap-1 px-3 py-1.5 rounded-md text-sm whitespace-nowrap cursor-pointer transition-colors shrink-0 ${
              board.id === activeBoardId
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
            onClick={() => { setConfirmDeleteId(null); onSelectBoard(board.id); }}
            onDoubleClick={() => handleDoubleClick(board)}
          >
            {editingId === board.id ? (
              <input
                ref={inputRef}
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleRenameSubmit();
                  if (e.key === 'Escape') setEditingId(null);
                }}
                aria-label="Edit board name"
                className="bg-transparent border-b border-zinc-500 outline-none text-sm w-24 text-zinc-100"
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className="max-w-32 truncate">{board.name}</span>
            )}

            {board.id === activeBoardId && boards.length > 1 && !editingId && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); handleDelete(board.id); }}
                className={`ml-1 p-0.5 rounded transition-colors ${
                  confirmDeleteId === board.id
                    ? 'text-red-400 bg-red-500/20'
                    : 'text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100'
                }`}
                aria-label={confirmDeleteId === board.id ? 'Confirm delete board' : 'Delete board'}
                title={confirmDeleteId === board.id ? 'Click again to confirm' : 'Delete board'}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </button>
        ))}
      </div>

      {boards.length < 20 && (
        <button
          type="button"
          onClick={onCreateBoard}
          className="shrink-0 p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          title="New board"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </div>
  );
}
