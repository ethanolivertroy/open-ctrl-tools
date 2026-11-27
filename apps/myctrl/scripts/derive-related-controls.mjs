#!/usr/bin/env node
/**
 * Derive within-framework related_controls from the crosswalk bridge.
 *
 * Two controls in the same framework are related when they map to the same
 * CCF hub control (src/data/ccf-crosswalks.json, ccf-extended-crosswalks.json,
 * and the dedicated {gdpr,hipaa,nis2,ccpa}-ccf-crosswalk.json files). This
 * fills the "Related Controls" section (rendered for every framework by
 * ControlDetail.tsx) for datasets that have no curated related_controls,
 * without authoring any new claims: the relation is already asserted by the
 * bridge data (derived from SCF STRM mappings, used with permission).
 *
 * Safety rails:
 *  - Only frameworks with ZERO existing related_controls are eligible, so
 *    curated data is never mixed with derived data.
 *  - CCF ids mapped to more than HUB_CONTROL_FRACTION of a framework's
 *    controls are ignored as generic hubs (they relate everything to
 *    everything and carry no signal).
 *  - Frameworks where the bridge covers under MIN_COVERAGE of controls are
 *    skipped instead of half-filled.
 *  - Deterministic output (rank by shared-hub count, then id), capped at
 *    MAX_RELATED per control. Rerunning converges to the same result.
 *
 * Usage:
 *   node scripts/derive-related-controls.mjs           # dry run (report only)
 *   node scripts/derive-related-controls.mjs --write   # update src/data/*.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'src', 'data');

const MAX_RELATED = 8;
const MIN_COVERAGE = 0.3;
const HUB_CONTROL_FRACTION = 0.2;
const WRITE = process.argv.includes('--write');

// NIST-family sets whose controls are 800-53 ids: their related controls
// should come from the official NIST relation data (already in
// nist-800-53-r5.json), not bridge inference. Tracked as a follow-up.
const EXCLUDE = new Set(['fedramp-rev5', 'nist-800-171-r2']);

function loadJson(file) {
  return JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8'));
}

/** frameworkId -> { controlId -> ccfIds[] } from every bridge source. */
function loadBridgeMaps() {
  const maps = {};
  for (const file of ['ccf-crosswalks.json', 'ccf-extended-crosswalks.json']) {
    const data = loadJson(file);
    for (const [fw, controls] of Object.entries(data.framework_to_ccf ?? {})) {
      maps[fw] = { ...(maps[fw] ?? {}), ...controls };
    }
  }
  for (const [file, key, fw] of [
    ['gdpr-ccf-crosswalk.json', 'gdpr_to_ccf', 'gdpr'],
    ['hipaa-ccf-crosswalk.json', 'hipaa_to_ccf', 'hipaa-simp'],
    ['nis2-ccf-crosswalk.json', 'nis2_to_ccf', 'nis2'],
    ['ccpa-ccf-crosswalk.json', 'ccpa_to_ccf', 'ccpa'],
  ]) {
    if (!existsSync(join(DATA_DIR, file))) continue;
    const data = loadJson(file);
    if (data[key]) maps[fw] = { ...(maps[fw] ?? {}), ...data[key] };
  }
  return maps;
}

function deriveForFramework(id, bridgeControls) {
  if (EXCLUDE.has(id)) return { id, skip: 'excluded: derive from official NIST relations instead' };
  const dataPath = join(DATA_DIR, `${id}.json`);
  if (!existsSync(dataPath)) return { id, skip: 'no dataset file' };

  const data = JSON.parse(readFileSync(dataPath, 'utf8'));
  const controls = data.controls ?? [];
  if (controls.length < 2) return { id, skip: 'placeholder or too small' };

  // A dataset stamped related_controls_derived was filled by this script, so
  // reruns recompute it. Unstamped data with relations is curated: hands off.
  const hasCurated =
    !data.related_controls_derived &&
    controls.some((c) => Array.isArray(c.related_controls) && c.related_controls.length > 0);
  if (hasCurated) return { id, skip: 'has curated related_controls' };
  for (const c of controls) delete c.related_controls;

  const datasetIds = new Set(controls.map((c) => c.control_id));
  const controlToCcf = new Map();
  for (const [controlId, ccfIds] of Object.entries(bridgeControls)) {
    if (datasetIds.has(controlId)) controlToCcf.set(controlId, ccfIds);
  }
  const coverage = controlToCcf.size / controls.length;
  if (coverage < MIN_COVERAGE) {
    return { id, skip: `bridge covers only ${Math.round(coverage * 100)}% of controls` };
  }

  // Invert to ccfId -> controls, dropping generic hubs that map to a large
  // share of the framework (no discriminating power).
  const hubLimit = Math.max(5, Math.ceil(controls.length * HUB_CONTROL_FRACTION));
  const ccfToControls = new Map();
  for (const [controlId, ccfIds] of controlToCcf) {
    for (const ccfId of ccfIds) {
      if (!ccfToControls.has(ccfId)) ccfToControls.set(ccfId, []);
      ccfToControls.get(ccfId).push(controlId);
    }
  }
  for (const [ccfId, ids] of ccfToControls) {
    if (ids.length > hubLimit) ccfToControls.delete(ccfId);
  }

  let filled = 0;
  for (const control of controls) {
    const ccfIds = controlToCcf.get(control.control_id);
    if (!ccfIds) continue;
    const shared = new Map();
    for (const ccfId of ccfIds) {
      for (const other of ccfToControls.get(ccfId) ?? []) {
        if (other === control.control_id) continue;
        shared.set(other, (shared.get(other) ?? 0) + 1);
      }
    }
    if (shared.size === 0) continue;
    const related = [...shared.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], undefined, { numeric: true }))
      .slice(0, MAX_RELATED)
      .map(([otherId]) => otherId);
    control.related_controls = related;
    filled += 1;
  }

  if (filled === 0) return { id, skip: 'no relations above thresholds' };
  if (WRITE) {
    data.related_controls_derived = true;
    writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n');
  }
  return {
    id,
    controls: controls.length,
    coveragePct: Math.round(coverage * 100),
    filled,
  };
}

function main() {
  const bridgeMaps = loadBridgeMaps();
  const results = Object.entries(bridgeMaps)
    .map(([id, bridgeControls]) => deriveForFramework(id, bridgeControls))
    .sort((a, b) => a.id.localeCompare(b.id));

  const updated = results.filter((r) => !r.skip);
  const skipped = results.filter((r) => r.skip);

  console.log(`${WRITE ? 'Updated' : 'Would update'} ${updated.length} frameworks:`);
  for (const r of updated) {
    console.log(`  ${r.id}: ${r.filled}/${r.controls} controls (bridge coverage ${r.coveragePct}%)`);
  }
  console.log(`Skipped ${skipped.length}:`);
  for (const r of skipped) console.log(`  ${r.id}: ${r.skip}`);
  if (!WRITE) console.log('\nDry run. Pass --write to update src/data/.');
}

main();
