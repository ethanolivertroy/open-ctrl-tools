/**
 * KSIRequirements — Displays FRMR requirements (MUST/SHOULD/MAY) for a KSI.
 *
 * Groups requirements by RFC 2119 keyword level with distinct visual treatment:
 * - MUST/MUST NOT: red left-accent cards (mandatory)
 * - SHOULD/SHOULD NOT: amber left-accent cards (recommended)
 * - MAY: blue left-accent cards (optional guidance)
 *
 * Each card uses a 3px left border for severity signaling, with animated
 * expand/collapse for details and typographic hierarchy for scanability.
 */

import * as React from 'react';
import { useState } from 'react';
import { ChevronRightIcon, AlertTriangleIcon, InfoIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { FRMRRequirement, ProcessRequirements } from '@/data/fedramp-20x-requirements';

const KEYWORD_STYLES: Record<string, { badge: string; border: string; divider: string; label: string; icon: typeof AlertTriangleIcon }> = {
  'MUST': {
    badge: 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30',
    border: 'border-l-red-500/70',
    divider: 'bg-red-500/20',
    label: 'text-red-700 dark:text-red-400',
    icon: AlertTriangleIcon,
  },
  'MUST NOT': {
    badge: 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30',
    border: 'border-l-red-500/70',
    divider: 'bg-red-500/20',
    label: 'text-red-700 dark:text-red-400',
    icon: AlertTriangleIcon,
  },
  'SHOULD': {
    badge: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30',
    border: 'border-l-amber-500/70',
    divider: 'bg-amber-500/20',
    label: 'text-amber-700 dark:text-amber-400',
    icon: InfoIcon,
  },
  'SHOULD NOT': {
    badge: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30',
    border: 'border-l-amber-500/70',
    divider: 'bg-amber-500/20',
    label: 'text-amber-700 dark:text-amber-400',
    icon: InfoIcon,
  },
  'MAY': {
    badge: 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30',
    border: 'border-l-blue-500/70',
    divider: 'bg-blue-500/20',
    label: 'text-blue-700 dark:text-blue-400',
    icon: InfoIcon,
  },
};

function getKeywordStyle(keyword: string) {
  return KEYWORD_STYLES[keyword] || KEYWORD_STYLES['MAY'];
}

/** Bold RFC 2119 keywords in statement text. */
function highlightKeywords(text: string): React.ReactNode {
  const keywords = ['MUST NOT', 'MUST', 'SHOULD NOT', 'SHOULD', 'MAY'];
  const regex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (keywords.includes(part)) {
      return <strong key={i} className="font-semibold">{part}</strong>;
    }
    return part;
  });
}

