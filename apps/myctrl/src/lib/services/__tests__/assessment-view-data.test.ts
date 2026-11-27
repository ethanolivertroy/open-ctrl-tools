import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Assessment, ControlStatus, ImplementationStatus } from '../../db';
import {
  buildAssessmentEvidenceItems,
  buildAssessmentGapItems,
  buildAssessmentRemediationItems,
  loadAssessmentViewSnapshot,
  normalizeAssessmentBaseline,
  resolveAssessmentForView,
} from '../assessment-view-data';

vi.mock('../../storage/assessment-store', () => ({
  getAssessments: vi.fn(),
  getAllControlStatusRecords: vi.fn(),
}));

import { getAssessments, getAllControlStatusRecords } from '../../storage/assessment-store';

function makeAssessment(overrides: Partial<Assessment> = {}): Assessment {
  const timestamp = overrides.updatedAt ?? Date.now();
  return {
    id: overrides.id ?? crypto.randomUUID(),
    projectId: overrides.projectId ?? 'project-1',
    name: overrides.name ?? 'Assessment',
    description: overrides.description,
    targetFrameworks: overrides.targetFrameworks ?? ['fedramp-rev5'],
    createdAt: overrides.createdAt ?? timestamp,
    updatedAt: timestamp,
    assessorName: overrides.assessorName,
    assessorOrg: overrides.assessorOrg,
    systemName: overrides.systemName,
    targetBaseline: overrides.targetBaseline,
    crosswalkSources: overrides.crosswalkSources,
  };
}

function makeStatusRecord(overrides: Partial<ControlStatus> = {}): ControlStatus {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    assessmentId: overrides.assessmentId ?? 'assessment-1',
    frameworkId: overrides.frameworkId ?? 'fedramp-rev5',
    controlId: overrides.controlId ?? 'AC-2',
    status: overrides.status ?? 'not-assessed',
    owner: overrides.owner,
    notes: overrides.notes,
    updatedAt: overrides.updatedAt ?? Date.now(),
    autoSuggested: overrides.autoSuggested,
    autoSuggestSource: overrides.autoSuggestSource,
    confidence: overrides.confidence,
    linkedCmvpModuleIds: overrides.linkedCmvpModuleIds,
  };
}

