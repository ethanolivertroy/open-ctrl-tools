import { describe, expect, it } from 'vitest';
import { normalizeGrcLankerMarkdown } from '../normalize-grclanker-markdown';

describe('normalizeGrcLankerMarkdown', () => {
  it('unescapes Grok markdown so headings and tables parse', () => {
    const cleaned = normalizeGrcLankerMarkdown([
      '\\*\\*Finding / Gap\\*\\*',
      '',
      '\\| Control \\| Meaning \\|',
      '\\| --- \\| --- \\|',
      '\\| PE-1 \\| Policy \\|',
    ].join('\n'));

    expect(cleaned).toContain('**Finding / Gap**');
    expect(cleaned).toContain('| Control | Meaning |');
    expect(cleaned).toContain('| PE-1 | Policy |');
    expect(cleaned).not.toContain('\\*');
    expect(cleaned).not.toContain('\\|');
  });

  it('strips think blocks and extra blank lines', () => {
    const cleaned = normalizeGrcLankerMarkdown('<think>secret</think>\n\n\n## Next actions\n\n\n- Assign owner\n');
    expect(cleaned).toBe('## Next actions\n\n- Assign owner');
    expect(cleaned).not.toContain('secret');
  });
});
