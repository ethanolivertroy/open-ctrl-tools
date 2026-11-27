/**
 * HeroStats - Credibility stats display for the homepage hero section
 *
 * Shows the total number of controls and frameworks with source attribution.
 * Stats are clickable and link to /all page for browsing all frameworks.
 */

interface HeroStatsProps {
  totalItems: number;
  frameworkCount: number;
}

export function HeroStats({ totalItems, frameworkCount }: HeroStatsProps) {
  return (
    <div className="text-center space-y-2">
      {/* Stats row - clickable link to /all */}
      <a
        href="/all"
        className="inline-flex items-center justify-center gap-2 text-sm md:text-base hover:text-primary transition-colors cursor-pointer group"
      >
        <span>
          <span className="font-semibold text-foreground group-hover:text-primary transition-colors">{totalItems.toLocaleString()}+</span>
          <span className="text-muted-foreground group-hover:text-foreground/70 transition-colors ml-1">controls</span>
        </span>
        <span className="text-muted-foreground">·</span>
        <span>
          <span className="font-semibold text-foreground group-hover:text-primary transition-colors">{frameworkCount}+</span>
          <span className="text-muted-foreground group-hover:text-foreground/70 transition-colors ml-1">frameworks</span>
        </span>
        <svg
          className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </a>

      {/* Attribution line */}
      <p className="text-xs md:text-sm text-muted-foreground">
        Data from NIST, PCI SSC, DISA, CIS, ISO, and more
      </p>
    </div>
  );
}
