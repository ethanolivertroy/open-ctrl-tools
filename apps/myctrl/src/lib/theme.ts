/**
 * Shared theme utilities
 *
 * Single source of truth for theme types, light/dark classification,
 * theme application, and static color values for swatch rendering.
 */

export type Theme =
  | 'zinc'
  | 'zinc-light'
  | 'mocha'
  | 'macchiato'
  | 'frappe'
  | 'neo-terminal'
  | 'nord'
  | 'dracula'
  | 'latte'
  | 'gruvbox-dark'
  | 'gruvbox-light'
  | 'tokyo-night'
  | 'rose-pine'
  | 'solarized-dark'
  | 'solarized-light'
  | 'kanagawa'
  | 'earth-light'
  | 'earth-dark';

export const LIGHT_THEMES: ReadonlySet<Theme> = new Set([
  'latte',
  'zinc-light',
  'gruvbox-light',
  'solarized-light',
  'earth-light',
]);

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.classList.toggle('dark', !LIGHT_THEMES.has(theme));
}

export interface ThemeInfo {
  value: Theme;
  label: string;
}

/**
 * Curated theme list. The full Theme type and THEME_COLORS are kept for
 * legacy stored values (migrated on load in BaseLayout) and for code-block
 * (src/lib/code-theme.ts) and graph color mappings, but the picker only
 * offers these three:
 * two dark themes tuned for the WebGL night-sky hero, one light theme
 * (the hero scene hides itself on light themes — additive star glow
 * doesn't work on a light background).
 */
export const THEMES: ThemeInfo[] = [
  { value: 'mocha', label: 'Mocha' },
  { value: 'dracula', label: 'Dracula' },
  { value: 'latte', label: 'Latte' },
];

/**
 * Read the current computed value of a Catppuccin CSS variable.
 * Returns the hex/rgb string the active theme defines for that token.
 * Safe to call only in browser (client components) — returns fallback otherwise.
 */
export function getThemeColor(token: string, fallback = '#888888'): string {
  if (typeof document === 'undefined') return fallback;
  const val = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return val || fallback;
}

/**
 * Semantic color token names used across graph and assessment components.
 * Maps a human-readable key to a CSS custom property name.
 * Use with getThemeColor() at render time to get the current theme's value.
 */
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

/**
 * Static hex colors per theme for swatch rendering.
 * CSS vars only reflect the *active* theme, so we need hardcoded values.
 * Keys: base (background), text, surface0, mauve (accent)
 */
export const THEME_COLORS: Record<Theme, { base: string; text: string; surface0: string; mauve: string }> = {
  mocha:            { base: '#1e1e2e', text: '#cdd6f4', surface0: '#313244', mauve: '#cba6f7' },
  macchiato:        { base: '#24273a', text: '#cad3f5', surface0: '#363a4f', mauve: '#c6a0f6' },
  frappe:           { base: '#303446', text: '#c6d0f5', surface0: '#414559', mauve: '#ca9ee6' },
  latte:            { base: '#eff1f5', text: '#4c4f69', surface0: '#ccd0da', mauve: '#8839ef' },
  'neo-terminal':   { base: '#0a0a0a', text: '#e4e4e7', surface0: '#18181b', mauve: '#22c55e' },
  nord:             { base: '#2e3440', text: '#eceff4', surface0: '#3b4252', mauve: '#88c0d0' },
  dracula:          { base: '#282a36', text: '#f8f8f2', surface0: '#44475a', mauve: '#bd93f9' },
  zinc:             { base: '#09090b', text: '#fafafa', surface0: '#27272a', mauve: '#fafafa' },
  'zinc-light':     { base: '#fafafa', text: '#09090b', surface0: '#e4e4e7', mauve: '#18181b' },
  'gruvbox-dark':   { base: '#282828', text: '#ebdbb2', surface0: '#3c3836', mauve: '#d3869b' },
  'gruvbox-light':  { base: '#fbf1c7', text: '#3c3836', surface0: '#ebdbb2', mauve: '#b16286' },
  'tokyo-night':    { base: '#1a1b26', text: '#c0caf5', surface0: '#24283b', mauve: '#bb9af7' },
  'rose-pine':      { base: '#191724', text: '#e0def4', surface0: '#1f1d2e', mauve: '#c4a7e7' },
  'solarized-dark': { base: '#002b36', text: '#839496', surface0: '#073642', mauve: '#268bd2' },
  'solarized-light':{ base: '#fdf6e3', text: '#657b83', surface0: '#eee8d5', mauve: '#268bd2' },
  kanagawa:         { base: '#1f1f28', text: '#dcd7ba', surface0: '#2a2a37', mauve: '#957fb8' },
  'earth-light':    { base: '#f5efe0', text: '#3b3228', surface0: '#ddd5c4', mauve: '#8b5e3c' },
  'earth-dark':     { base: '#2a231c', text: '#e8dcc8', surface0: '#342c24', mauve: '#c4956a' },
};
