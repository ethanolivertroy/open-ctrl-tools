import { describe, it, expect } from 'vitest';
import {
  getAllFrameworkIds,
  getFrameworkConfig,
  getFrameworkData,
  getLoadedFrameworkIds,
  getExternalFrameworkIds,
  hasFrameworkData,
  isValidFramework,
  getFrameworks,
  getRiskLists,
  isRiskList,
  getByTag,
} from '@/data/frameworks';
import { slugify, getAllControls, getAllFamilies } from '@/data/controls';

const CURATED_RELATED_CONTROLS_FRAMEWORKS = new Set([
  'cisa-sbd',
  'dod-srg',
  'fedramp-20x-ksi',
  'mitre-attack',
  'nist-800-53-r5',
  'tx-ramp',
]);

describe('framework configs and data alignment', () => {
  const allIds = getAllFrameworkIds();
  const loadedIds = getLoadedFrameworkIds();
  const externalIds = getExternalFrameworkIds();

  it('has expected built-in open and external catalog partitions', () => {
    expect(allIds.length).toBe(107);
    expect(loadedIds.length).toBe(80);
    expect(externalIds.length).toBe(27);
    for (const id of allIds) {
      expect(() => getFrameworkConfig(id)).not.toThrow();
    }
  });

  it('every framework config returns safe data from getFrameworkData', () => {
    for (const id of allIds) {
      expect(() => getFrameworkData(id)).not.toThrow();
      const data = getFrameworkData(id);
      if (hasFrameworkData(id)) {
        expect(data.controls.length).toBeGreaterThan(0);
      } else {
        expect(data.controls).toEqual([]);
        expect(data.families).toEqual({});
      }
    }
  });

  it('built-in frameworks strip derived SCF related_controls', () => {
    for (const id of loadedIds) {
      const data = getFrameworkData(id);
      expect(data.related_controls_derived, `${id} should not carry related_controls_derived`).toBeUndefined();
      if (!CURATED_RELATED_CONTROLS_FRAMEWORKS.has(id)) {
        for (const control of data.controls) {
          expect(control.related_controls ?? [], `${id}/${control.control_id}`).toEqual([]);
        }
      }
    }
  });

  it('every external-only framework has an official publisher URL', () => {
    for (const id of externalIds) {
      const config = getFrameworkConfig(id);
      expect(config.officialUrl, `${id} missing officialUrl`).toMatch(/^https?:\/\//);
    }
  });
});

describe('no duplicate slugs within any framework', () => {
  const allIds = getAllFrameworkIds();

  it('has unique slugs per framework', () => {
    for (const id of allIds) {
      const controls = getAllControls(id);
      const slugs = controls.map(c => slugify(c.control_id));
      const uniqueSlugs = new Set(slugs);

      if (slugs.length !== uniqueSlugs.size) {
        // Find duplicates for a helpful error message
        const seen = new Set<string>();
        const dupes: string[] = [];
        for (const s of slugs) {
          if (seen.has(s)) dupes.push(s);
          seen.add(s);
        }
        expect.fail(
          `Framework "${id}" has duplicate slugs: ${dupes.join(', ')}`
        );
      }
    }
  });
});

describe('required fields on all controls', () => {
  const allIds = getAllFrameworkIds();

  it('all controls have control_id, title, description, and family', () => {
    for (const id of allIds) {
      const data = getFrameworkData(id);
      for (const control of data.controls) {
        expect(control.control_id, `${id}: missing control_id`).toBeTruthy();
        expect(control.title, `${id}/${control.control_id}: missing title`).toBeTruthy();
        // description must be a string (may be empty for some frameworks like ITSG-33)
        expect(typeof control.description, `${id}/${control.control_id}: description is not a string`).toBe('string');
        expect(control.family, `${id}/${control.control_id}: missing family`).toBeTruthy();
      }
    }
  });
});

describe('valid family references', () => {
  const allIds = getAllFrameworkIds();

  it('all control family values exist in the families list', () => {
    for (const id of allIds) {
      const families = new Set(getAllFamilies(id));
      const controls = getAllControls(id);

      for (const control of controls) {
        expect(
          families.has(control.family),
          `Framework "${id}", control "${control.control_id}" references family "${control.family}" which is not in the families set`
        ).toBe(true);
      }
    }
  });
});

describe('framework config required fields', () => {
  const allIds = getAllFrameworkIds();

  it('all configs have id, name, description, familyLabel, type, and itemLabel', () => {
    for (const id of allIds) {
      const config = getFrameworkConfig(id);
      expect(config.id, `${id}: missing id`).toBeTruthy();
      expect(config.name, `${id}: missing name`).toBeTruthy();
      expect(config.description, `${id}: missing description`).toBeTruthy();
      expect(config.familyLabel, `${id}: missing familyLabel`).toBeTruthy();
      expect(config.type, `${id}: missing type`).toBeTruthy();
      expect(config.itemLabel, `${id}: missing itemLabel`).toBeTruthy();
    }
  });

  it('config id matches the key used to look it up', () => {
    for (const id of allIds) {
      const config = getFrameworkConfig(id);
      expect(config.id).toBe(id);
    }
  });
});

describe('framework utility functions', () => {
  it('isValidFramework returns true for known frameworks', () => {
    expect(isValidFramework('nist-800-53-r5')).toBe(true);
    expect(isValidFramework('pci-dss-v4')).toBe(true);
  });

  it('isValidFramework returns false for unknown frameworks', () => {
    expect(isValidFramework('nonexistent')).toBe(false);
  });

  it('getFrameworks returns only type=framework', () => {
    const frameworks = getFrameworks();
    for (const f of frameworks) {
      expect(f.type).toBe('framework');
    }
    expect(frameworks.length).toBeGreaterThan(50);
  });

  it('getRiskLists returns only type=risk-list', () => {
    const riskLists = getRiskLists();
    for (const r of riskLists) {
      expect(r.type).toBe('risk-list');
    }
    expect(riskLists.length).toBeGreaterThan(0);
  });

  it('isRiskList correctly identifies risk lists', () => {
    expect(isRiskList('owasp-llm-top10')).toBe(true);
    expect(isRiskList('owasp-web-top10')).toBe(true);
    expect(isRiskList('nist-800-53-r5')).toBe(false);
  });

  it('getByTag returns frameworks with matching tag', () => {
    const federalFrameworks = getByTag('Federal');
    expect(federalFrameworks.length).toBeGreaterThan(0);
    for (const f of federalFrameworks) {
      expect(f.tags).toContain('Federal');
    }
  });

  it('getByTag returns AI-tagged frameworks', () => {
    const aiFrameworks = getByTag('AI');
    expect(aiFrameworks.length).toBeGreaterThan(0);
    for (const f of aiFrameworks) {
      expect(f.tags).toContain('AI');
    }
  });
});

describe('framework data structure', () => {
  it('framework data has families record', () => {
    const data = getFrameworkData('nist-800-53-r5');
    expect(data.families).toBeDefined();
    expect(Object.keys(data.families).length).toBeGreaterThan(0);
  });

  it('framework data has framework metadata', () => {
    const data = getFrameworkData('nist-800-53-r5');
    expect(data.framework).toBeDefined();
    expect(data.framework.id).toBe('nist-800-53-r5');
    expect(data.framework.name).toBeDefined();
  });
});
