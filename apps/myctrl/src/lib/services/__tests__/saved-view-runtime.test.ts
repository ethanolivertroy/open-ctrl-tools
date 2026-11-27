import { describe, expect, it, vi } from 'vitest';
import { buildSavedViewContext, buildSavedViewRuntime, loadSavedViewRuntime } from '@/lib/services/saved-view-runtime';
import type { SavedView } from '@/lib/storage-types';

vi.mock('@/lib/storage/saved-view-store', () => ({
  getSavedViewById: vi.fn(),
}));

import { getSavedViewById } from '@/lib/storage/saved-view-store';

const baseSavedView: SavedView = {
  id: 'saved-view-1',
  projectId: 'project-1',
  name: 'IL5 Queue',
  prompt: 'Show me IL5 remediation work.',
  viewJson: JSON.stringify({
    title: 'DoD SRG Queue',
    components: [
      {
        type: 'AssessmentRemediationQueue',
        frameworkId: 'dod-srg',
        baseline: 'il5',
        groupBy: 'owner',
        limit: 10,
        showOwners: true,
        showNotes: true,
      },
    ],
  }),
  frameworkId: 'dod-srg',
  assessmentId: 'assessment-1',
  baseline: 'il5',
  systemName: 'Mission System',
  createdAt: Date.now(),
};

describe('saved view runtime', () => {
  it('builds AI context from saved view metadata', () => {
    expect(buildSavedViewContext(baseSavedView)).toEqual({
      frameworkId: 'dod-srg',
      controlId: undefined,
      family: undefined,
      assessmentId: 'assessment-1',
      baseline: 'il5',
      systemName: 'Mission System',
    });
  });

  it('hydrates a saved view into a validated runtime payload', () => {
    const runtime = buildSavedViewRuntime(baseSavedView);

    expect(runtime.context.frameworkId).toBe('dod-srg');
    expect(runtime.view.title).toBe('DoD SRG Queue');
    expect(runtime.view.components[0]?.type).toBe('AssessmentRemediationQueue');
  });

  it('returns null when a saved view cannot be found', async () => {
    vi.mocked(getSavedViewById).mockResolvedValueOnce(null);

    await expect(loadSavedViewRuntime('missing')).resolves.toBeNull();
  });

  it('throws a clear error for invalid saved view JSON', () => {
    expect(() => buildSavedViewRuntime({
      ...baseSavedView,
      viewJson: '{not valid json',
    })).toThrow('Saved view contains invalid JSON.');
  });
});
