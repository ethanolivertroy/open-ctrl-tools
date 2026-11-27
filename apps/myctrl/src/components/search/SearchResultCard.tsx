import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import type { UnifiedSearchEntry } from '@/data/types';
import { FRAMEWORK_LABELS } from '@/lib/search-constants';

interface SearchResultCardProps {
  entry: UnifiedSearchEntry;
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    control: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    framework: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    guide: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
    crosswalk: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    page: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded border ${colors[type] || ''}`}>
      {type}
    </span>
  );
}

export function SearchResultCard({ entry }: SearchResultCardProps) {
  switch (entry.type) {
    case 'control':
      return (
        <a
          href={entry.href}
          className="block p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-start gap-3">
            <span className="font-mono font-semibold text-sm shrink-0 control-id">
              {entry.id}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{entry.title}</div>
              {entry.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.description}</p>
              )}
              <div className="flex flex-wrap gap-1 mt-1.5">
                <TypeBadge type="control" />
                <Badge variant="outline" className="text-[11px] px-1 py-0">
                  {FRAMEWORK_LABELS[entry.frameworkId] || entry.frameworkId}
                </Badge>
                <Badge variant="outline" className="text-[11px] px-1 py-0">
                  {entry.family}
                </Badge>
                {entry.baselines.map((b) => (
                  <Badge
                    key={b}
                    variant={b.toLowerCase() as 'low' | 'moderate' | 'high' | 'privacy'}
                    className="text-[11px] px-1 py-0"
                  >
                    {b}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </a>
      );

    case 'framework':
      return (
        <a
          href={entry.href}
          className="block p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{entry.title}</div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.description}</p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              <TypeBadge type="framework" />
              {entry.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-[11px] px-1 py-0">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </a>
      );

    case 'guide':
      return (
        <a
          href={entry.href}
          className="block p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">
              {entry.title}
              {entry.vendor && (
                <span className="text-muted-foreground font-normal ml-1">by {entry.vendor}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.description}</p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              <TypeBadge type="guide" />
              <Badge variant="outline" className="text-[11px] px-1 py-0">
                {entry.category}
              </Badge>
            </div>
          </div>
        </a>
      );

    case 'crosswalk':
      return (
        <a
          href={entry.href}
          className="block p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{entry.title}</div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.description}</p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              <TypeBadge type="crosswalk" />
              {entry.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-[11px] px-1 py-0">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </a>
      );

    case 'page':
      return (
        <a
          href={entry.href}
          className="block p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{entry.title}</div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.description}</p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              <TypeBadge type="page" />
            </div>
          </div>
        </a>
      );
  }
}
