import { githubRepoRefUrl } from '@/lib/github-repo-ref';

interface GitHubRepoCardProps {
  owner: string;
  repo: string;
  /** Directory inside the repository, for a project that lives in a monorepo. */
  path?: string;
  description?: string | null;
  language?: string | null;
  stars?: number;
  forks?: number;
  className?: string;
}

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Go: '#00ADD8',
  Rust: '#dea584',
  Java: '#b07219',
  'C#': '#178600',
  'C++': '#f34b7d',
  C: '#555555',
  Ruby: '#701516',
  Shell: '#89e051',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  HCL: '#844FBA',
};

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

export function GitHubRepoCard({
  owner,
  repo,
  path,
  description,
  language,
  stars,
  forks,
  className = '',
}: GitHubRepoCardProps) {
  const url = githubRepoRefUrl({ owner, repo, path });
  // A monorepo project is named by its directory; the repository becomes context.
  const segments = path ? path.split('/') : [];
  const name = segments.length > 0 ? segments[segments.length - 1] : repo;
  const prefix = segments.length > 0 ? `${[owner, repo, ...segments.slice(0, -1)].join('/')}/` : `${owner}/`;
  const summary = description ?? (path ? `Part of the ${owner}/${repo} monorepo.` : null);
  const langColor = language ? (LANGUAGE_COLORS[language] ?? '#858585') : null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group block rounded-lg border border-border bg-card p-4 hover:bg-muted/50 hover:border-primary/50 transition-all ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <GitHubIcon className="w-5 h-5 text-muted-foreground shrink-0" />
          <span className="text-sm truncate">
            <span className="text-muted-foreground">{prefix}</span>
            <span className="font-semibold text-foreground group-hover:text-primary transition-colors">{name}</span>
          </span>
        </div>
        <ExternalLinkIcon className="w-4 h-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Description */}
      {summary && (
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{summary}</p>
      )}

      {/* Stats row */}
      {(language || stars != null || forks != null) && (
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          {language && langColor && (
            <div className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: langColor }}
              />
              <span>{language}</span>
            </div>
          )}
          {stars != null && (
            <div className="flex items-center gap-1">
              <StarIcon className="w-3.5 h-3.5" />
              <span>{formatCount(stars)}</span>
            </div>
          )}
          {forks != null && (
            <div className="flex items-center gap-1">
              <ForkIcon className="w-3.5 h-3.5" />
              <span>{formatCount(forks)}</span>
            </div>
          )}
        </div>
      )}
    </a>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  );
}

function ForkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
    </svg>
  );
}
