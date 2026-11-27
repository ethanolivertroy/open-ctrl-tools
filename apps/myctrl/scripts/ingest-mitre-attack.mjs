#!/usr/bin/env node
/**
 * Build src/data/mitre-attack.json from the official MITRE ATT&CK STIX release.
 *
 * Source (Enterprise ATT&CK v19.2):
 *   https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack-19.2.json
 *
 * License / attribution (from attack-stix-data LICENSE.txt):
 *   © 2026 The MITRE Corporation. This work is reproduced and distributed
 *   with the permission of The MITRE Corporation.
 *
 * Usage:
 *   node scripts/ingest-mitre-attack.mjs
 *
 * Caches the raw STIX bundle under /tmp (not committed). Re-runs skip the
 * download when the cache file already exists.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '19.2';
const SOURCE_URL =
  'https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack-19.2.json';
const ATTRIBUTION =
  '© 2026 The MITRE Corporation. This work is reproduced and distributed with the permission of The MITRE Corporation.';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = join(ROOT, 'src', 'data', 'mitre-attack.json');
const CACHE_PATH = join('/tmp', `enterprise-attack-${VERSION}.json`);

/** Fallback title-casing when a phase is missing from x-mitre-tactic objects. */
function titleCasePhase(phaseName) {
  return phaseName
    .split('-')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

/**
 * Clean STIX technique descriptions for display:
 * - strip (Citation: ...) markers
 * - collapse markdown links [text](url) → text
 * - normalize whitespace while keeping paragraph breaks
 */
function cleanDescription(raw) {
  if (typeof raw !== 'string') return '';

  let text = raw.replace(/\r\n?/g, '\n');
  // Citations may nest parentheses sparingly; strip common ATT&CK forms.
  text = text.replace(/\s*\(Citation:\s*[^)]+\)/gi, '');
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  // The site renders descriptions as plain text (React-escaped), so real HTML
  // must go: unwrap <code>/<b>, turn <br> into newlines, decode entities.
  // Placeholder tokens like <username> or <PID> are literal text - keep them.
  text = text.replace(/<\/?(?:code|b)>/g, '');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&lbrace;/g, '{')
    .replace(/&rbrace;/g, '}')
    .replace(/&amp;/g, '&');
  text = text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

