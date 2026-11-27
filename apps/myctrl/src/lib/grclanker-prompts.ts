/**
 * GRCLanker system prompts: the global chat dock plus the assessment sidebar
 * (framework and AIUC-1 variants).
 *
 * Produces scannable markdown workpapers for security/GRC practitioners.
 * Unlike the ViewSchema catalog prompt, this path is chat-only (no JSON UI).
 */

import type { ImplementationStatus } from './db';
import {
  getAssessmentFrameworkLabel,
  getAssessmentLabel,
  type AssessmentFrameworkId,
} from './assessment-frameworks';
import type { AssessmentCryptoModule } from './cmvp';

/** The five ## headings every GRCLanker answer defaults to. */
function formatAnswerShape(evidenceHeading: string): string {
  return `## Finding / Gap
## Why it matters
## How to implement
## ${evidenceHeading}
## Next actions`;
}

export interface GrcLankerContext {
  controlId: string;
  controlTitle: string;
  controlDescription: string;
  family: string;
  familyName: string;
  baseline: string;
  status: ImplementationStatus;
  frameworkParameters?: string;
  frameworkParametersLabel?: string;
  assessmentQuestions?: { category: string; questions: string[] }[];
  userNotes?: string;
  autoSuggestSource?: string;
  systemName?: string;
  // AIUC-1 specific
  frameworkId?: string;
  evidenceItems?: { evidence_id: string; evidence_title: string; control_application: string; typical_evidence: string }[];
  application?: string;
  frequency?: string;
  linkedCmvpModules?: AssessmentCryptoModule[];
  assessmentCryptoSummary?: string;
  assessmentName?: string;
  assessorName?: string;
  assessorOrg?: string;
  owner?: string;
  crosswalkSources?: { frameworkId: string; complianceLevel: 'full' | 'partial' }[];
  controlDescriptionIncluded?: boolean;
}

const STATUS_DESCRIPTIONS: Record<ImplementationStatus, string> = {
  'not-assessed': 'has not been assessed yet',
  'not-implemented': 'is NOT implemented',
  'partially-implemented': 'is PARTIALLY implemented',
  'planned': 'is PLANNED but not yet implemented',
  'implemented': 'is fully IMPLEMENTED',
  'not-applicable': 'has been marked as NOT APPLICABLE',
};

export function buildGrcLankerSystemPrompt(ctx: GrcLankerContext): string {
  if (ctx.frameworkId === 'aiuc-1') {
    return buildAIUCSystemPrompt(ctx);
  }
  return buildFrameworkSystemPrompt(ctx);
}

function appendAssessmentProfile(ctx: GrcLankerContext): string {
  let block = '';
  if (ctx.systemName) block += `- **System Being Assessed:** ${ctx.systemName}\n`;
  if (ctx.assessmentName) block += `- **Assessment:** ${ctx.assessmentName}\n`;
  if (ctx.assessorName || ctx.assessorOrg) {
    block += `- **Assessor:** ${[ctx.assessorName, ctx.assessorOrg].filter(Boolean).join(' / ')}\n`;
  }
  if (ctx.owner) block += `- **Control Owner:** ${ctx.owner}\n`;
  if (ctx.crosswalkSources && ctx.crosswalkSources.length > 0) {
    block += `- **Claimed source frameworks:** ${ctx.crosswalkSources.map((source) => `${source.frameworkId} (${source.complianceLevel})`).join(', ')}\n`;
  }
  if (ctx.controlDescription && ctx.controlDescriptionIncluded !== false) {
    block += `\n### Control text\n${ctx.controlDescription}\n`;
  }
  return block;
}

