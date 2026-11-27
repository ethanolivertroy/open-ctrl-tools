import { describe, expect, it } from 'vitest';
import {
  deriveComparisonTitle,
  getGoodBadExamplePresentation,
  hasGoodBadComparison,
  isComparableGoodBadCode,
  parseGoodBadCode,
  resolveComparisonTitle,
} from '@/components/guidance/good-bad-parser';

describe('parseGoodBadCode', () => {
  it('parses YAML comments into bad and good sections', () => {
    const code = `# BAD: pull_request_target runs with WRITE token
on: pull_request_target

# GOOD: pull_request runs in fork sandbox
on: pull_request`;

    const parsed = parseGoodBadCode(code);

    expect(parsed.bad).toContain('# BAD: pull_request_target runs with WRITE token');
    expect(parsed.good).toContain('# GOOD: pull_request runs in fork sandbox');
    expect(parsed.hasLeadingContent).toBe(false);
    expect(isComparableGoodBadCode(parsed)).toBe(true);
  });

  it('parses slash comments into bad and better/good sections', () => {
    const code = `// BAD: broad policy
allow = "*"

// GOOD: scoped policy
allow = "repo:read"

// BETTER: ephemeral policy
allow = "repo:read:short-lived"`;

    const parsed = parseGoodBadCode(code);

    expect(parsed.bad).toContain('// BAD: broad policy');
    expect(parsed.good).toContain('// GOOD: scoped policy');
    expect(parsed.better).toContain('// BETTER: ephemeral policy');
    expect(isComparableGoodBadCode(parsed)).toBe(true);
  });

  it('parses HTML comment markers into comparison sections', () => {
    const code = `<!-- BAD: any application bypass -->
<entry app="any" action="allow" />

<!-- GOOD: application-specific enforcement -->
<entry app="github" action="allow" />`;

    const parsed = parseGoodBadCode(code);

    expect(parsed.bad).toContain('<!-- BAD: any application bypass -->');
    expect(parsed.good).toContain('<!-- GOOD: application-specific enforcement -->');
    expect(isComparableGoodBadCode(parsed)).toBe(true);
  });

  it('does not mark code with only one section as comparable', () => {
    const code = `# GOOD: enforce least privilege
permissions:
  contents: read`;

    const parsed = parseGoodBadCode(code);

    expect(parsed.good).toContain('# GOOD: enforce least privilege');
    expect(parsed.bad).toBeNull();
    expect(isComparableGoodBadCode(parsed)).toBe(false);
  });

  it('captures shared prelude content before comparison sections', () => {
    const code = `name: CI

# BAD: broad token
permissions: write-all

# GOOD: scoped token
permissions:
  contents: read`;

    const parsed = parseGoodBadCode(code);

    expect(parsed.hasLeadingContent).toBe(true);
    expect(parsed.sharedPrelude).toBe('name: CI');
    expect(isComparableGoodBadCode(parsed)).toBe(true);
  });
});

describe('hasGoodBadComparison', () => {
  it('uses the shared parser decision for comparison detection', () => {
    const code = `steps:
  - name: Build

# BAD: unsafe env export
echo "BRANCH=$HEAD_REF" >> $GITHUB_ENV

# GOOD: use step env
env:
  BRANCH: \${{ github.head_ref }}`;

    expect(hasGoodBadComparison(code)).toBe(true);
  });
});

describe('getGoodBadExamplePresentation', () => {
  it('classifies shared-prelude snippets with bad and good sections as comparisons', () => {
    const code = `steps:
  - name: Setup

# BAD: mutable ref
- uses: actions/checkout@v4

# GOOD: pinned commit
- uses: actions/checkout@8ade135a`;

    expect(getGoodBadExamplePresentation(code)).toMatchObject({
      mode: 'comparison',
      status: null,
      parsed: {
        sharedPrelude: 'steps:\n  - name: Setup',
      },
    });
  });

  it('classifies good-only examples as single-sided good', () => {
    const code = `# GOOD: enforce least privilege
permissions:
  contents: read`;

    expect(getGoodBadExamplePresentation(code)).toMatchObject({
      mode: 'single-sided',
      status: 'good',
    });
  });

  it('classifies bad-only examples as single-sided bad', () => {
    const code = `# BAD: write-all token
permissions: write-all`;

    expect(getGoodBadExamplePresentation(code)).toMatchObject({
      mode: 'single-sided',
      status: 'bad',
    });
  });
});

describe('deriveComparisonTitle', () => {
  it('strips comparison prefixes and trailing qualifiers', () => {
    expect(deriveComparisonTitle('BAD vs GOOD: ServiceAccount Configuration')).toBe(
      'ServiceAccount Configuration',
    );
    expect(deriveComparisonTitle('GOOD: Gmail SPF Configuration (GWS.GMAIL.4.1v0.6)')).toBe(
      'Gmail SPF Configuration',
    );
  });

  it('uses curated neutral headings for titles that remain one-sided after stripping', () => {
    expect(deriveComparisonTitle('BAD: Pwn Request via pull_request_target (AVOID)')).toBe(
      'Pull Request Trigger Selection',
    );
    expect(deriveComparisonTitle('BAD: Weak Password Policy (AVOID)')).toBe(
      'Password Policy Strength',
    );
  });
});

describe('resolveComparisonTitle', () => {
  it('prefers explicit comparison titles for comparison snippets', () => {
    expect(
      resolveComparisonTitle('BAD: GITHUB_ENV Injection (AVOID)', {
        comparisonTitle: 'Workflow Environment Variable Handling',
        isSemanticExample: true,
      }),
    ).toBe('Workflow Environment Variable Handling');
  });

  it('derives neutral titles for semantic snippets without explicit headings', () => {
    expect(
      resolveComparisonTitle('BAD: secrets: inherit Overexposure (AVOID)', {
        isSemanticExample: true,
      }),
    ).toBe('Reusable Workflow Secret Scope');
  });

  it('derives neutral titles for single-sided examples too', () => {
    expect(
      resolveComparisonTitle('GOOD: Pin Actions to Commit SHA', {
        isSemanticExample: true,
      }),
    ).toBe('Pin Actions to Commit SHA');
  });

  it('leaves non-semantic example titles unchanged', () => {
    expect(
      resolveComparisonTitle('Branch Protection via API', {
        isSemanticExample: false,
      }),
    ).toBe('Branch Protection via API');
  });
});
