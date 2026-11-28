import * as React from 'react';
import {
  getAllFrameworkIds,
  getBasePath,
  getFrameworkConfig,
} from '@/data/framework-configs';
import {
  loadFrameworkDataset,
  loadFrameworkManifest,
} from '@/lib/client-framework-data';
import { slugifyControlId as slugify } from '@/lib/slugify';

export interface SidebarInitialData {
  frameworkId: string;
  name: string;
  version: string;
  basePath: string;
  loaded: boolean;
  families: Record<string, string>;
  controls: Array<{ control_id: string; title: string; family: string }>;
}

interface SidebarProps {
  frameworkId?: string;
  initialData?: SidebarInitialData;
}

const QUICK_NAV = [
  { href: '/all', label: 'All Frameworks' },
  { href: '/compare', label: 'Compare' },
  { href: '/crosswalk', label: 'Crosswalks' },
  { href: '/assess', label: 'Gap Analysis' },
];

const CATEGORY_PILLS = [
  { href: '/us-federal', label: 'Federal', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20' },
  { href: '/ai', label: 'AI', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20' },
  { href: '/privacy', label: 'Privacy', color: 'bg-pink-500/10 text-pink-400 border-pink-500/30 hover:bg-pink-500/20' },
  { href: '/international', label: 'Intl', color: 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20' },
  { href: '/owasp', label: 'OWASP', color: 'bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20' },
];

function sortFamilyCodes(codes: string[]): string[] {
  return [...codes].sort((a, b) => {
    const aNum = parseInt(a, 10);
    const bNum = parseInt(b, 10);
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    return a.localeCompare(b);
  });
}

export default function Sidebar({ frameworkId, initialData }: SidebarProps) {
  const frameworkIds = React.useMemo(() => getAllFrameworkIds(), []);

  const [activeFramework] = React.useState<string>(() => {
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

  const [dataset, setDataset] = React.useState<SidebarInitialData | null>(() => {
    if (initialData && initialData.frameworkId === activeFramework) {
      return initialData;
    }
    return null;
  });
  const [expandedFamily, setExpandedFamily] = React.useState<string | null>(null);
  const [currentPath] = React.useState(() =>
    typeof window !== 'undefined' ? window.location.pathname : '',
  );

  const [focusedIndex, setFocusedIndex] = React.useState(-1);
  const linkRefs = React.useRef<(HTMLAnchorElement | null)[]>([]);
  const activeControlRef = React.useRef<HTMLAnchorElement | null>(null);

  React.useEffect(() => {
    if (initialData && initialData.frameworkId === activeFramework) {
      setDataset(initialData);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const manifest = await loadFrameworkManifest();
        const entry = manifest.frameworks.find((fw) => fw.id === activeFramework);
        if (!entry || !entry.loaded) {
          if (!cancelled) {
            const cfg = getFrameworkConfig(activeFramework);
            setDataset({
              frameworkId: activeFramework,
              name: cfg.name,
              version: cfg.version,
              basePath: getBasePath(activeFramework),
              loaded: false,
              families: {},
              controls: [],
            });
          }
          return;
        }
        const loaded = await loadFrameworkDataset(activeFramework);
        if (!cancelled) {
          setDataset({
            frameworkId: activeFramework,
            name: loaded.config.name,
            version: loaded.config.version,
            basePath: loaded.basePath,
            loaded: true,
            families: loaded.families,
            controls: loaded.controls.map((c) => ({
              control_id: c.control_id,
              title: c.title,
              family: c.family,
            })),
          });
        }
      } catch {
        // Leave sidebar empty on transient fetch errors.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeFramework, initialData]);

  const toggleFamily = (family: string) => {
    setExpandedFamily((prev) => (prev === family ? null : family));
  };

  React.useEffect(() => {
    const handleNavigateList = (e: CustomEvent<{ direction: 'next' | 'prev' }>) => {
      const links = linkRefs.current.filter(Boolean) as HTMLAnchorElement[];
      if (links.length === 0) return;

      setFocusedIndex((prev) => {
        const next =
          e.detail.direction === 'next'
            ? prev < links.length - 1
              ? prev + 1
              : 0
            : prev > 0
              ? prev - 1
              : links.length - 1;
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

  const config = getFrameworkConfig(activeFramework);
  const basePath = dataset?.basePath || getBasePath(activeFramework);
  const controlsList = dataset?.controls ?? [];
  const familyNames = dataset?.families ?? {};

  const controlsByFamily = React.useMemo(() => {
    const grouped = new Map<string, Array<{ control_id: string; title: string; family: string }>>();
    for (const c of controlsList) {
      const arr = grouped.get(c.family);
      if (arr) arr.push(c);
      else grouped.set(c.family, [c]);
    }
    return grouped;
  }, [controlsList]);

  const families = React.useMemo(
    () => sortFamilyCodes(Array.from(controlsByFamily.keys())),
    [controlsByFamily],
  );

  const hasAutoExpanded = React.useRef(false);
  React.useEffect(() => {
    if (typeof window === 'undefined' || hasAutoExpanded.current || families.length === 0) return;
    const match = window.location.pathname.match(/\/(frameworks|risk-lists)\/[^\/]+\/([^\/]+)$/);
    if (!match) return;
    const slug = match[2];

    for (const family of families) {
      const controls = controlsByFamily.get(family) || [];
      if (controls.some((c) => slugify(c.control_id) === slug)) {
        setExpandedFamily(family);
        hasAutoExpanded.current = true;
        break;
      }
    }
  }, [controlsByFamily, families]);

  React.useEffect(() => {
    if (activeControlRef.current) {
      const timer = setTimeout(() => {
        activeControlRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [expandedFamily]);

  const isFlatList =
    families.length > 0 && families.every((f) => (controlsByFamily.get(f)?.length ?? 0) === 1);

  let linkIndex = 0;

  return (
    <nav className="space-y-1" aria-label="Framework navigation">
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

      <div className="mb-4 pb-2 border-b border-border">
        <a
          href={`${basePath}/${activeFramework}`}
          className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
        >
          {config.name}
        </a>
        <span className="ml-2 text-xs text-muted-foreground">v{config.version}</span>
        {dataset && !dataset.loaded && (
          <p className="text-xs text-muted-foreground mt-1">
            External reference — see official source or local overlay.
          </p>
        )}
      </div>

      {isFlatList ? (
        <div className="space-y-0.5">
          {controlsList.map((control) => {
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
        <>
          <div className="mb-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {config.familyLabel.endsWith('y')
                ? config.familyLabel.slice(0, -1) + 'ies'
                : config.familyLabel + 's'}
            </span>
          </div>

          {families.map((family) => {
            const controls = controlsByFamily.get(family) || [];
            const isExpanded = expandedFamily === family;
            const familyName = familyNames[family] || family;

            return (
              <div key={family} className="space-y-1">
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
                    <ChevronIcon
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        isExpanded ? 'rotate-90' : ''
                      }`}
                    />
                  </button>
                </div>

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
