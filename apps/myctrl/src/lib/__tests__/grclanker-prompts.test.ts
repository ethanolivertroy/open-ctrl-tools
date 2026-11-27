import { describe, expect, it } from 'vitest';
import {
  buildGlobalGrcLankerSystemPrompt,
  buildGrcLankerSystemPrompt,
  buildGrcLankerWorkbenchPrompt,
  type GrcLankerContext,
} from '../grclanker-prompts';

function makeContext(overrides: Partial<GrcLankerContext> = {}): GrcLankerContext {
  return {
    controlId: overrides.controlId ?? 'AC-2',
    controlTitle: overrides.controlTitle ?? 'Account Management',
    controlDescription: overrides.controlDescription ?? 'Manage information system accounts.',
    family: overrides.family ?? 'AC',
    familyName: overrides.familyName ?? 'Access Control',
    baseline: overrides.baseline ?? 'moderate',
    status: overrides.status ?? 'partially-implemented',
    frameworkParameters: overrides.frameworkParameters,
    frameworkParametersLabel: overrides.frameworkParametersLabel,
    assessmentQuestions: overrides.assessmentQuestions,
    userNotes: overrides.userNotes,
    autoSuggestSource: overrides.autoSuggestSource,
    systemName: overrides.systemName,
    frameworkId: overrides.frameworkId ?? 'fedramp-rev5',
    evidenceItems: overrides.evidenceItems,
    application: overrides.application,
    frequency: overrides.frequency,
    linkedCmvpModules: overrides.linkedCmvpModules,
    assessmentCryptoSummary: overrides.assessmentCryptoSummary,
    assessmentName: overrides.assessmentName,
    assessorName: overrides.assessorName,
    assessorOrg: overrides.assessorOrg,
    owner: overrides.owner,
    crosswalkSources: overrides.crosswalkSources,
  };
}

describe('GRCLanker prompt helpers', () => {
  it('builds a generic workbench prompt when there is no source request', () => {
    const prompt = buildGrcLankerWorkbenchPrompt(makeContext());

    expect(prompt).toContain('interactive assessment workbench');
    expect(prompt).toContain('AC-2');
    expect(prompt).toContain('FedRAMP Moderate assessment');
    expect(prompt).toContain('open gaps');
    expect(prompt).toContain('evidence');
  });

  it('threads the operator request into the workbench prompt', () => {
    const prompt = buildGrcLankerWorkbenchPrompt(
      makeContext({ frameworkId: 'aiuc-1', application: 'Mandatory' }),
      'Show me the missing evidence and next remediation steps.',
    );

    expect(prompt).toContain('Focus on this operator request');
    expect(prompt).toContain('missing evidence and next remediation steps');
    expect(prompt).toContain('AIUC-1 assessment');
  });

  it('uses an expert persona and workpaper shape', () => {
    const prompt = buildGrcLankerSystemPrompt(makeContext({
      assessmentName: 'Prod FedRAMP Moderate',
      assessorName: 'Alex',
      assessorOrg: 'Example 3PAO',
      owner: 'Platform',
      systemName: 'Payments API',
      userNotes: 'SSO is partial; break-glass accounts are still local.',
    }));

    expect(prompt).toContain('You are GRCLanker');
    expect(prompt).toContain('## Finding / Gap');
    expect(prompt).toContain('## Evidence an assessor expects');
    expect(prompt).toContain('Do not escape markdown');
    expect(prompt).toContain('Payments API');
    expect(prompt).toContain('Prod FedRAMP Moderate');
    expect(prompt).toContain('Alex / Example 3PAO');
    expect(prompt).toContain('Platform');
    expect(prompt).toContain('3PAO');
    expect(prompt).not.toContain('2-4 paragraphs');
  });

  it('keeps CMMC assessor language', () => {
    const prompt = buildGrcLankerSystemPrompt(makeContext({ frameworkId: 'cmmc-v2' }));
    expect(prompt).toContain('C3PAO');
  });

  it('builds a global orb prompt from page context', () => {
    const prompt = buildGlobalGrcLankerSystemPrompt({
      frameworkId: 'fedramp-rev5',
      controlId: 'AC-2',
    });
    expect(prompt).toContain('GRCLanker');
    expect(prompt).toContain('fedramp-rev5');
    expect(prompt).toContain('AC-2');
    expect(prompt).toContain('## Finding / Gap');
    expect(prompt).toContain('Do not escape markdown');
  });
});
