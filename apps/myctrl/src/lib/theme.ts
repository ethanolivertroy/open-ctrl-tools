/**
 * Shared theme utilities — 3 curated themes (Mocha, Dracula, Latte).
 * Legacy theme keys stored in localStorage / IndexedDB normalize cleanly.
 */

export type Theme = 'mocha' | 'dracula' | 'latte';

export const LIGHT_THEMES: ReadonlySet<Theme> = new Set(['latte']);

const LEGACY_LIGHT_THEMES = new Set([
  'latte',
  'zinc-light',
  'gruvbox-light',
  'solarized-light',
  'earth-light',
]);

export function normalizeTheme(value: string | null | undefined): Theme {
  if (value === 'dracula') return 'dracula';
  if (value && LEGACY_LIGHT_THEMES.has(value)) return 'latte';
  return 'mocha';
}

export function applyTheme(theme: Theme | string) {
  const normalized = normalizeTheme(theme);
  document.documentElement.setAttribute('data-theme', normalized);
  document.documentElement.classList.toggle('dark', !LIGHT_THEMES.has(normalized));
}

export interface ThemeInfo {
  value: Theme;
  label: string;
}

export const THEMES: ThemeInfo[] = [
  { value: 'mocha', label: 'Mocha' },
  { value: 'dracula', label: 'Dracula' },
  { value: 'latte', label: 'Latte' },
];

export function getThemeColor(token: string, fallback = '#888888'): string {
  if (typeof document === 'undefined') return fallback;
  const val = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return val || fallback;
}

export const SEMANTIC_COLORS = {
  blue: '--ctp-blue',
  mauve: '--ctp-mauve',
  teal: '--ctp-teal',
  peach: '--ctp-peach',
  pink: '--ctp-pink',
  green: '--ctp-green',
  yellow: '--ctp-yellow',
  red: '--ctp-red',
  sapphire: '--ctp-sapphire',
  lavender: '--ctp-lavender',
  sky: '--ctp-sky',
  maroon: '--ctp-maroon',
  flamingo: '--ctp-flamingo',
  rosewater: '--ctp-rosewater',
  overlay0: '--ctp-overlay0',
  overlay1: '--ctp-overlay1',
  overlay2: '--ctp-overlay2',
  surface0: '--ctp-surface0',
  surface1: '--ctp-surface1',
  surface2: '--ctp-surface2',
  base: '--ctp-base',
  mantle: '--ctp-mantle',
  crust: '--ctp-crust',
  text: '--ctp-text',
  subtext0: '--ctp-subtext0',
  subtext1: '--ctp-subtext1',
} as const;

export type SemanticColor = keyof typeof SEMANTIC_COLORS;

export const THEME_COLORS: Record<Theme, { base: string; text: string; surface0: string; mauve: string }> = {
  mocha:   { base: '#1e1e2e', text: '#cdd6f4', surface0: '#313244', mauve: '#cba6f7' },
  dracula: { base: '#282a36', text: '#f8f8f2', surface0: '#44475a', mauve: '#bd93f9' },
  latte:   { base: '#eff1f5', text: '#4c4f69', surface0: '#ccd0da', mauve: '#8839ef' },
};
