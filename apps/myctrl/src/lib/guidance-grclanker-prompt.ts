export interface GuidanceGrcLankerSection {
  id: string;
  title: string;
  summary: string;
  actions: string[];
}

export interface GuidanceGrcLankerSource {
  title: string;
  summary: string;
}

export interface GuidanceGrcLankerFramework {
  name: string;
  description: string;
}

export interface GuidanceGrcLankerCommand {
  group: string;
  description: string;
  command: string;
  scope?: string;
  notes?: string;
}

export interface GuidanceGrcLankerContext {
  guideId: string;
  guideName: string;
  intro: string;
  sections: GuidanceGrcLankerSection[];
  sources?: GuidanceGrcLankerSource[];
  frameworks?: GuidanceGrcLankerFramework[];
  commands?: GuidanceGrcLankerCommand[];
}

export interface GuidanceGrcLankerPromptOptions {
  mode?: 'full' | 'compact' | 'minimal';
}

export function buildGuidanceGrcLankerSystemPrompt(
  ctx: GuidanceGrcLankerContext,
  options: GuidanceGrcLankerPromptOptions = {},
): string {
  const mode = options.mode ?? 'full';
  const sectionCount = mode === 'minimal' ? 4 : 6;
  const actionCount = mode === 'minimal' ? 1 : 2;
  const sections = ctx.sections.slice(0, sectionCount).map((section) => {
    const actions = section.actions.slice(0, actionCount).map((action) => `  - ${action}`).join('\n');
    return `- ${section.title}: ${section.summary}\n${actions}`;
  }).join('\n');
  const sourceTitles = (ctx.sources ?? []).slice(0, 2).map((source) => source.title).join('; ');

  return `You are GRCLanker, a senior security engineering and GRC practitioner for the ${ctx.guideName} hardening guide.

Guide scope: ${ctx.intro}

Priority topics:
${sections}

${sourceTitles ? `Primary references: ${sourceTitles}\n` : ''}Keep answers practical, short, and implementation-first.

When answering:
- Start with the direct answer.
- Use ## headings and 3-6 bullets. Prefer checklists over long prose or tables.
- Do not escape markdown. Never write \\* or \\|.
- Focus on secure configuration and review steps a security engineer can act on quickly.
- Separate organization policy, repository settings, and workflow YAML when relevant.
- Prefer real CLI commands, CODEOWNERS entries, and valid workflow YAML.
- If verification matters, give a short practical check.
- Mark inferences when you lack environment detail. Do not invent config keys or citations.

For GitHub Actions specifically:
- Do not invent GitHub settings, API fields, CLI flags, or pseudo-YAML.
- Do not present GitHub UI settings as fake YAML keys.
- Do not recommend 'secrets: inherit' as a safe default.
- Do not recommend broad tokens, dumping all secrets, writing untrusted input into 'GITHUB_ENV', or casual use of 'pull_request_target'.
- If you do not have enough context for an exact code sample, say where to change it and how to verify it instead of fabricating syntax.

Preferred answer shape:
## What to change
## Where to change it
## Example
## How to verify
## Common mistakes
`;
}

export function getGuidanceGrcLankerQuickActions(
  ctx: GuidanceGrcLankerContext,
): { label: string; prompt: string }[] {
  if (ctx.guideId === 'github-actions') {
    return [
      {
        label: 'Secure baseline',
        prompt: 'Give me the shortest useful secure baseline for GitHub Actions. Organize it by org policy, repo settings, and workflow YAML. Keep it implementation-first and do not invent pseudo-configuration.',
      },
      {
        label: 'Implementation plan',
        prompt: 'I need to harden an existing GitHub repository quickly. Give me a short prioritized plan: what to change first, where to change it, and how to verify each step.',
      },
      {
        label: 'Evidence pack',
        prompt: 'Create a short evidence checklist for GitHub Actions hardening. Organize it by org policy, repo policy, workflow files, runner usage, and secrets handling.',
      },
      {
        label: 'High-risk findings',
        prompt: 'List the top GitHub Actions findings to look for. For each one, give the risk, how to detect it, and the fix.',
      },
      {
        label: 'PR threat review',
        prompt: 'Explain the main GitHub Actions risks around pull_request_target, workflow_run, untrusted artifacts, and forked pull requests. Keep it short and show the safe pattern.',
      },
      {
        label: 'Framework narrative',
        prompt: 'Map the GitHub Actions hardening areas on this page to practical control themes in NIST 800-53, FedRAMP Rev. 5, and CIS Controls v8. Explain the intent of the mapping and the evidence implications without inventing unsupported citations.',
      },
    ];
  }

  return [
    {
      label: 'Review priorities',
      prompt: `Summarize the highest-priority implementation and review work on this ${ctx.guideName} page.`,
    },
    {
      label: 'Evidence checklist',
      prompt: `What evidence should a reviewer collect to show that the ${ctx.guideName} guidance on this page has been implemented?`,
    },
    {
      label: 'Key risks',
      prompt: `What are the main risks addressed by the ${ctx.guideName} guidance on this page, and what should be checked first?`,
    },
    {
      label: 'Framework mapping',
      prompt: `Map the key hardening areas on this ${ctx.guideName} page to common control themes for GRC review.`,
    },
  ];
}
