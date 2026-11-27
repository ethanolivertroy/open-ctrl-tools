import * as React from 'react';
import {
  getAllFamilies,
  getAllControls,
  getControlsByFamily,
  getFamilyName,
  slugify,
  getAllFrameworkIds,
  getFrameworkConfig,
  getBasePath,
  hasFrameworkData,
} from '@/data/controls';

interface SidebarProps {
  frameworkId?: string;
}

// Quick-access navigation links shown above the framework controls
const QUICK_NAV = [
  { href: '/all', label: 'All Frameworks' },
  { href: '/compare', label: 'Compare' },
  { href: '/crosswalk', label: 'Crosswalks' },
  { href: '/assess', label: 'Gap Analysis' },
  { href: '/graph', label: 'Knowledge Graph' },
];

const CATEGORY_PILLS = [
  { href: '/us-federal', label: 'Federal', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20' },
  { href: '/ai', label: 'AI', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20' },
  { href: '/enterprise', label: 'Enterprise', color: 'bg-teal-500/10 text-teal-400 border-teal-500/30 hover:bg-teal-500/20' },
  { href: '/privacy', label: 'Privacy', color: 'bg-pink-500/10 text-pink-400 border-pink-500/30 hover:bg-pink-500/20' },
  { href: '/international', label: 'Intl', color: 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20' },
  { href: '/owasp', label: 'OWASP', color: 'bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20' },
];

export default function Sidebar({ frameworkId }: SidebarProps) {
  const frameworkIds = getAllFrameworkIds();

  // Use prop if provided (from Astro SSR), otherwise parse URL client-side
  const [activeFramework, setActiveFramework] = React.useState<string>(() => {
    if (frameworkId && frameworkIds.includes(frameworkId)) {
      return frameworkId;
    }
    if (typeof window === 'undefined') return 'nist-800-53-r5';
    const match = window.location.pathname.match(/\/(frameworks|risk-lists)\/([^\/]+)/);
    if (match && frameworkIds.includes(match[2])) {
      return match[2];
    }
    return 'nist-800-53-r5';
  });

  const [expandedFamily, setExpandedFamily] = React.useState<string | null>(null);
  const [currentPath, setCurrentPath] = React.useState(() =>
    typeof window !== 'undefined' ? window.location.pathname : ''
  );

  const [focusedIndex, setFocusedIndex] = React.useState(-1);
  const linkRefs = React.useRef<(HTMLAnchorElement | null)[]>([]);
  const activeControlRef = React.useRef<HTMLAnchorElement | null>(null);

  const toggleFamily = (family: string) => {
    setExpandedFamily(expandedFamily === family ? null : family);
  };

  // Listen for J/K navigation events from keyboard shortcuts
  React.useEffect(() => {
    const handleNavigateList = (e: CustomEvent<{ direction: 'next' | 'prev' }>) => {
      const links = linkRefs.current.filter(Boolean) as HTMLAnchorElement[];
      if (links.length === 0) return;

      setFocusedIndex(prev => {
        let next: number;
        if (e.detail.direction === 'next') {
          next = prev < links.length - 1 ? prev + 1 : 0;
        } else {
          next = prev > 0 ? prev - 1 : links.length - 1;
        }
        links[next]?.scrollIntoView({ block: 'nearest' });
        links[next]?.focus();
        return next;
      });
    };

    document.addEventListener('navigate-list', handleNavigateList as EventListener);
    return () => {
      document.removeEventListener('navigate-list', handleNavigateList as EventListener);
    };
  }, []);

  const families = getAllFamilies(activeFramework);
  const config = getFrameworkConfig(activeFramework);
  const basePath = getBasePath(activeFramework);

  // Auto-expand the family containing the active control (only on initial mount)
  const hasAutoExpanded = React.useRef(false);
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasAutoExpanded.current) return; // Only auto-expand once

    const path = window.location.pathname;
    // Extract control slug from path: /frameworks/nist-800-53-r5/ac-2 -> ac-2
    const controlMatch = path.match(/\/(frameworks|risk-lists)\/[^\/]+\/([^\/]+)$/);
    if (!controlMatch) return;

    const controlSlug = controlMatch[2];

    // Find which family this control belongs to
    for (const family of families) {
      const controls = getControlsByFamily(activeFramework, family);
      const foundControl = controls.find(c => slugify(c.control_id) === controlSlug);
      if (foundControl) {
        setExpandedFamily(family);
        hasAutoExpanded.current = true;
        break;
      }
    }
  }, [activeFramework, families]);

  // Scroll the active control into view after expansion
  React.useEffect(() => {
    if (activeControlRef.current) {
      // Small delay to allow the DOM to render after family expansion
      const timer = setTimeout(() => {
        activeControlRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [expandedFamily]);

  // Detect if all families have only 1 item (show flat list instead of dropdowns)
  const isFlatList = families.every(f => getControlsByFamily(activeFramework, f).length === 1);
  const allControls = isFlatList ? getAllControls(activeFramework) : [];

  // Reset link refs when content changes
  let linkIndex = 0;

  return (
    <nav className="space-y-1">
      {/* Quick navigation links */}
      <div className="mb-3 pb-3 border-b border-border">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Navigate
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {CATEGORY_PILLS.map((cat) => (
            <a
              key={cat.href}
              href={cat.href}
              className={`px-2 py-1 text-xs rounded border ${cat.color} transition-colors`}
            >
              {cat.label}
            </a>
          ))}
        </div>
        <div className="space-y-0.5">
          {QUICK_NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`block px-3 py-1.5 text-sm rounded-md transition-colors ${
                currentPath === item.href
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>

      {/* Current framework header */}
      <div className="mb-4 pb-2 border-b border-border">
        <a
          href={`${basePath}/${activeFramework}`}
          className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
        >
          {config.name}
        </a>
        <span className="ml-2 text-xs text-muted-foreground">v{config.version}</span>
        {!hasFrameworkData(activeFramework) && (
          <p className="text-xs text-muted-foreground mt-1">
            External reference — see official source or local overlay.
          </p>
        )}
      </div>

      {isFlatList ? (
        // Flat list for frameworks where each family has only 1 item (e.g., OWASP Top 10)
        <div className="space-y-0.5">
          {allControls.map((control) => {
            const href = `${basePath}/${activeFramework}/${slugify(control.control_id)}`;
            const isActive = currentPath === href;
            const idx = linkIndex++;

            return (
              <a
                key={control.control_id}
                href={href}
                ref={(el) => {
                  linkRefs.current[idx] = el;
                  if (isActive) activeControlRef.current = el;
                }}
                className={`block px-3 py-2 text-sm rounded-md transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                } ${focusedIndex === idx ? 'ring-2 ring-primary/50' : ''}`}
              >
                <span className="font-mono text-primary text-xs mr-2">{control.control_id}</span>
                <span>{control.title}</span>
              </a>
            );
          })}
        </div>
      ) : (
        // Dropdown pattern for frameworks with multiple items per family (NIST, PCI)
        <>
          <div className="mb-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {config.familyLabel.endsWith('y') ? config.familyLabel.slice(0, -1) + 'ies' : config.familyLabel + 's'}
            </span>
          </div>

          {families.map((family) => {
            const controls = getControlsByFamily(activeFramework, family);
            const isExpanded = expandedFamily === family;
            const familyName = getFamilyName(activeFramework, family);

            return (
              <div key={family} className="space-y-1">
                {/* Family header */}
                <div className="flex items-center">
                  <a
                    href={`${basePath}/${activeFramework}/family/${family.toLowerCase()}`}
                    className="flex items-center gap-2 min-w-0 px-3 py-2 text-sm rounded-l-md hover:bg-muted transition-colors group flex-1"
                    title={`View all ${familyName} ${config.itemLabel}`}
                  >
                    <span className="font-mono text-primary text-xs shrink-0">{family}</span>
                    <span className="text-muted-foreground group-hover:text-foreground text-left truncate">
                      {familyName}
                    </span>
                  </a>
                  <button
                    type="button"
                    onClick={() => toggleFamily(family)}
                    className="flex items-center gap-2 shrink-0 px-2 py-2 text-sm rounded-r-md hover:bg-muted transition-colors"
                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    <span className="text-xs text-muted-foreground">{controls.length}</span>
                    <ChevronIcon className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>
                </div>

                {/* Controls list */}
                {isExpanded && (
                  <div className="ml-4 border-l border-border pl-2 space-y-0.5">
                    {controls.map((control) => {
                      const href = `${basePath}/${activeFramework}/${slugify(control.control_id)}`;
                      const isActive = currentPath === href;
                      const idx = linkIndex++;

                      return (
                        <a
                          key={control.control_id}
                          href={href}
                          ref={(el) => {
                            linkRefs.current[idx] = el;
                            if (isActive) activeControlRef.current = el;
                          }}
                          className={`block px-3 py-1.5 text-sm rounded-md transition-colors ${
                            isActive
                              ? 'bg-primary/10 text-primary border-l-2 border-primary -ml-[2px] pl-[14px]'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          } ${focusedIndex === idx ? 'ring-2 ring-primary/50' : ''}`}
                        >
                          <span className="font-mono text-xs">{control.control_id}</span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </nav>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
