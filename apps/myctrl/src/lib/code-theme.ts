/**
 * Shared mapping between site themes and Shiki themes for @pierre/diffs
 * code blocks, plus language normalization for syntax highlighting.
 *
 * Used by the client-side CodeBlock (per-theme match, follows data-theme)
 * and the build-time StaticCode.astro (fixed dark/light pair switched via
 * the site's per-theme `color-scheme` and Pierre's light-dark() CSS).
 */

import { registerCustomTheme } from '@pierre/diffs';
import type { BundledLanguage, SupportedLanguages } from '@pierre/diffs';
import type { Theme } from '@/lib/theme';

/**
 * Green-on-black theme matching the site's "neo-terminal" flavor.
 * Registered at module scope (module evaluation is already once-only);
 * registration just records a lazy loader, so the theme JSON is only
 * built if a block actually renders with it.
 */
const NEO_TERMINAL_THEME_NAME = 'myctrl-neo-terminal';

registerCustomTheme(NEO_TERMINAL_THEME_NAME, async () => ({
  name: NEO_TERMINAL_THEME_NAME,
  type: 'dark',
  colors: {
    'editor.background': '#0a0a0a',
    'editor.foreground': '#00ff00',
  },
  tokenColors: [
    { scope: ['comment'], settings: { foreground: '#006600', fontStyle: 'italic' } },
    { scope: ['keyword', 'storage'], settings: { foreground: '#00ffff' } },
    { scope: ['string'], settings: { foreground: '#00ff00' } },
    { scope: ['constant.numeric', 'constant.language'], settings: { foreground: '#ffff00' } },
    { scope: ['entity.name.type', 'support.type', 'support.class'], settings: { foreground: '#00ccff' } },
    { scope: ['entity.name.function', 'support.function'], settings: { foreground: '#00e5e5' } },
    { scope: ['variable', 'entity.name.tag'], settings: { foreground: '#00ff00' } },
  ],
}));

/**
 * Site theme -> Shiki theme. Every value except the custom neo-terminal
 * entry is a Shiki bundled theme (https://shiki.style/themes).
 */
const SHIKI_THEME_BY_SITE_THEME: Record<Theme, string> = {
  mocha: 'catppuccin-mocha',
  macchiato: 'catppuccin-macchiato',
  frappe: 'catppuccin-frappe',
  latte: 'catppuccin-latte',
  'neo-terminal': NEO_TERMINAL_THEME_NAME,
  nord: 'nord',
  dracula: 'dracula',
  zinc: 'min-dark',
  'zinc-light': 'min-light',
  'gruvbox-dark': 'gruvbox-dark-medium',
  'gruvbox-light': 'gruvbox-light-medium',
  'tokyo-night': 'tokyo-night',
  'rose-pine': 'rose-pine',
  'solarized-dark': 'solarized-dark',
  'solarized-light': 'solarized-light',
  kanagawa: 'kanagawa-wave',
  'earth-light': 'gruvbox-light-soft',
  'earth-dark': 'gruvbox-dark-soft',
};

const DEFAULT_SHIKI_THEME = SHIKI_THEME_BY_SITE_THEME.mocha;

export function shikiThemeForSiteTheme(siteTheme: string | null | undefined): string {
  if (siteTheme && siteTheme in SHIKI_THEME_BY_SITE_THEME) {
    return SHIKI_THEME_BY_SITE_THEME[siteTheme as Theme];
  }
  return DEFAULT_SHIKI_THEME;
}

/**
 * Dark/light pair used by build-time rendered (static) code blocks.
 * Which side applies follows the site theme's `color-scheme` via
 * Pierre's light-dark() CSS.
 */
export const STATIC_CODE_THEMES = {
  dark: 'catppuccin-mocha',
  light: 'catppuccin-latte',
} as const;

/**
 * Normalize the language names used across the site's datasets and
 * markdown fences to Shiki language ids. Unknown languages fall back
 * to plain text rather than failing to highlight. The value type keeps
 * every id checked against Shiki's bundle at compile time.
 */
const SHIKI_LANG_BY_ALIAS: Record<string, BundledLanguage | 'text'> = {
  bash: 'bash',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  shellscript: 'bash',
  console: 'bash',
  powershell: 'powershell',
  ps1: 'powershell',
  json: 'json',
  jsonc: 'jsonc',
  yaml: 'yaml',
  yml: 'yaml',
  hcl: 'hcl',
  terraform: 'terraform',
  tf: 'terraform',
  xml: 'xml',
  html: 'html',
  ini: 'ini',
  toml: 'toml',
  spl: 'spl',
  splunk: 'spl',
  javascript: 'javascript',
  js: 'javascript',
  typescript: 'typescript',
  ts: 'typescript',
  tsx: 'tsx',
  jsx: 'jsx',
  python: 'python',
  py: 'python',
  go: 'go',
  rust: 'rust',
  java: 'java',
  csharp: 'csharp',
  sql: 'sql',
  dockerfile: 'dockerfile',
  docker: 'dockerfile',
  markdown: 'markdown',
  md: 'markdown',
  css: 'css',
  diff: 'diff',
  text: 'text',
  txt: 'text',
  plaintext: 'text',
};

export function shikiLanguage(language: string | null | undefined): SupportedLanguages {
  if (!language) return 'text';
  return SHIKI_LANG_BY_ALIAS[language.toLowerCase()] ?? 'text';
}
