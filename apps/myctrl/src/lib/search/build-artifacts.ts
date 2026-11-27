import Fuse from 'fuse.js';
import {
  generateAllSearchIndex,
  generateFrameworkSearchIndex,
} from '@/data/controls';
import { generateUnifiedSearchIndex } from '@/data/unified-search';
import {
  CROSSWALK_REGISTRY,
  buildBridgeArtifact,
  type CrosswalkIdMap,
} from '@/data/crosswalk';
import { getAllControls } from '@/data/controls';
import type {
  FrameworkSearchEntry,
  SearchEntry,
  UnifiedSearchEntry,
} from '@/data/types';
import { FRAMEWORK_LABELS } from '@/lib/search-constants';
import {
  CONTROL_SEARCH_FUSE_KEYS,
  FRAMEWORK_SEARCH_FUSE_KEYS,
  UNIFIED_SEARCH_FUSE_KEYS,
} from './fuse-config';

export interface SerializedFuseIndex {
  keys: ReadonlyArray<string>;
  records: unknown[];
}

export interface FrameworkOption {
  id: string;
  label: string;
}

export type SerializedControlSearchEntry = [
  id: string,
  title: string,
  family: string,
  description: string,
  frameworkId: string,
  href: string,
  baselines: string[],
];

export type SerializedFrameworkSearchEntry = [
  frameworkId: string,
  title: string,
  description: string,
  href: string,
  controlCount: number,
  version: string,
  tags: string[],
];

export type SerializedUnifiedSearchEntry =
  | [
      type: 'control',
      id: string,
      title: string,
      description: string,
      family: string,
      frameworkId: string,
      href: string,
      baselines: string[],
    ]
  | [
      type: 'framework',
      frameworkId: string,
      title: string,
      description: string,
      href: string,
      controlCount: number,
      version: string,
      tags: string[],
    ]
  | [
      type: 'guide',
      title: string,
      description: string,
      href: string,
      category: string,
      vendor: string | null,
      tags: string[],
    ]
  | [
      type: 'crosswalk',
      title: string,
      description: string,
      href: string,
      fromFramework: string,
      toFramework: string,
      tags: string[],
    ]
  | [
      type: 'page',
      title: string,
      description: string,
      href: string,
      tags: string[],
    ];

export interface ControlSearchPayload {
  entries: SerializedControlSearchEntry[];
  index: SerializedFuseIndex;
  frameworkEntries: SerializedFrameworkSearchEntry[];
  frameworkIndex: SerializedFuseIndex;
}

export interface UnifiedSearchPayload {
  entries: SerializedUnifiedSearchEntry[];
  index: SerializedFuseIndex;
  frameworkOptions: FrameworkOption[];
}

export type SerializedCrosswalkPair = [
  a: string,
  b: string,
  aToB: Record<string, string[]>,
  bToA: Record<string, string[]>,
];

/**
 * Bridge maps for one framework: [frameworkId, toBridge, fromBridge].
 * toBridge: framework control id -> bridge ids; fromBridge: bridge id ->
 * framework control ids (pre-normalized). Bridge ids are internal and never
 * surfaced to API consumers.
 */
export type SerializedBridgeEntry = [
  frameworkId: string,
  toBridge: Record<string, string[]>,
  fromBridge: Record<string, string[]>,
];

export interface CrosswalkIndexPayload {
  pairs: SerializedCrosswalkPair[];
  bridge: SerializedBridgeEntry[];
}

function stripControlTitlePrefix(id: string, title: string): string {
  const prefix = `${id}: `;
  return title.startsWith(prefix) ? title.slice(prefix.length) : title;
}

function normalizeControlSearchEntry(entry: SearchEntry): SearchEntry {
  return {
    ...entry,
    title: stripControlTitlePrefix(entry.id, entry.title),
  };
}

function normalizeUnifiedSearchEntry(entry: UnifiedSearchEntry): UnifiedSearchEntry {
  if (entry.type !== 'control') return entry;

  return {
    ...entry,
    title: stripControlTitlePrefix(entry.id, entry.title),
  };
}

function serializeControlSearchEntry(entry: SearchEntry): SerializedControlSearchEntry {
  return [
    entry.id,
    entry.title,
    entry.family,
    entry.description,
    entry.frameworkId,
    entry.href,
    entry.baselines,
  ];
}

