import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateLocalOverlay } from '../../../scripts/validate-local-overlay.mjs';

const tempDirs: string[] = [];

function makeTempOverlayDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'myctrl-overlay-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('validateLocalOverlay', () => {
  it('succeeds when no local overlay files are present', () => {
    const dir = makeTempOverlayDir();
    const res = validateLocalOverlay({ localDir: dir });
    expect(res.ok).toBe(true);
    expect(res.frameworkCount).toBe(0);
    expect(res.crosswalkCount).toBe(0);
    expect(res.errors).toEqual([]);
  });

  it('accepts valid framework and crosswalk overlay files', () => {
    const dir = makeTempOverlayDir();
    const cwDir = join(dir, 'crosswalks');
    mkdirSync(cwDir, { recursive: true });

    writeFileSync(
      join(dir, 'iso-27001-2022.json'),
      JSON.stringify({
        framework: {
          id: 'iso-27001-2022',
          name: 'ISO/IEC 27001:2022',
          version: '2022',
          description: 'Local test copy',
        },
        families: { '5': 'Organizational controls' },
        controls: [
          {
            control_id: '5.1',
            title: 'Policies for information security',
            family: '5',
            description: 'Local control text',
          },
        ],
      }),
    );

    writeFileSync(
      join(cwDir, 'soc2-crosswalk.json'),
      JSON.stringify({
        tsc_to_csf: { 'CC1.1': ['GV.OC-01'] },
        csf_to_tsc: { 'GV.OC-01': ['CC1.1'] },
        tsc_to_iso: { 'CC1.1': ['5.1'] },
        iso_to_tsc: { '5.1': ['CC1.1'] },
        tsc_to_nist: { 'CC1.1': ['AC-1'] },
        nist_to_tsc: { 'AC-1': ['CC1.1'] },
      }),
    );

    const res = validateLocalOverlay({ localDir: dir });
    expect(res.ok).toBe(true);
    expect(res.frameworkCount).toBe(1);
    expect(res.crosswalkCount).toBe(1);
    expect(res.errors).toEqual([]);
  });

  it('rejects mismatched framework.id and duplicate control slugs', () => {
    const dir = makeTempOverlayDir();
    writeFileSync(
      join(dir, 'iso-27001-2022.json'),
      JSON.stringify({
        framework: {
          id: 'wrong-id',
          name: 'Wrong',
          version: '2022',
          description: 'Bad overlay',
        },
        families: { '5': 'Organizational' },
        controls: [
          { control_id: '5.1', title: 'First', family: '5', description: 'a' },
          { control_id: '5-1', title: 'Dup slug', family: '5', description: 'b' },
        ],
      }),
    );

    const res = validateLocalOverlay({ localDir: dir });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e: string) => e.includes('must match filename'))).toBe(true);
    expect(res.errors.some((e: string) => e.includes('duplicate control slug'))).toBe(true);
  });

  it('rejects malformed known crosswalk overlays missing required keys', () => {
    const dir = makeTempOverlayDir();
    const cwDir = join(dir, 'crosswalks');
    mkdirSync(cwDir, { recursive: true });
    writeFileSync(
      join(cwDir, 'cjis-fedramp-crosswalk.json'),
      JSON.stringify({ cjis_to_fedramp: { '5.1.1': ['AC-1'] } }),
    );

    const res = validateLocalOverlay({ localDir: dir });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e: string) => e.includes('fedramp_to_cjis'))).toBe(true);
  });
});
