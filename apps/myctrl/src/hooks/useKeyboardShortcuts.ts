import { useState, useEffect, useRef, useCallback } from 'react';
import { requestOpenAIChat } from '@/lib/ai-chat-events';
import { isInputElement, NAVIGATION_ROUTES } from '@/lib/keyboard-shortcuts';

const CHORD_TIMEOUT_MS = 500;

interface UseKeyboardShortcutsOptions {
  /** Current page scope for context-aware shortcuts */
  scope?: 'global' | 'framework' | 'control';
  /** Framework ID for F key (favorite toggle) */
  frameworkId?: string;
  /** Control slug for N key (notes focus) */
  controlSlug?: string;
}

interface UseKeyboardShortcutsReturn {
  /** Currently pending chord prefix (e.g., "g") */
  pendingChord: string | null;
  /** Whether the help modal is open */
  helpOpen: boolean;
  /** Set help modal state */
  setHelpOpen: (open: boolean) => void;
  /** Currently focused item index for J/K navigation */
  focusedIndex: number;
  /** Set focused index */
  setFocusedIndex: (index: number) => void;
}

export function useKeyboardShortcuts(
  options: UseKeyboardShortcutsOptions = {}
): UseKeyboardShortcutsReturn {
  const { scope = 'global', frameworkId, controlSlug } = options;

  const [pendingChord, setPendingChord] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const chordTimeoutRef = useRef<number | undefined>(undefined);

  const handleChord = useCallback((key: string) => {
    const route = NAVIGATION_ROUTES[key];
    if (route) {
      window.location.href = route;
    }
  }, []);

  const handleSingleKey = useCallback(
    (key: string, e: KeyboardEvent) => {
      // F - Toggle favorite (on framework pages)
      if (key === 'f' && (scope === 'framework' || scope === 'control') && frameworkId) {
        e.preventDefault();
        // Dispatch custom event for FavoriteButton to handle
        document.dispatchEvent(
          new CustomEvent('toggle-favorite', { detail: { frameworkId } })
        );
        return;
      }

      // N - Focus notes (on control pages)
      if (key === 'n' && scope === 'control') {
        e.preventDefault();
        // Dispatch custom event for ControlNotes to handle
        document.dispatchEvent(
          new CustomEvent('focus-notes', { detail: { controlSlug } })
        );
        return;
      }

      // J - Next item
      if (key === 'j') {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('navigate-list', { detail: { direction: 'next' } }));
        return;
      }

      // K - Previous item
      if (key === 'k') {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('navigate-list', { detail: { direction: 'prev' } }));
        return;
      }
    },
    [scope, frameworkId, controlSlug]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if we're in an input element
      if (isInputElement(e.target)) return;

      const key = e.key.toLowerCase();

      // Handle Cmd+J / Ctrl+J for AI dialog
      if (key === 'j' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        requestOpenAIChat();
        return;
      }

      // Handle ? for help (Shift + /)
      if (key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }

      // Handle Escape to close help
      if (key === 'escape' && helpOpen) {
        e.preventDefault();
        setHelpOpen(false);
        return;
      }

      // Handle chord prefix (g)
      if (key === 'g' && !pendingChord && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setPendingChord('g');
        chordTimeoutRef.current = window.setTimeout(() => {
          setPendingChord(null);
        }, CHORD_TIMEOUT_MS);
        return;
      }

      // Handle chord completion
      if (pendingChord === 'g') {
        clearTimeout(chordTimeoutRef.current);
        setPendingChord(null);
        e.preventDefault();
        handleChord(key);
        return;
      }

      // Handle single-key shortcuts
      handleSingleKey(key, e);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (chordTimeoutRef.current) {
        clearTimeout(chordTimeoutRef.current);
      }
    };
  }, [pendingChord, helpOpen, handleChord, handleSingleKey]);

  return {
    pendingChord,
    helpOpen,
    setHelpOpen,
    focusedIndex,
    setFocusedIndex,
  };
}
