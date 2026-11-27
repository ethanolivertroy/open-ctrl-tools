import { describe, expect, it } from 'vitest';
import { generateUnifiedSearchIndex } from '@/data/unified-search';

describe('CMVP explorer search integration', () => {
  it('adds the CMVP explorer page to the unified search index', () => {
    const entry = generateUnifiedSearchIndex().find(
      (candidate) =>
        candidate.type === 'page' &&
        candidate.title === 'CMVP Explorer' &&
        candidate.href === '/cmvp',
    );

    expect(entry).toBeDefined();
  });
});
