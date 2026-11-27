import { useMemo, useSyncExternalStore } from 'react';
import { File } from '@pierre/diffs/react';
import type { FileOptions } from '@pierre/diffs/react';
import type { FileContents } from '@pierre/diffs';
import { shikiLanguage, shikiThemeForSiteTheme } from '@/lib/code-theme';

interface CodeBlockProps {
  code: string;
  language: string;
  /** Show the line-number gutter (default true; turn off for one-liner commands). */
  lineNumbers?: boolean;
  /** Wrap long lines instead of horizontal scrolling (default true). */
  wrap?: boolean;
  className?: string;
  /**
   * Extra CSS injected into the block's shadow root (the library's own
   * escape hatch). Needed because outer page CSS cannot reach the code
   * lines; pass a constant so the options object stays stable.
   */
  unsafeCSS?: string;
}

// ── Shared site-theme subscription ──────────────────────────────────────────
// All CodeBlock instances share ONE MutationObserver on <html data-theme>.

const themeListeners = new Set<() => void>();
let themeObserver: MutationObserver | null = null;

function subscribeToSiteTheme(listener: () => void): () => void {
  themeListeners.add(listener);
  if (themeObserver === null && typeof document !== 'undefined') {
    themeObserver = new MutationObserver(() => {
      themeListeners.forEach((notify) => notify());
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }
  return () => {
    themeListeners.delete(listener);
    if (themeListeners.size === 0 && themeObserver !== null) {
      themeObserver.disconnect();
      themeObserver = null;
    }
  };
}

function getSiteTheme(): string | null {
  return document.documentElement.getAttribute('data-theme');
}

function getServerSiteTheme(): string | null {
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────

const CODE_BLOCK_STYLE = {
  '--diffs-font-family': 'var(--font-mono, ui-monospace, monospace)',
  '--diffs-font-size': '12px',
  '--diffs-line-height': '18px',
  '--diffs-gap-block': '10px',
} as React.CSSProperties;

/**
 * Syntax-highlighted, read-only code block rendered with @pierre/diffs.
 * The Shiki theme follows the site theme (data-theme attribute) live.
 */
export function CodeBlock({
  code,
  language,
  lineNumbers = true,
  wrap = true,
  className = '',
  unsafeCSS,
}: CodeBlockProps) {
  const siteTheme = useSyncExternalStore(
    subscribeToSiteTheme,
    getSiteTheme,
    getServerSiteTheme,
  );

  const file = useMemo<FileContents>(
    () => ({
      name: 'snippet',
      contents: code,
      lang: shikiLanguage(language),
    }),
    [code, language],
  );

  const options = useMemo<FileOptions<undefined>>(
    () => ({
      theme: shikiThemeForSiteTheme(siteTheme),
      disableFileHeader: true,
      disableLineNumbers: !lineNumbers,
      overflow: wrap ? 'wrap' : 'scroll',
      unsafeCSS,
    }),
    [siteTheme, lineNumbers, wrap, unsafeCSS],
  );

  return (
    <File
      file={file}
      options={options}
      className={className}
      style={CODE_BLOCK_STYLE}
    />
  );
}
