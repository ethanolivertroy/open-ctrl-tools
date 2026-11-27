import * as React from 'react';
import { formatKeysForDisplay } from '@/lib/keyboard-shortcuts';

interface KeyboardHintProps {
  keys: string;
  className?: string;
}

/**
 * Display keyboard shortcut keys with styled kbd elements
 * @example <KeyboardHint keys="g h" /> -> [G] then [H]
 */
export function KeyboardHint({ keys, className = '' }: KeyboardHintProps) {
  const formattedKeys = formatKeysForDisplay(keys);

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {formattedKeys.map((key, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span className="text-muted-foreground text-xs">then</span>}
          <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted rounded border border-border shadow-sm">
            {key}
          </kbd>
        </React.Fragment>
      ))}
    </span>
  );
}

/**
 * Single key display without "then" connector
 */
export function SingleKey({ children, className = '' }: { children: string; className?: string }) {
  return (
    <kbd className={`px-1.5 py-0.5 text-xs font-mono bg-muted rounded border border-border shadow-sm ${className}`}>
      {children}
    </kbd>
  );
}
