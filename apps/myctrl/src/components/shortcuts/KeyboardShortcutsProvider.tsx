import * as React from 'react';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { ChordIndicator } from './ChordIndicator';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';

interface KeyboardShortcutsContextValue {
  pendingChord: string | null;
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  focusedIndex: number;
  setFocusedIndex: (index: number) => void;
}

const KeyboardShortcutsContext = React.createContext<KeyboardShortcutsContextValue | null>(null);

export function useKeyboardShortcutsContext() {
  const context = React.useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error('useKeyboardShortcutsContext must be used within KeyboardShortcutsProvider');
  }
  return context;
}

interface KeyboardShortcutsProviderProps {
  children?: React.ReactNode;
  /** Current page scope for context-aware shortcuts */
  scope?: 'global' | 'framework' | 'control';
  /** Framework ID for F key (favorite toggle) */
  frameworkId?: string;
  /** Control slug for N key (notes focus) */
  controlSlug?: string;
}

/**
 * Provider component that wraps the app and handles keyboard shortcuts
 * Renders the ChordIndicator and KeyboardShortcutsModal
 */
export function KeyboardShortcutsProvider({
  children,
  scope = 'global',
  frameworkId,
  controlSlug,
}: KeyboardShortcutsProviderProps) {
  const shortcuts = useKeyboardShortcuts({ scope, frameworkId, controlSlug });

  return (
    <KeyboardShortcutsContext.Provider value={shortcuts}>
      {children}
      <ChordIndicator pendingChord={shortcuts.pendingChord} />
      <KeyboardShortcutsModal
        open={shortcuts.helpOpen}
        onOpenChange={shortcuts.setHelpOpen}
      />
    </KeyboardShortcutsContext.Provider>
  );
}
