import { describe, it, expect } from 'vitest';
import {
  slugify,
  getControlBySlug,
  getControlById,
  getControlsByFamily,
  getAllFamilies,
  getAllControls,
  getBasePath,
} from '@/data/controls';

describe('slugify', () => {
  it('converts simple control IDs', () => {
    expect(slugify('AC-2')).toBe('ac-2');
    expect(slugify('AU-6')).toBe('au-6');
  });

  it('converts parenthesized enhancements', () => {
    expect(slugify('AC-2(1)')).toBe('ac-2-1');
    expect(slugify('AC-2(13)')).toBe('ac-2-13');
    expect(slugify('SI-4(2)')).toBe('si-4-2');
  });

  it('converts dotted IDs', () => {
    expect(slugify('1.1.1')).toBe('1-1-1');
    expect(slugify('12.4.2')).toBe('12-4-2');
  });

  it('strips leading zeros', () => {
    expect(slugify('IR-07')).toBe('ir-7');
    expect(slugify('AC-02')).toBe('ac-2');
    expect(slugify('AU-02(1)')).toBe('au-2-1');
  });

  it('handles bracket notation', () => {
    // Brackets become dashes, then collapsed
    expect(slugify('AC.L1-B.1.I[a]')).toBe('ac-l1-b-1-i-a');
  });

  it('handles special characters', () => {
    expect(slugify('GV.OC-01')).toBe('gv-oc-1');
    expect(slugify('PR.DS-01')).toBe('pr-ds-1');
  });

  it('collapses multiple dashes', () => {
    expect(slugify('A--B--C')).toBe('a-b-c');
  });

  it('trims leading/trailing dashes', () => {
    expect(slugify('-AC-2-')).toBe('ac-2');
  });

  it('handles EU AI Act article IDs', () => {
    expect(slugify('Art. 5(1)(a)')).toBe('art-5-1-a');
    expect(slugify('Art. 50(1)')).toBe('art-50-1');
  });

  it('handles AI RMF control IDs', () => {
    expect(slugify('GOVERN-1.1')).toBe('govern-1-1');
    expect(slugify('MAP-2.3')).toBe('map-2-3');
    expect(slugify('MEASURE-2.8')).toBe('measure-2-8');
  });

  it('handles CMMC practice IDs', () => {
    expect(slugify('AC.L1-3.1.1')).toBe('ac-l1-3-1-1');
    expect(slugify('SC.L2-3.13.1')).toBe('sc-l2-3-13-1');
  });
});

describe('getControlBySlug', () => {
  it('returns a NIST 800-53 control by slug', () => {
    const control = getControlBySlug('nist-800-53-r5', 'ac-1');
    expect(control).toBeDefined();
    expect(control!.control_id).toBe('AC-1');
    expect(control!.title).toBeDefined();
    expect(control!.family).toBe('AC');
  });

  it('returns a CSF control by slug', () => {
    const control = getControlBySlug('nist-csf-v2', 'gv-oc-1');
    expect(control).toBeDefined();
    expect(control!.control_id).toBe('GV.OC-01');
  });

  it('returns a FedRAMP control by slug', () => {
    const control = getControlBySlug('fedramp-rev5', 'ac-1');
    expect(control).toBeDefined();
    expect(control!.control_id).toBe('AC-1');
  });

  it('returns undefined for unloaded external-only frameworks without throwing', () => {
    expect(getControlBySlug('pci-dss-v4', '1-1-1')).toBeUndefined();
  });

  it('returns undefined for missing slug', () => {
    expect(getControlBySlug('nist-800-53-r5', 'zzz-999')).toBeUndefined();
  });

  it('returns undefined for missing framework', () => {
    expect(() => getControlBySlug('nonexistent-framework', 'ac-1')).toThrow();
  });
});

describe('getControlById', () => {
  it('returns a NIST control by exact ID', () => {
    const control = getControlById('nist-800-53-r5', 'AC-1');
    expect(control).toBeDefined();
    expect(control!.control_id).toBe('AC-1');
  });

  it('returns a CSF control by exact ID', () => {
    const control = getControlById('nist-csf-v2', 'GV.OC-01');
    expect(control).toBeDefined();
    expect(control!.control_id).toBe('GV.OC-01');
  });

  it('returns undefined for non-existent ID', () => {
    expect(getControlById('nist-800-53-r5', 'ZZ-999')).toBeUndefined();
  });

  it('is case-sensitive (original ID format)', () => {
    expect(getControlById('nist-800-53-r5', 'ac-1')).toBeUndefined();
  });
});

describe('getControlsByFamily', () => {
  it('returns only controls in the AC family for NIST', () => {
    const controls = getControlsByFamily('nist-800-53-r5', 'AC');
    expect(controls.length).toBeGreaterThan(0);
    for (const c of controls) {
      expect(c.family).toBe('AC');
    }
  });

  it('returns only controls in the GV family for CSF', () => {
    const controls = getControlsByFamily('nist-csf-v2', 'GV');
    expect(controls.length).toBeGreaterThan(0);
    for (const c of controls) {
      expect(c.family).toBe('GV');
    }
  });

  it('returns empty array for non-existent family', () => {
    const controls = getControlsByFamily('nist-800-53-r5', 'NONEXISTENT');
    expect(controls).toEqual([]);
  });
});

describe('getAllFamilies', () => {
  it('returns sorted unique families for NIST', () => {
    const families = getAllFamilies('nist-800-53-r5');
    expect(families.length).toBeGreaterThan(0);
    expect(families).toContain('AC');
    expect(families).toContain('AU');
    expect(families).toContain('SI');
    // Should be alphabetically sorted
    for (let i = 1; i < families.length; i++) {
      expect(families[i].localeCompare(families[i - 1])).toBeGreaterThan(0);
    }
  });

  it('returns numerically sorted families for multi-digit numeric frameworks', () => {
    const families = getAllFamilies('uk-defstan');
    expect(families.length).toBeGreaterThan(2);
    const nums = families.map(f => parseInt(f, 10)).filter(n => !isNaN(n));
    expect(nums.length).toBe(families.length);
    for (let i = 1; i < nums.length; i++) {
      expect(nums[i]).toBeGreaterThan(nums[i - 1]);
    }
    expect(getAllFamilies('pci-dss-v4')).toEqual([]);
  });

  it('returns no duplicates', () => {
    const families = getAllFamilies('nist-800-53-r5');
    const uniqueSet = new Set(families);
    expect(families.length).toBe(uniqueSet.size);
  });
});

describe('getAllControls', () => {
  it('returns controls with computed URL', () => {
    const controls = getAllControls('nist-800-53-r5');
    expect(controls.length).toBeGreaterThan(0);
    for (const c of controls.slice(0, 5)) {
      expect(c.url).toBeDefined();
      expect(c.url).toContain('/frameworks/nist-800-53-r5/');
    }
  });

  it('returns risk list controls with risk-lists base path', () => {
    const controls = getAllControls('owasp-llm-top10');
    expect(controls.length).toBeGreaterThan(0);
    for (const c of controls) {
      expect(c.url).toContain('/risk-lists/owasp-llm-top10/');
    }
  });
});

describe('getBasePath', () => {
  it('returns /frameworks for regular frameworks', () => {
    expect(getBasePath('nist-800-53-r5')).toBe('/frameworks');
    expect(getBasePath('pci-dss-v4')).toBe('/frameworks');
  });

  it('returns /risk-lists for risk lists', () => {
    expect(getBasePath('owasp-llm-top10')).toBe('/risk-lists');
    expect(getBasePath('owasp-web-top10')).toBe('/risk-lists');
  });
});