export function buildGlobalGrcLankerSystemPrompt(context?: {
  frameworkId?: string;
  controlId?: string;
  family?: string;
  baseline?: string;
  systemName?: string;
}): string {
  const lines = [
    context?.frameworkId ? `Framework: ${context.frameworkId}` : null,
    context?.controlId ? `Control: ${context.controlId}` : null,
    context?.family ? `Family: ${context.family}` : null,
    context?.baseline ? `Baseline / scope: ${context.baseline}` : null,
    context?.systemName ? `System: ${context.systemName}` : null,
  ].filter(Boolean);

  return `You are GRCLanker, a senior security engineering and GRC practitioner for myctrl.tools.

Help operators with control interpretation, implementation, evidence, assessor expectations, gap analysis, inheritance, and POA&M-style next steps.

Write for a narrow chat panel. Keep answers short and easy to scan.

Default answer shape unless asked otherwise:
${formatAnswerShape('Evidence')}

Formatting rules:
- Use those exact ## headings
- Under each heading: 1 short paragraph or 3-6 bullets, not both walls of text
- Prefer bullets over tables. Use a table only for 2-4 rows of control IDs
- Do not escape markdown. Write **bold**, lists, and | tables as real markdown
- No ASCII art, no backslash-escaped * or |
- Ground answers in page context. Mark inferences. Do not invent citations

${lines.length > 0 ? `Current page context:\n${lines.join('\n')}` : 'No page-specific control is open. Ask a clarifying question if the framework or control matters.'}`;
}

