import { useState } from 'react';
import { CodeBlock } from '@/components/ui/CodeBlock';

/**
 * Copyable command rendered as a CodeBlock with a hover copy button.
 * Single owner of the command-block pattern used across control pages
 * (cloud implementations, KSI programmatic queries, STIG check/fix text).
 */
interface CommandBlockProps {
  command: string;
  /** Optional one-line explanation rendered above the block. */
  description?: string;
  /** Shiki language for highlighting (default bash). */
  language?: string;
  /** Extra classes on the root element (e.g. vertical spacing). */
  className?: string;
}

// Keeps line ends clear of the overlaid copy button. The code lines live
// in the library's shadow DOM, so outer page CSS cannot reach them.
const COPY_BUTTON_CLEARANCE_CSS = '[data-line] { padding-inline-end: 2.5rem; }';

const CopyIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeWidth="2" />
  </svg>
);

const CheckIcon = () => (
  <svg
    className="w-4 h-4 text-green-600 dark:text-green-500"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
  </svg>
);

export function CommandBlock({
  command,
  description,
  language = 'bash',
  className = '',
}: CommandBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked (permissions policy, insecure context).
    }
  };

  return (
    <div className={`group ${className}`.trim()}>
      {description ? (
        <div className="text-xs text-muted-foreground mb-1">{description}</div>
      ) : null}
      <div className="relative">
        <div className="border border-border rounded-lg overflow-hidden">
          <CodeBlock
            code={command}
            language={language}
            lineNumbers={false}
            wrap={false}
            unsafeCSS={COPY_BUTTON_CLEARANCE_CSS}
          />
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className={`absolute right-2 p-1.5 rounded-md bg-background/80 border border-border opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted ${
            command.includes('\n') ? 'top-2' : 'top-1/2 -translate-y-1/2'
          }`}
          title="Copy command"
          aria-label="Copy command"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </div>
    </div>
  );
}