/** Show a compact note when the requirement keyword varies by impact level. */
function VariesByLevelNote({ variesByLevel, currentKeyword }: {
  variesByLevel: Record<string, any>;
  currentKeyword: string;
}) {
  const levels = ['low', 'moderate', 'high'] as const;
  const keywords = levels.map((level) => ({
    level,
    keyword: variesByLevel[level]?.primary_key_word as string | undefined,
  })).filter((l) => l.keyword);

  // Only show if keywords actually differ across levels
  const uniqueKeywords = new Set(keywords.map((k) => k.keyword));
  if (uniqueKeywords.size <= 1) return null;

  return (
    <div className="text-xs px-2 py-1 rounded bg-muted/50 text-muted-foreground border border-border/50">
      <span className="font-medium">Varies by level:</span>{' '}
      {keywords.map((k, i) => (
        <span key={k.level}>
          {i > 0 && ' · '}
          <span className="capitalize">{k.level}</span>{' '}
          <span className={`font-semibold ${k.keyword === 'MUST' || k.keyword === 'MUST NOT' ? 'text-red-600 dark:text-red-400' : k.keyword === 'SHOULD' || k.keyword === 'SHOULD NOT' ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}>
            {k.keyword}
          </span>
        </span>
      ))}
    </div>
  );
}

function RequirementCard({ req }: { req: FRMRRequirement }) {
  const [showDetails, setShowDetails] = useState(false);
  const style = getKeywordStyle(req.keyword);
  const hasDetails = (req.followingInformation && req.followingInformation.length > 0) || (req.notes && req.notes.length > 0);

  return (
    <div className={`relative rounded-lg border border-border/60 border-l-[3px] ${style.border} bg-card p-4 shadow-sm hover:shadow-md hover:translate-x-0.5 transition-all duration-200`}>
      {/* Top row: badge + title, ID floated right */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-xs shrink-0 ${style.badge}`}>
              {req.keyword}
            </Badge>
            {req.name && (
              <h4 className="text-base font-semibold leading-snug">{req.name}</h4>
            )}
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed">
            {highlightKeywords(req.statement)}
          </p>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground/50 shrink-0 pt-0.5">
          {req.id}
        </span>
      </div>

      {req.variesByLevel && (
        <div className="mt-3">
          <VariesByLevelNote variesByLevel={req.variesByLevel} currentKeyword={req.keyword} />
        </div>
      )}

      {/* Actor tags */}
      {req.affects.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {req.affects.map((a) => (
            <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground border border-border/40 transition-colors">
              {a}
            </span>
          ))}
        </div>
      )}

      {/* Expandable details — animated */}
      {hasDetails && (
        <>
          <div className="border-t border-dashed border-border/40 mt-3 pt-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRightIcon
                className={`w-3.5 h-3.5 transition-transform duration-200 ${showDetails ? 'rotate-90' : ''}`}
              />
              <span>More context</span>
            </button>
          </div>
          <div
            className={`grid transition-all duration-200 ${showDetails ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0'}`}
          >
            <div className="overflow-hidden">
              <div className="space-y-2 text-xs text-muted-foreground">
                {req.followingInformation && req.followingInformation.length > 0 && (
                  <ul className="list-disc ml-4 space-y-0.5">
                    {req.followingInformation.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}
                {req.notes && req.notes.length > 0 && (
                  <div className="space-y-1 italic">
                    {req.notes.map((note, i) => (
                      <p key={i}>{note}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Typographic section divider with severity-colored label and count. */
function SectionDivider({ label, count, style }: {
  label: string;
  count: number;
  style: { divider: string; label: string };
}) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <div className={`h-px flex-1 ${style.divider}`} />
      <span className={`font-medium uppercase tracking-wider ${style.label}`}>
        {label}
      </span>
      <span className="text-muted-foreground">{count}</span>
      <div className={`h-px flex-1 ${style.divider}`} />
    </div>
  );
}

interface KSIRequirementsProps {
  requirements: ProcessRequirements;
}

export function KSIRequirements({ requirements }: KSIRequirementsProps) {
  // Group by keyword level
  const mustReqs = requirements.requirements.filter(r => r.keyword === 'MUST' || r.keyword === 'MUST NOT');
  const shouldReqs = requirements.requirements.filter(r => r.keyword === 'SHOULD' || r.keyword === 'SHOULD NOT');
  const mayReqs = requirements.requirements.filter(r => r.keyword === 'MAY');
  const otherReqs = requirements.requirements.filter(r =>
    !['MUST', 'MUST NOT', 'SHOULD', 'SHOULD NOT', 'MAY'].includes(r.keyword)
  );

  const totalCount = requirements.requirements.length;

  return (
    <section className="space-y-5">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <span className="text-primary">{'>'}</span>
        FRMR Requirements
        <Badge variant="outline" className="text-xs font-normal">
          {totalCount}
        </Badge>
      </h2>
      <p className="text-sm text-muted-foreground">
        Normative requirements from the FedRAMP Requirements and Recommendations document —
        <span className="text-red-600 dark:text-red-400 font-medium"> {requirements.counts.MUST + requirements.counts['MUST NOT']} mandatory</span>,{' '}
        <span className="text-amber-600 dark:text-amber-400 font-medium">{requirements.counts.SHOULD + requirements.counts['SHOULD NOT']} recommended</span>
        {requirements.counts.MAY > 0 && (
          <>, <span className="text-blue-600 dark:text-blue-400 font-medium">{requirements.counts.MAY} optional</span></>
        )}.
      </p>

      {/* MUST / MUST NOT */}
      {mustReqs.length > 0 && (
        <div className="space-y-3">
          <SectionDivider
            label="Mandatory"
            count={mustReqs.length}
            style={KEYWORD_STYLES['MUST']}
          />
          {mustReqs.map((req) => (
            <RequirementCard key={req.id} req={req} />
          ))}
        </div>
      )}

      {/* SHOULD / SHOULD NOT */}
      {shouldReqs.length > 0 && (
        <div className="space-y-3">
          <SectionDivider
            label="Recommended"
            count={shouldReqs.length}
            style={KEYWORD_STYLES['SHOULD']}
          />
          {shouldReqs.map((req) => (
            <RequirementCard key={req.id} req={req} />
          ))}
        </div>
      )}

      {/* MAY — collapsed by default */}
      {mayReqs.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRightIcon className="w-4 h-4 transition-transform duration-200 group-open:rotate-90" />
            <span>{mayReqs.length} optional guidance (MAY)</span>
          </summary>
          <div className="mt-3 space-y-3">
            <SectionDivider
              label="Optional Guidance"
              count={mayReqs.length}
              style={KEYWORD_STYLES['MAY']}
            />
            {mayReqs.map((req) => (
              <RequirementCard key={req.id} req={req} />
            ))}
          </div>
        </details>
      )}

      {/* Other (unknown keyword) */}
      {otherReqs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-xs">
            <div className="h-px flex-1 bg-border" />
            <span className="font-medium text-muted-foreground uppercase tracking-wider">Other</span>
            <span className="text-muted-foreground">{otherReqs.length}</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          {otherReqs.map((req) => (
            <RequirementCard key={req.id} req={req} />
          ))}
        </div>
      )}
    </section>
  );
}
