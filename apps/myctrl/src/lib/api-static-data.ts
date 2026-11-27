import type { APIContext } from 'astro';

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

let controlSearchPayloadPromise: Promise<ControlSearchPayload> | null = null;
let crosswalkIndexPayloadPromise: Promise<CrosswalkIndexPayload> | null = null;

async function fetchStaticJson<T>(context: APIContext, path: string): Promise<T> {
  const url = new URL(path, context.request.url);
  const { env } = await import('cloudflare:workers');
  const init = { headers: { accept: 'application/json' } };
  const response = env.ASSETS
    ? await env.ASSETS.fetch(url.href, init)
    : await fetch(url, init);

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
