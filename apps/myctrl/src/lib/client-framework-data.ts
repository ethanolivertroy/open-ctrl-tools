import { FRAMEWORK_CONFIGS, getBasePath } from '@/data/framework-configs';
import type {
  CrosswalkIndexPayload,
  FrameworkDatasetPayload,
  FrameworkManifestEntry,
  FrameworkManifestPayload,
} from '@/lib/api-static-data';
import { slugifyControlId } from '@/lib/slugify';
import type { Control } from '@/data/types';

export type FrameworkCategory =
  | 'federal'
  | 'enterprise'
  | 'ai'
  | 'privacy'
  | 'international'
  | 'meta';

export interface FrameworkNode {
  id: string;
  name: string;
  shortName: string;
  controlCount: number;
  category: FrameworkCategory;
}

export interface CrosswalkEdge {
  source: string;
  target: string;
  mappingCount: number;
  label?: string;
}

export interface CrosswalkStats {
  nodes: FrameworkNode[];
  edges: CrosswalkEdge[];
  matrix: Record<string, Record<string, number>>;
}

export interface ControlNeighbor {
  controlId: string;
  title: string;
  url: string;
}

export interface ControlNeighbors {
  prev: ControlNeighbor | null;
  next: ControlNeighbor | null;
  prevFamily: ControlNeighbor | null;
  nextFamily: ControlNeighbor | null;
}

export interface CrossFrameworkMapping {
  frameworkId: string;
  controlIds: string[];
  frameworkName: string;
  derived?: boolean;
}

export const CATEGORY_COLORS: Record<FrameworkCategory, string> = {
  federal: '#3b82f6',
  enterprise: '#22c55e',
  ai: '#a855f7',
  privacy: '#f59e0b',
  international: '#06b6d4',
  meta: '#ec4899',
};

export type {
  CrosswalkIndexPayload,
  FrameworkDatasetPayload,
  FrameworkManifestEntry,
  FrameworkManifestPayload,
};

let manifestPromise: Promise<FrameworkManifestPayload> | null = null;
let crosswalkIndexPromise: Promise<CrosswalkIndexPayload> | null = null;
let crosswalkStatsPromise: Promise<CrosswalkStats> | null = null;
const datasetPromises = new Map<string, Promise<FrameworkDatasetPayload>>();

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function loadFrameworkManifest(): Promise<FrameworkManifestPayload> {
  manifestPromise ??= fetchJson<FrameworkManifestPayload>('/data/frameworks/manifest.json').catch(
    (err) => {
      manifestPromise = null;
      throw err;
    },
  );
  return manifestPromise;
}

export function loadFrameworkDataset(frameworkId: string): Promise<FrameworkDatasetPayload> {
  let cached = datasetPromises.get(frameworkId);
  if (!cached) {
    cached = fetchJson<FrameworkDatasetPayload>(
      `/data/frameworks/${encodeURIComponent(frameworkId)}.json`,
    ).catch((err) => {
      datasetPromises.delete(frameworkId);
      throw err;
    });
    datasetPromises.set(frameworkId, cached);
  }
  return cached;
}

export function loadCrosswalkIndex(): Promise<CrosswalkIndexPayload> {
  crosswalkIndexPromise ??= fetchJson<CrosswalkIndexPayload>(
    '/api/search/crosswalk-index.json',
  ).catch((err) => {
    crosswalkIndexPromise = null;
    throw err;
  });
  return crosswalkIndexPromise;
}

export function loadCrosswalkStats(): Promise<CrosswalkStats> {
  crosswalkStatsPromise ??= fetchJson<CrosswalkStats>('/data/crosswalk-stats.json').catch(
    (err) => {
      crosswalkStatsPromise = null;
      throw err;
    },
  );
  return crosswalkStatsPromise;
}

function displayName(frameworkId: string): string {
  return FRAMEWORK_CONFIGS[frameworkId]?.name || frameworkId;
}

export function computeControlNeighbors(controls: Control[], controlId: string): ControlNeighbors {
  const idx = controls.findIndex((c) => c.control_id === controlId);
  if (idx === -1) {
    return { prev: null, next: null, prevFamily: null, nextFamily: null };
  }

  const basePath = controls[idx].url?.startsWith('/risk-lists/') ? '/risk-lists' : '/frameworks';
  const toNeighbor = (c: Control): ControlNeighbor => ({
    controlId: c.control_id,
    title: c.title,
    url: c.url || `${basePath}/${slugifyControlId(c.control_id)}`,
  });

  const prev = idx > 0 ? toNeighbor(controls[idx - 1]) : null;
  const next = idx < controls.length - 1 ? toNeighbor(controls[idx + 1]) : null;

  const family = controls[idx].family;
  const familyControls = controls.filter((c) => c.family === family);
  const fIdx = familyControls.findIndex((c) => c.control_id === controlId);
  const prevFamily = fIdx > 0 ? toNeighbor(familyControls[fIdx - 1]) : null;
  const nextFamily =
    fIdx < familyControls.length - 1 ? toNeighbor(familyControls[fIdx + 1]) : null;

  return { prev, next, prevFamily, nextFamily };
}

export function getCrossFrameworkMappingsFromIndex({
  index,
  controlId,
  frameworkId,
  stigNistMappings,
}: {
  index: CrosswalkIndexPayload;
  controlId: string;
  frameworkId: string;
  stigNistMappings?: string[];
}): CrossFrameworkMapping[] {
  const mappings: CrossFrameworkMapping[] = [];
  let inRegistry = false;

  for (const [a, b, aToB, bToA] of index.pairs) {
    if (a === frameworkId) {
      inRegistry = true;
      const ids = aToB[controlId];
      if (ids && ids.length > 0) {
        mappings.push({
          frameworkId: b,
          frameworkName: displayName(b),
          controlIds: ids,
        });
      }
    } else if (b === frameworkId) {
      inRegistry = true;
      const ids = bToA[controlId];
      if (ids && ids.length > 0) {
        mappings.push({
          frameworkId: a,
          frameworkName: displayName(a),
          controlIds: ids,
        });
      }
    }
  }

  if (!inRegistry && stigNistMappings && stigNistMappings.length > 0) {
    mappings.push({
      frameworkId: 'nist-800-53-r5',
      frameworkName: displayName('nist-800-53-r5'),
      controlIds: stigNistMappings,
    });
  }

  const sourceBridge = index.bridge.find(([fwId]) => fwId === frameworkId);
  const bridgeIds = sourceBridge?.[1]?.[controlId];
  if (bridgeIds && bridgeIds.length > 0) {
    const covered = new Set(mappings.map((m) => m.frameworkId));
    const derived: CrossFrameworkMapping[] = [];

    for (const [targetId, , targetFromBridge] of index.bridge) {
      if (targetId === frameworkId || covered.has(targetId)) continue;
      if (!(targetId in FRAMEWORK_CONFIGS)) continue;
      const collected = new Set<string>();
      for (const bid of bridgeIds) {
        for (const tid of targetFromBridge[bid] ?? []) {
          collected.add(tid);
        }
      }
      if (collected.size > 0) {
        derived.push({
          frameworkId: targetId,
          frameworkName: displayName(targetId),
          controlIds: Array.from(collected),
          derived: true,
        });
      }
    }

    derived.sort((a, b) => a.frameworkName.localeCompare(b.frameworkName));
    mappings.push(...derived);
  }

  return mappings;
}

export function getControlUrl(frameworkId: string, controlId: string): string {
  return `${getBasePath(frameworkId)}/${frameworkId}/${slugifyControlId(controlId)}`;
}
