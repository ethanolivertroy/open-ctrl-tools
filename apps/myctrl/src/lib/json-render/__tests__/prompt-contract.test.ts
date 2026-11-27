import { describe, expect, it } from 'vitest';
import { catalog, generateSystemPrompt, ViewSchema } from '@/lib/json-render/catalog';
import { componentRegistry } from '@/lib/json-render/components';
import { componentTypes } from '@/lib/json-render/component-manifest';

describe('json-render prompt contract', () => {
  it('keeps schema and runtime component manifests aligned', () => {
    const expected = [...componentTypes].sort();
    expect(Object.keys(catalog).sort()).toEqual(expected);
    expect(Object.keys(componentRegistry).sort()).toEqual(expected);
  });

  it('advertises shipped assessment workbench surfaces and baselines', () => {
    const prompt = generateSystemPrompt({ frameworkId: 'dod-srg' });

    expect(prompt).toContain('AssessmentOverview');
    expect(prompt).toContain('AssessmentRemediationQueue');
    expect(prompt).toContain('AssessmentEvidenceQueue');
    expect(prompt).toContain('FilterControls');
    expect(prompt).toContain('cmmc-v2');
    expect(prompt).toContain('dod-srg');
    expect(prompt).toContain('il4-mod');
    expect(prompt).toContain('il5');
  });

  it('validates an assessment-native workbench view', () => {
    const parsed = ViewSchema.parse({
      title: 'DoD SRG Remediation Cockpit',
      description: 'Focused on owner assignment and evidence prep.',
      components: [
        {
          type: 'AssessmentOverview',
          frameworkId: 'dod-srg',
          baseline: 'il5',
          showStatusBreakdown: true,
          showMetadata: true,
        },
        {
          type: 'AssessmentRemediationQueue',
          frameworkId: 'dod-srg',
          baseline: 'il5',
          groupBy: 'owner',
          limit: 10,
          showOwners: true,
          showNotes: true,
        },
        {
          type: 'AssessmentEvidenceQueue',
          frameworkId: 'dod-srg',
          baseline: 'il5',
          groupBy: 'status',
          limit: 10,
          showEvidenceHighlights: true,
          showNotes: true,
        },
      ],
      actions: [
        {
          type: 'export',
          format: 'json',
          data: 'view',
          params: {
            scope: 'current',
          },
        },
      ],
    });

    expect(parsed.components).toHaveLength(3);
    expect(parsed.components[1]?.type).toBe('AssessmentRemediationQueue');
    expect(parsed.components[2]?.type).toBe('AssessmentEvidenceQueue');
  });
});
