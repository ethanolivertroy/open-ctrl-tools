#!/usr/bin/env node
/**
 * Refresh src/data/fedramp-20x-ksi.json from the FedRAMP Consolidated Rules
 * for 2026 (https://github.com/FedRAMP/rules, public domain as a US
 * government work).
 *
 * Usage:
 *   node scripts/ingest-fedramp-20x-ksi.mjs [--local path/to/fedramp-consolidated-rules.json]
 *
 * The 2026 Consolidated Rules restructured KSIs relative to the FRMR beta
 * releases the previous dataset was built from:
 *   - The AFR family moved out of KSIs into FedRAMP Requirements Rules (FRR).
 *   - Four CED training KSIs were consolidated into KSI-CED-RAT.
 *   - KSI-IAM-MFA folded into the existing KSI-IAM-APM.
 *   - KSI-RSC-MON was re-lettered KSI-SCR-MON; KSI-SVC-SNT broadened into
 *     KSI-SVC-SIN (statement scope grew, control mappings are a superset).
 *   - Impact levels are now expressed as classes: indicators with a
 *     varies_by_class "**Optional:**" statement at class B (Low) are required
 *     only at class C (Moderate).
 *
 * Site-authored enrichment (assessment_questions, fka) is carried over from
 * the existing dataset for surviving indicators; renames keep their content
 * under the new id with fka set to the old id.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_PATH = join(ROOT, 'src/data/fedramp-20x-ksi.json');
const SOURCE_URL = 'https://raw.githubusercontent.com/FedRAMP/rules/main/fedramp-consolidated-rules.json';

// new id -> old id (verified renames; statements/control mappings match)
const RENAMES = {
  'KSI-SCR-MON': 'KSI-RSC-MON',
  'KSI-SVC-SIN': 'KSI-SVC-SNT',
};

// KSI-CED-RAT consolidates the four beta-era training-review KSIs. Carry one
// authored question group per training audience so the merged indicator keeps
// the site's enrichment without inventing new content.
const CED_RAT_SOURCES = [
  { oldId: 'KSI-CED-RGT', category: 'General Training (All Employees)' },
  { oldId: 'KSI-CED-RST', category: 'Role-Specific Training (High-Risk Roles)' },
  { oldId: 'KSI-CED-DET', category: 'Development & Engineering Training' },
  { oldId: 'KSI-CED-RRT', category: 'Response & Recovery Training' },
];

async function loadSource() {
  const localIdx = process.argv.indexOf('--local');
  if (localIdx !== -1) {
    return JSON.parse(readFileSync(process.argv[localIdx + 1], 'utf8'));
  }
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`fetch ${SOURCE_URL} -> ${res.status}`);
  return res.json();
}

const OPTIONAL_PREFIX = /^\*\*Optional:\*\*\s*/;

function resolveStatement(id, ind) {
  if (ind.statement) {
    return { description: ind.statement, impact_low: true, impact_moderate: true };
  }
  const byClass = ind.varies_by_class;
  if (!byClass?.b?.statement || !byClass?.c?.statement) {
    throw new Error(`${id}: no statement and no usable varies_by_class`);
  }
  const b = byClass.b.statement;
  const c = byClass.c.statement;
  const bIsOptional = OPTIONAL_PREFIX.test(b);
  if (b.replace(OPTIONAL_PREFIX, '') !== c) {
    console.warn(`WARN ${id}: class B statement differs from class C beyond the Optional prefix`);
  }
  // Optional at class B (Low) means the indicator is only required at
  // class C (Moderate) - same semantics the old impact flags carried.
  return { description: c, impact_low: !bIsOptional, impact_moderate: true };
}

const source = await loadSource();
const existing = JSON.parse(readFileSync(OUT_PATH, 'utf8'));
const oldById = new Map(existing.controls.map((c) => [c.control_id, c]));

const families = {};
const controls = [];
for (const fam of Object.values(source.KSI)) {
  families[fam.short_name] = fam.name;
  for (const [id, ind] of Object.entries(fam.indicators)) {
    const { description, impact_low, impact_moderate } = resolveStatement(id, ind);
    const carryFrom = oldById.get(id) ?? oldById.get(RENAMES[id]);
    const control = {
      control_id: id,
      title: ind.name,
      family: fam.short_name,
      description,
      impact_low,
      impact_moderate,
    };
    const fka = carryFrom && carryFrom.control_id !== id ? carryFrom.control_id : carryFrom?.fka;
    if (fka) control.fka = fka;
    if (Array.isArray(ind.controls) && ind.controls.length) control.related_controls = ind.controls;
    if (Array.isArray(ind.updated) && ind.updated.length) control.updated = ind.updated;
    if (Array.isArray(ind.terms) && ind.terms.length) control.terms = ind.terms;
    if (id === 'KSI-CED-RAT') {
      const merged = [];
      for (const { oldId, category } of CED_RAT_SOURCES) {
        const src = oldById.get(oldId);
        const group = src?.assessment_questions?.[0];
        if (group?.questions?.length) merged.push({ category, questions: group.questions });
      }
      if (merged.length) control.assessment_questions = merged;
    } else if (carryFrom?.assessment_questions?.length) {
      control.assessment_questions = carryFrom.assessment_questions;
    }
    controls.push(control);
  }
}

// Invariants
const ids = controls.map((c) => c.control_id);
if (new Set(ids).size !== ids.length) throw new Error('duplicate control ids');
for (const c of controls) {
  if (!c.description?.trim()) throw new Error(`${c.control_id}: empty description`);
  if (!families[c.family]) throw new Error(`${c.control_id}: unknown family ${c.family}`);
}

const out = {
  framework: {
    id: 'fedramp-20x-ksi',
    name: 'FedRAMP 20x KSI',
    version: source.info.version,
    description: 'Key Security Indicators from the FedRAMP Consolidated Rules for 2026',
  },
  families,
  controls,
};

writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n');

const withQ = controls.filter((c) => c.assessment_questions?.length).length;
const lowOptional = controls.filter((c) => !c.impact_low).map((c) => c.control_id);
const removed = existing.controls.filter(
  (c) => !ids.includes(c.control_id) && !Object.values(RENAMES).includes(c.control_id)
);
console.log(`Wrote ${controls.length} KSIs across ${Object.keys(families).length} families (source ${source.info.version})`);
console.log(`assessment_questions carried: ${withQ}/${controls.length}`);
console.log(`moderate-only (Optional at Low): ${lowOptional.join(', ')}`);
console.log(`retired vs previous dataset: ${removed.length} (${removed.map((c) => c.control_id).join(', ')})`);
