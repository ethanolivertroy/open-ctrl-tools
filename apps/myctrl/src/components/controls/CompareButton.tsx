interface CompareButtonProps {
  frameworkId: string;
  controlSlug: string;
  compareWith?: {
    frameworkId: string;
    controlSlug: string;
  };
  size?: 'sm' | 'md';
}

export function CompareButton({
  frameworkId,
  controlSlug,
  compareWith,
  size = 'md',
}: CompareButtonProps) {
  const slots = compareWith
    ? `${frameworkId}:${controlSlug},${compareWith.frameworkId}:${compareWith.controlSlug}`
    : `${frameworkId}:${controlSlug}`;
  const href = `/compare/controls?c=${slots}`;

  const sizeClasses = size === 'sm'
    ? 'px-1.5 py-0.5 text-xs gap-1'
    : 'px-2.5 py-1 text-xs gap-1.5';

  return (
    <a
      href={href}
      className={`inline-flex items-center ${sizeClasses} rounded border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors`}
      title="Compare this control"
      aria-label="Compare this control"
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
      </svg>
      Compare
    </a>
  );
}
