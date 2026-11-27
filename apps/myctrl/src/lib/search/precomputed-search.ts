import Fuse from 'fuse.js';
import type { FuseIndexRecords, IFuseOptions } from 'fuse.js';
import type {
  FrameworkSearchEntry,
  SearchEntry,
  UnifiedSearchEntry,
} from '@/data/types';
import {
  CONTROL_SEARCH_FUSE_KEYS,
  CONTROL_SEARCH_FUSE_OPTIONS,
  FRAMEWORK_SEARCH_FUSE_KEYS,
  FRAMEWORK_SEARCH_FUSE_OPTIONS,
  UNIFIED_SEARCH_FUSE_KEYS,
  UNIFIED_SEARCH_FUSE_OPTIONS,
} from './fuse-config';
import {
  trackSearchIndexLoaded,
  trackSearchIndexLoadFailed,
} from './analytics';
import type {
  ControlSearchPayload,
  FrameworkOption,
  SerializedControlSearchEntry,
  SerializedFrameworkSearchEntry,
  SerializedFuseIndex,
  SerializedUnifiedSearchEntry,
  UnifiedSearchPayload,
} from './build-artifacts';

export interface ControlSearchResources {
  entries: SearchEntry[];
  fuse: Fuse<SearchEntry>;
  frameworkEntries: FrameworkSearchEntry[];
  frameworkFuse: Fuse<FrameworkSearchEntry>;
}

export interface UnifiedSearchResources {
  entries: UnifiedSearchEntry[];
  fuse: Fuse<UnifiedSearchEntry>;
  frameworkOptions: FrameworkOption[];
}

const CONTROL_SEARCH_ENDPOINT = '/api/search/control-index.json';
const UNIFIED_SEARCH_ENDPOINT = '/api/search/unified-index.json';

let controlSearchPromise: Promise<ControlSearchResources> | null = null;
let unifiedSearchPromise: Promise<UnifiedSearchResources> | null = null;

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error(`Failed to load search artifact: ${response.status}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return response.json() as Promise<T>;
}

function parseFuseIndex<T>(index: SerializedFuseIndex) {
  return Fuse.parseIndex<T>({
    keys: index.keys,
    records: index.records as FuseIndexRecords,
  });
}

const controlSearchFuseOptions: IFuseOptions<SearchEntry> = {
  ...CONTROL_SEARCH_FUSE_OPTIONS,
  keys: [...CONTROL_SEARCH_FUSE_KEYS],
};

const frameworkSearchFuseOptions: IFuseOptions<FrameworkSearchEntry> = {
  ...FRAMEWORK_SEARCH_FUSE_OPTIONS,
  keys: [...FRAMEWORK_SEARCH_FUSE_KEYS],
};

const unifiedSearchFuseOptions: IFuseOptions<UnifiedSearchEntry> = {
  ...UNIFIED_SEARCH_FUSE_OPTIONS,
  keys: [...UNIFIED_SEARCH_FUSE_KEYS],
};

function inflateControlSearchEntries(entries: SerializedControlSearchEntry[]): SearchEntry[] {
  return entries.map(([id, title, family, description, frameworkId, href, baselines]) => ({
    id,
    title,
    family,
    description,
    frameworkId,
    href,
    baselines,
  }));
}

function inflateFrameworkSearchEntries(entries: SerializedFrameworkSearchEntry[]): FrameworkSearchEntry[] {
  return entries.map(([frameworkId, title, description, href, controlCount, version, tags]) => ({
    type: 'framework',
    frameworkId,
    title,
    description,
    href,
    controlCount,
    version,
    tags,
  }));
}

function inflateUnifiedSearchEntries(entries: SerializedUnifiedSearchEntry[]): UnifiedSearchEntry[] {
  return entries.map((entry) => {
    switch (entry[0]) {
      case 'control': {
        const [, id, title, description, family, frameworkId, href, baselines] = entry;
        return {
          type: 'control',
          id,
          title,
          description,
          family,
          frameworkId,
          href,
          baselines,
          tags: [],
        };
      }
      case 'framework': {
        const [, frameworkId, title, description, href, controlCount, version, tags] = entry;
        return {
          type: 'framework',
          frameworkId,
          title,
          description,
          href,
          controlCount,
          version,
          tags,
        };
      }
      case 'guide': {
        const [, title, description, href, category, vendor, tags] = entry;
        return {
          type: 'guide',
          title,
          description,
          href,
          category,
          vendor: vendor ?? undefined,
          tags,
        };
      }
      case 'crosswalk': {
        const [, title, description, href, fromFramework, toFramework, tags] = entry;
        return {
          type: 'crosswalk',
          title,
          description,
          href,
          fromFramework,
          toFramework,
          tags,
        };
      }
      case 'page': {
        const [, title, description, href, tags] = entry;
        return {
          type: 'page',
          title,
          description,
          href,
          tags,
        };
      }
    }
  });
}

export function loadControlSearchResources(): Promise<ControlSearchResources> {
  if (!controlSearchPromise) {
    const startedAt = now();

    controlSearchPromise = fetchJson<ControlSearchPayload>(CONTROL_SEARCH_ENDPOINT)
      .then((payload) => {
        const entries = inflateControlSearchEntries(payload.entries);
        const frameworkEntries = inflateFrameworkSearchEntries(payload.frameworkEntries);
        const resources = {
          entries,
          fuse: new Fuse(
            entries,
            controlSearchFuseOptions,
            parseFuseIndex<SearchEntry>(payload.index),
          ),
          frameworkEntries,
          frameworkFuse: new Fuse(
            frameworkEntries,
            frameworkSearchFuseOptions,
            parseFuseIndex<FrameworkSearchEntry>(payload.frameworkIndex),
          ),
        };

        trackSearchIndexLoaded({
          artifact: 'control',
          durationMs: now() - startedAt,
          entryCount: entries.length,
          frameworkEntryCount: frameworkEntries.length,
        });

        return resources;
      })
      .catch((error) => {
        controlSearchPromise = null;

        trackSearchIndexLoadFailed({
          artifact: 'control',
          reason: error instanceof Error ? error.message : 'Unknown search index error',
          statusCode: typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
            ? error.status
            : undefined,
        });

        throw error;
      });
  }

  return controlSearchPromise;
}

export function loadUnifiedSearchResources(): Promise<UnifiedSearchResources> {
  if (!unifiedSearchPromise) {
    const startedAt = now();

    unifiedSearchPromise = fetchJson<UnifiedSearchPayload>(UNIFIED_SEARCH_ENDPOINT)
      .then((payload) => {
        const entries = inflateUnifiedSearchEntries(payload.entries);
        const resources = {
          entries,
          fuse: new Fuse(
            entries,
            unifiedSearchFuseOptions,
            parseFuseIndex<UnifiedSearchEntry>(payload.index),
          ),
          frameworkOptions: payload.frameworkOptions,
        };

        trackSearchIndexLoaded({
          artifact: 'unified',
          durationMs: now() - startedAt,
          entryCount: entries.length,
          frameworkEntryCount: payload.frameworkOptions.length,
        });

        return resources;
      })
      .catch((error) => {
        unifiedSearchPromise = null;

        trackSearchIndexLoadFailed({
          artifact: 'unified',
          reason: error instanceof Error ? error.message : 'Unknown search index error',
          statusCode: typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
            ? error.status
            : undefined,
        });

        throw error;
      });
  }

  return unifiedSearchPromise;
}