function slugify(id) {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getAttackRef(obj) {
  return (obj.external_references ?? []).find((ref) => ref.source_name === 'mitre-attack');
}

function buildTacticNameMap(objects) {
  const map = new Map();
  for (const obj of objects) {
    if (obj.type !== 'x-mitre-tactic') continue;
    if (obj.revoked === true || obj.x_mitre_deprecated === true) continue;
    if (typeof obj.x_mitre_shortname === 'string' && typeof obj.name === 'string') {
      map.set(obj.x_mitre_shortname, obj.name);
    }
  }
  return map;
}

function tacticNamesFor(obj, tacticNameMap) {
  const phases = (obj.kill_chain_phases ?? []).filter(
    (phase) => phase.kill_chain_name === 'mitre-attack' && typeof phase.phase_name === 'string',
  );
  return phases.map(
    (phase) => tacticNameMap.get(phase.phase_name) ?? titleCasePhase(phase.phase_name),
  );
}

async function loadBundle() {
  if (existsSync(CACHE_PATH)) {
    console.log(`Using cached STIX bundle: ${CACHE_PATH}`);
    return JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
  }

  console.log(`Downloading ${SOURCE_URL}`);
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Failed to download STIX bundle: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  // Validate JSON before writing cache.
  const bundle = JSON.parse(text);
  writeFileSync(CACHE_PATH, text);
  console.log(`Cached STIX bundle at ${CACHE_PATH} (${statSync(CACHE_PATH).size} bytes)`);
  return bundle;
}

function transform(bundle) {
  const objects = bundle.objects ?? [];
  const tacticNameMap = buildTacticNameMap(objects);

  const candidates = [];
  for (const obj of objects) {
    if (obj.type !== 'attack-pattern') continue;
    if (obj.revoked === true || obj.x_mitre_deprecated === true) continue;

    const attackRef = getAttackRef(obj);
    const controlId = attackRef?.external_id;
    if (!controlId) continue;

    const description = cleanDescription(obj.description);
    if (!description) {
      throw new Error(`Empty description after cleaning for ${controlId}`);
    }

    const tactics = tacticNamesFor(obj, tacticNameMap);
    if (tactics.length === 0) {
      throw new Error(`No mitre-attack kill_chain_phases for ${controlId}`);
    }

    const isSubtechnique =
      typeof obj.x_mitre_is_subtechnique === 'boolean'
        ? obj.x_mitre_is_subtechnique
        : controlId.includes('.');

    candidates.push({
      control_id: controlId,
      title: obj.name,
      family: tactics[0],
      description,
      tactics,
      is_subtechnique: isSubtechnique,
      attack_url: attackRef.url ?? `https://attack.mitre.org/techniques/${controlId.replace('.', '/')}`,
    });
  }

  candidates.sort((a, b) => a.control_id.localeCompare(b.control_id, 'en'));

  const idSet = new Set(candidates.map((c) => c.control_id));
  const controls = candidates.map((control) => {
    const related = new Set();
    if (control.is_subtechnique) {
      const parentId = control.control_id.split('.')[0];
      if (idSet.has(parentId)) related.add(parentId);
    } else {
      const prefix = `${control.control_id}.`;
      for (const id of idSet) {
        if (id.startsWith(prefix)) related.add(id);
      }
    }

    const relatedControls = [...related].sort((a, b) => a.localeCompare(b, 'en'));
    return relatedControls.length > 0
      ? { ...control, related_controls: relatedControls }
      : { ...control };
  });

  const familyNames = [...new Set(controls.map((c) => c.family))].sort((a, b) =>
    a.localeCompare(b, 'en'),
  );

  return {
    version: VERSION,
    source: SOURCE_URL,
    attribution: ATTRIBUTION,
    framework: {
      id: 'mitre-attack',
      name: 'MITRE ATT&CK',
      version: VERSION,
      description:
        'Adversarial Tactics, Techniques & Common Knowledge - attack taxonomy that maps across security frameworks',
    },
    families: Object.fromEntries(familyNames.map((name) => [name, name])),
    controls,
  };
}

function validate(data) {
  const errors = [];
  const controls = data.controls;
  const ids = new Set();
  const slugs = new Map();
  let parents = 0;
  let subs = 0;
  const perTactic = {};

  if (!Array.isArray(controls) || controls.length === 0) {
    errors.push('controls array missing or empty');
  }

  for (const control of controls) {
    const { control_id: id, description, family, title, related_controls: related } = control;

    if (!id || !title || !family || !description) {
      errors.push(`Missing required field on control ${id ?? '(unknown)'}`);
      continue;
    }
    if (ids.has(id)) errors.push(`Duplicate control_id: ${id}`);
    ids.add(id);

    const slug = slugify(id);
    if (slugs.has(slug)) {
      errors.push(`Slug collision: ${id} and ${slugs.get(slug)} both slugify to ${slug}`);
    } else {
      slugs.set(slug, id);
    }

    if (!description.trim()) errors.push(`Empty description: ${id}`);
    if (/\(Citation:/i.test(description)) {
      errors.push(`Citation remnant in description: ${id}`);
    }
    if (!Array.isArray(control.tactics) || control.tactics.length === 0) {
      errors.push(`Missing tactics array: ${id}`);
    }
    if (typeof control.is_subtechnique !== 'boolean') {
      errors.push(`Missing is_subtechnique: ${id}`);
    }
    if (typeof control.attack_url !== 'string' || !control.attack_url.startsWith('http')) {
      errors.push(`Missing attack_url: ${id}`);
    }

    if (related) {
      for (const relatedId of related) {
        if (!ids.has(relatedId) && !controls.some((c) => c.control_id === relatedId)) {
          // deferred: ids set incomplete mid-loop; check after
        }
      }
    }

    if (control.is_subtechnique) subs += 1;
    else parents += 1;
    perTactic[family] = (perTactic[family] ?? 0) + 1;
  }

  // Full-set dangling related_controls check
  for (const control of controls) {
    for (const relatedId of control.related_controls ?? []) {
      if (!ids.has(relatedId)) {
        errors.push(`Dangling related_controls on ${control.control_id}: ${relatedId}`);
      }
    }
  }

  // Bidirectional parent/sub sanity: every related id should reciprocate when both exist
  const byId = new Map(controls.map((c) => [c.control_id, c]));
  for (const control of controls) {
    for (const relatedId of control.related_controls ?? []) {
      const other = byId.get(relatedId);
      if (!other) continue;
      const back = other.related_controls ?? [];
      if (!back.includes(control.control_id)) {
        errors.push(
          `related_controls not bidirectional: ${control.control_id} → ${relatedId} missing reverse`,
        );
      }
    }
  }

  if (parents < 200) errors.push(`Expected 200+ parent techniques, got ${parents}`);
  if (subs < 400) errors.push(`Expected 400+ sub-techniques, got ${subs}`);

  return { errors, parents, subs, perTactic, total: controls.length };
}

async function main() {
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });

  const bundle = await loadBundle();
  const data = transform(bundle);
  const { errors, parents, subs, perTactic, total } = validate(data);

  if (errors.length > 0) {
    console.error('Validation failed:');
    for (const error of errors.slice(0, 50)) console.error(`  - ${error}`);
    if (errors.length > 50) console.error(`  ... and ${errors.length - 50} more`);
    process.exitCode = 1;
    return;
  }

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(data, null, 2)}\n`);
  const size = statSync(OUTPUT_PATH).size;

  console.log(`Source: ${SOURCE_URL}`);
  console.log(`Attribution: ${ATTRIBUTION}`);
  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(`File size: ${size} bytes (${(size / (1024 * 1024)).toFixed(2)} MiB)`);
  console.log(`Total controls: ${total} (${parents} parent techniques, ${subs} sub-techniques)`);
  console.log('Controls per tactic (family = first kill_chain phase):');
  for (const tactic of Object.keys(perTactic).sort((a, b) => a.localeCompare(b, 'en'))) {
    console.log(`  ${tactic}: ${perTactic[tactic]}`);
  }
  console.log('Validation: PASS (no duplicates, no slug collisions, no dangling related_controls, no empty descriptions, no Citation remnants)');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