function buildFrameworkSystemPrompt(ctx: GrcLankerContext): string {
  const statusDesc = STATUS_DESCRIPTIONS[ctx.status] || 'has not been assessed';
  const frameworkId = (ctx.frameworkId ?? 'fedramp-rev5') as AssessmentFrameworkId;
  const scopeLabel = getAssessmentLabel(frameworkId, ctx.baseline);
  const frameworkLabel = getAssessmentFrameworkLabel(frameworkId);
  const isCryptoPriorityControl = frameworkId === 'fedramp-rev5'
    && ['SC-12', 'SC-13', 'SC-28', 'SC-8', 'IA-7'].includes(ctx.controlId);

  const frameworkSpecificRole = frameworkId === 'cmmc-v2'
    ? 'You help security teams prepare for and execute CMMC 2.0 gap assessments.'
    : frameworkId === 'dod-srg'
      ? 'You help cloud teams assess and document DoD SRG requirements by impact level.'
      : 'You help security teams assess, implement, and document NIST 800-53 / FedRAMP security controls.';

  const assessorExpectation = frameworkId === 'cmmc-v2'
    ? 'When discussing evidence, mention what a C3PAO or internal readiness reviewer would expect to see'
    : frameworkId === 'dod-srg'
      ? 'When discussing evidence, mention what an SRG assessor or authorizing reviewer would expect to see'
      : 'When discussing evidence, mention what a 3PAO assessor would look for';

  let prompt = `You are GRCLanker, a senior security engineering and GRC practitioner embedded in myctrl.tools. ${frameworkSpecificRole} You think like both an implementer and an assessor.

## Current Control

- **Control:** ${ctx.controlId} — ${ctx.controlTitle}
- **Family:** ${ctx.family} (${ctx.familyName})
- **Scope:** ${scopeLabel}
- **Current Status:** This control ${statusDesc}
`;

  if (ctx.frameworkParameters) {
    prompt += `\n- **${ctx.frameworkParametersLabel || 'Framework Parameters'}:** ${ctx.frameworkParameters}\n`;
  }

  prompt += appendAssessmentProfile(ctx);

  if (ctx.autoSuggestSource) {
    prompt += `- **Auto-Suggested From:** ${ctx.autoSuggestSource} (via crosswalk mapping)\n`;
  }

  if (ctx.userNotes) {
    prompt += `\n### User's Notes\n${ctx.userNotes}\n`;
  }

  if (ctx.assessmentCryptoSummary) {
    prompt += `\n### Assessment Cryptographic Module Inventory\n${ctx.assessmentCryptoSummary}\n`;
  }

  if (ctx.linkedCmvpModules && ctx.linkedCmvpModules.length > 0) {
    prompt += `\n### Linked CMVP Modules For This Control\n`;
    for (const module of ctx.linkedCmvpModules) {
      const validationHistory = module.detailSnapshot?.validationHistory?.length
        ? `; Validation history: ${module.detailSnapshot.validationHistory.map((entry) => `${entry.date} (${entry.type}${entry.lab ? ` via ${entry.lab}` : ''})`).join('; ')}`
        : '';
      const exceptions = module.detailSnapshot?.securityLevelExceptions?.length
        ? `; Security level exceptions: ${module.detailSnapshot.securityLevelExceptions.join('; ')}`
        : '';
      const freshness = module.stale ? '; Snapshot status: stale' : '';
      prompt += `- ${module.certificateNumber ? `Certificate ${module.certificateNumber}` : module.moduleId}: ${module.vendorName} / ${module.moduleName}; Standard: ${module.standard ?? 'Unknown'}; Status: ${module.status}; Algorithms: ${module.algorithms.length > 0 ? module.algorithms.join(', ') : 'not listed'}${module.componentName ? `; Component: ${module.componentName}` : ''}${module.usageTypes && module.usageTypes.length > 0 ? `; Usage: ${module.usageTypes.join(', ')}` : ''}${module.notes ? `; Notes: ${module.notes}` : ''}${validationHistory}${exceptions}${freshness}\n`;
    }
  }

  if (isCryptoPriorityControl) {
    prompt += '\n### Crypto Relevance\nThis is a cryptography-sensitive FedRAMP control. Use the linked CMVP modules, algorithms, certificate status, and usage context when evaluating control coverage, gaps, and evidence.\n';
  }

  if (ctx.assessmentQuestions && ctx.assessmentQuestions.length > 0) {
    prompt += `\n### Assessment Interview Topics (from the framework)\n`;
    for (const group of ctx.assessmentQuestions) {
      prompt += `**${group.category}:**\n`;
      for (const q of group.questions) {
        prompt += `- ${q}\n`;
      }
    }
  }

  prompt += `
## Your Role

Write assessor-grade guidance teammates can paste into workpapers. Be specific to this control.

**Default answer shape (use these ## headings unless asked otherwise):**
${formatAnswerShape('Evidence an assessor expects')}

**Formatting:**
- Keep it scannable in a sidebar: short headings, then 3-6 bullets
- Prefer bullets over tables. Tables only for tiny comparison grids
- Do not escape markdown characters. Never write \\* or \\|
- One screen of content unless the operator asks to go deeper

**Guidelines:**
- Ground claims in the supplied control text, parameters, notes, CMVP data, and interview topics
- Mark inferences clearly when the local environment is unknown
- Reference framework parameters when they exist
- Suggest specific tools, configs, or artifacts where relevant
- ${assessorExpectation}
- Cover inheritance, shared responsibility, and common cloud patterns when they change evidence
- If the control is partially implemented, focus on what is likely missing
- If auto-suggested from another framework, explain source coverage vs additional ${frameworkLabel} requirements
- When CMVP modules are linked, reason about certificate numbers, algorithms, status, and residual risk

**Do NOT:**
- Output JSON or structured data — plain markdown only
- Repeat the control description verbatim
- Give disclaimer-heavy non-answers
- Invent citations, certificate numbers, or audit findings not in context
`;

  return prompt;
}

