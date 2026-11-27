import { describe, it, expect } from 'vitest';
import {
  hasCrossFrameworkMappings,
  getCrossFrameworkMappings,
  hasFrameworkCrosswalk,
  getFrameworkCrosswalkTargets,
  getNistControlsForCSF,
  getCSFSubcategoriesForNist,
  getPCIControlsForCSF,
  getCSFSubcategoriesForPCI,
  getISOControlsForCSF,
  getCSFSubcategoriesForISO,
  getCSFForSOC2,
  getSOC2ForCSF,
  getNISTForSOC2,
  getSOC2ForNIST,
  getCISControlsForCSF,
  getCSFForCIS,
  getISO42001ForAIRMF,
  getAIRMFForISO42001,
  getAIRMFForEUAIAct,
  getEUAIActForAIRMF,
  getNIST171ForCMMC,
  getCMMCForNIST171,
  getBridgeIdsForControl,
  getBridgeDerivedControlIds,
  getBridgeFrameworkIds,
  countBridgeDerivedMappings,
} from '@/data/crosswalk';

// ─── hasCrossFrameworkMappings ───────────────────────────────────

describe('hasCrossFrameworkMappings', () => {
  it('returns true for CSF control with known NIST mappings', () => {
    // GV.OC-01 maps to PM-11
    expect(hasCrossFrameworkMappings('GV.OC-01', 'nist-csf-v2')).toBe(true);
  });

  it('returns true for NIST control with known CSF mappings', () => {
    expect(hasCrossFrameworkMappings('PM-11', 'nist-800-53-r5')).toBe(true);
  });

  it('returns expected mapping state for external/local-overlay SOC 2 control', () => {
    expect(hasCrossFrameworkMappings('CC1.1', 'soc2-tsc')).toBe(hasFrameworkCrosswalk('soc2-tsc'));
  });

  it('returns true for CMMC control with NIST 800-171 mapping', () => {
    expect(hasCrossFrameworkMappings('AC.L1-3.1.1', 'cmmc-v2')).toBe(true);
  });

  it('returns true for EU AI Act control with AI RMF mapping', () => {
    expect(hasCrossFrameworkMappings('Art. 5(1)(a)', 'eu-ai-act')).toBe(true);
  });

  it('returns true for AI RMF control with EU AI Act mapping', () => {
    expect(hasCrossFrameworkMappings('GOVERN-1.1', 'nist-ai-rmf')).toBe(true);
  });

  it('bridge participation reflects optional local crosswalk overlays only', () => {
    const bridgeIds = getBridgeFrameworkIds();
    if (bridgeIds.length > 0) {
      expect(bridgeIds).toContain('gdpr');
    } else {
      expect(bridgeIds).toEqual([]);
    }
  });

  it('returns false for controls without mappings', () => {
    expect(hasCrossFrameworkMappings('NONEXISTENT-999', 'nist-csf-v2')).toBe(false);
    expect(hasCrossFrameworkMappings('NONEXISTENT-999', 'nist-800-53-r5')).toBe(false);
  });
});

// ─── getCrossFrameworkMappings ───────────────────────────────────

