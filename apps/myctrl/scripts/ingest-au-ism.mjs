#!/usr/bin/env node
/**
 * Refresh the Australia ISM dataset from the official ACSC OSCAL catalog.
 *
 * To bump the release, verify the latest tag at
 * https://api.github.com/repos/AustralianCyberSecurityCentre/ism-oscal/releases/latest,
 * then update RELEASE_TAG below.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RELEASE_TAG = 'v2026.06.18';
const REPOSITORY_URL = 'https://github.com/AustralianCyberSecurityCentre/ism-oscal';
const RELEASE_URL = `${REPOSITORY_URL}/releases/tag/${RELEASE_TAG}`;
const CATALOG_URL =
  `https://raw.githubusercontent.com/AustralianCyberSecurityCentre/ism-oscal/${RELEASE_TAG}/ISM_catalog.json`;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = join(ROOT, 'src', 'data', 'au-ism.json');
const CONTROL_ID_PATTERN = /^ism-\d{4}$/i;
const OUTPUT_CONTROL_ID_PATTERN = /^ISM-\d{4}$/;
const INSERT_PATTERN = /\{\{\s*insert\b/i;
const XML_TAG_PATTERN = /<\/?[A-Za-z][^>]*>/;

function decodeHtmlEntities(value) {
  const namedEntities = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };

  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, name) => {
    if (name[0] === '#') {
      const radix = name[1]?.toLowerCase() === 'x' ? 16 : 10;
      const digits = radix === 16 ? name.slice(2) : name.slice(1);
      const codePoint = Number.parseInt(digits, radix);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    return namedEntities[name.toLowerCase()] ?? entity;
  });
}

function toPlainText(value) {
  if (typeof value !== 'string') return '';

  return decodeHtmlEntities(value)
    .replace(/\r\n?/g, '\n')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<\/?[A-Za-z][^>]*>/g, '')
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s).,;:!?])/g, '$1$2')
    .replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,;:!?])/g, '$1$2')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^(\s*)[-*+]\s+/gm, '$1• ')
    .replace(/\\([\\`*{}[\]()#+\-.!_>])/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function collectPartProse(parts) {
  const prose = [];

  for (const part of parts ?? []) {
    if (part.name === 'statement' && typeof part.prose === 'string') {
      prose.push(part.prose);
    }
    prose.push(...collectPartProse(part.parts));
  }

  return prose;
}

function extractControls(groups) {
  const controls = [];

  function visitGroup(group, family) {
    for (const control of group.controls ?? []) {
      if (!CONTROL_ID_PATTERN.test(control.id ?? '')) continue;

      const controlId = control.id.toUpperCase();
      const sourceTitle = toPlainText(control.title);
      const genericTitle = new RegExp(`^control:\\s*${control.id}$`, 'i');
      const statementProse = collectPartProse(control.parts);
      const description = toPlainText(statementProse.join('\n\n'));

      controls.push({
        control_id: controlId,
        title: genericTitle.test(sourceTitle) ? controlId : sourceTitle || controlId,
        family,
        description,
      });
    }

    for (const childGroup of group.groups ?? []) {
      visitGroup(childGroup, family);
    }
  }

  for (const group of groups ?? []) {
    const family = toPlainText(group.title);
    if (!family) continue;
    visitGroup(group, family);
  }

  return controls;
}

function formatVersion(version) {
  const match = /^(\d{4})\.(\d{2})\.\d{2}$/.exec(version ?? '');
  if (!match) return version;

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const month = monthNames[Number(match[2]) - 1];
  if (!month) return version;
  return `${month} ${match[1]}`;
}

function validate(data) {
  if (data.controls.length < 500 || data.controls.length > 5000) {
    throw new Error(`Unexpected ISM control count: ${data.controls.length}`);
  }

  const seenIds = new Set();
  for (const [index, control] of data.controls.entries()) {
    for (const field of ['control_id', 'title', 'family', 'description']) {
      if (typeof control[field] !== 'string' || !control[field].trim()) {
        throw new Error(`Control ${index + 1} has an empty ${field}`);
      }
    }
    if (!OUTPUT_CONTROL_ID_PATTERN.test(control.control_id)) {
      throw new Error(`Invalid ISM control id: ${control.control_id}`);
    }
    if (seenIds.has(control.control_id)) {
      throw new Error(`Duplicate ISM control id: ${control.control_id}`);
    }
    if (INSERT_PATTERN.test(control.description)) {
      throw new Error(`Unresolved OSCAL insert in ${control.control_id}`);
    }
    if (XML_TAG_PATTERN.test(control.description)) {
      throw new Error(`XML tag in ${control.control_id}`);
    }
    if ('related_controls' in control) {
      throw new Error(`Unexpected related_controls in ${control.control_id}`);
    }
    seenIds.add(control.control_id);
  }

  if ('related_controls_derived' in data) {
    throw new Error('Unexpected related_controls_derived marker');
  }
}

async function main() {
  const current = JSON.parse(readFileSync(OUTPUT_PATH, 'utf8'));
  const response = await fetch(CATALOG_URL);
  if (!response.ok) {
    throw new Error(`Failed to download ${CATALOG_URL}: ${response.status} ${response.statusText}`);
  }

  const source = await response.json();
  const catalog = source.catalog;
  if (!catalog || !Array.isArray(catalog.groups)) {
    throw new Error('Downloaded JSON is not an OSCAL catalog with groups');
  }

  const sourceVersion = catalog.metadata?.version;
  if (sourceVersion !== RELEASE_TAG.slice(1)) {
    throw new Error(
      `Release tag ${RELEASE_TAG} does not match catalog version ${sourceVersion ?? '(missing)'}`,
    );
  }

  const controls = extractControls(catalog.groups);
  const familyNames = [...new Set(controls.map((control) => control.family))];
  const data = {
    ...current,
    framework: {
      ...current.framework,
      version: formatVersion(sourceVersion),
    },
    families: Object.fromEntries(familyNames.map((family) => [family, family])),
    controls,
  };
  delete data.related_controls_derived;

  validate(data);
  writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2) + '\n');

  console.log(`Source: ${RELEASE_URL}`);
  console.log(`Updated au-ism: ${current.controls?.length ?? 0} -> ${controls.length} controls`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
