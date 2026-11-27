import * as React from 'react';
import type { Project } from '@/lib/db';
import { getActiveProject } from '@/lib/storage/project-store';
import { useProjectChange } from '@/hooks/useProjectChange';
import {
  getControlNote,
  setControlNote,
  getControlNoteUpdatedAt,
} from '@/lib/storage/control-note-store';
import { ActiveProjectSelect } from '@/components/projects/ActiveProjectSelect';

interface ControlNotesProps {
  frameworkId: string;
  controlSlug: string;
}

export function ControlNotes({ frameworkId, controlSlug }: ControlNotesProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [activeProject, setActiveProject] = React.useState<Project | null>(null);
  const [notes, setNotes] = React.useState('');
  const [savedNotes, setSavedNotes] = React.useState('');
  const [lastSaved, setLastSaved] = React.useState<number | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  async function loadNotes() {
    const [stored, updatedAt, project] = await Promise.all([
      getControlNote(frameworkId, controlSlug),
      getControlNoteUpdatedAt(frameworkId, controlSlug),
      getActiveProject(),
    ]);
    setActiveProject(project);
    setNotes(stored);
    setSavedNotes(stored);
    setLastSaved(updatedAt);
    if (stored) {
      setIsExpanded(true);
    }
  }

  React.useEffect(() => {
    loadNotes();
  }, [frameworkId, controlSlug]);

  useProjectChange(loadNotes);

  // Handle keyboard shortcut (N key) to focus notes
  React.useEffect(() => {
    const handleFocusNotes = (e: CustomEvent<{ controlSlug: string }>) => {
      // Focus notes for any control on this page
      setIsExpanded(true);
      // Small delay to ensure textarea is rendered
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    };

    document.addEventListener('focus-notes', handleFocusNotes as EventListener);
    return () => {
      document.removeEventListener('focus-notes', handleFocusNotes as EventListener);
    };
  }, [controlSlug]);

  const hasUnsavedChanges = notes !== savedNotes;
  const hasNotes = savedNotes.trim() !== '';

  const confirmProjectSwitch = React.useCallback(() => {
    if (!hasUnsavedChanges) return true;
    return confirm('Switch projects and discard your unsaved note changes?');
  }, [hasUnsavedChanges]);

  const handleSave = () => {
    setIsSaving(true);
    setControlNote(frameworkId, controlSlug, notes).then(() => {
      setSavedNotes(notes);
      setLastSaved(Date.now());
      setTimeout(() => setIsSaving(false), 300);
    });
  };

  const handleClear = () => {
    setNotes('');
    setControlNote(frameworkId, controlSlug, '');
    setSavedNotes('');
    setLastSaved(null);
  }; // setControlNote is fire-and-forget

  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="mt-8 border border-border rounded-lg bg-card">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <NoteIcon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">My Notes</span>
          {hasNotes && !isExpanded && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              Has notes
            </span>
          )}
          {hasUnsavedChanges && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              (unsaved)
            </span>
          )}
        </div>
        <ChevronIcon className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Collapsible content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ActiveProjectSelect
              beforeChange={confirmProjectSwitch}
              onChange={() => loadNotes()}
              showManageLink
            />
            {activeProject && (
              <p className="text-xs text-muted-foreground">
                Saving to <span className="font-medium text-foreground">{activeProject.name}</span>
              </p>
            )}
          </div>
          <textarea
            ref={textareaRef}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add your personal notes here... (implementation details, evidence locations, assessment findings, etc.)"
            className="w-full min-h-[120px] p-3 text-sm bg-background border border-border rounded-md resize-y focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={!hasUnsavedChanges || isSaving}
                className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              {hasNotes && (
                <button
                  onClick={handleClear}
                  className="px-3 py-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            {lastSaved && (
              <span className="text-xs text-muted-foreground">
                Last saved: {formatTimeAgo(lastSaved)}
              </span>
            )}
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
            <InfoIcon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Notes are saved locally in your browser only. Not backed up or synced.
              Avoid storing sensitive information.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function NoteIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
