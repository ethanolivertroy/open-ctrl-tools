#!/usr/bin/env node
/**
 * Framework data completeness audit.
 *
 * Scores every framework registered in src/data/framework-configs.ts on the
 * data dimensions the site actually renders (see ControlDetail.tsx and
 * sections/section-content.ts):
 *   - control descriptions (length)
 *   - assessment_questions (BaseControl, rendered for every framework)
 *   - related_controls (BaseControl)
 *   - framework-specific prose fields (discussion, supplemental_guidance, ...)
 *   - crosswalk bridge coverage (ccf-crosswalks.json + ccf-extended-crosswalks.json)
 *
 * Output: scripts/data/reports/framework-completeness.json and .md,
 * tiered worst-first so the enrichment queue falls out of the report.
 *
 * Usage: node scripts/audit-framework-completeness.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'src', 'data');
const REPORT_DIR = join(ROOT, 'scripts', 'data', 'reports');

const BASE_FIELDS = new Set(['control_id', 'title', 'family', 'description', 'url']);
const ENRICHMENT_BASE_FIELDS = ['assessment_questions', 'related_controls'];
// Long-form prose fields rendered by section-content.ts / per-framework sections.
const PROSE_FIELDS = [
  'supplemental_guidance', 'discussion', 'guidance', 'about', 'suggested_actions',
  'testing_procedures', 'check_content', 'fix_text', 'implementation_guidance',
  'examples', 'purpose', 'assessment_objectives', 'further_discussion',
];
const DESC_OK_CHARS = 120;

function parseConfigs(src) {
  const configs = [];
  // Entries are either multi-line blocks or single-line objects, both opening
  // with `'id': {` at 2-space indent. Split on the openings and treat
  // everything up to the next opening (or the end of FRAMEWORK_CONFIGS) as
  // that entry's body.
  const objSrc = src.slice(src.indexOf('FRAMEWORK_CONFIGS'), src.indexOf('\n};'));
  const openRe = /^  '([^']+)': \{/gm;
  const openings = [];
  let om;
  while ((om = openRe.exec(objSrc)) !== null) {
    openings.push({ id: om[1], start: om.index + om[0].length });
  }
  for (let i = 0; i < openings.length; i++) {
    const end = i + 1 < openings.length ? openings[i + 1].start : objSrc.length;
    const { id } = openings[i];
    const body = objSrc.slice(openings[i].start, end);
    const str = (key) => {
      const r = body.match(new RegExp(`${key}: '([^']*)'`));
      return r ? r[1] : undefined;
    };
    const bool = (key) => new RegExp(`${key}: true`).test(body);
    const tags = (() => {
      const r = body.match(/tags: \[([^\]]*)\]/);
      if (!r) return [];
      return r[1].split(',').map((t) => t.trim().replace(/^'|'$/g, '')).filter(Boolean);
    })();
    configs.push({
      id,
      name: str('name') ?? id,
      version: str('version'),
      type: str('type') ?? 'framework',
      license: str('license'),
      officialUrl: str('officialUrl'),
      underConstruction: bool('underConstruction'),
      tags,
    });
  }
  return configs;
}

function loadBridgeCoverage() {
  const keys = new Set();
  for (const file of ['ccf-crosswalks.json', 'ccf-extended-crosswalks.json']) {
    const p = join(DATA_DIR, file);
    if (!existsSync(p)) continue;
    const data = JSON.parse(readFileSync(p, 'utf8'));
    for (const k of Object.keys(data.framework_to_ccf ?? {})) keys.add(k);
  }
  // Frameworks wired into the bridge through a dedicated {id}-ccf-crosswalk.json
  // (imported individually by crosswalk.ts) rather than the shared files.
  for (const [file, id] of [
    ['hipaa-ccf-crosswalk.json', 'hipaa-simp'],
    ['gdpr-ccf-crosswalk.json', 'gdpr'],
    ['nis2-ccf-crosswalk.json', 'nis2'],
    ['ccpa-ccf-crosswalk.json', 'ccpa'],
  ]) {
    if (existsSync(join(DATA_DIR, file))) keys.add(id);
  }
  return keys;
}

function median(nums) {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function pct(part, whole) {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

function hasContent(v) {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.values(v).some(hasContent);
  return true;
}

function auditFramework(config, bridgeKeys) {
  const dataPath = join(DATA_DIR, `${config.id}.json`);
  const result = {
    id: config.id,
    name: config.name,
    version: config.version,
    type: config.type,
    tags: config.tags,
    license: config.license,
    officialUrl: config.officialUrl,
  };

  if (!existsSync(dataPath)) {
    return { ...result, tier: 'missing', controls: 0 };
  }

  const data = JSON.parse(readFileSync(dataPath, 'utf8'));
  const controls = data.controls ?? [];
  const isPlaceholder =
    config.tags.includes('TBD') ||
    controls.some((c) => String(c.control_id).includes('PLACEHOLDER'));

  const descLens = controls.map((c) => (c.description ?? '').length);
  const withQuestions = controls.filter((c) => hasContent(c.assessment_questions)).length;
  const withRelated = controls.filter((c) => hasContent(c.related_controls)).length;

  const proseFill = {};
  for (const field of PROSE_FIELDS) {
    const n = controls.filter((c) => hasContent(c[field])).length;
    if (n > 0) proseFill[field] = pct(n, controls.length);
  }
  const extraFields = new Set();
  for (const c of controls) {
    for (const k of Object.keys(c)) {
      if (!BASE_FIELDS.has(k) && !ENRICHMENT_BASE_FIELDS.includes(k) && !PROSE_FIELDS.includes(k)) {
        extraFields.add(k);
      }
    }
  }

  const metrics = {
    controls: controls.length,
    families: new Set(controls.map((c) => c.family)).size,
    descMedianChars: median(descLens),
    pctDescOk: pct(descLens.filter((l) => l >= DESC_OK_CHARS).length, controls.length),
    pctAssessmentQuestions: pct(withQuestions, controls.length),
    pctRelatedControls: pct(withRelated, controls.length),
    proseFill,
    extraFields: [...extraFields].sort(),
    inBridge: bridgeKeys.has(config.id),
  };

  let tier;
  const bestProse = Math.max(0, ...Object.values(proseFill));
  if (isPlaceholder) tier = 'placeholder';
  else if (bestProse >= 50 && metrics.pctAssessmentQuestions >= 50) tier = 'gold';
  else if (bestProse >= 50 || metrics.pctAssessmentQuestions >= 50) tier = 'enriched';
  else if (metrics.pctDescOk >= 50) tier = 'basic';
  else tier = 'bare';

  return { ...result, tier, ...metrics };
}

function main() {
  const configSrc = readFileSync(join(DATA_DIR, 'framework-configs.ts'), 'utf8');
  const configs = parseConfigs(configSrc);
  const bridgeKeys = loadBridgeCoverage();
  const results = configs.map((c) => auditFramework(c, bridgeKeys));

  const tierRank = { missing: 0, placeholder: 1, bare: 2, basic: 3, enriched: 4, gold: 5 };
  results.sort((a, b) => tierRank[a.tier] - tierRank[b.tier] || (a.controls ?? 0) - (b.controls ?? 0));

  const summary = {};
  for (const r of results) summary[r.tier] = (summary[r.tier] ?? 0) + 1;

  mkdirSync(REPORT_DIR, { recursive: true });
  // No timestamp in the committed artifacts: reruns on the same inputs must
  // be byte-identical so regenerating never dirties the tree.
  writeFileSync(
    join(REPORT_DIR, 'framework-completeness.json'),
    JSON.stringify({ summary, frameworks: results }, null, 2) + '\n',
  );

  const lines = [
    '# Framework data completeness',
    '',
    'Generated by `scripts/audit-framework-completeness.mjs`.',
    '',
    'Tiers: **gold** = prose sections + assessment questions at >=50% fill. **enriched** = one of the two.',
    '**basic** = solid descriptions only. **bare** = thin descriptions, no enrichment. **placeholder** = TBD stub.',
    '',
    `Summary: ${Object.entries(summary).map(([t, n]) => `${n} ${t}`).join(', ')}.`,
    '',
    '| Framework | Tier | Controls | Desc ok | Questions | Related | Prose fill | Bridge |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const r of results) {
    const prose = r.proseFill && Object.keys(r.proseFill).length
      ? Object.entries(r.proseFill).map(([k, v]) => `${k} ${v}%`).join(', ')
      : '';
    lines.push(
      `| ${r.name} (\`${r.id}\`) | ${r.tier} | ${r.controls ?? 0} | ${r.pctDescOk ?? 0}% | ${r.pctAssessmentQuestions ?? 0}% | ${r.pctRelatedControls ?? 0}% | ${prose} | ${r.inBridge ? 'yes' : 'no'} |`,
    );
  }
  lines.push('');
  writeFileSync(join(REPORT_DIR, 'framework-completeness.md'), lines.join('\n'));

  console.log(`Audited ${results.length} frameworks.`);
  console.log(Object.entries(summary).map(([t, n]) => `${t}: ${n}`).join('  '));
  console.log(`Reports: scripts/data/reports/framework-completeness.{json,md}`);
}

main();
