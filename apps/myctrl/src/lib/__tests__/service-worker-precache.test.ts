import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');
const source = readFileSync(resolve(root, 'public/sw.js'), 'utf8');

function precacheUrls(): string[] {
  const offline = /const OFFLINE_URL = '([^']+)'/.exec(source)?.[1];
  const list = /const PRECACHE_URLS = \[([\s\S]*?)\];/.exec(source)?.[1];
  if (!offline || !list) throw new Error('sw.js no longer declares OFFLINE_URL / PRECACHE_URLS');
  return list
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, '').trim().replace(/,$/, ''))
    .filter(Boolean)
    .map((entry) => (entry === 'OFFLINE_URL' ? offline : entry.replace(/^'|'$/g, '')));
}

/** Where a precached URL comes from in the source tree, or null if nothing serves it. */
function sourceFor(url: string): string | null {
  const candidates = url.endsWith('/')
    ? [`src/pages${url === '/' ? '/index' : url.slice(0, -1)}.astro`, `src/pages${url}index.astro`]
    : [`public${url}`, `src/pages${url}.ts`];
  return candidates.find((candidate) => existsSync(resolve(root, candidate))) ?? null;
}

describe('service worker precache list', () => {
  const urls = precacheUrls();

  it('only lists URLs the site actually serves', () => {
    // A single missing URL used to reject the whole precache, offline fallback included.
    const missing = urls.filter((url) => sourceFor(url) === null);
    expect(missing).toEqual([]);
  });

  it('includes the offline fallback it serves when a navigation fails', () => {
    expect(urls).toContain('/offline/');
    expect(source).toContain('caches.match(OFFLINE_URL)');
  });

  it('lists pages at their canonical trailing-slash URL', () => {
    // The host redirects `/all` to `/all/`; a redirected response cannot answer a navigation.
    const pages = urls.filter((url) => !/\.[a-z]+$/.test(url));
    expect(pages.length).toBeGreaterThan(0);
    for (const page of pages) expect(page.endsWith('/')).toBe(true);
  });
});
