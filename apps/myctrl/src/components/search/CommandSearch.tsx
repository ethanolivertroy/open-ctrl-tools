import * as React from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { applyTheme, THEMES, type Theme } from '@/lib/theme';
import { requestOpenAIChat } from '@/lib/ai-chat-events';
import { Mic, Palette, ArrowRight } from 'lucide-react';
import type { FilterPreset } from '@/lib/db';
import type { SearchEntry, FrameworkSearchEntry } from '@/data/types';
import { getPresets, savePreset, deletePreset } from '@/lib/storage/filter-preset-store';
import { getFavorites } from '@/lib/storage/favorites-store';
import { downloadFile } from '@/lib/export';
import type { SearchCacheStatus } from '@/lib/search/analytics';
import {
  trackSearchQueryExecuted,
  trackSearchSurfaceReady,
} from '@/lib/search/analytics';
import { normalizeControlId } from '@/lib/search/control-id';
import { loadControlSearchResources } from '@/lib/search/precomputed-search';
import {
  CATEGORY_PREFIX_MAP,
  FRAMEWORK_LABELS,
  CATEGORY_FILTERS,
  parseSearchQuery,
} from '@/lib/search-constants';

// Dedup grouping type
interface GroupedResult {
  primaryEntry: SearchEntry;
  allEntries: SearchEntry[];
  normalizedId: string;
}

