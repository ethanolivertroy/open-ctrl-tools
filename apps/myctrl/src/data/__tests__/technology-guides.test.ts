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
    expect(guide?.officialUrl).toBe('https://github.com/ethanolivertroy/open-ctrl-tools/tree/main/tools/nist-cmvp-api');
  });

  it('teaches people to build the dataset themselves instead of promising a hosted one', () => {
    const guide = getTechnologyById('nist-cmvp-api');
    const text = JSON.stringify(guide);

    // The hosted copy is a frozen snapshot; the guide must not present it as maintained.
    expect(text).not.toMatch(/weekly updates/i);
    expect(text).toContain('Archived snapshot');

    // Agent instructions: a prompt that points a coding agent at the pipeline's skill.
    expect(guide?.agentInstructions?.prompt).toContain('skills/nist-cmvp-pipeline/SKILL.md');
    expect(guide?.agentInstructions?.prompt).toMatch(/Do not publish, push, or deploy/);
    expect(guide?.agentInstructions?.skillUrl).toContain('/tools/nist-cmvp-api/skills/nist-cmvp-pipeline/SKILL.md');

    // Every command works against the reader's own run, never the archived host.
    expect(guide?.commands.length).toBeGreaterThan(0);
    for (const command of guide?.commands ?? []) {
      expect(command.command).not.toContain('ethanolivertroy.github.io');
    }
    expect(guide?.commands.some((command) => command.command.includes('scraper.py'))).toBe(true);
    expect(guide?.commands.some((command) => command.command.includes('validate_api.py'))).toBe(true);
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

    expect(markdown).toContain('**NIST CMVP API** (open-ctrl-tools)');
    expect(markdown).toContain('Open-source pipeline for building your own static JSON API of NIST CMVP');
  });
});
