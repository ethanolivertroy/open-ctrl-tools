import { useId, useState } from 'react';
import type { AuthoritativeSource, AuthoritativeSourceType, ConfigExample } from '@/data/types';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { GoodBadComparison } from './GoodBadComparison';
import { getGoodBadExamplePresentation, resolveComparisonTitle } from './good-bad-parser';

interface AuthoritativeSourceCardProps {
  source: AuthoritativeSource;
}

// Source type display configuration
const SOURCE_TYPES: Record<AuthoritativeSourceType, { label: string; color: string }> = {
  nist: { label: 'NIST', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  cis: { label: 'CIS', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
  'disa-stig': { label: 'DISA STIG', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  vendor: { label: 'Vendor', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  csa: { label: 'CSA', color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' },
  owasp: { label: 'OWASP', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  cisa: { label: 'CISA', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  soc2: { label: 'SOC 2', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' },
  iso: { label: 'ISO', color: 'bg-teal-500/10 text-teal-500 border-teal-500/20' },
  ccm: { label: 'CCM', color: 'bg-sky-500/10 text-sky-500 border-sky-500/20' },
  community: { label: 'Community', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
};

// Language display labels
const LANGUAGE_LABELS: Record<string, string> = {
  json: 'JSON',
  yaml: 'YAML',
  hcl: 'HCL',
  bash: 'Bash',
  powershell: 'PowerShell',
  xml: 'XML',
  terraform: 'Terraform',
  python: 'Python',
};

export function AuthoritativeSourceCard({ source }: AuthoritativeSourceCardProps) {
  const typeConfig = SOURCE_TYPES[source.type];
  const [expandedExamples, setExpandedExamples] = useState<Set<number>>(new Set());
  const hasConfigExamples = source.configExamples && source.configExamples.length > 0;
  const allExamplesExpanded = Boolean(
    source.configExamples?.length && expandedExamples.size === source.configExamples.length,
  );
  const noExamplesExpanded = expandedExamples.size === 0;

  const toggleExample = (index: number) => {
    setExpandedExamples((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (source.configExamples) {
      setExpandedExamples(new Set(source.configExamples.map((_, i) => i)));
    }
  };

  const collapseAll = () => {
    setExpandedExamples(new Set());
  };

  return (
    <div className="p-3 sm:p-4 rounded-lg border border-border bg-card overflow-hidden">
      {/* Header with type badge */}
      <div className="flex items-start gap-2 sm:gap-3">
        <span
          className={`shrink-0 px-2 py-0.5 text-xs font-medium rounded border ${typeConfig.color}`}
        >
          {typeConfig.label}
        </span>
        <div className="flex-1 min-w-0">
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground hover:text-primary hover:underline transition-colors line-clamp-2 break-words"
          >
            {source.title}
            <ExternalLinkIcon className="inline-block w-3.5 h-3.5 ml-1.5 opacity-50" />
          </a>
          {source.section && (
            <span className="text-xs text-muted-foreground ml-2">
              ({source.section})
            </span>
          )}
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm text-muted-foreground mt-3 leading-relaxed break-words">
        {source.summary}
      </p>

      {/* Config Examples */}
      {hasConfigExamples && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
              <CodeIcon className="w-4 h-4 text-muted-foreground" />
              Configuration Examples
              <span className="text-xs text-muted-foreground font-normal">
                ({source.configExamples!.length})
              </span>
            </h4>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={expandAll}
                disabled={allExamplesExpanded}
                aria-label="Expand all configuration examples"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:hover:text-muted-foreground disabled:cursor-not-allowed"
              >
                Expand all
              </button>
              <span className="text-muted-foreground">·</span>
              <button
                type="button"
                onClick={collapseAll}
                disabled={noExamplesExpanded}
                aria-label="Collapse all configuration examples"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:hover:text-muted-foreground disabled:cursor-not-allowed"
              >
                Collapse all
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {source.configExamples!.map((example, index) => (
              <ConfigExampleBlock
                key={index}
                example={example}
                isExpanded={expandedExamples.has(index)}
                onToggle={() => toggleExample(index)}
              />
            ))}
          </div>
        </div>
      )}

      {/* View Source link(s) */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          View source
          <ArrowRightIcon className="w-3 h-3" />
        </a>
        {source.additionalUrls?.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            {link.label}
            <ArrowRightIcon className="w-3 h-3" />
          </a>
        ))}
      </div>
    </div>
  );
}

interface ConfigExampleBlockProps {
  example: ConfigExample;
  isExpanded: boolean;
  onToggle: () => void;
}

function ConfigExampleBlock({ example, isExpanded, onToggle }: ConfigExampleBlockProps) {
  const [copied, setCopied] = useState(false);
  const id = useId();
  const languageLabel = LANGUAGE_LABELS[example.language] || example.language.toUpperCase();
  const presentation = getGoodBadExamplePresentation(example.code);
  const isComparison = presentation.mode === 'comparison';
  const semanticStatus = presentation.mode === 'single-sided' ? presentation.status : null;
  const displayTitle = resolveComparisonTitle(example.title, {
    comparisonTitle: example.comparisonTitle,
    isSemanticExample: presentation.mode !== 'plain',
  });
  const triggerId = `${id}-trigger`;
  const panelId = `${id}-panel`;

  const copyToClipboard = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(example.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = example.code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-md border border-border overflow-hidden">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        id={triggerId}
        className="w-full flex items-center gap-2 px-3 py-2 bg-muted/50 hover:bg-muted transition-colors text-left"
      >
        <ChevronIcon
          className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />
        <span className="min-w-0 flex-1 flex items-center gap-2">
          <span className="text-sm text-foreground truncate">{displayTitle}</span>
          {semanticStatus && (
            <SemanticStatusBadge status={semanticStatus} />
          )}
        </span>
        <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-background text-muted-foreground border border-border">
          {languageLabel}
        </span>
      </button>

      {/* Expandable code block */}
      {isExpanded && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={triggerId}
          className="relative"
        >
          {/* Check if code has GOOD/BAD comparison patterns */}
          {isComparison ? (
            <div className="p-3">
              <GoodBadComparison
                code={example.code}
                language={example.language}
              />
            </div>
          ) : (
            <>
              {/* Highlighted code content */}
              <CodeBlock
                code={example.code}
                language={example.language}
              />

              {/* Copy button */}
              <button
                type="button"
                onClick={copyToClipboard}
                className="absolute top-2 right-2 z-10 p-1.5 rounded bg-neutral-800/80 hover:bg-neutral-700/80 text-neutral-400 hover:text-neutral-200 transition-colors"
                title="Copy to clipboard"
                aria-label="Copy to clipboard"
              >
                {copied ? (
                  <CheckIcon className="w-4 h-4 text-green-500" />
                ) : (
                  <CopyIcon className="w-4 h-4" />
                )}
              </button>
            </>
          )}

          {/* Source citation */}
          {example.source && (
            <div className="px-3 py-2 border-t border-border bg-muted/30">
              <span className="text-xs text-muted-foreground">
                Source:{' '}
                {example.sourceUrl ? (
                  <a href={example.sourceUrl} target="_blank" rel="noopener noreferrer"
                     className="text-primary hover:underline">
                    {example.source}
                  </a>
                ) : (
                  example.source
                )}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SemanticStatusBadge({ status }: { status: 'good' | 'bad' | 'better' }) {
  const config = {
    good: {
      label: 'GOOD',
      className: 'bg-green-500/10 text-green-500 border-green-500/20',
    },
    bad: {
      label: 'BAD',
      className: 'bg-red-500/10 text-red-500 border-red-500/20',
    },
    better: {
      label: 'BETTER',
      className: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    },
  }[status];

  return (
    <span
      className={`shrink-0 inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium tracking-wide ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  );
}

function CodeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}
