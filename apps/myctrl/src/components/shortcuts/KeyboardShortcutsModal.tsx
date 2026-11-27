import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  SHORTCUTS,
  getShortcutsByCategory,
  CATEGORY_LABELS,
  type ShortcutDefinition,
} from '@/lib/keyboard-shortcuts';
import { KeyboardHint } from './KeyboardHint';

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Help modal showing all available keyboard shortcuts
 * Triggered by pressing ? key
 */
export function KeyboardShortcutsModal({ open, onOpenChange }: KeyboardShortcutsModalProps) {
  const shortcutsByCategory = getShortcutsByCategory();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <KeyboardIcon className="h-5 w-5" />
            Keyboard Shortcuts
          </SheetTitle>
          <SheetDescription>
            Navigate quickly using keyboard shortcuts
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {Array.from(shortcutsByCategory.entries()).map(([category, shortcuts]) => (
            <ShortcutCategory
              key={category}
              category={category}
              shortcuts={shortcuts}
            />
          ))}
        </div>

        <div className="mt-8 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Press <kbd className="px-1 py-0.5 text-xs bg-muted rounded border">?</kbd> to toggle this panel
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ShortcutCategory({
  category,
  shortcuts,
}: {
  category: string;
  shortcuts: ShortcutDefinition[];
}) {
  const label = CATEGORY_LABELS[category] || category;

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-3">{label}</h3>
      <div className="space-y-2">
        {shortcuts.map((shortcut) => (
          <div
            key={shortcut.id}
            className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors"
          >
            <span className="text-sm text-muted-foreground">{shortcut.description}</span>
            <KeyboardHint keys={shortcut.keys} />
          </div>
        ))}
      </div>
    </div>
  );
}

function KeyboardIcon({ className }: { className?: string }) {
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
      <rect width="20" height="16" x="2" y="4" rx="2" ry="2" />
      <path d="M6 8h.001" />
      <path d="M10 8h.001" />
      <path d="M14 8h.001" />
      <path d="M18 8h.001" />
      <path d="M8 12h.001" />
      <path d="M12 12h.001" />
      <path d="M16 12h.001" />
      <path d="M7 16h10" />
    </svg>
  );
}
