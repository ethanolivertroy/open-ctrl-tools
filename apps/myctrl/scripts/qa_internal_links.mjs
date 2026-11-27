#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST_ROOT = join(ROOT, 'dist');
const DIST_DIR = resolveStaticDistDir();
const PAGES_DIR = join(ROOT, 'src', 'pages');
const REPORT_DIR = join(ROOT, 'reports');
const REPORT_PATH = join(REPORT_DIR, 'internal-link-qa.json');

const INTERNAL_ORIGIN = 'https://myctrl.tools';
const LINK_ATTR_PATTERN = /\b(?:href|src)=("|')([^"']+)\1/g;
const IGNORED_SCHEMES = [
  'blob:',
  'data:',
  'javascript:',
  'mailto:',
  'tel:',
];

function resolveStaticDistDir() {
  const clientDir = join(DIST_ROOT, 'client');
  if (existsSync(clientDir)) return clientDir;
  return DIST_ROOT;
}

function walkHtmlFiles(dir, out = []) {
  if (!existsSync(dir)) return out;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkHtmlFiles(path, out);
    } else if (entry.isFile() && extname(path) === '.html') {
      out.push(path);
    }
  }

  return out;
}

function routeExists(pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURI(pathname);
  } catch {
    decodedPath = pathname;
  }

  if (decodedPath === '/') return existsSync(join(DIST_DIR, 'index.html'));

  const normalized = decodedPath.replace(/\/$/, '');
  return (
    existsSync(join(DIST_DIR, normalized, 'index.html'))
    || existsSync(join(DIST_DIR, normalized))
    || existsSync(join(DIST_DIR, `${normalized}.html`))
    || serverRouteExists(normalized)
  );
}

function serverRouteExists(pathname) {
  const segments = pathname.replace(/^\//, '').split('/').filter(Boolean);
  const routeFile = findServerRouteFile(PAGES_DIR, segments);
  if (!routeFile) return false;

  const source = readFileSync(routeFile, 'utf8');
  return source.includes('export const prerender = false');
}

function findServerRouteFile(dir, segments) {
  if (segments.length === 0) {
    return findPageFile(dir, 'index');
  }

  const [head, ...tail] = segments;
  const exactDir = join(dir, head);

  if (tail.length === 0) {
    const exactFile = findPageFile(dir, head);
    if (exactFile) return exactFile;
    const indexFile = findPageFile(exactDir, 'index');
    if (indexFile) return indexFile;
  }

  if (existsSync(exactDir)) {
    const exactMatch = findServerRouteFile(exactDir, tail);
    if (exactMatch) return exactMatch;
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.name.startsWith('[')) continue;

    const candidate = join(dir, entry.name);
    if (entry.isDirectory()) {
      const dynamicMatch = findServerRouteFile(candidate, tail);
      if (dynamicMatch) return dynamicMatch;
    } else if (tail.length === 0 && entry.isFile() && pageFileBase(entry.name).startsWith('[')) {
      return candidate;
    }
  }

  return null;
}

function findPageFile(dir, basename) {
  for (const ext of ['.astro', '.md', '.mdx', '.ts', '.js']) {
    const path = join(dir, `${basename}${ext}`);
    if (existsSync(path)) return path;
  }
  return null;
}

function pageFileBase(filename) {
  return filename.replace(/\.(astro|md|mdx|ts|js)$/, '');
}

function shouldSkip(rawUrl, url) {
  if (!rawUrl || rawUrl.startsWith('#')) return true;
  if (IGNORED_SCHEMES.some((scheme) => rawUrl.startsWith(scheme))) return true;
  if (rawUrl.startsWith('//')) return true;
  if (url.origin !== INTERNAL_ORIGIN) return true;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/cdn-cgi/')) return true;
  return false;
}

function main() {
  if (!existsSync(DIST_ROOT)) {
    console.error('dist/ was not found. Run npm run build before npm run qa:links.');
    return 1;
  }

  const htmlFiles = walkHtmlFiles(DIST_DIR);
  const broken = new Map();

  for (const file of htmlFiles) {
    const html = readFileSync(file, 'utf8');
    let match;

    while ((match = LINK_ATTR_PATTERN.exec(html))) {
      const rawUrl = match[2]
        .replace(/&amp;/g, '&')
        .replace(/&#38;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      let url;

      try {
        url = new URL(rawUrl, INTERNAL_ORIGIN);
      } catch {
        continue;
      }

      if (shouldSkip(rawUrl, url)) continue;
      if (routeExists(url.pathname)) continue;

      const route = url.pathname;
      if (!broken.has(route)) {
        broken.set(route, {
          route,
          examples: [],
          count: 0,
        });
      }

      const issue = broken.get(route);
      issue.count += 1;
      if (issue.examples.length < 10) {
        issue.examples.push(relative(DIST_DIR, file));
      }
    }
  }

  const issues = [...broken.values()].sort((a, b) => b.count - a.count || a.route.localeCompare(b.route));

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(
    REPORT_PATH,
    JSON.stringify({
      staticDir: relative(ROOT, DIST_DIR),
      checkedHtmlFiles: htmlFiles.length,
      brokenRouteCount: issues.length,
      issues,
    }, null, 2),
  );

  console.log(`Checked ${htmlFiles.length.toLocaleString()} HTML files.`);
  console.log(`Wrote ${relative(ROOT, REPORT_PATH)}`);

  if (issues.length > 0) {
    console.error(`${issues.length.toLocaleString()} broken internal route(s) found.`);
    for (const issue of issues.slice(0, 20)) {
      console.error(`- ${issue.route} (${issue.count} refs)`);
    }
    if (issues.length > 20) {
      console.error(`- ... ${issues.length - 20} more`);
    }
    return 1;
  }

  return 0;
}

process.exitCode = main();