function buildAIUCSystemPrompt(ctx: GrcLankerContext): string {
  const statusDesc = STATUS_DESCRIPTIONS[ctx.status] || 'has not been assessed';

  let prompt = `You are GRCLanker, a senior AI agent security and GRC specialist embedded in myctrl.tools. You help teams assess, implement, and document controls from the AIUC-1 AI Agent Security standard.

## Current Control

- **Control:** ${ctx.controlId} — ${ctx.controlTitle}
- **Principle:** ${ctx.family} (${ctx.familyName})
- **Application:** ${ctx.application || 'Mandatory'}
- **Review Frequency:** ${ctx.frequency || 'Every 12 months'}
- **Current Status:** This control ${statusDesc}
`;

  prompt += appendAssessmentProfile(ctx);

  if (ctx.userNotes) {
    prompt += `\n### User's Notes\n${ctx.userNotes}\n`;
  }

  if (ctx.assessmentCryptoSummary) {
    prompt += `\n### Assessment Cryptographic Module Inventory\n${ctx.assessmentCryptoSummary}\n`;
  }

  if (ctx.evidenceItems && ctx.evidenceItems.length > 0) {
    prompt += `\n### Required Evidence (from AIUC-1)\n`;
    for (const ev of ctx.evidenceItems) {
      const coreLabel = ev.control_application.startsWith('Core') ? '**Core**' : '*Supplemental*';
      prompt += `- ${ev.evidence_id}: ${coreLabel} — ${ev.typical_evidence}\n`;
    }
  }

  prompt += `
## Your Role

Write auditor-ready AI agent security guidance teammates can paste into workpapers.

**Default answer shape:**
${formatAnswerShape('Evidence an auditor expects')}

**Formatting:**
- Short ## headings, then 3-6 bullets
- Prefer bullets over tables
- Do not escape markdown. Never write \\* or \\|
- Distinguish Core vs Supplemental evidence in bullets

**Guidelines:**
- Suggest specific tools, configs, or documentation
- Ground answers in supplied control text and evidence items; mark inferences
- If partially implemented, focus on missing evidence

**Do NOT:**
- Output JSON or structured UI
- Repeat the control description verbatim
- Give disclaimer-heavy non-answers
- Invent auditor findings not supported by context
`;

  return prompt;
}

/** Quick action prompts tailored to the control context */
export function getGrcLankerQuickActions(ctx: GrcLankerContext): { label: string; prompt: string }[] {
  if (ctx.frameworkId === 'aiuc-1') {
    return getAIUCQuickActions(ctx);
  }
  return getFrameworkQuickActions(ctx);
}

export function buildGrcLankerWorkbenchPrompt(
  ctx: GrcLankerContext,
  sourcePrompt?: string,
): string {
  const focus = sourcePrompt?.trim()
    ? `Focus on this operator request: ${sourcePrompt.trim()}`
    : 'Focus on the open gaps, expected evidence, and the next remediation steps for this control.';

  const baselineText = ctx.frameworkId === 'aiuc-1'
    ? 'the current AIUC-1 assessment'
    : `the ${getAssessmentLabel((ctx.frameworkId ?? 'fedramp-rev5') as AssessmentFrameworkId, ctx.baseline)} assessment`;

  const evidenceHint = ctx.frameworkId === 'aiuc-1'
    ? 'Pull in the relevant evidence items, auditor expectations, and implementation tasks.'
    : 'Pull in the relevant control expectations, likely evidence, and remediation tasks.';

  return [
    `Build an interactive assessment workbench for ${ctx.controlId} (${ctx.controlTitle}) in ${baselineText}.`,
    focus,
    evidenceHint,
    'If the operator asks about owners, assignments, or unassigned work, prefer an owner-grouped remediation queue. If they ask about artifacts, evidence, or interview prep, prefer an evidence-focused queue.',
    'Include an assessment summary, the main gaps or blockers, and a concrete action-oriented view that helps an operator move this control forward.',
  ].join(' ');
}

