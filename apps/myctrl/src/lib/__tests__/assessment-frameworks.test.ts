import { describe, expect, it } from 'vitest';
import { getControlById } from '@/data/controls';
import { isDoDSRGControl } from '@/data/types';
import { getAssessmentParameterInfo } from '@/lib/assessment-frameworks';

describe('getAssessmentParameterInfo', () => {
  it('returns populated DoD SRG parameter guidance across all DoD baselines', () => {
    const control = getControlById('dod-srg', 'AC-1');
    expect(control).toBeDefined();
    expect(isDoDSRGControl(control!)).toBe(true);
    if (!control || !isDoDSRGControl(control)) return;

    const baselineCases = [
      ['il4-mod', 'il4_mod'],
      ['il4-high', 'il4_high'],
      ['il5', 'il5'],
      ['il6', 'il6'],
    ] as const;

    for (const [baseline, key] of baselineCases) {
      const levelData = control.impact_levels[key];
      const info = getAssessmentParameterInfo('dod-srg', control, baseline);
      expect(levelData).toBeDefined();
      expect(info).not.toBeNull();
      expect(info?.label).toBe('DoD SRG Parameters');
      expect(info?.text.length).toBeGreaterThan(0);

      const expectedFragment =
        levelData?.fedramp_parameters?.trim()
        || levelData?.dod_parameters?.trim()
        || levelData?.additional_requirements?.trim();
      expect(expectedFragment).toBeTruthy();
      expect(info?.text).toContain(expectedFragment!);
    }

    expect(getAssessmentParameterInfo('dod-srg', control)).toEqual(
      getAssessmentParameterInfo('dod-srg', control, 'il4-mod'),
    );
  });

  it('continues returning FedRAMP Rev 5 parameter guidance when a baseline is selected and null for aiuc-1', () => {
    const control = getControlById('fedramp-rev5', 'AC-1');
    expect(control).toBeDefined();
    if (!control) return;

    const info = getAssessmentParameterInfo('fedramp-rev5', control, 'moderate');
    expect(info?.label).toBe('FedRAMP Parameters');
    expect(info?.text.length).toBeGreaterThan(0);
    expect(getAssessmentParameterInfo('aiuc-1', control, 'moderate')).toBeNull();
  });
});
