import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const serverDir = join(root, 'dist', 'server');
const entryPath = join(serverDir, 'entry.mjs');
const astroEntryPath = join(serverDir, 'entry.astro.mjs');

if (!existsSync(entryPath)) {
  throw new Error(`Cloudflare entry not found at ${entryPath}. Run astro build first.`);
}

const entry = readFileSync(entryPath, 'utf8');

if (entry.includes('entry.astro.mjs')) {
  console.log('Cloudflare entry wrapper already installed.');
  process.exit(0);
}

renameSync(entryPath, astroEntryPath);

const wrapper = `globalThis.process ??= {};
globalThis.process.env ??= {};
import "cloudflare:workers";
import astroWorker from "./entry.astro.mjs";

const CANONICAL_HOST = "myctrl.tools";
const LEGACY_HOST = "www.myctrl.tools";
const LEGACY_RISK_LISTS = new Set([
  "owasp-llm-top10",
  "owasp-web-top10",
  "owasp-api-top10",
  "owasp-mobile-top10",
  "owasp-smart-contract-top10",
]);

function canonicalRedirectFor(request) {
  const url = new URL(request.url);
  let changed = false;

  if (url.hostname === LEGACY_HOST) {
    url.hostname = CANONICAL_HOST;
    changed = true;
  }

  const markdownMatch = url.pathname.match(/^\\/frameworks\\/([^/]+)\\.md$/);
  if (markdownMatch && LEGACY_RISK_LISTS.has(markdownMatch[1])) {
    url.pathname = \`/risk-lists/\${markdownMatch[1]}.md\`;
    changed = true;
  }

  const routeMatch = url.pathname.match(/^\\/frameworks\\/([^/]+)(\\/.*)?$/);
  if (routeMatch && LEGACY_RISK_LISTS.has(routeMatch[1])) {
    url.pathname = \`/risk-lists/\${routeMatch[1]}\${routeMatch[2] ?? ""}\`;
    changed = true;
  }

  return changed ? Response.redirect(url.toString(), 301) : null;
}

export default {
  async fetch(request, env, ctx) {
    const redirect = canonicalRedirectFor(request);
    if (redirect) return redirect;

    return astroWorker.fetch(request, env, ctx);
  },
};
`;

writeFileSync(entryPath, wrapper);
console.log('Wrapped Cloudflare entry with canonical redirect handler.');
