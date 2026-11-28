import { describe, expect, it } from 'vitest';
import { renderGuidanceMarkdown } from '@/lib/markdown-renderer';
import {
  getTechnologiesForControl,
  getTechnologyById,
} from '@/data/technology-guides';
import { generateUnifiedSearchIndex } from '@/data/unified-search';

describe('NIST CMVP API guide integration', () => {
  it('exposes the CMVP API as a security-tools guide', () => {
    const guide = getTechnologyById('nist-cmvp-api');

    expect(guide).toBeDefined();
    expect(guide?.name).toBe('NIST CMVP API');
    expect(guide?.category).toBe('security-tools');
    expect(guide?.officialUrl).toBe('https://ethanolivertroy.github.io/nist-cmvp-api/');
  });

  it('adds the CMVP API guide to the unified search index', () => {
    const entry = generateUnifiedSearchIndex().find(
      (candidate) =>
        candidate.type === 'guide' &&
        candidate.title === 'NIST CMVP API' &&
        candidate.href === '/guidance/nist-cmvp-api',
    );

    expect(entry).toBeDefined();
  });

  it('maps the guide to curated crypto-related controls', () => {
    expect(
      getTechnologiesForControl('SC-13', 'nist-800-53-r5').some(
        (guide) => guide.id === 'nist-cmvp-api',
      ),
    ).toBe(true);

    expect(
      getTechnologiesForControl('3.13.11', 'nist-800-171-r2').some(
        (guide) => guide.id === 'nist-cmvp-api',
      ),
    ).toBe(true);
  });

  it('includes the guide in guidance markdown exports', () => {
    const markdown = renderGuidanceMarkdown();

    expect(markdown).toContain('**NIST CMVP API** (Ethan Troy)');
    expect(markdown).toContain('Unofficial static JSON API for NIST CMVP cryptographic module data');
  });
});
