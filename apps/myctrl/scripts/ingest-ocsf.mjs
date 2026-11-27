#!/usr/bin/env node
/**
 * Build src/data/ocsf.json from the official OCSF schema server export (v1.9.0).
 *
 * Source:
 *   https://schema.ocsf.io/1.9.0/export/v2/schema
 *
 * The legacy /export/schema endpoint returns HTTP 400 for 1.9.0 (profile
 * collision in the legacy format). The versioned v2 export is the supported
 * compiled-schema download.
 *
 * License: Apache-2.0 (https://github.com/ocsf/ocsf-schema)
 *
 * Usage:
 *   node scripts/ingest-ocsf.mjs
 *
 * Caches the raw export under /tmp (not committed). Re-runs skip the download
 * when the cache file already exists.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '1.9.0';
const SOURCE_URL = `https://schema.ocsf.io/${VERSION}/export/v2/schema`;
const LICENSE = 'Apache-2.0';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = join(ROOT, 'src', 'data', 'ocsf.json');
const CACHE_DIR = '/tmp/ocsf-cache';
const CACHE_PATH = join(CACHE_DIR, `ocsf-${VERSION}-v2-schema.json`);

function slugify(id) {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function decodeHtmlEntities(value) {
  const named = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
    mdash: '—',
    ndash: '–',
  };

  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, name) => {
    if (name[0] === '#') {
      const radix = name[1]?.toLowerCase() === 'x' ? 16 : 10;
      const digits = radix === 16 ? name.slice(2) : name.slice(1);
      const codePoint = Number.parseInt(digits, radix);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    return named[name.toLowerCase()] ?? entity;
  });
}

/** Strip HTML to plain text for control descriptions. */
function toPlainText(value) {
  if (typeof value !== 'string') return '';

  return decodeHtmlEntities(value)
    .replace(/\r\n?/g, '\n')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*p\s*>/gi, '\n\n')
    .replace(/<\/\s*li\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<\/?[A-Za-z][^>]*>/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function categoryCaptionMap(schema) {
  const attrs = schema.categories?.attributes ?? {};
  const map = new Map();
  for (const [key, cat] of Object.entries(attrs)) {
    if (typeof cat?.caption === 'string' && cat.caption.trim()) {
      map.set(key, cat.caption.trim());
    }
  }
  return map;
}

/**
 * Required attributes belonging to the class itself (not injected solely by a
 * profile). Profile-scoped fields still appear as requirement=required in the
 * full compiled export when profiles are enabled.
 */
function requiredAttributeCaptions(attributes) {
  const captions = [];
  const seen = new Set();

  for (const attr of Object.values(attributes ?? {})) {
    if (attr?.requirement !== 'required') continue;
    if (Array.isArray(attr.profiles) && attr.profiles.length > 0) continue;
    const caption = typeof attr.caption === 'string' ? attr.caption.trim() : '';
    if (!caption || seen.has(caption)) continue;
    seen.add(caption);
    captions.push(caption);
  }

  return captions;
}

function isSkippedClass(classKey, cls) {
  // Abstract/generic base event (uid 0, category "other").
  if (classKey === 'base_event' || cls?.name === 'base_event' || cls?.uid === 0) {
    return 'base_event';
  }
  if (cls?.['@deprecated']) {
    return 'deprecated';
  }
  return null;
}

async function loadSchema() {
  if (existsSync(CACHE_PATH)) {
    console.log(`Using cached OCSF schema: ${CACHE_PATH}`);
    return JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
  }

  mkdirSync(CACHE_DIR, { recursive: true });
  console.log(`Downloading ${SOURCE_URL}`);
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Failed to download OCSF schema: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  const schema = JSON.parse(text);
  if (schema.version !== VERSION) {
    throw new Error(`Expected schema version ${VERSION}, got ${schema.version ?? '(missing)'}`);
  }

  writeFileSync(CACHE_PATH, text);
  console.log(`Cached OCSF schema at ${CACHE_PATH} (${statSync(CACHE_PATH).size} bytes)`);
  return schema;
}

function transform(schema) {
  const categories = categoryCaptionMap(schema);
  const skipped = { base_event: 0, deprecated: 0 };
  const controls = [];

  for (const [classKey, cls] of Object.entries(schema.classes ?? {})) {
    const reason = isSkippedClass(classKey, cls);
    if (reason) {
      skipped[reason] += 1;
      continue;
    }

    const classUid = cls.uid;
    if (typeof classUid !== 'number' || !Number.isFinite(classUid)) {
      throw new Error(`Class ${classKey} is missing a numeric uid`);
    }

    const className = typeof cls.name === 'string' && cls.name ? cls.name : classKey.split('/').pop();
    const title = typeof cls.caption === 'string' && cls.caption.trim() ? cls.caption.trim() : className;

    const categoryKey = cls.category;
    let family =
      (typeof categoryKey === 'string' && categories.get(categoryKey)) ||
      (typeof cls.category_name === 'string' && cls.category_name.trim()) ||
      '';

    // Uncategorized / "other" — only base_event normally lands here; keep a
    // labeled bucket rather than inventing a fake category.
    if (!family) {
      family = categoryKey === 'other' || !categoryKey ? 'Other' : String(categoryKey);
    }

    const baseDescription = toPlainText(cls.description);
    if (!baseDescription) {
      throw new Error(`Empty description for class ${classKey} (uid ${classUid})`);
    }

    const required = requiredAttributeCaptions(cls.attributes);
    const requiredParagraph =
      required.length > 0
        ? `Required attributes: ${required.join(', ')}.`
        : 'Required attributes: none beyond the OCSF base event fields.';

    const description = `${baseDescription}\n\n${requiredParagraph}`;

    // Browser paths for extensions use the extension/name key (e.g. win/...).
    const urlPath = classKey.includes('/') ? classKey : className;

    controls.push({
      control_id: `OCSF-${classUid}`,
      title,
      family,
      description,
      class_uid: classUid,
      class_name: className,
      ocsf_url: `https://schema.ocsf.io/${VERSION}/classes/${urlPath}`,
    });
  }

  controls.sort((a, b) => {
    if (a.class_uid !== b.class_uid) return a.class_uid - b.class_uid;
    return a.control_id.localeCompare(b.control_id, 'en');
  });

  const familyNames = [...new Set(controls.map((c) => c.family))].sort((a, b) =>
    a.localeCompare(b, 'en'),
  );

  return {
    version: VERSION,
    source: SOURCE_URL,
    license: LICENSE,
    framework: {
      id: 'ocsf',
      name: 'OCSF',
      version: VERSION,
      description:
        'Open Cybersecurity Schema Framework - open standard for security data normalization across tools and vendors',
    },
    families: Object.fromEntries(familyNames.map((name) => [name, name])),
    controls,
    _meta: { skipped },
  };
}

function validate(data) {
  const errors = [];
  const controls = data.controls;
  const ids = new Set();
  const slugs = new Map();
  const byFamily = new Map();

  if (!Array.isArray(controls) || controls.length === 0) {
    errors.push('controls array is empty or missing');
  }

  for (const control of controls) {
    const { control_id, title, family, description, class_uid, class_name, ocsf_url } = control;

    if (!control_id || typeof control_id !== 'string') {
      errors.push(`Missing control_id for class_uid=${class_uid}`);
      continue;
    }
    if (ids.has(control_id)) errors.push(`Duplicate control_id: ${control_id}`);
    ids.add(control_id);

    const slug = slugify(control_id);
    if (!slug) errors.push(`Empty slug for ${control_id}`);
    if (slugs.has(slug)) {
      errors.push(`Slug collision: ${slug} (${slugs.get(slug)} vs ${control_id})`);
    } else {
      slugs.set(slug, control_id);
    }

    if (!title || typeof title !== 'string') errors.push(`Empty title for ${control_id}`);
    if (!family || typeof family !== 'string') errors.push(`Empty family for ${control_id}`);
    if (!description || typeof description !== 'string' || !description.trim()) {
      errors.push(`Empty description for ${control_id}`);
    }
    if (typeof class_uid !== 'number') errors.push(`Missing class_uid for ${control_id}`);
    if (!class_name) errors.push(`Missing class_name for ${control_id}`);
    if (!ocsf_url?.startsWith(`https://schema.ocsf.io/${VERSION}/classes/`)) {
      errors.push(`Bad ocsf_url for ${control_id}: ${ocsf_url}`);
    }
    if ('related_controls' in control) {
      errors.push(`${control_id} should not invent related_controls`);
    }

    byFamily.set(family, (byFamily.get(family) || 0) + 1);
  }

  return { errors, byFamily, total: controls.length };
}

function printSummary(data, validation) {
  console.log('\nOCSF ingest summary');
  console.log(`  source:   ${data.source}`);
  console.log(`  version:  ${data.version}`);
  console.log(`  license:  ${data.license}`);
  console.log(`  classes:  ${validation.total}`);
  console.log(`  skipped:  base_event=${data._meta.skipped.base_event}, deprecated=${data._meta.skipped.deprecated}`);
  console.log('  per category:');
  for (const [family, count] of [...validation.byFamily.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], 'en'),
  )) {
    console.log(`    ${family}: ${count}`);
  }

  console.log('\nValidation: OK (no duplicate ids, no slug collisions, no empty descriptions/families)');
}

async function main() {
  const schema = await loadSchema();
  const data = transform(schema);
  const validation = validate(data);

  // Fail before touching the canonical dataset so a bad upstream export
  // can never leave src/data/ocsf.json corrupted.
  if (validation.errors.length > 0) {
    console.error('\nValidation errors:');
    for (const err of validation.errors) console.error(`  - ${err}`);
    throw new Error(`OCSF ingest validation failed with ${validation.errors.length} error(s)`);
  }

  const { _meta, ...output } = data;
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`\nWrote ${OUTPUT_PATH} (${statSync(OUTPUT_PATH).size} bytes)`);

  // Attach skip stats for the summary only (not written to the dataset).
  printSummary({ ...output, _meta }, validation);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
