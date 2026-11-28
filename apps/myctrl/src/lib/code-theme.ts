/**
 * Shared mapping between site themes and Shiki themes for @pierre/diffs
 * code blocks, plus language normalization for syntax highlighting.
 *
 * Used by the client-side CodeBlock (per-theme match, follows data-theme)
 * and the build-time StaticCode.astro (fixed dark/light pair switched via
 * the site's per-theme `color-scheme` and Pierre's light-dark() CSS).
 */

import type { BundledLanguage, SupportedLanguages } from '@pierre/diffs';
import { normalizeTheme, type Theme } from '@/lib/theme';

const SHIKI_THEME_BY_SITE_THEME: Record<Theme, string> = {
  mocha: 'catppuccin-mocha',
  dracula: 'dracula',
  latte: 'catppuccin-latte',
};

export function shikiThemeForSiteTheme(siteTheme: string | null | undefined): string {
  return SHIKI_THEME_BY_SITE_THEME[normalizeTheme(siteTheme)];
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
