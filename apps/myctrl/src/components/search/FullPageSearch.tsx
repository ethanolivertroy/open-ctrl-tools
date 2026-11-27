import * as React from 'react';
import type { UnifiedSearchEntry, SearchEntryType } from '@/data/types';
import { CATEGORY_PREFIX_MAP } from '@/lib/search-constants';
import {
  trackSearchQueryExecuted,
  trackSearchSurfaceReady,
} from '@/lib/search/analytics';
import { loadUnifiedSearchResources } from '@/lib/search/precomputed-search';
import { SearchFilters } from './SearchFilters';
import { SearchResultCard } from './SearchResultCard';

const PAGE_SIZE = 50;

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function getUrlParams(): {
  q: string;
  type: SearchEntryType | null;
  category: string[];
  framework: string;
  page: number;
} {
  if (typeof window === 'undefined') {
    return { q: '', type: null, category: [], framework: '', page: 1 };
  }
  const params = new URLSearchParams(window.location.search);
  const typeParam = params.get('type');
  const validTypes: SearchEntryType[] = ['control', 'framework', 'guide', 'crosswalk', 'page'];
  return {
    q: params.get('q') || '',
    type: typeParam && validTypes.includes(typeParam as SearchEntryType)
      ? (typeParam as SearchEntryType)
      : null,
    category: params.get('category')?.split(',').filter(Boolean) || [],
    framework: params.get('framework') || '',
    page: Math.max(1, parseInt(params.get('page') || '1', 10) || 1),
  };
}

function setUrlParams(params: {
  q: string;
  type: SearchEntryType | null;
  category: string[];
  framework: string;
  page: number;
}) {
  if (typeof window === 'undefined') return;
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.type) search.set('type', params.type);
  if (params.category.length > 0) search.set('category', params.category.join(','));
  if (params.framework) search.set('framework', params.framework);
  if (params.page > 1) search.set('page', String(params.page));
  const newUrl = `${window.location.pathname}${search.toString() ? '?' + search.toString() : ''}`;
  window.history.replaceState(null, '', newUrl);
}

