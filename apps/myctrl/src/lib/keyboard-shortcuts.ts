/**
 * Keyboard shortcuts registry and utilities
 * Linear/Superhuman-style keyboard navigation
 */

export interface ShortcutDefinition {
  id: string;
  keys: string;              // "g h" for chord, "Cmd+k" for combo
  description: string;
  category: 'navigation' | 'actions' | 'list' | 'help';
  scope?: 'global' | 'framework' | 'control';
}

export const SHORTCUTS: ShortcutDefinition[] = [
  // Navigation (G + key chords)
  { id: 'go-home', keys: 'g h', description: 'Go to Home', category: 'navigation', scope: 'global' },
  { id: 'go-frameworks', keys: 'g f', description: 'Go to All Frameworks', category: 'navigation', scope: 'global' },
  { id: 'go-graph', keys: 'g g', description: 'Go to Knowledge Graph', category: 'navigation', scope: 'global' },
  { id: 'go-compare', keys: 'g c', description: 'Go to Compare Tool', category: 'navigation', scope: 'global' },
  { id: 'go-crosswalk', keys: 'g x', description: 'Go to Crosswalk Explorer', category: 'navigation', scope: 'global' },
  { id: 'go-preferences', keys: 'g s', description: 'Go to Preferences', category: 'navigation', scope: 'global' },
  { id: 'go-guidance', keys: 'g t', description: 'Go to Guidance', category: 'navigation', scope: 'global' },

  // Actions
  { id: 'toggle-favorite', keys: 'f', description: 'Toggle favorite', category: 'actions', scope: 'framework' },
  { id: 'focus-notes', keys: 'n', description: 'Focus notes textarea', category: 'actions', scope: 'control' },
  { id: 'open-search', keys: '/', description: 'Open search', category: 'actions', scope: 'global' },
  { id: 'open-search-cmd', keys: 'Cmd+k', description: 'Go to Full Search', category: 'actions', scope: 'global' },
  { id: 'open-ai', keys: 'Cmd+j', description: 'Open GRCLanker', category: 'actions', scope: 'global' },

  // List Navigation
  { id: 'next-item', keys: 'j', description: 'Next item in list', category: 'list', scope: 'global' },
  { id: 'prev-item', keys: 'k', description: 'Previous item in list', category: 'list', scope: 'global' },
  { id: 'select-item', keys: 'Enter', description: 'Open focused item', category: 'list', scope: 'global' },

  // Help
  { id: 'show-help', keys: '?', description: 'Show keyboard shortcuts', category: 'help', scope: 'global' },
  { id: 'close-modal', keys: 'Escape', description: 'Close modal/sheet', category: 'help', scope: 'global' },
];

/**
 * Check if the target element is an input that should capture keyboard events
 */
export function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  return (
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    target.isContentEditable
  );
}

/**
 * Get shortcuts grouped by category
 */
export function getShortcutsByCategory(): Map<string, ShortcutDefinition[]> {
  const grouped = new Map<string, ShortcutDefinition[]>();

  for (const shortcut of SHORTCUTS) {
    const existing = grouped.get(shortcut.category) || [];
    grouped.set(shortcut.category, [...existing, shortcut]);
  }

  return grouped;
}

/**
 * Format keys for display (e.g., "g h" -> ["G", "H"])
 */
export function formatKeysForDisplay(keys: string): string[] {
  return keys.split(' ').map(k => {
    if (k.includes('+')) {
      return k.split('+').map(part => {
        if (part === 'Cmd') return '⌘';
        if (part === 'Ctrl') return 'Ctrl';
        if (part === 'Alt') return 'Alt';
        if (part === 'Shift') return '⇧';
        return part.toUpperCase();
      }).join('');
    }
    return k.toUpperCase();
  });
}

/**
 * Navigation routes for chord shortcuts
 */
export const NAVIGATION_ROUTES: Record<string, string> = {
  h: '/',
  f: '/all',
  g: '/graph',
  c: '/compare',
  x: '/crosswalk',
  s: '/preferences',
  t: '/guidance',
};

/**
 * Category labels for display
 */
export const CATEGORY_LABELS: Record<string, string> = {
  navigation: 'Navigation',
  actions: 'Actions',
  list: 'List Navigation',
  help: 'Help',
};