function getFrameworkQuickActions(ctx: GrcLankerContext): { label: string; prompt: string }[] {
  const actions: { label: string; prompt: string }[] = [];
  const frameworkId = (ctx.frameworkId ?? 'fedramp-rev5') as AssessmentFrameworkId;
  const scopeLabel = getAssessmentLabel(frameworkId, ctx.baseline);
  const assessmentReviewer = frameworkId === 'cmmc-v2'
    ? 'a C3PAO or internal readiness reviewer'
    : frameworkId === 'dod-srg'
      ? 'an SRG assessor or authorizing reviewer'
      : 'a 3PAO assessor';

  if (ctx.status === 'not-assessed' || ctx.status === 'not-implemented') {
    actions.push({
      label: 'Is this implemented?',
      prompt: `Help me determine if ${ctx.controlId} (${ctx.controlTitle}) is likely already implemented in our environment. What are the most common ways organizations implement this control? What should I check for?`,
    });
  }

  actions.push({
    label: 'How to implement',
    prompt: `Give me a step-by-step implementation guide for ${ctx.controlId} (${ctx.controlTitle}). Include specific tools, configurations, and best practices. What are the minimum requirements to satisfy this control in the ${scopeLabel} assessment scope?`,
  });

  actions.push({
    label: 'Evidence & testing',
    prompt: `What evidence do I need to demonstrate compliance with ${ctx.controlId} (${ctx.controlTitle})? What would ${assessmentReviewer} look for when evaluating this control? What artifacts should I prepare?`,
  });

  if (ctx.status === 'partially-implemented') {
    actions.push({
      label: 'What\'s missing?',
      prompt: `${ctx.controlId} is marked as partially implemented.${ctx.userNotes ? ` The user noted: "${ctx.userNotes}".` : ''} What are the most common gaps when this control is partially implemented? What specific areas should I focus on to achieve full compliance?`,
    });
  }

  if (ctx.status === 'planned') {
    actions.push({
      label: 'Implementation plan',
      prompt: `Create a phased implementation plan for ${ctx.controlId} (${ctx.controlTitle}). Include timeline estimates, resource requirements, dependencies on other controls, and key milestones. What should we prioritize first?`,
    });
  }

  if (ctx.frameworkParameters) {
    actions.push({
      label: 'Explain parameters',
      prompt: `Explain the framework-specific parameters for ${ctx.controlId}: "${ctx.frameworkParameters}". What do these mean in practice, and how should they influence implementation or evidence collection?`,
    });
  }

  if (ctx.linkedCmvpModules && ctx.linkedCmvpModules.length > 0) {
    actions.push({
      label: 'Review linked crypto',
      prompt: `Review the linked CMVP modules for ${ctx.controlId} (${ctx.controlTitle}). Explain whether the linked certificate numbers, standards, algorithms, and module statuses appear sufficient for this control, and call out any likely gaps or residual risks.`,
    });
  }

  return actions;
}

function getAIUCQuickActions(ctx: GrcLankerContext): { label: string; prompt: string }[] {
  const actions: { label: string; prompt: string }[] = [];
  const evidenceCount = ctx.evidenceItems?.length || 0;

  actions.push({
    label: 'What evidence do I need?',
    prompt: `List all evidence items required for ${ctx.controlId} (${ctx.controlTitle}). For each item, explain what an auditor expects to see, distinguish Core vs Supplemental requirements, and suggest the simplest way to produce each artifact.${evidenceCount > 0 ? ` There are ${evidenceCount} evidence items for this control.` : ''}`,
  });

  if (ctx.application) {
    actions.push({
      label: ctx.application === 'Mandatory' ? 'Why is this mandatory?' : 'Is this required?',
      prompt: `Explain why ${ctx.controlId} (${ctx.controlTitle}) is classified as "${ctx.application}" in AIUC-1. What are the implications of this classification? ${ctx.application === 'Optional' ? 'When should an organization choose to implement this optional control?' : 'What happens if this mandatory control is not met?'}`,
    });
  }

  actions.push({
    label: 'How to implement',
    prompt: `Give me a step-by-step implementation guide for ${ctx.controlId} (${ctx.controlTitle}) from the AIUC-1 AI agent security standard. Include specific tools, configurations, and engineering practices. What are the minimum requirements to satisfy this control?`,
  });

  if (ctx.status === 'partially-implemented') {
    actions.push({
      label: 'What\'s missing?',
      prompt: `${ctx.controlId} is marked as partially implemented.${ctx.userNotes ? ` The user noted: "${ctx.userNotes}".` : ''} Which evidence items are most commonly missed? What specific areas should I focus on to achieve full compliance?`,
    });
  }

  if (ctx.status === 'planned') {
    actions.push({
      label: 'Implementation plan',
      prompt: `Create a phased implementation plan for ${ctx.controlId} (${ctx.controlTitle}). This is an AI agent security control — include timeline estimates, engineering tasks, documentation needs, and key milestones.`,
    });
  }

  return actions;
}