describe('assessment view data', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('normalizes framework-specific baselines', () => {
    expect(normalizeAssessmentBaseline('aiuc-1')).toBe('all');
    expect(normalizeAssessmentBaseline('fedramp-20x-ksi', 'low')).toBe('low');
    expect(normalizeAssessmentBaseline('fedramp-20x-ksi', 'high')).toBe('moderate');
    expect(normalizeAssessmentBaseline('fedramp-rev5', 'high')).toBe('high');
    expect(normalizeAssessmentBaseline('fedramp-rev5')).toBe('moderate');
    expect(normalizeAssessmentBaseline('cmmc-v2')).toBe('level-2');
    expect(normalizeAssessmentBaseline('cmmc-v2', 'level-3')).toBe('level-3');
    expect(normalizeAssessmentBaseline('dod-srg')).toBe('il4-mod');
    expect(normalizeAssessmentBaseline('dod-srg', 'il5')).toBe('il5');
  });

  it('resolves the latest matching assessment for a framework and baseline', () => {
    const older = makeAssessment({
      id: 'older',
      name: 'Older Moderate',
      targetFrameworks: ['fedramp-rev5'],
      targetBaseline: 'moderate',
      updatedAt: 100,
    });
    const newer = makeAssessment({
      id: 'newer',
      name: 'Newer Moderate',
      targetFrameworks: ['fedramp-rev5'],
      targetBaseline: 'moderate',
      updatedAt: 200,
    });
    const otherFramework = makeAssessment({
      id: 'other-framework',
      targetFrameworks: ['aiuc-1'],
      updatedAt: 300,
    });

    expect(
      resolveAssessmentForView(
        [newer, otherFramework, older],
        'fedramp-rev5',
        'moderate',
      )?.id,
    ).toBe('newer');
    expect(
      resolveAssessmentForView(
        [newer, older],
        'fedramp-rev5',
        'moderate',
        'older',
      )?.id,
    ).toBe('older');
  });

  it('builds gap items from assessment statuses', () => {
    const controls = [
      {
        controlId: 'AC-2',
        title: 'Account Management',
        family: 'AC',
        url: '/frameworks/fedramp-rev5/ac-2',
      },
      {
        controlId: 'AC-3',
        title: 'Access Enforcement',
        family: 'AC',
        url: '/frameworks/fedramp-rev5/ac-3',
      },
      {
        controlId: 'AU-2',
        title: 'Event Logging',
        family: 'AU',
        url: '/frameworks/fedramp-rev5/au-2',
      },
    ];
    const statuses = new Map<string, ImplementationStatus>([
      ['fedramp-rev5:AC-2', 'partially-implemented'],
      ['fedramp-rev5:AC-3', 'implemented'],
      ['fedramp-rev5:AU-2', 'not-implemented'],
    ]);

    expect(buildAssessmentGapItems(controls, 'fedramp-rev5', statuses)).toEqual([
      {
        controlId: 'AU-2',
        title: 'Event Logging',
        family: 'AU',
        url: '/frameworks/fedramp-rev5/au-2',
        status: 'not-implemented',
      },
      {
        controlId: 'AC-2',
        title: 'Account Management',
        family: 'AC',
        url: '/frameworks/fedramp-rev5/ac-2',
        status: 'partially-implemented',
      },
    ]);
  });

  it('builds remediation and evidence queues with operational metadata', () => {
    const aiucControls = [
      {
        control_id: 'A.1',
        title: 'Human Review',
        family: 'accountability',
        description: 'Require human review.',
        application: 'Mandatory',
        frequency: 'Every 12 months',
        capabilities: 'review',
        controls_evidence: [
          {
            evidence_id: 'E-1',
            evidence_title: 'Human review procedure',
            control_text: 'Document the process.',
            control_application: 'Core',
            typical_evidence: 'Written review procedure',
            category: 'Policy',
            location: 'Confluence',
          },
        ],
        assessment_questions: [
          { category: 'Implementation', questions: ['How are human approvals documented?'] },
        ],
      },
    ];
    const records = new Map<string, ControlStatus>([
      ['aiuc-1:A.1', makeStatusRecord({
        frameworkId: 'aiuc-1',
        controlId: 'A.1',
        status: 'partially-implemented',
        owner: 'Security',
        linkedCmvpModuleIds: ['cmvp-1'],
      })],
    ]);

    const remediation = buildAssessmentRemediationItems(aiucControls as any, 'aiuc-1', records);
    expect(remediation[0]).toMatchObject({
      controlId: 'A.1',
      status: 'partially-implemented',
      owner: 'Security',
      needsOwner: false,
      needsNotes: true,
      evidenceItemCount: 1,
      assessmentQuestionCount: 1,
      linkedCmvpModuleCount: 1,
    });

    const evidence = buildAssessmentEvidenceItems(aiucControls as any, 'aiuc-1', records);
    expect(evidence[0]).toMatchObject({
      controlId: 'A.1',
      status: 'partially-implemented',
      needsNotes: true,
      evidenceItemCount: 1,
      assessmentQuestionCount: 1,
      application: 'Mandatory',
      frequency: 'Every 12 months',
      linkedCmvpModuleCount: 1,
    });
    expect(evidence[0]?.evidenceHighlights[0]).toContain('E-1');
  });

  it('loads the latest matching assessment snapshot', async () => {
    const latest = makeAssessment({
      id: 'latest',
      name: 'System Alpha Moderate',
      systemName: 'System Alpha',
      targetFrameworks: ['fedramp-rev5'],
      targetBaseline: 'moderate',
      updatedAt: 200,
    });
    const older = makeAssessment({
      id: 'older',
      targetFrameworks: ['fedramp-rev5'],
      targetBaseline: 'moderate',
      updatedAt: 100,
    });

    vi.mocked(getAssessments).mockResolvedValue([latest, older]);
    vi.mocked(getAllControlStatusRecords).mockResolvedValue(new Map([
      ['fedramp-rev5:AC-1', makeStatusRecord({ controlId: 'AC-1', status: 'implemented' })],
      ['fedramp-rev5:AC-2', makeStatusRecord({ controlId: 'AC-2', status: 'not-implemented' })],
      ['fedramp-rev5:AC-3', makeStatusRecord({ controlId: 'AC-3', status: 'planned' })],
    ]));

    const snapshot = await loadAssessmentViewSnapshot({
      frameworkId: 'fedramp-rev5',
      baseline: 'moderate',
    });

    expect(snapshot?.assessment.id).toBe('latest');
    expect(snapshot?.baseline).toBe('moderate');
    expect(snapshot?.frameworkId).toBe('fedramp-rev5');
    expect(snapshot?.distribution.length).toBeGreaterThan(0);
    expect(snapshot?.gaps.some(gap => gap.controlId === 'AC-2')).toBe(true);
    expect(snapshot?.remediationQueue.some(item => item.controlId === 'AC-2')).toBe(true);
    expect(snapshot?.evidenceQueue.length).toBeGreaterThan(0);
  });
});
