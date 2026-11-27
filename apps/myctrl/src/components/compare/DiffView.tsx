import { useMemo } from 'react';
import { computeDiff, type DiffSegment } from '../../lib/text-diff';
import { useSyncScroll } from '../../hooks/useSyncScroll';
import type { Control, FrameworkConfig } from '../../data/types';

interface DiffViewProps {
  controlA: Control;
  controlB: Control;
  configA: FrameworkConfig;
  configB: FrameworkConfig;
}

export function DiffView({ controlA, controlB, configA, configB }: DiffViewProps) {
  const { leftRef, rightRef } = useSyncScroll();

  const descriptionDiff = useMemo(
    () => computeDiff(controlA.description || '', controlB.description || ''),
    [controlA.description, controlB.description]
  );

  return (
    <div className="space-y-4">
      {descriptionDiff.truncated && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Text was truncated to 10,000 characters for diff comparison.
        </p>
      )}

      {/* Column Headers */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-xs font-mono bg-primary/10 text-primary rounded">
            {configA.name}
          </span>
          <span className="text-sm font-semibold">{controlA.control_id}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-xs font-mono bg-primary/10 text-primary rounded">
            {configB.name}
          </span>
          <span className="text-sm font-semibold">{controlB.control_id}</span>
        </div>
      </div>

      {/* Description Diff */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Description
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            ref={leftRef}
            className="rounded-lg border border-border bg-card p-4 max-h-96 overflow-y-auto text-sm leading-relaxed"
          >
            <DiffSegments segments={descriptionDiff.left} side="left" />
          </div>
          <div
            ref={rightRef}
            className="rounded-lg border border-border bg-card p-4 max-h-96 overflow-y-auto text-sm leading-relaxed"
          >
            <DiffSegments segments={descriptionDiff.right} side="right" />
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-red-500/20 border border-red-500/30" />
          Removed
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30" />
          Added
        </span>
      </div>
    </div>
  );
}

function DiffSegments({ segments, side }: { segments: DiffSegment[]; side: 'left' | 'right' }) {
  if (segments.length === 0) {
    return <span className="text-muted-foreground italic">No content</span>;
  }

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'equal') {
          return <span key={i}>{seg.text}</span>;
        }
        if (seg.type === 'delete' && side === 'left') {
          return (
            <span
              key={i}
              className="bg-red-500/20 text-red-900 dark:text-red-300 rounded-sm px-0.5"
            >
              {seg.text}
            </span>
          );
        }
        if (seg.type === 'insert' && side === 'right') {
          return (
            <span
              key={i}
              className="bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 rounded-sm px-0.5"
            >
              {seg.text}
            </span>
          );
        }
        return null;
      })}
    </>
  );
}