export function FullPageSearch() {
  const initial = getUrlParams();
  const [query, setQuery] = React.useState(initial.q);
  const [typeFilter, setTypeFilter] = React.useState<SearchEntryType | null>(initial.type);
  const [categoryFilters, setCategoryFilters] = React.useState<string[]>(initial.category);
  const [frameworkFilter, setFrameworkFilter] = React.useState(initial.framework);
  const [displayPage, setDisplayPage] = React.useState(initial.page);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [debouncedQuery, setDebouncedQuery] = React.useState(query);
  const [searchResources, setSearchResources] = React.useState<Awaited<ReturnType<typeof loadUnifiedSearchResources>> | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const startedAtRef = React.useRef(now());
  const hasTrackedSurfaceReadyRef = React.useRef(false);
  const hasTrackedFirstQueryRef = React.useRef(false);

  // Debounce query input
  React.useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
      setDisplayPage(1); // Reset to page 1 on new query
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Sync URL params
  React.useEffect(() => {
    setUrlParams({
      q: debouncedQuery,
      type: typeFilter,
      category: categoryFilters,
      framework: frameworkFilter,
      page: displayPage,
    });
  }, [debouncedQuery, typeFilter, categoryFilters, frameworkFilter, displayPage]);

  React.useEffect(() => {
    let cancelled = false;

    void loadUnifiedSearchResources()
      .then((resources) => {
        if (!cancelled) {
          setSearchResources(resources);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('Search index failed to load.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (hasTrackedSurfaceReadyRef.current || !searchResources) {
      return;
    }

    hasTrackedSurfaceReadyRef.current = true;
    trackSearchSurfaceReady({
      surface: 'full-page',
      durationMs: now() - startedAtRef.current,
      cacheStatus: 'cold',
    });
  }, [searchResources]);

  // Get frameworks from selected categories
  const categoryFrameworkIds = React.useMemo(() => {
    if (categoryFilters.length === 0) return null;
    const ids = new Set<string>();
    for (const cat of categoryFilters) {
      const fws = CATEGORY_PREFIX_MAP[cat];
      if (fws) fws.forEach(f => ids.add(f));
    }
    return ids;
  }, [categoryFilters]);

  // Compute results
  const { results, typeCounts, totalFiltered, searchTimeMs } = React.useMemo(() => {
    if (!searchResources) {
      return {
        results: [] as UnifiedSearchEntry[],
        typeCounts: {} as Record<string, number>,
        totalFiltered: 0,
        searchTimeMs: null as number | null,
      };
    }

    let candidates: UnifiedSearchEntry[];
    let measuredSearchTime: number | null = null;

    if (debouncedQuery.trim()) {
      const t0 = performance.now();
      const fuseResults = searchResources.fuse.search(debouncedQuery);
      const t1 = performance.now();
      measuredSearchTime = t1 - t0;
      candidates = fuseResults.map(r => r.item);
    } else {
      candidates = searchResources.entries;
    }

    // Apply post-search filters
    let filtered = candidates;

    // Category filter (applies to controls via frameworkId, and to other types via tags)
    if (categoryFrameworkIds) {
      filtered = filtered.filter(entry => {
        if (entry.type === 'control') {
          return categoryFrameworkIds.has(entry.frameworkId);
        }
        // For non-control types, check if any tag matches a category
        return entry.tags.some(tag => {
          for (const cat of categoryFilters) {
            const label = cat === 'fed' ? 'Federal' : cat === 'ent' ? 'Enterprise' : cat === 'priv' ? 'Privacy' : cat === 'intl' ? 'International' : cat === 'owasp' ? 'OWASP' : cat === 'ai' ? 'AI' : cat;
            if (tag === label) return true;
          }
          return false;
        });
      });
    }

    // Framework filter (controls only)
    if (frameworkFilter) {
      filtered = filtered.filter(entry =>
        entry.type !== 'control' || entry.frameworkId === frameworkFilter
      );
    }

    // Compute type counts before type filter
    const counts: Record<string, number> = {};
    for (const entry of filtered) {
      counts[entry.type] = (counts[entry.type] || 0) + 1;
    }
    const total = filtered.length;

    // Type filter
    if (typeFilter) {
      filtered = filtered.filter(entry => entry.type === typeFilter);
    }

    return {
      results: filtered,
      typeCounts: counts,
      totalFiltered: total,
      searchTimeMs: measuredSearchTime,
    };
  }, [debouncedQuery, typeFilter, categoryFilters, categoryFrameworkIds, frameworkFilter, searchResources]);

  const displayedResults = results.slice(0, displayPage * PAGE_SIZE);
  const hasMore = displayedResults.length < results.length;
  const frameworkOptions = searchResources?.frameworkOptions ?? [];

  React.useEffect(() => {
    const trimmedQuery = debouncedQuery.trim();

    if (
      hasTrackedFirstQueryRef.current ||
      searchTimeMs === null ||
      !trimmedQuery
    ) {
      return;
    }

    hasTrackedFirstQueryRef.current = true;
    trackSearchQueryExecuted({
      surface: 'full-page',
      durationMs: searchTimeMs,
      queryLength: trimmedQuery.length,
      resultCount: results.length,
      categoryFilterCount: categoryFilters.length,
      hasFrameworkFilter: Boolean(frameworkFilter),
      typeFilter: typeFilter ?? 'all',
    });
  }, [
    categoryFilters.length,
    debouncedQuery,
    frameworkFilter,
    results.length,
    searchTimeMs,
    typeFilter,
  ]);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Filters */}
      <SearchFilters
        typeFilter={typeFilter}
        onTypeChange={(t) => { setTypeFilter(t); setDisplayPage(1); }}
        categoryFilters={categoryFilters}
        onCategoryChange={(c) => { setCategoryFilters(c); setDisplayPage(1); }}
        frameworkFilter={frameworkFilter}
        onFrameworkChange={(f) => { setFrameworkFilter(f); setDisplayPage(1); }}
        frameworkOptions={frameworkOptions}
        typeCounts={typeCounts}
        totalCount={totalFiltered}
      />

      {/* Results area */}
      <div className="flex-1 min-w-0">
        {/* Search input */}
        <div className="relative mb-4">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search controls, frameworks, guides, crosswalks..."
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            autoFocus
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setDebouncedQuery(''); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Result stats */}
        <div className="flex items-center gap-3 mb-4 text-xs text-muted-foreground">
          <span>{searchResources ? `${results.length.toLocaleString()} result${results.length !== 1 ? 's' : ''}` : 'Loading search index...'}</span>
          {searchTimeMs !== null && debouncedQuery.length > 0 && (
            <span className="text-primary font-mono">
              in {searchTimeMs < 1 ? '<1' : Math.round(searchTimeMs)}ms
            </span>
          )}
        </div>

        {/* Results list */}
        {!searchResources ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {loadError || 'Preparing search index...'}
            </p>
          </div>
        ) : displayedResults.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No results found.</p>
            <p className="text-xs text-muted-foreground mt-2">
              Try adjusting your search term or filters.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayedResults.map((entry, i) => (
              <SearchResultCard key={`${entry.type}-${entry.href}-${i}`} entry={entry} />
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && (
          <div className="mt-6 text-center">
            <button
              onClick={() => setDisplayPage(p => p + 1)}
              className="px-4 py-2 text-sm rounded-md border border-border bg-muted/50 text-foreground hover:bg-muted transition-colors"
            >
              Load more ({results.length - displayedResults.length} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
