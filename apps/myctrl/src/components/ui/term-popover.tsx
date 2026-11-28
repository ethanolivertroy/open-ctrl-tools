import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@ui-sdk/react/popover';
import type { GlossaryTerm } from '@/data/fedramp-20x-glossary';

interface TermPopoverProps {
  term: string | GlossaryTerm;
  children: React.ReactNode;
}

export function TermPopover({ term, children }: TermPopoverProps) {
  const isEntry = typeof term !== 'string';

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Define term ${String(children)}`}
        className="inline-flex items-center px-2 py-0.5 text-xs font-mono rounded bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors cursor-pointer"
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        sideOffset={6}
        className="z-50 w-72 rounded-md border border-border bg-card p-3 shadow-lg text-foreground transition-all data-[ending]:opacity-0 data-[starting]:opacity-0"
      >
        {isEntry ? (
          <div className="space-y-1.5">
            <div className="font-mono text-xs font-semibold text-primary">{term.term}</div>
            <p className="text-xs leading-relaxed text-foreground">{term.definition}</p>
            {term.note && (
              <p className="text-[11px] leading-relaxed text-muted-foreground border-t border-border/60 pt-1">
                {term.note}
              </p>
            )}
            {term.referenceUrl && (
              <a
                href={term.referenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-[11px] font-mono text-primary hover:underline"
              >
                {term.reference || 'Reference'} &rarr;
              </a>
            )}
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-foreground">{term}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
