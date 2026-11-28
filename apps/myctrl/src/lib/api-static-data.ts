import type { APIContext } from 'astro';
import type { Control, FrameworkConfig } from '@/data/types';
import type { CloudImplementation } from '@/data/cloud-implementations';

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

export interface ControlSearchPayload {
  entries: SerializedControlSearchEntry[];
  frameworkEntries: SerializedFrameworkSearchEntry[];
}

export type SerializedCrosswalkPair = [
  a: string,
  b: string,
  aToB: Record<string, string[]>,
  bToA: Record<string, string[]>,
];

export type SerializedBridgeEntry = [
  frameworkId: string,
  toBridge: Record<string, string[]>,
  fromBridge: Record<string, string[]>,
];

export interface CrosswalkIndexPayload {
  pairs: SerializedCrosswalkPair[];
  bridge: SerializedBridgeEntry[];
}

export interface FrameworkManifestEntry {
  id: string;
  name: string;
  version: string;
  description: string;
  type: 'framework' | 'risk-list';
  basePath: '/frameworks' | '/risk-lists';
  loaded: boolean;
  controlCount: number;
  familyLabel: string;
  itemLabel: string;
  tags: string[];
  license: string;
  officialUrl?: string;
  families: Array<{ code: string; name: string; count: number }>;
  crosswalkTargets: string[];
}

export interface FrameworkManifestPayload {
  generatedAt: string;
  loadedCount: number;
  totalLoadedControls: number;
  loadedIds: string[];
  frameworks: FrameworkManifestEntry[];
}

export interface FrameworkDatasetPayload {
  id: string;
  config: FrameworkConfig;
  basePath: '/frameworks' | '/risk-lists';
  families: Record<string, string>;
  controls: Control[];
  stigNistMappings?: Record<string, string[]>;
  cloudImplementations?: Record<string, CloudImplementation>;
  relevantTechnologies?: Record<string, Array<{ id: string; name: string; path: string }>>;
}

let controlSearchPayloadPromise: Promise<ControlSearchPayload> | null = null;
let crosswalkIndexPayloadPromise: Promise<CrosswalkIndexPayload> | null = null;
let frameworkManifestPayloadPromise: Promise<FrameworkManifestPayload> | null = null;
const frameworkDatasetPromises = new Map<string, Promise<FrameworkDatasetPayload>>();

async function fetchStaticJson<T>(context: APIContext, path: string): Promise<T> {
  const url = new URL(path, context.request.url);
  const init = { headers: { accept: 'application/json' } };
  let assets: { fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> } | undefined;

  try {
    const workers = await import('cloudflare:workers');
    assets = (workers as { env?: { ASSETS?: typeof assets } }).env?.ASSETS;
  } catch {
    // Non-Workers runtime (Node/Vitest/local) falls back to regular fetch.
  }

  const response = assets ? await assets.fetch(url.href, init) : await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Unable to load static API artifact ${path}`);
  }

  return response.json() as Promise<T>;
}

export function getControlSearchPayload(context: APIContext): Promise<ControlSearchPayload> {
  controlSearchPayloadPromise ??= fetchStaticJson<ControlSearchPayload>(
    context,
    '/api/search/control-index.json',
  );
  return controlSearchPayloadPromise;
}

export function getCrosswalkIndexPayload(context: APIContext): Promise<CrosswalkIndexPayload> {
  crosswalkIndexPayloadPromise ??= fetchStaticJson<CrosswalkIndexPayload>(
    context,
    '/api/search/crosswalk-index.json',
  );
  return crosswalkIndexPayloadPromise;
}

export function getFrameworkManifestPayload(context: APIContext): Promise<FrameworkManifestPayload> {
  frameworkManifestPayloadPromise ??= fetchStaticJson<FrameworkManifestPayload>(
    context,
    '/data/frameworks/manifest.json',
  );
  return frameworkManifestPayloadPromise;
}

export function getFrameworkJsonPayload(
  context: APIContext,
  frameworkId: string,
): Promise<FrameworkDatasetPayload> {
  let cached = frameworkDatasetPromises.get(frameworkId);
  if (!cached) {
    cached = fetchStaticJson<FrameworkDatasetPayload>(
      context,
      `/data/frameworks/${encodeURIComponent(frameworkId)}.json`,
    ).catch((err) => {
      frameworkDatasetPromises.delete(frameworkId);
      throw err;
    });
    frameworkDatasetPromises.set(frameworkId, cached);
  }
  return cached;
}

export { slugifyControlId } from '@/lib/slugify';

export function findFramework(
  payload: ControlSearchPayload,
  frameworkId: string,
): SerializedFrameworkSearchEntry | undefined {
  return payload.frameworkEntries.find((entry) => entry[0] === frameworkId);
}

export function isRiskListHref(href: string): boolean {
  return href.startsWith('/risk-lists/');
}
