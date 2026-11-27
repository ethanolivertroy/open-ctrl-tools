import { describe, expect, it } from 'vitest';
import { parseIntent } from '../intent-classifier';
import { buildFromIntent } from '../view-templates';

describe('assessment intent classification', () => {
  it('falls back to an assessment workbench intent from query context', () => {
    const intent = parseIntent(
      'not-json',
      'show me the readiness workbench for this assessment',
      {
        frameworkId: 'cmmc-v2',
        assessmentId: 'assessment-1',
        baseline: 'level-2',
      },
    );

    expect(intent).toEqual({
      intent: 'show_assessment_workbench',
      frameworks: ['cmmc-v2'],
      assessmentId: 'assessment-1',
      baseline: 'level-2',
    });
  });

  it('detects dod srg gap prompts and normalizes il5', () => {
    const intent = parseIntent(
      '{"intent":"explain"}',
      'show me the priority gaps for our DoD IL5 assessment',
    );

    expect(intent?.intent).toBe('show_assessment_gaps');
    expect(intent?.frameworks).toEqual(['dod-srg']);
    expect(intent?.baseline).toBe('il5');
  });

  it('detects owner-focused remediation prompts', () => {
    const intent = parseIntent(
      '{"intent":"show_assessment_remediation"}',
      'show me the unassigned owner buckets for our CMMC Level 2 assessment',
    );

    expect(intent?.intent).toBe('show_assessment_remediation');
    expect(intent?.frameworks).toEqual(['cmmc-v2']);
    expect(intent?.baseline).toBe('level-2');
  });

  it('detects evidence-prep prompts for assessments', () => {
    const intent = parseIntent(
      'not-json',
      'what evidence do we still need for our DoD IL5 assessment',
    );

    expect(intent?.intent).toBe('show_assessment_evidence');
    expect(intent?.frameworks).toEqual(['dod-srg']);
    expect(intent?.baseline).toBe('il5');
  });
});

describe('assessment view templates', () => {
  it('builds an assessment-native workbench view', () => {
    const view = buildFromIntent({
      intent: 'show_assessment_workbench',
      frameworks: ['cmmc-v2'],
      assessmentId: 'assessment-1',
      baseline: 'level-2',
    });

    expect(view?.title).toContain('CMMC Level 2');
    expect(view?.components.map(component => component.type)).toEqual([
      'TextBlock',
      'AssessmentOverview',
      'AssessmentFamilyBreakdown',
      'AssessmentRemediationQueue',
      'AssessmentEvidenceQueue',
    ]);
  });

  it('builds an owner-grouped remediation view', () => {
    const view = buildFromIntent({
      intent: 'show_assessment_remediation',
      frameworks: ['cmmc-v2'],
      assessmentId: 'assessment-1',
      baseline: 'level-2',
    });

    expect(view?.title).toContain('Remediation Queue');
    expect(view?.components.map(component => component.type)).toEqual([
      'TextBlock',
      'AssessmentOverview',
      'AssessmentRemediationQueue',
      'AssessmentRemediationQueue',
    ]);
  });

  it('builds an evidence-prep assessment view', () => {
    const view = buildFromIntent({
      intent: 'show_assessment_evidence',
      frameworks: ['dod-srg'],
      assessmentId: 'assessment-1',
      baseline: 'il5',
    });

    expect(view?.title).toContain('Evidence Prep');
    expect(view?.components.map(component => component.type)).toEqual([
      'TextBlock',
      'AssessmentOverview',
      'AssessmentEvidenceQueue',
      'AssessmentEvidenceQueue',
    ]);
  });
});
