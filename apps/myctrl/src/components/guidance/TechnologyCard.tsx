import type { TechnologyGuide } from '@/data/types';
import { getTechnologyPath } from '@/data/technology-guides';

interface TechnologyCardProps {
  technology: TechnologyGuide;
}

export function TechnologyCard({ technology }: TechnologyCardProps) {
  const sourceCount = technology.authoritativeSources.length;
  const commandCount = technology.commands.length;
  const frameworkCount = technology.controlMappings.length;

  return (
    <a
      href={getTechnologyPath(technology)}
      className="group block p-5 rounded-lg border border-border bg-card hover:bg-muted/50 hover:border-primary/50 transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg group-hover:text-primary transition-colors truncate">
              {technology.name}
            </h3>
            {technology.vendor && (
              <span className="text-xs text-muted-foreground shrink-0">
                by {technology.vendor}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {technology.description}
          </p>
        </div>
        <ArrowRightIcon className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <BookIcon className="w-3.5 h-3.5" />
          <span>{sourceCount} {sourceCount === 1 ? 'source' : 'sources'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TerminalIcon className="w-3.5 h-3.5" />
          <span>{commandCount} {commandCount === 1 ? 'command' : 'commands'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <LinkIcon className="w-3.5 h-3.5" />
          <span>{frameworkCount} {frameworkCount === 1 ? 'framework' : 'frameworks'}</span>
        </div>
      </div>
    </a>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}
