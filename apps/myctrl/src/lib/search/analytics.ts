type SearchMetricValue = string | number | boolean | null | undefined;

export type SearchSurface = 'command' | 'full-page';
export type SearchArtifact = 'control' | 'unified';
export type SearchCacheStatus = 'cold' | 'warm';

interface SearchMetricProperties {
  [key: string]: SearchMetricValue;
}

interface SearchIndexLoadedMetric {
  artifact: SearchArtifact;
  durationMs: number;
  entryCount: number;
  frameworkEntryCount?: number;
}

interface SearchIndexLoadFailedMetric {
  artifact: SearchArtifact;
  reason: string;
  statusCode?: number;
}

interface SearchSurfaceReadyMetric {
  surface: SearchSurface;
  durationMs: number;
  cacheStatus?: SearchCacheStatus;
}

interface SearchQueryExecutedMetric {
  surface: SearchSurface;
  durationMs: number;
  queryLength: number;
  resultCount: number;
  categoryFilterCount?: number;
  hasFrameworkFilter?: boolean;
  typeFilter?: string;
}

function roundDurationMs(durationMs: number): number {
  return Math.round(Math.max(0, durationMs) * 10) / 10;
}

function normalizeMetricProperties(properties: SearchMetricProperties): SearchMetricProperties {
  const normalized: SearchMetricProperties = {};

  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === 'number' && key.endsWith('_ms')) {
      normalized[key] = roundDurationMs(value);
    } else if (typeof value === 'string') {
      normalized[key] = value.slice(0, 120);
    } else {
      normalized[key] = value;
    }
  }

  return normalized;
}

function sendSearchMetric(name: string, properties: SearchMetricProperties) {
  if (typeof window === 'undefined') return;

  const normalized = normalizeMetricProperties(properties);

  if (import.meta.env.DEV) {
    console.debug(`[search-metric] ${name}`, normalized);
  }
}

export function trackSearchIndexLoaded(metric: SearchIndexLoadedMetric) {
  sendSearchMetric('search_index_loaded', {
    artifact: metric.artifact,
    duration_ms: metric.durationMs,
    entry_count: metric.entryCount,
    framework_entry_count: metric.frameworkEntryCount,
  });
}

export function trackSearchIndexLoadFailed(metric: SearchIndexLoadFailedMetric) {
  sendSearchMetric('search_index_load_failed', {
    artifact: metric.artifact,
    reason: metric.reason,
    status_code: metric.statusCode,
  });
}

export function trackSearchSurfaceReady(metric: SearchSurfaceReadyMetric) {
  sendSearchMetric('search_surface_ready', {
    surface: metric.surface,
    duration_ms: metric.durationMs,
    cache_status: metric.cacheStatus,
  });
}

export function trackSearchQueryExecuted(metric: SearchQueryExecutedMetric) {
  sendSearchMetric('search_query_executed', {
    surface: metric.surface,
    duration_ms: metric.durationMs,
    query_length: metric.queryLength,
    result_count: metric.resultCount,
    category_filter_count: metric.categoryFilterCount,
    has_framework_filter: metric.hasFrameworkFilter,
    type_filter: metric.typeFilter,
  });
}
