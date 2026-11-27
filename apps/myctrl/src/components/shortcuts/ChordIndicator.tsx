import * as React from 'react';

interface ChordIndicatorProps {
  /** The current pending chord prefix (e.g., "g") */
  pendingChord: string | null;
}

/**
 * Floating indicator showing the active chord prefix
 * Appears at bottom center when user presses G and waits for second key
 */
export function ChordIndicator({ pendingChord }: ChordIndicatorProps) {
  if (!pendingChord) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg shadow-lg">
        <kbd className="px-2 py-1 text-sm font-mono font-semibold bg-primary/10 text-primary rounded border border-primary/30">
          {pendingChord.toUpperCase()}
        </kbd>
        <span className="text-sm text-muted-foreground">+</span>
        <span className="text-sm text-muted-foreground motion-safe:animate-pulse">...</span>
      </div>
    </div>
  );
}
