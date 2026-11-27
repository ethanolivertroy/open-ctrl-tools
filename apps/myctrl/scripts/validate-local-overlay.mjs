#!/usr/bin/env node
/**
 * Validate optional local BYO framework and crosswalk overlays in src/data/local/.
 *
 * Usage:
 *   node scripts/validate-local-overlay.mjs
 *   node scripts/validate-local-overlay.mjs --dir /path/to/local/dir
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function slugifyControlId(controlId) {
  return String(controlId)
    .toLowerCase()
    .replace(/\((\d+)\)/g, '-$1')
    .replace(/\./g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/-0+(\d)/g, '-$1');
}

function parseArgs(argv) {
  let localDir = join(ROOT, 'src', 'data', 'local');
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dir' && argv[i + 1]) {
      localDir = resolve(argv[i + 1]);
      i += 1;
    }
  }
  return { localDir, crosswalksDir: join(localDir, 'crosswalks') };
}

function listJsonFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => join(dir, name));
}

function isStringArrayMap(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const entries = Object.entries(obj);
  if (entries.length === 0) return false;
  return entries.every(
    ([k, v]) => typeof k === 'string' && Array.isArray(v) && v.every((item) => typeof item === 'string'),
  );
}

function isNestedFrameworkMap(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const entries = Object.entries(obj);
  if (entries.length === 0) return false;
  return entries.every(([k, v]) => typeof k === 'string' && isStringArrayMap(v));
}

const KNOWN_CROSSWALK_KEYS = {
  'soc2-crosswalk.json': ['tsc_to_csf', 'csf_to_tsc', 'tsc_to_iso', 'iso_to_tsc', 'tsc_to_nist', 'nist_to_tsc'],
  'ai-rmf-iso42001-crosswalk.json': ['ai_rmf_to_iso42001', 'iso42001_to_ai_rmf'],
  'ai-rmf-iso23894-crosswalk.json': ['ai_rmf_to_iso23894', 'iso23894_to_ai_rmf'],
  'aiuc-1-airmf-crosswalk.json': ['aiuc_to_ai_rmf', 'ai_rmf_to_aiuc'],
  'aiuc-1-owasp-llm-crosswalk.json': ['aiuc_to_owasp_llm', 'owasp_llm_to_aiuc'],
  'hipaa-ccf-crosswalk.json': ['hipaa_to_ccf', 'ccf_to_hipaa'],
  'gdpr-ccf-crosswalk.json': ['gdpr_to_ccf', 'ccf_to_gdpr'],
  'nis2-ccf-crosswalk.json': ['nis2_to_ccf', 'ccf_to_nis2'],
  'ccpa-ccf-crosswalk.json': ['ccpa_to_ccf', 'ccf_to_ccpa'],
  'cjis-fedramp-crosswalk.json': ['cjis_to_fedramp', 'fedramp_to_cjis'],
};

function validateFrameworkFile(filePath) {
  const errors = [];
  const warnings = [];
  const fileName = basename(filePath);
  const stem = fileName.replace(/\.json$/, '');

  let data;
  try {
    data = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    return { errors: [`${fileName}: invalid JSON (${err.message})`], warnings };
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { errors: [`${fileName}: root must be a JSON object`], warnings };
  }

  if (!data.framework || typeof data.framework !== 'object') {
    errors.push(`${fileName}: missing "framework" metadata object`);
  } else {
    for (const field of ['id', 'name', 'version', 'description']) {
      if (typeof data.framework[field] !== 'string' || data.framework[field].trim() === '') {
        errors.push(`${fileName}: framework.${field} must be a non-empty string`);
      }
    }
    if (typeof data.framework.id === 'string' && data.framework.id !== stem) {
      errors.push(`${fileName}: framework.id "${data.framework.id}" must match filename "${stem}"`);
    }
  }

  if (!data.families || typeof data.families !== 'object' || Array.isArray(data.families)) {
    errors.push(`${fileName}: missing "families" record`);
  } else {
    for (const [k, v] of Object.entries(data.families)) {
      if (typeof v !== 'string') {
        errors.push(`${fileName}: families["${k}"] must be a string`);
        break;
      }
    }
  }

  if (!Array.isArray(data.controls) || data.controls.length === 0) {
    errors.push(`${fileName}: "controls" must be a non-empty array`);
    return { errors, warnings };
  }

  const seenSlugs = new Set();
  for (let i = 0; i < data.controls.length; i++) {
    const c = data.controls[i];
    if (!c || typeof c !== 'object') {
      errors.push(`${fileName}: controls[${i}] must be an object`);
      continue;
    }
    if (typeof c.control_id !== 'string' || c.control_id.trim() === '') {
      errors.push(`${fileName}: controls[${i}].control_id must be a non-empty string`);
      continue;
    }
    if (typeof c.title !== 'string' || c.title.trim() === '') {
      errors.push(`${fileName}: control "${c.control_id}" is missing non-empty title`);
    }
    if (typeof c.family !== 'string' || c.family.trim() === '') {
      errors.push(`${fileName}: control "${c.control_id}" is missing non-empty family`);
    } else if (data.families && !(c.family in data.families)) {
      warnings.push(`${fileName}: control "${c.control_id}" family "${c.family}" is not listed in families`);
    }
    if (typeof c.description !== 'string') {
      errors.push(`${fileName}: control "${c.control_id}" description must be a string`);
    }

    const slug = slugifyControlId(c.control_id);
    if (!slug) {
      errors.push(`${fileName}: control "${c.control_id}" produces an empty URL slug`);
    } else if (seenSlugs.has(slug)) {
      errors.push(`${fileName}: duplicate control slug "${slug}" (from "${c.control_id}")`);
    } else {
      seenSlugs.add(slug);
    }
  }

  return { errors, warnings };
}

function validateCrosswalkFile(filePath) {
  const errors = [];
  const fileName = basename(filePath);

  let data;
  try {
    data = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    return [`${fileName}: invalid JSON (${err.message})`];
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return [`${fileName}: root must be a JSON object`];
  }

  if (fileName === 'ccf-crosswalks.json' || fileName === 'ccf-extended-crosswalks.json') {
    if (!isNestedFrameworkMap(data.ccf_to_framework)) {
      errors.push(`${fileName}: "ccf_to_framework" must be a non-empty { frameworkId: { bridgeId: controlIds[] } } map`);
    }
    if (!isNestedFrameworkMap(data.framework_to_ccf)) {
      errors.push(`${fileName}: "framework_to_ccf" must be a non-empty { frameworkId: { controlId: bridgeIds[] } } map`);
    }
    return errors;
  }

  const expectedKeys = KNOWN_CROSSWALK_KEYS[fileName];
  if (expectedKeys) {
    for (const key of expectedKeys) {
      if (!isStringArrayMap(data[key])) {
        errors.push(`${fileName}: "${key}" must be a non-empty Record<string, string[]> map`);
      }
    }
    return errors;
  }

  // Generic crosswalk shape: at least one Record<string, string[]> mapping object (or array of {cmmc, ...}-style entries)
  const hasMappingDict = Object.entries(data).some(
    ([k, v]) => k !== 'metadata' && (isStringArrayMap(v) || (Array.isArray(v) && v.length > 0)),
  );
  if (!hasMappingDict) {
    errors.push(`${fileName}: must contain at least one non-empty mapping dictionary or mapping array`);
  }

  return errors;
}

export function validateLocalOverlay(options = {}) {
  const localDir = options.localDir ? resolve(options.localDir) : join(ROOT, 'src', 'data', 'local');
  const crosswalksDir = join(localDir, 'crosswalks');
  const frameworkFiles = listJsonFiles(localDir);
  const crosswalkFiles = listJsonFiles(crosswalksDir);

  if (frameworkFiles.length === 0 && crosswalkFiles.length === 0) {
    return {
      ok: true,
      frameworkCount: 0,
      crosswalkCount: 0,
      errors: [],
      warnings: [],
    };
  }

  const errors = [];
  const warnings = [];

  for (const file of frameworkFiles) {
    const res = validateFrameworkFile(file);
    errors.push(...res.errors);
    warnings.push(...res.warnings);
  }

  for (const file of crosswalkFiles) {
    errors.push(...validateCrosswalkFile(file));
  }

  return {
    ok: errors.length === 0,
    frameworkCount: frameworkFiles.length,
    crosswalkCount: crosswalkFiles.length,
    errors,
    warnings,
  };
}

function main() {
  const { localDir } = parseArgs(process.argv.slice(2));
  const result = validateLocalOverlay({ localDir });

  if (result.frameworkCount === 0 && result.crosswalkCount === 0) {
    console.log('No local overlay JSON files found in src/data/local/ (built-in catalog only).');
    return 0;
  }

  console.log(
    `Validated ${result.frameworkCount} local framework overlay(s) and ${result.crosswalkCount} local crosswalk overlay(s).`,
  );

  for (const w of result.warnings) {
    console.warn(`WARN: ${w}`);
  }
  for (const e of result.errors) {
    console.error(`ERROR: ${e}`);
  }

  return result.ok ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
