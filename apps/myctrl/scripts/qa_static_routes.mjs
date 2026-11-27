#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'src', 'data');
const CONFIGS_PATH = join(DATA_DIR, 'framework-configs.ts');
const CONTROL_PAGE_PATH = join(ROOT, 'src', 'pages', 'frameworks', '[framework]', '[control].astro');
const FRAMEWORK_CONTROLS_ARE_SSR =
  existsSync(CONTROL_PAGE_PATH)
  && readFileSync(CONTROL_PAGE_PATH, 'utf8').includes('export const prerender = false');
const DIST_ROOT = join(ROOT, 'dist');
const DIST_DIR = resolveStaticDistDir();
const REPORT_DIR = join(ROOT, 'reports');

function resolveStaticDistDir() {
  const clientDir = join(DIST_ROOT, 'client');
  if (existsSync(join(DIST_ROOT, 'frameworks')) || existsSync(join(DIST_ROOT, 'risk-lists'))) {
    return DIST_ROOT;
  }
  if (existsSync(clientDir)) return clientDir;
  return DIST_ROOT;
}

function slugify(controlId) {
  return String(controlId)
    .toLowerCase()
    .replace(/\((\d+)\)/g, '-$1')
    .replace(/\./g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/-0+(\d)/g, '-$1');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function isFrameworkData(data) {
  return data
    && typeof data === 'object'
    && data.framework
    && typeof data.framework.id === 'string'
    && Array.isArray(data.controls);
}

function listFrameworkFiles() {
  return readdirSync(DATA_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => join(DATA_DIR, name))
    .filter((path) => {
      try {
        return isFrameworkData(readJson(path));
      } catch {
        return false;
      }
    });
}

function listCatalogConfigs() {
  const ts = readFileSync(CONFIGS_PATH, 'utf8');
  return [...ts.matchAll(/^  '([a-z0-9-]+)': \{[^\n]*(?:\n(?![ ]{2}'|\};)[^\n]*)*/gm)].map((m) => {
    const block = m[0];
    const name = (block.match(/name:\s*'([^']+)'/) || block.match(/name:\s*"([^"]+)"/))?.[1] || m[1];
    const type = block.match(/type:\s*'([^']+)'/)?.[1] || 'framework';
    return { id: m[1], name, type };
  });
}

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalText(value) {
  return visibleText(String(value))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getBuiltPath(basePath, frameworkId, controlId) {
  const segments = [DIST_DIR, basePath, frameworkId];
  if (controlId) segments.push(slugify(controlId));
  segments.push('index.html');
  return join(...segments);
}

function resolveBasePath(frameworkId) {
  if (existsSync(getBuiltPath('risk-lists', frameworkId))) return 'risk-lists';
  if (existsSync(getBuiltPath('frameworks', frameworkId))) return 'frameworks';
  return 'frameworks';
}

function includesExpectedText(html, expected) {
  if (!expected) return true;
  const text = canonicalText(html);
  const expectedText = canonicalText(expected);
  if (!expectedText) return true;
  if (text.includes(expectedText)) return true;

  const words = expectedText.split(' ').filter((word) => word.length > 2);
  if (words.length < 4) return words.every((word) => text.includes(word));
  return words.slice(0, 8).every((word) => text.includes(word));
}

function expectedControlText(control) {
  const title = String(control.title || '').trim();
  if (title.length >= 3 && !title.startsWith('<')) return title;
  return control.description || control.control_id;
}

function expectedFrameworkText(framework) {
  const name = String(framework.name || '').replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  return name || framework.description || framework.id;
}

function main() {
  if (!existsSync(DIST_ROOT)) {
    console.error('dist/ was not found. Run npm run build before npm run qa:routes.');
    return 1;
  }

  const issues = [];
  const summaries = [];
  const frameworkFiles = listFrameworkFiles();
  const catalogConfigs = listCatalogConfigs();
  const catalogById = new Map(catalogConfigs.map((cfg) => [cfg.id, cfg]));
  const loadedIds = new Set();

  for (const file of frameworkFiles) {
    const data = readJson(file);
    const frameworkId = data.framework.id;
    loadedIds.add(frameworkId);
    const basePath = resolveBasePath(frameworkId);
    const indexPath = getBuiltPath(basePath, frameworkId);

    if (!existsSync(indexPath)) {
      issues.push({
        code: 'framework_route_missing',
        frameworkId,
        path: relative(ROOT, indexPath),
      });
      continue;
    }

    const frameworkHtml = readFileSync(indexPath, 'utf8');
    const catalogCfg = catalogById.get(frameworkId);
    const frameworkExpected = expectedFrameworkText(catalogCfg ? { ...data.framework, name: catalogCfg.name } : data.framework);
    const fallbackExpected = expectedFrameworkText(data.framework);
    if (!includesExpectedText(frameworkHtml, frameworkExpected) && !includesExpectedText(frameworkHtml, fallbackExpected)) {
      issues.push({
        code: 'framework_route_blank_or_wrong',
        frameworkId,
        path: relative(ROOT, indexPath),
        expected: frameworkExpected,
      });
    }

    let checkedControls = 0;
    const ssrControls = basePath === 'frameworks' && FRAMEWORK_CONTROLS_ARE_SSR ? data.controls.length : 0;
    if (basePath !== 'frameworks' || !FRAMEWORK_CONTROLS_ARE_SSR) {
      for (const control of data.controls) {
        if (!control || !control.control_id) continue;
        checkedControls += 1;
        const controlPath = getBuiltPath(basePath, frameworkId, control.control_id);

        if (!existsSync(controlPath)) {
          issues.push({
            code: 'control_route_missing',
            frameworkId,
            controlId: control.control_id,
            path: relative(ROOT, controlPath),
          });
          continue;
        }

        const controlHtml = readFileSync(controlPath, 'utf8');
        const controlExpected = expectedControlText(control);
        if (!includesExpectedText(controlHtml, controlExpected)) {
          issues.push({
            code: 'control_route_blank_or_wrong',
            frameworkId,
            controlId: control.control_id,
            path: relative(ROOT, controlPath),
            expected: controlExpected,
          });
        }
      }
    }

    summaries.push({
      frameworkId,
      basePath,
      controls: checkedControls,
      ssrControls,
      externalOnly: false,
    });
  }

  let externalCount = 0;
  for (const cfg of listCatalogConfigs()) {
    if (loadedIds.has(cfg.id)) continue;
    externalCount += 1;
    const basePath = cfg.type === 'risk-list' ? 'risk-lists' : 'frameworks';
    const indexPath = getBuiltPath(basePath, cfg.id);

    if (!existsSync(indexPath)) {
      issues.push({
        code: 'external_framework_route_missing',
        frameworkId: cfg.id,
        path: relative(ROOT, indexPath),
      });
      continue;
    }

    const frameworkHtml = readFileSync(indexPath, 'utf8');
    const frameworkExpected = expectedFrameworkText({ id: cfg.id, name: cfg.name, description: cfg.name });
    if (!includesExpectedText(frameworkHtml, frameworkExpected)) {
      issues.push({
        code: 'external_framework_route_blank_or_wrong',
        frameworkId: cfg.id,
        path: relative(ROOT, indexPath),
        expected: frameworkExpected,
      });
    }

    summaries.push({
      frameworkId: cfg.id,
      basePath,
      controls: 0,
      externalOnly: true,
    });
  }

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(
    join(REPORT_DIR, 'static-route-qa.json'),
    JSON.stringify({ staticDir: relative(ROOT, DIST_DIR), summaries, issues }, null, 2),
  );

  const checked = summaries.reduce((total, item) => total + item.controls, 0);
  console.log(
    `Checked ${summaries.length - externalCount} built-in framework routes (${externalCount} external-only framework routes) and ${checked.toLocaleString()} control routes.`,
  );
  console.log(`Wrote ${relative(ROOT, join(REPORT_DIR, 'static-route-qa.json'))}`);

  if (issues.length > 0) {
    console.error(`${issues.length.toLocaleString()} route QA issue(s) found.`);
    issues.slice(0, 20).forEach((issue) => {
      console.error(`- ${issue.code}: ${issue.frameworkId}${issue.controlId ? ` ${issue.controlId}` : ''} (${issue.path})`);
    });
    if (issues.length > 20) {
      console.error(`- ... ${issues.length - 20} more`);
    }
    return 1;
  }

  return 0;
}

process.exitCode = main();