function serializeFrameworkSearchEntry(entry: FrameworkSearchEntry): SerializedFrameworkSearchEntry {
  return [
    entry.frameworkId,
    entry.title,
    entry.description,
    entry.href,
    entry.controlCount,
    entry.version,
    entry.tags,
  ];
}

function serializeUnifiedSearchEntry(entry: UnifiedSearchEntry): SerializedUnifiedSearchEntry {
  switch (entry.type) {
    case 'control':
      return [
        'control',
        entry.id,
        entry.title,
        entry.description,
        entry.family,
        entry.frameworkId,
        entry.href,
        entry.baselines,
      ];
    case 'framework':
      return [
        'framework',
        entry.frameworkId,
        entry.title,
        entry.description,
        entry.href,
        entry.controlCount,
        entry.version,
        entry.tags,
      ];
    case 'guide':
      return [
        'guide',
        entry.title,
        entry.description,
        entry.href,
        entry.category,
        entry.vendor ?? null,
        entry.tags,
      ];
    case 'crosswalk':
      return [
        'crosswalk',
        entry.title,
        entry.description,
        entry.href,
        entry.fromFramework,
        entry.toFramework,
        entry.tags,
      ];
    case 'page':
      return [
        'page',
        entry.title,
        entry.description,
        entry.href,
        entry.tags,
      ];
  }
}

export function buildControlSearchPayload(): ControlSearchPayload {
  const entries = generateAllSearchIndex().map(normalizeControlSearchEntry);
  const frameworkEntries = generateFrameworkSearchIndex();

  return {
    entries: entries.map(serializeControlSearchEntry),
    index: Fuse.createIndex<SearchEntry>(
      [...CONTROL_SEARCH_FUSE_KEYS],
      entries,
    ).toJSON() as SerializedFuseIndex,
    frameworkEntries: frameworkEntries.map(serializeFrameworkSearchEntry),
    frameworkIndex: Fuse.createIndex<FrameworkSearchEntry>(
      [...FRAMEWORK_SEARCH_FUSE_KEYS],
      frameworkEntries,
    ).toJSON() as SerializedFuseIndex,
  };
}

/**
 * Materialize all crosswalk pairs for the prerendered crosswalk-index artifact.
 * - Pairs with normalizeAKey (AI RMF → ISO 23894) are expanded to control-level
 *   keys so the API matches the site UI's per-control lookups.
 * - Pairs with expandBIds (CCF pairs) get their forward ids normalized/expanded.
 * - Extended (STRM) framework ↔ CCF maps are appended as extra pairs.
 */
export function buildCrosswalkIndexPayload(): CrosswalkIndexPayload {
  const pairs: SerializedCrosswalkPair[] = [];

  for (const pair of CROSSWALK_REGISTRY) {
    let aToB = pair.aToB;

    if (pair.normalizeAKey) {
      const expanded: CrosswalkIdMap = {};
      for (const control of getAllControls(pair.a)) {
        const ids = pair.aToB[pair.normalizeAKey(control.control_id)];
        if (ids && ids.length > 0) {
          expanded[control.control_id] = ids;
        }
      }
      aToB = expanded;
    }

    if (pair.expandBIds) {
      aToB = Object.fromEntries(
        Object.entries(aToB).map(([key, ids]) => [key, pair.expandBIds!(ids)]),
      );
    }

    pairs.push([pair.a, pair.b, aToB, pair.bToA]);
  }

  return { pairs, bridge: buildBridgeArtifact() };
}

export function buildUnifiedSearchPayload(): UnifiedSearchPayload {
  const entries = generateUnifiedSearchIndex().map(normalizeUnifiedSearchEntry);
  const frameworkOptionsMap = new Map<string, string>();

  for (const entry of entries) {
    if (entry.type === 'control' && entry.frameworkId) {
      if (!frameworkOptionsMap.has(entry.frameworkId)) {
        frameworkOptionsMap.set(
          entry.frameworkId,
          FRAMEWORK_LABELS[entry.frameworkId] || entry.frameworkId,
        );
      }
    }
  }

  return {
    entries: entries.map(serializeUnifiedSearchEntry),
    index: Fuse.createIndex<UnifiedSearchEntry>(
      [...UNIFIED_SEARCH_FUSE_KEYS],
      entries,
    ).toJSON() as SerializedFuseIndex,
    frameworkOptions: Array.from(frameworkOptionsMap.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  };
}