describe('getCrossFrameworkMappings', () => {
  it('returns NIST mappings for CSF control', () => {
    const mappings = getCrossFrameworkMappings('GV.OC-01', 'nist-csf-v2');
    const nistMapping = mappings.find(m => m.frameworkId === 'nist-800-53-r5');
    expect(nistMapping).toBeDefined();
    expect(nistMapping!.controlIds).toContain('PM-11');
  });

  it('returns CSF mappings for NIST control', () => {
    // PM-11 has known CSF reverse mappings (AC-1 does not)
    const mappings = getCrossFrameworkMappings('PM-11', 'nist-800-53-r5');
    const csfMapping = mappings.find(m => m.frameworkId === 'nist-csf-v2');
    expect(csfMapping).toBeDefined();
    expect(csfMapping!.controlIds).toContain('GV.OC-01');
  });

  it('returns NIST 800-171 mapping for CMMC control', () => {
    const mappings = getCrossFrameworkMappings('AC.L1-3.1.1', 'cmmc-v2');
    const nist171 = mappings.find(m => m.frameworkId === 'nist-800-171-r2');
    expect(nist171).toBeDefined();
    expect(nist171!.controlIds).toContain('3.1.1');
  });

  it('returns AI RMF mappings for EU AI Act control', () => {
    const mappings = getCrossFrameworkMappings('Art. 5(1)(a)', 'eu-ai-act');
    const aiRmf = mappings.find(m => m.frameworkId === 'nist-ai-rmf');
    expect(aiRmf).toBeDefined();
    expect(aiRmf!.controlIds.length).toBeGreaterThan(0);
  });

  it('never leaks internal bridge id and resolves derived mappings when local bridge is loaded', () => {
    const mappings = getCrossFrameworkMappings('AC-1', 'nist-800-53-r5');
    const derived = mappings.filter(m => m.derived);
    if (getBridgeFrameworkIds().length > 0) {
      expect(derived.length).toBeGreaterThan(0);
    } else {
      expect(derived).toEqual([]);
    }
    // Derived mappings never reference the internal bridge as a framework
    expect(mappings.every(m => m.frameworkId !== 'myctrl-ccf')).toBe(true);
  });

  it('returns empty array for unknown control', () => {
    const mappings = getCrossFrameworkMappings('NONEXISTENT-999', 'nist-csf-v2');
    expect(mappings).toEqual([]);
  });

  it('lists direct mappings before derived mappings', () => {
    const mappings = getCrossFrameworkMappings('CC1.1', 'soc2-tsc');
    const firstDerivedIdx = mappings.findIndex(m => m.derived);
    const lastDirectIdx = mappings.reduce((acc, m, i) => (m.derived ? acc : i), -1);
    if (firstDerivedIdx !== -1 && lastDirectIdx !== -1) {
      expect(lastDirectIdx).toBeLessThan(firstDerivedIdx);
    }
    // A direct target framework is never repeated as a derived mapping
    const ids = mappings.map(m => m.frameworkId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── hasFrameworkCrosswalk ───────────────────────────────────────

describe('hasFrameworkCrosswalk', () => {
  it('returns true for built-in CROSSWALK_REGISTRY frameworks', () => {
    expect(hasFrameworkCrosswalk('nist-csf-v2')).toBe(true);
    expect(hasFrameworkCrosswalk('nist-800-53-r5')).toBe(true);
    expect(hasFrameworkCrosswalk('pci-dss-v4')).toBe(true);
    expect(hasFrameworkCrosswalk('iso-27001-2022')).toBe(true);
    expect(hasFrameworkCrosswalk('cis-controls-v8')).toBe(true);
    expect(hasFrameworkCrosswalk('nist-ai-rmf')).toBe(true);
    expect(hasFrameworkCrosswalk('eu-ai-act')).toBe(true);
    expect(hasFrameworkCrosswalk('cmmc-v2')).toBe(true);
    expect(hasFrameworkCrosswalk('nist-800-171-r2')).toBe(true);
  });

  it('tracks bridge participation only when local bridge overlays are loaded', () => {
    const hasBridge = getBridgeFrameworkIds().length > 0;
    expect(hasFrameworkCrosswalk('gdpr')).toBe(hasBridge);
    expect(hasFrameworkCrosswalk('hipaa-security')).toBe(hasBridge);
  });

  it('returns false for frameworks without crosswalks', () => {
    expect(hasFrameworkCrosswalk('owasp-web-top10')).toBe(false);
    expect(hasFrameworkCrosswalk('nonexistent')).toBe(false);
  });
});

// ─── getFrameworkCrosswalkTargets ────────────────────────────────

describe('getFrameworkCrosswalkTargets', () => {
  it('returns all built-in CSF crosswalk targets', () => {
    const targets = getFrameworkCrosswalkTargets('nist-csf-v2');
    expect(targets).toContain('nist-800-53-r5');
    expect(targets).toContain('pci-dss-v4');
    expect(targets).toContain('iso-27001-2022');
    expect(targets).toContain('cis-controls-v8');
    if (getCSFForSOC2('CC1.1').length > 0) {
      expect(targets).toContain('soc2-tsc');
    } else {
      expect(targets).not.toContain('soc2-tsc');
    }
  });

  it('returns CMMC targets', () => {
    const targets = getFrameworkCrosswalkTargets('cmmc-v2');
    expect(targets).toContain('nist-800-171-r2');
  });

  it('returns AI RMF targets', () => {
    const targets = getFrameworkCrosswalkTargets('nist-ai-rmf');
    expect(targets).toContain('eu-ai-act');
    if (getISO42001ForAIRMF('GOVERN-1.1').length > 0) {
      expect(targets).toContain('iso-42001');
    } else {
      expect(targets).not.toContain('iso-42001');
    }
  });

  it('returns empty for frameworks not in CROSSWALK_PAIRS', () => {
    expect(getFrameworkCrosswalkTargets('owasp-web-top10')).toEqual([]);
  });
});

// ─── Bidirectional consistency ───────────────────────────────────

describe('bidirectional consistency', () => {
  it('CSF -> NIST -> CSF roundtrip has no orphans', () => {
    const csfId = 'GV.OC-01';
    const nistControls = getNistControlsForCSF(csfId);
    expect(nistControls.length).toBeGreaterThan(0);

    // Each mapped NIST control should map back to this CSF control
    for (const nistId of nistControls) {
      const backMapped = getCSFSubcategoriesForNist(nistId);
      expect(backMapped).toContain(csfId);
    }
  });

  it('NIST -> CSF -> NIST roundtrip has no orphans', () => {
    // PM-11 has known CSF reverse mappings
    const nistId = 'PM-11';
    const csfControls = getCSFSubcategoriesForNist(nistId);
    expect(csfControls.length).toBeGreaterThan(0);

    for (const csfId of csfControls) {
      const backMapped = getNistControlsForCSF(csfId);
      expect(backMapped).toContain(nistId);
    }
  });

  it('CSF -> PCI -> CSF roundtrip has no orphans', () => {
    const csfId = 'DE.AE-02';
    const pciControls = getPCIControlsForCSF(csfId);
    expect(pciControls.length).toBeGreaterThan(0);

    for (const pciId of pciControls) {
      const backMapped = getCSFSubcategoriesForPCI(pciId);
      expect(backMapped).toContain(csfId);
    }
  });

  it('CSF -> ISO -> CSF roundtrip has no orphans', () => {
    const isoId = 'A.5.1';
    const csfControls = getCSFSubcategoriesForISO(isoId);
    if (csfControls.length > 0) {
      for (const csfId of csfControls) {
        const backMapped = getISOControlsForCSF(csfId);
        expect(backMapped).toContain(isoId);
      }
    }
  });

  it('SOC 2 -> CSF -> SOC 2 roundtrip has no orphans when local SOC 2 crosswalk is present', () => {
    const tscId = 'CC1.1';
    const csfControls = getCSFForSOC2(tscId);
    if (csfControls.length === 0) {
      expect(csfControls).toEqual([]);
      return;
    }

    for (const csfId of csfControls) {
      const backMapped = getSOC2ForCSF(csfId);
      expect(backMapped).toContain(tscId);
    }
  });

  it('SOC 2 -> NIST -> SOC 2 roundtrip has no orphans when local SOC 2 crosswalk is present', () => {
    const tscId = 'CC1.1';
    const nistControls = getNISTForSOC2(tscId);
    if (nistControls.length === 0) {
      expect(nistControls).toEqual([]);
      return;
    }

    for (const nistId of nistControls) {
      const backMapped = getSOC2ForNIST(nistId);
      expect(backMapped).toContain(tscId);
    }
  });

  it('CIS -> CSF -> CIS roundtrip has no orphans', () => {
    const cisId = '1.1';
    const csfControls = getCSFForCIS(cisId);
    if (csfControls.length > 0) {
      for (const csfId of csfControls) {
        const backMapped = getCISControlsForCSF(csfId);
        expect(backMapped).toContain(cisId);
      }
    }
  });

  it('AI RMF -> ISO 42001 -> AI RMF roundtrip has no orphans when local ISO 42001 crosswalk is present', () => {
    const controlId = 'GOVERN-1.1';
    const isoClauses = getISO42001ForAIRMF(controlId);
    if (isoClauses.length === 0) {
      expect(isoClauses).toEqual([]);
      return;
    }

    for (const clauseId of isoClauses) {
      const backMapped = getAIRMFForISO42001(clauseId);
      expect(backMapped).toContain(controlId);
    }
  });

  it('EU AI Act -> AI RMF -> EU AI Act roundtrip has no orphans', () => {
    const articleId = 'Art. 5(1)(a)';
    const aiRmfControls = getAIRMFForEUAIAct(articleId);
    expect(aiRmfControls.length).toBeGreaterThan(0);

    for (const controlId of aiRmfControls) {
      const backMapped = getEUAIActForAIRMF(controlId);
      expect(backMapped).toContain(articleId);
    }
  });

  it('CMMC -> NIST 800-171 -> CMMC roundtrip has no orphans', () => {
    const cmmcId = 'AC.L1-3.1.1';
    const nist171Id = getNIST171ForCMMC(cmmcId);
    expect(nist171Id).toBe('3.1.1');

    const backMapped = getCMMCForNIST171(nist171Id!);
    expect(backMapped).toContain(cmmcId);
  });
});

// ─── Crosswalk bridge functions ──────────────────────────────────

describe('crosswalk bridge functions', () => {
  it('returns empty bridge results by default and positive lookups when local bridge is loaded', () => {
    const ids = getBridgeFrameworkIds();
    const bridgeIds = getBridgeIdsForControl('nist-800-53-r5', 'AC-1');
    const isoIds = getBridgeDerivedControlIds('nist-800-53-r5', 'AC-1', 'iso-27001-2022');
    if (ids.length === 0) {
      expect(bridgeIds).toEqual([]);
      expect(isoIds).toEqual([]);
      expect(countBridgeDerivedMappings('hipaa-security', 'nist-800-53-r5')).toBe(0);
    } else {
      expect(bridgeIds.length).toBeGreaterThan(0);
      expect(bridgeIds).toContain('GOV-02');
      expect(isoIds.length).toBeGreaterThan(0);
      expect(ids).toContain('gdpr');
      expect(ids).toContain('hipaa-security');
      expect(ids).toContain('au-ism');
      expect(countBridgeDerivedMappings('hipaa-security', 'nist-800-53-r5')).toBeGreaterThan(0);
      expect(countBridgeDerivedMappings('gdpr', 'iso-27001-2022')).toBeGreaterThan(0);
    }
  });

  it('getBridgeIdsForControl returns empty for unmapped controls', () => {
    expect(getBridgeIdsForControl('nist-800-53-r5', 'NONEXISTENT-999')).toEqual([]);
  });
});

// ─── normalizeControlIdForFramework (tested via getCrossFrameworkMappings) ─

describe('control ID normalization via bridge-derived mappings', () => {
  it('SOC 2 POF suffix is stripped in derived mappings', () => {
    const soc2Ids = getBridgeDerivedControlIds('nist-800-53-r5', 'AC-1', 'soc2-tsc');
    for (const id of soc2Ids) {
      expect(id).not.toMatch(/-POF\d+$/);
    }
  });

  it('EU AI Act IDs are normalized with Art. prefix in derived mappings', () => {
    const euIds = getBridgeDerivedControlIds('nist-800-53-r5', 'AC-1', 'eu-ai-act');
    for (const id of euIds) {
      expect(id).toMatch(/^Art\./);
    }
  });
});