// Normalize control ID for matching (removes dashes, parens, dots, lowercases)
function normalizeId(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Check if query looks like a control ID
function looksLikeControlId(query: string): boolean {
  // Matches patterns like: AC-2, AC2, ac-2(1), SC-7-3, 1.1.1, etc.
  return /^[a-z]{2,3}[-\s]?\d+/i.test(query.trim()) || /^\d+\.\d+/i.test(query.trim());
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

// Helper to determine if a control ID is a base control (no enhancement number in parentheses)
function isBaseControl(controlId: string): boolean {
  return !controlId.includes('(');
}

// Find direct match for control ID
function findDirectMatch(query: string, entries: SearchEntry[]): SearchEntry | undefined {
  const normalized = normalizeId(query);
  return entries.find(e => normalizeId(e.id) === normalized);
}

interface CommandSearchProps {
  contextFrameworkId?: string;
}

export function CommandSearch({ contextFrameworkId }: CommandSearchProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);
  const [presets, setPresets] = React.useState<FilterPreset[]>([]);
  const [favorites, setFavorites] = React.useState<string[]>([]);
  const [showSaveDialog, setShowSaveDialog] = React.useState(false);
  const [presetName, setPresetName] = React.useState('');
  const [searchTimeMs, setSearchTimeMs] = React.useState<number | null>(null);
  const lastSearchTimeRef = React.useRef<number | null>(null);
  const [contextScope, setContextScope] = React.useState<string | null>(contextFrameworkId || null);
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());
  const [searchResources, setSearchResources] = React.useState<Awaited<ReturnType<typeof loadControlSearchResources>> | null>(null);
  const [isLoadingSearch, setIsLoadingSearch] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const isMountedRef = React.useRef(true);
  const firstOpenStartedAtRef = React.useRef<number | null>(null);
  const firstOpenCacheStatusRef = React.useRef<SearchCacheStatus | undefined>(undefined);
  const hasTrackedSurfaceReadyRef = React.useRef(false);
  const hasTrackedFirstQueryRef = React.useRef(false);

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const ensureSearchResources = React.useCallback(() => {
    if (searchResources || isLoadingSearch) return;

    setIsLoadingSearch(true);
    setSearchError(null);

    void loadControlSearchResources()
      .then((resources) => {
        if (isMountedRef.current) {
          setSearchResources(resources);
        }
      })
      .catch(() => {
        if (isMountedRef.current) {
          setSearchError('Search index failed to load.');
        }
      })
      .finally(() => {
        if (isMountedRef.current) {
          setIsLoadingSearch(false);
        }
      });
  }, [isLoadingSearch, searchResources]);

  const openSearch = React.useCallback(() => {
    if (firstOpenStartedAtRef.current === null) {
      firstOpenStartedAtRef.current = now();
      firstOpenCacheStatusRef.current = searchResources ? 'warm' : 'cold';
    }

    ensureSearchResources();
    setOpen(true);
  }, [ensureSearchResources, searchResources]);

  // Reset expanded groups when query changes
  React.useEffect(() => {
    setExpandedGroups(new Set());
  }, [query]);

  const toggleExpand = (normalizedId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(normalizedId)) next.delete(normalizedId);
      else next.add(normalizedId);
      return next;
    });
  };

  // Load presets and favorites on mount
  React.useEffect(() => {
    getPresets().then(setPresets);
    getFavorites().then(setFavorites);
  }, []);

  // Toggle category filter
  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  // Clear all filters
  const clearFilters = () => setSelectedCategories([]);

  // Apply preset
  const applyPreset = (preset: FilterPreset) => {
    setSelectedCategories(preset.categories);
    setQuery(preset.searchTerm);
  };

  // Save current as preset
  const saveCurrentAsPreset = async () => {
    if (!presetName.trim()) return;
    const newPreset = await savePreset({
      name: presetName.trim(),
      categories: selectedCategories,
      searchTerm: query,
    });
    setPresets([...presets, newPreset]);
    setPresetName('');
    setShowSaveDialog(false);
  };

  // Delete preset
  const handleDeletePreset = async (id: string) => {
    await deletePreset(id);
    setPresets(presets.filter(p => p.id !== id));
  };

  // Get all framework IDs from selected categories
  const selectedFrameworks = React.useMemo(() => {
    if (selectedCategories.length === 0) return [];
    const frameworks = new Set<string>();
    for (const categoryId of selectedCategories) {
      const categoryFrameworks = CATEGORY_PREFIX_MAP[categoryId];
      if (categoryFrameworks) {
        categoryFrameworks.forEach(f => frameworks.add(f));
      }
    }
    return Array.from(frameworks);
  }, [selectedCategories]);

  // Listen for custom open-search / open-command-search events
  React.useEffect(() => {
    const handleOpenSearch = () => {
      openSearch();
    };
    document.addEventListener('open-search', handleOpenSearch);
    window.addEventListener('open-command-search', handleOpenSearch);
    return () => {
      document.removeEventListener('open-search', handleOpenSearch);
      window.removeEventListener('open-command-search', handleOpenSearch);
    };
  }, [openSearch]);

  React.useEffect(() => {
    if (open) {
      ensureSearchResources();
    }
  }, [ensureSearchResources, open]);

  // Listen for Cmd+K / Ctrl+K and "/" (open popup)
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (open) {
          setOpen(false);
        } else {
          openSearch();
        }
      }
      // "/" key (when not in an input) - but not "?" (Shift+/)
      if (e.key === '/' && !e.shiftKey && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        openSearch();
      }
      // Close on Escape
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [openSearch]);

  // Listen for two-finger tap to open search (mobile gesture)
  React.useEffect(() => {
    let touchStartTime = 0;
    let initialTouchCount = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        touchStartTime = Date.now();
        initialTouchCount = 2;
      }
    };

    const handleTouchEnd = () => {
      // Quick tap (< 300ms) with exactly 2 fingers opens search
      if (initialTouchCount === 2 && Date.now() - touchStartTime < 300) {
        openSearch();
      }
      initialTouchCount = 0;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [openSearch]);

  React.useEffect(() => {
    if (hasTrackedSurfaceReadyRef.current || !searchResources || firstOpenStartedAtRef.current === null) {
      return;
    }

    hasTrackedSurfaceReadyRef.current = true;
    trackSearchSurfaceReady({
      surface: 'command',
      durationMs: now() - firstOpenStartedAtRef.current,
      cacheStatus: firstOpenCacheStatusRef.current,
    });
  }, [open, searchResources]);

  // Handle Enter key for direct navigation
  React.useEffect(() => {
    const handleEnter = (e: KeyboardEvent) => {
      if (!open || e.key !== 'Enter') return;
      if (!searchResources) return;

      // Check for direct control ID match
      if (query.trim() && looksLikeControlId(query)) {
        const directMatch = findDirectMatch(query, searchResources.entries);
        if (directMatch) {
          e.preventDefault();
          handleSelect(directMatch.href);
        }
      }
    };

    document.addEventListener('keydown', handleEnter);
    return () => document.removeEventListener('keydown', handleEnter);
  }, [open, query, searchResources]);

  // Apply framework filter (from pills, single prefix, or category prefix)
  const applyFrameworkFilter = (
    entries: SearchEntry[],
    frameworkId?: string | null,
    frameworkIds?: string[] | null
  ) => {
    // Category prefix (multiple frameworks) takes priority
    if (frameworkIds && frameworkIds.length > 0) {
      return entries.filter(e => frameworkIds.includes(e.frameworkId));
    }
    // Single framework prefix takes priority over pill selection
    if (frameworkId) {
      return entries.filter(e => e.frameworkId === frameworkId);
    }
    if (selectedFrameworks.length > 0) {
      return entries.filter(e => selectedFrameworks.includes(e.frameworkId));
    }
    // Context scope: pre-filter to current framework page if set
    if (contextScope) {
      return entries.filter(e => e.frameworkId === contextScope);
    }
    return entries;
  };

  // Parse query for prefix (for UI indicator)
  const { frameworkId: activePrefixFramework, frameworkIds: activeCategoryFrameworks, categoryLabel: activeCategoryLabel } = parseSearchQuery(query);

  // Fuzzy search results with framework filter
  const filteredResults = React.useMemo(() => {
    if (!searchResources) {
      lastSearchTimeRef.current = null;
      return [];
    }

    // Parse query for prefix
    const { frameworkId: prefixFramework, frameworkIds: categoryFrameworks, term: searchTerm } = parseSearchQuery(query);

    let results: SearchEntry[];
    const effectiveTerm = searchTerm;

    // Helper to check if entry matches current filter
    const matchesFilter = (entry: SearchEntry) => {
      if (categoryFrameworks && categoryFrameworks.length > 0) {
        return categoryFrameworks.includes(entry.frameworkId);
      }
      if (prefixFramework) {
        return entry.frameworkId === prefixFramework;
      }
      return selectedFrameworks.length === 0 || selectedFrameworks.includes(entry.frameworkId);
    };

    // Sort results to show base controls before enhancements
    const sortBaseControlsFirst = (entries: SearchEntry[]): SearchEntry[] => {
      return entries.sort((a, b) => {
        const aIsBase = isBaseControl(a.id);
        const bIsBase = isBaseControl(b.id);
        if (aIsBase && !bIsBase) return -1;
        if (!aIsBase && bIsBase) return 1;
        return 0; // Preserve original order for same type
      });
    };

    /**
     * Sort results to prioritize exact and prefix matches over fuzzy matches.
     * This ensures "ac2" returns AC-2 before AC-21 or AC-3.
     */
    const sortByRelevance = (
      entries: SearchEntry[],
      query: string
    ): SearchEntry[] => {
      if (!query.trim()) return entries;

      const normalizedQuery = normalizeId(query);
      if (!normalizedQuery) return entries;

      return [...entries].sort((a, b) => {
        const aId = normalizeId(a.id);
        const bId = normalizeId(b.id);

        // Priority 1: Exact match wins
        const aExact = aId === normalizedQuery;
        const bExact = bId === normalizedQuery;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        // Priority 2: Prefix match (ID starts with query)
        const aPrefix = aId.startsWith(normalizedQuery);
        const bPrefix = bId.startsWith(normalizedQuery);
        if (aPrefix && !bPrefix) return -1;
        if (!aPrefix && bPrefix) return 1;

        // Priority 3: For prefix matches, prefer base controls
        if (aPrefix && bPrefix) {
          const aIsBase = isBaseControl(a.id);
          const bIsBase = isBaseControl(b.id);
          if (aIsBase && !bIsBase) return -1;
          if (!aIsBase && bIsBase) return 1;
          // Then shorter IDs first (AC-2 before AC-21)
          return aId.length - bId.length;
        }

        // Priority 4: Preserve Fuse.js score order for non-prefix matches
        return 0;
      });
    };

    if (!effectiveTerm.trim()) {
      // No search term - show first 10 controls (filtered by prefix or pills)
      results = applyFrameworkFilter(searchResources.entries, prefixFramework, categoryFrameworks).slice(0, 25);
      lastSearchTimeRef.current = null;
    } else {
      // Measure search time - only the fuse.search() call
      const t0 = performance.now();
      const fuseResults = searchResources.fuse.search(effectiveTerm);
      const t1 = performance.now();
      lastSearchTimeRef.current = t1 - t0;

      // Fuzzy search with filter, then sort by relevance before slicing
      const searchResults = applyFrameworkFilter(
        fuseResults.map(r => r.item),
        prefixFramework,
        categoryFrameworks
      );
      results = sortByRelevance(searchResults, effectiveTerm).slice(0, 25);
    }

    return results;
  }, [query, searchResources, selectedFrameworks]);

  // Sync search timing from ref to state (avoids setState during render)
  React.useEffect(() => {
    setSearchTimeMs(lastSearchTimeRef.current);
  }, [filteredResults]);

  // Framework search results
  const frameworkResults = React.useMemo(() => {
    if (!searchResources) return [];
    const { term: searchTerm } = parseSearchQuery(query);
    if (!searchTerm.trim()) return [];
    return searchResources.frameworkFuse.search(searchTerm).slice(0, 3).map(r => r.item);
  }, [query, searchResources]);

  // Deduplicate controls by normalized ID with expandable grouping
  const dedupedResults = React.useMemo((): GroupedResult[] => {
    // Skip dedup when scoped to one framework (no duplicates possible)
    if (contextScope || activePrefixFramework) {
      return filteredResults.map(entry => ({
        primaryEntry: entry,
        allEntries: [entry],
        normalizedId: normalizeControlId(entry.id),
      }));
    }

    const groups = new Map<string, SearchEntry[]>();
    for (const entry of filteredResults) {
      const key = normalizeControlId(entry.id);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(entry);
    }

    return [...groups.entries()].map(([normalizedId, entries]) => {
      // Pick primary: NIST 800-53 > first entry
      const primary =
        entries.find(e => e.frameworkId === 'nist-800-53-r5') ||
        entries[0];

      return { primaryEntry: primary, allEntries: entries, normalizedId };
    });
  }, [filteredResults, contextScope, activePrefixFramework]);

  React.useEffect(() => {
    const { term } = parseSearchQuery(query);
    const trimmedTerm = term.trim();

    if (
      hasTrackedFirstQueryRef.current ||
      !searchResources ||
      searchTimeMs === null ||
      !trimmedTerm
    ) {
      return;
    }

    hasTrackedFirstQueryRef.current = true;
    trackSearchQueryExecuted({
      surface: 'command',
      durationMs: searchTimeMs,
      queryLength: trimmedTerm.length,
      resultCount: dedupedResults.length,
      categoryFilterCount: selectedCategories.length,
      hasFrameworkFilter: Boolean(
        contextScope ||
        activePrefixFramework ||
        (activeCategoryFrameworks && activeCategoryFrameworks.length > 0) ||
        selectedFrameworks.length > 0
      ),
    });
  }, [
    activeCategoryFrameworks,
    activePrefixFramework,
    contextScope,
    dedupedResults.length,
    query,
    searchResources,
    searchTimeMs,
    selectedCategories.length,
    selectedFrameworks.length,
  ]);

  const handleSelect = (href: string) => {
    setOpen(false);
    setQuery('');
    window.location.href = href;
  };

  const handleExportResults = React.useCallback(() => {
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        query: query,
        categories: selectedCategories,
        totalResults: dedupedResults.length,
      },
      results: dedupedResults.map(group => ({
        control_id: group.primaryEntry.id,
        title: group.primaryEntry.title,
        description: group.primaryEntry.description,
        family: group.primaryEntry.family,
        framework: group.primaryEntry.frameworkId,
        baselines: group.primaryEntry.baselines,
        url: group.primaryEntry.href,
        ...(group.allEntries.length > 1 ? {
          also_in: group.allEntries
            .filter(e => e !== group.primaryEntry)
            .map(e => ({
              framework: e.frameworkId,
              control_id: e.id,
              url: e.href,
            }))
        } : {}),
      })),
    };

    const date = new Date().toISOString().split('T')[0];
    const sanitizedQuery = query.trim().replace(/[^a-z0-9]/gi, '-').slice(0, 30);
    const filename = `search-${sanitizedQuery || 'results'}-${date}.json`;
    downloadFile(exportData, filename, 'application/json');
  }, [query, selectedCategories, dedupedResults]);

  const isCommandMode = query.trimStart().startsWith('>');
  const commandQuery = isCommandMode ? query.trimStart().slice(1).trim().toLowerCase() : '';

  const paletteCommands = React.useMemo(() => {
    const base = [
      {
        id: 'voice-copilot',
        label: 'Voice Copilot — Ask GRCLanker (⌘⇧V)',
        group: 'AI & Voice',
        kind: 'voice' as const,
        run: () => {
          setOpen(false);
          setQuery('');
          requestOpenAIChat({ tab: 'voice', voiceMode: 'copilot' });
        },
      },
      {
        id: 'voice-audit',
        label: 'Mock Audit Interview — Voice Practice',
        group: 'AI & Voice',
        kind: 'voice' as const,
        run: () => {
          setOpen(false);
          setQuery('');
          requestOpenAIChat({ tab: 'voice', voiceMode: 'audit-interview' });
        },
      },
      {
        id: 'open-chat',
        label: 'Open GRCLanker Chat (⌘J)',
        group: 'AI & Voice',
        kind: 'voice' as const,
        run: () => {
          setOpen(false);
          setQuery('');
          requestOpenAIChat({ tab: 'chat' });
        },
      },
      ...THEMES.map((t) => ({
        id: `theme-${t.value}`,
        label: `Theme: ${t.label}`,
        group: 'Appearance',
        kind: 'theme' as const,
        run: () => {
          applyTheme(t.value as Theme);
          try {
            localStorage.setItem('theme', t.value);
          } catch {
            // Ignore storage errors
          }
          setOpen(false);
          setQuery('');
        },
      })),
      {
        id: 'nav-assess',
        label: 'Open Assessment Workbench',
        group: 'Navigation',
        kind: 'nav' as const,
        run: () => handleSelect('/assess'),
      },
      {
        id: 'nav-crosswalk',
        label: 'Open Crosswalk Workbench',
        group: 'Navigation',
        kind: 'nav' as const,
        run: () => handleSelect('/crosswalk/visualize'),
      },
      {
        id: 'nav-compare',
        label: 'Compare Frameworks',
        group: 'Navigation',
        kind: 'nav' as const,
        run: () => handleSelect('/compare'),
      },
      {
        id: 'nav-search',
        label: 'Full Search Page',
        group: 'Navigation',
        kind: 'nav' as const,
        run: () => handleSelect('/search'),
      },
      {
        id: 'nav-preferences',
        label: 'Preferences & Backup',
        group: 'Navigation',
        kind: 'nav' as const,
        run: () => handleSelect('/preferences'),
      },
      {
        id: 'nav-api',
        label: 'Developer API Docs',
        group: 'Navigation',
        kind: 'nav' as const,
        run: () => handleSelect('/developers/api'),
      },
    ];
    if (!commandQuery) return base;
    return base.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(commandQuery) ||
        cmd.group.toLowerCase().includes(commandQuery),
    );
  }, [commandQuery]);

  // Check if current query has a direct match (for UI feedback)
  const directMatch = React.useMemo(() => {
    if (isCommandMode || !searchResources) return undefined;
    if (!query.trim() || !looksLikeControlId(query)) return undefined;
    return findDirectMatch(query, searchResources.entries);
  }, [isCommandMode, query, searchResources]);
  const hasDirectMatch = !!directMatch;
  const frameworkLabelMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of searchResources?.frameworkEntries || []) {
      map.set(entry.frameworkId, entry.title);
    }
    return map;
  }, [searchResources]);

  const getFrameworkLabel = React.useCallback((frameworkId: string) => {
    return frameworkLabelMap.get(frameworkId)
      || FRAMEWORK_LABELS[frameworkId]
      || frameworkId;
  }, [frameworkLabelMap]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      {/* Search input first - always visible on mobile */}
      <CommandInput
        placeholder="Search... (try fed:ac-2, owasp:injection, or nist:)"
        value={query}
        onValueChange={setQuery}
      />

      {/* Active prefix indicator - show for both single framework and category prefixes */}
      {(activePrefixFramework || activeCategoryLabel) && (
        <div className="px-3 py-1 bg-primary/10 border-b border-border flex items-center gap-2">
          <Badge variant="default" className="text-xs">
            {activeCategoryLabel || FRAMEWORK_LABELS[activePrefixFramework!]}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {activeCategoryLabel ? `${activeCategoryFrameworks?.length} frameworks` : 'filter active'}
          </span>
        </div>
      )}

      {/* Context scope indicator - when opened from a framework page */}
      {contextScope && !activePrefixFramework && !activeCategoryLabel && selectedCategories.length === 0 && (
        <div className="px-3 py-1 bg-primary/10 border-b border-border flex items-center gap-2">
          <Badge variant="default" className="text-xs">
            {FRAMEWORK_LABELS[contextScope] || contextScope}
          </Badge>
          <span className="text-xs text-muted-foreground">scoped to this framework</span>
          <button
            type="button"
            onClick={() => setContextScope(null)}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            ✕ Search all
          </button>
        </div>
      )}

      {/* Category filter pills - 6 smart categories instead of 80+ framework pills */}
      <div className="flex flex-wrap gap-2 px-3 py-2.5 border-b border-border">
        {CATEGORY_FILTERS.map(({ id, label, frameworks, colorClass }) => {
          const isSelected = selectedCategories.includes(id);
          return (
            <button
              type="button"
              key={id}
              onClick={() => toggleCategory(id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-all ${
                isSelected
                  ? `${colorClass} shadow-sm ring-1 ring-current/20`
                  : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground'
              }`}
            >
              {label}
              <span className="ml-1 opacity-60">({frameworks.length})</span>
            </button>
          );
        })}
        {selectedCategories.length > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            className="px-2.5 py-1 text-xs rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Favorite Frameworks Row - hidden on mobile (available in Sheet drawer) */}
      {favorites.length > 0 && (
        <div className="hidden sm:flex flex-wrap gap-2 px-3 py-2 border-b border-border bg-yellow-500/5">
          <span className="text-xs text-muted-foreground self-center">★ Favorites:</span>
          {favorites.map(frameworkId => (
            <button
              type="button"
              key={frameworkId}
              onClick={() => { window.location.href = `/frameworks/${frameworkId}`; }}
              className="px-2 py-1 text-xs rounded-md bg-yellow-500/10 text-yellow-600
                         dark:text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20"
            >
              {FRAMEWORK_LABELS[frameworkId] || frameworkId}
            </button>
          ))}
        </div>
      )}

      {/* Saved Presets Row - hidden on mobile */}
      {presets.length > 0 && (
        <div className="hidden sm:flex flex-wrap gap-2 px-3 py-2 border-b border-border bg-muted/30">
          <span className="text-xs text-muted-foreground self-center">Saved:</span>
          {presets.map(preset => (
            <button
              type="button"
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className="group px-2 py-1 text-xs rounded-md bg-accent/50 text-accent-foreground
                         hover:bg-accent border border-accent/30 flex items-center gap-1.5"
            >
              <span>{preset.name}</span>
              <span
                onClick={(e) => { e.stopPropagation(); handleDeletePreset(preset.id); }}
                className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity cursor-pointer"
              >
                ×
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Save Preset Button (when filters/search active) */}
      {(selectedCategories.length > 0 || query.trim()) && (
        <div className="px-3 py-1.5 border-b border-border">
          {showSaveDialog ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Preset name..."
                className="flex-1 px-2 py-1 text-xs rounded bg-muted border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                onKeyDown={(e) => e.key === 'Enter' && saveCurrentAsPreset()}
                autoFocus
              />
              <button
                type="button"
                onClick={saveCurrentAsPreset}
                className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => { setShowSaveDialog(false); setPresetName(''); }}
                className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSaveDialog(true)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              + Save as preset
            </button>
          )}
        </div>
      )}

      <CommandList>
        <CommandEmpty>
          <div className="text-center py-4">
            <p className="text-muted-foreground">
              {searchError || (isLoadingSearch ? 'Loading search index...' : 'No controls found.')}
            </p>
            {!searchError && (
              <p className="text-xs text-muted-foreground mt-1">
                {isLoadingSearch
                  ? 'Search results will appear as soon as the precomputed index is ready.'
                  : selectedCategories.length > 0
                    ? 'Try clearing category filters or adjusting your search'
                    : 'Try searching by control ID (AC-2, 1.1.1) or keyword (authentication)'}
              </p>
            )}
          </div>
        </CommandEmpty>

        {hasDirectMatch && (
          <div className="px-3 py-1.5 text-xs text-primary border-b border-border bg-primary/5">
            Press Enter to go directly to {directMatch?.id}
          </div>
        )}

        {isCommandMode ? (
          paletteCommands.length > 0 && (
            <CommandGroup heading="Commands">
              {paletteCommands.map((cmd) => (
                <CommandItem
                  key={cmd.id}
                  value={`cmd-${cmd.id} ${cmd.label}`}
                  onSelect={() => cmd.run()}
                  className="flex items-center gap-3 py-2"
                >
                  {cmd.kind === 'voice' ? (
                    <Mic className="w-4 h-4 text-primary shrink-0" />
                  ) : cmd.kind === 'theme' ? (
                    <Palette className="w-4 h-4 text-primary shrink-0" />
                  ) : (
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="flex-1 text-sm">{cmd.label}</span>
                  <span className="text-[11px] font-mono text-muted-foreground">{cmd.group}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )
        ) : (
          <>
            {/* Framework search results */}
            {frameworkResults.length > 0 && (
          <CommandGroup heading="Frameworks">
            {frameworkResults.map((fw) => (
              <CommandItem
                key={fw.frameworkId}
                value={`framework-${fw.frameworkId} ${fw.title}`}
                onSelect={() => handleSelect(fw.href)}
                className="flex items-center gap-3 py-2"
              >
                <span className="w-8 h-8 rounded-md bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                  {fw.frameworkId.slice(0, 3).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{fw.title} {fw.version}</div>
                  <div className="text-xs text-muted-foreground">
                    {fw.controlCount} controls
                    {fw.tags.length > 0 && ` · ${fw.tags[0]}`}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Deduplicated control results with expandable framework rows */}
        {dedupedResults.length > 0 && (
          <CommandGroup heading="Controls">
            {dedupedResults.map((group) => (
              <React.Fragment key={group.normalizedId}>
                <CommandItem
                  value={`${group.primaryEntry.id} ${group.primaryEntry.title}`}
                  onSelect={() => handleSelect(group.primaryEntry.href)}
                  className="flex items-start gap-3 py-2"
                >
                  <span className="font-mono control-id font-semibold shrink-0 text-sm">
                    {group.primaryEntry.id}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm">{group.primaryEntry.title}</div>
                    <div className="flex gap-1 mt-1">
                      <Badge variant="outline" className="text-[11px] px-1 py-0">
                        {getFrameworkLabel(group.primaryEntry.frameworkId)}
                      </Badge>
                      {group.primaryEntry.baselines.map((baseline) => (
                        <Badge
                          key={baseline}
                          variant={baseline.toLowerCase() as 'low' | 'moderate' | 'high' | 'privacy'}
                          className="text-[11px] px-1 py-0"
                        >
                          {baseline}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CommandItem>

                {group.allEntries.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleExpand(group.normalizedId); }}
                      className="w-full flex items-center gap-2 px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      style={{ paddingLeft: '96px' }}
                    >
                      <svg
                        className={`w-3 h-3 transition-transform ${expandedGroups.has(group.normalizedId) ? 'rotate-90' : ''}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                      Also in {group.allEntries.length - 1} other framework{group.allEntries.length > 2 ? 's' : ''}
                    </button>

                    {expandedGroups.has(group.normalizedId) && (
                      <div className="bg-muted/20">
                        {group.allEntries
                          .filter(e => e !== group.primaryEntry)
                          .map(entry => (
                            <CommandItem
                              key={`${entry.frameworkId}-${entry.id}`}
                              value={`${entry.frameworkId} ${entry.id}`}
                              onSelect={() => handleSelect(entry.href)}
                              className="flex items-center gap-2 py-1.5 opacity-85 hover:opacity-100"
                              style={{ paddingLeft: '96px' }}
                            >
                              <Badge variant="outline" className="text-[11px] px-1.5 py-0">
                                {getFrameworkLabel(entry.frameworkId)}
                              </Badge>
                              <span className="text-xs text-muted-foreground font-mono">{entry.id}</span>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs text-muted-foreground">
                                {entry.baselines.join(', ') || 'No baseline'}
                              </span>
                            </CommandItem>
                          ))}
                      </div>
                    )}
                  </>
                )}
              </React.Fragment>
            ))}
          </CommandGroup>
        )}
          </>
        )}
      </CommandList>

      <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
        <div className="flex items-center gap-2">
          {query.length > 0 && (
            <span className="text-primary font-mono">
              {dedupedResults.length} controls
              {frameworkResults.length > 0 && ` · ${frameworkResults.length} frameworks`}
              {searchTimeMs !== null && ` · ${searchTimeMs < 1 ? '<1' : Math.round(searchTimeMs)}ms`}
            </span>
          )}
          <a
            href={`/search${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}${selectedCategories.length > 0 ? `${query.trim() ? '&' : '?'}category=${selectedCategories.join(',')}` : ''}`}
            className="text-primary hover:underline"
            onClick={() => setOpen(false)}
          >
            See all results &rarr;
          </a>
          {dedupedResults.length > 0 && (
            <button
              type="button"
              onClick={handleExportResults}
              className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              title="Export search results as JSON"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </button>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-4">
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded border">↑↓</kbd>
            <span>Navigate</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded border">Enter</kbd>
            <span>Select</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded border">Esc</kbd>
            <span>Close</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded border">?</kbd>
            <span>All shortcuts</span>
          </div>
        </div>
      </div>
    </CommandDialog>
  );
}
