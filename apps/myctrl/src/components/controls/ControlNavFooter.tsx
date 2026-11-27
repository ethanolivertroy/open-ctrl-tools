import type { ControlNeighbors, ControlNeighbor } from '@/data/controls';
import type { NavigationScope } from '@/lib/storage/settings-store';

interface ControlNavFooterProps {
  neighbors: ControlNeighbors;
  frameworkId: string;
  family: string;
  familyLabel: string;
  basePath: string;
  controlTerm: string;
  scope: NavigationScope;
  onScopeChange: (newScope: NavigationScope) => void;
}

export function ControlNavFooter({ neighbors, frameworkId, family, familyLabel, basePath, controlTerm, scope, onScopeChange }: ControlNavFooterProps) {
  const prev = scope === 'family' ? neighbors.prevFamily : neighbors.prev;
  const next = scope === 'family' ? neighbors.nextFamily : neighbors.next;
  const hasFamilyNav = neighbors.prevFamily !== null || neighbors.nextFamily !== null;

  return (
    <footer className="pt-8 border-t border-border space-y-4">
      {/* Prev / Next navigation */}
      {(prev || next) && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            {prev ? (
              <NavLink neighbor={prev} direction="prev" />
            ) : (
              <div />
            )}
          </div>
          <div className="text-right">
            {next ? (
              <NavLink neighbor={next} direction="next" />
            ) : (
              <div />
            )}
          </div>
        </div>
      )}

      {/* Bottom row */}
      <div className="flex items-center justify-between text-sm">
        <a
          href={`${basePath}/${frameworkId}`}
          className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
        >
          <span>←</span>
          <span>Back to all {controlTerm}</span>
        </a>

        {hasFamilyNav && (
          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={() => onScopeChange('all')}
              className={`px-2 py-1 rounded transition-colors ${scope === 'all' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              All
            </button>
            <button
              onClick={() => onScopeChange('family')}
              className={`px-2 py-1 rounded transition-colors ${scope === 'family' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {familyLabel} only
            </button>
          </div>
        )}

        <span className="text-muted-foreground font-mono text-xs">
          {familyLabel} {family}
        </span>
      </div>
    </footer>
  );
}

function NavLink({ neighbor, direction }: { neighbor: ControlNeighbor; direction: 'prev' | 'next' }) {
  const isPrev = direction === 'prev';
  return (
    <a
      href={neighbor.url}
      className={`group block p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/50 transition-all ${isPrev ? '' : 'text-right'}`}
    >
      <span className="text-xs text-muted-foreground">{isPrev ? 'Previous' : 'Next'}</span>
      <div className={`flex items-center gap-1.5 mt-1 ${isPrev ? '' : 'justify-end'}`}>
        {isPrev && <span className="text-muted-foreground group-hover:text-foreground transition-colors">←</span>}
        <span className="text-sm font-mono truncate">{neighbor.controlId}</span>
        {!isPrev && <span className="text-muted-foreground group-hover:text-foreground transition-colors">→</span>}
      </div>
      <div className="text-xs text-muted-foreground truncate mt-0.5">{neighbor.title}</div>
    </a>
  );
}
