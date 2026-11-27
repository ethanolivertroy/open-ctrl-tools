/**
 * Markdown export + preset builders for the assessment queue components.
 *
 * The remediation and evidence queues share the same copy/export/save-preset
 * flows; only the per-item markdown formatter and queue component config
 * differ, so the shared workflow lives here.
 */

import { getFrameworkConfig } from '@/data/controls';
import { getAssessmentLabel } from '@/lib/assessment-frameworks';
import { STATUS_LABELS } from '@/lib/db';
import type {
  AssessmentEvidenceItem,
  AssessmentRemediationItem,
  AssessmentViewSnapshot,
} from '@/lib/services/assessment-view-data';
import { getActiveProject } from '@/lib/storage/project-store';
import { saveView as saveSavedView } from '@/lib/storage/saved-view-store';
import { downloadFile } from '../actions';
import type { Component, View } from '../catalog';

export type AssessmentQueueComponent = Extract<
  Component,
  { type: 'AssessmentRemediationQueue' | 'AssessmentEvidenceQueue' }
>;

export type QueueMarkdownFormatter<T> = (
  assessmentName: string,
  queueLabel: string,
  items: T[],
) => string;

function slugifyLabel(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function formatRemediationQueueMarkdown(
  assessmentName: string,
  queueLabel: string,
  items: AssessmentRemediationItem[],
): string {
  const lines = [
    `# ${assessmentName} - ${queueLabel}`,
    '',
    `Exported ${new Date().toISOString()}`,
    '',
  ];

  for (const item of items) {
    lines.push(`## ${item.controlId} - ${item.title}`);
    lines.push(`- Status: ${STATUS_LABELS[item.status]}`);
    lines.push(`- Family: ${item.family}`);
    lines.push(`- Owner: ${item.owner || 'Unassigned'}`);
    lines.push(`- Assessment questions: ${item.assessmentQuestionCount}`);
    if (item.evidenceItemCount > 0) {
      lines.push(`- Evidence items: ${item.evidenceItemCount}`);
    }
    if (item.linkedCmvpModuleCount > 0) {
      lines.push(`- Linked CMVP modules: ${item.linkedCmvpModuleCount}`);
    }
    if (item.notes?.trim()) {
      lines.push('- Notes:');
      lines.push(item.notes.trim());
    } else {
      lines.push('- Notes: None');
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

export function formatEvidenceQueueMarkdown(
  assessmentName: string,
  queueLabel: string,
  items: AssessmentEvidenceItem[],
): string {
  const lines = [
    `# ${assessmentName} - ${queueLabel}`,
    '',
    `Exported ${new Date().toISOString()}`,
    '',
  ];

  for (const item of items) {
    lines.push(`## ${item.controlId} - ${item.title}`);
    lines.push(`- Status: ${STATUS_LABELS[item.status]}`);
    lines.push(`- Family: ${item.family}`);
    lines.push(`- Assessment questions: ${item.assessmentQuestionCount}`);
    if (item.evidenceItemCount > 0) {
      lines.push(`- Evidence items: ${item.evidenceItemCount}`);
    }
    if (item.frequency) {
      lines.push(`- Frequency: ${item.frequency}`);
    }
    if (item.application) {
      lines.push(`- Application: ${item.application}`);
    }
    if (item.linkedCmvpModuleCount > 0) {
      lines.push(`- Linked CMVP modules: ${item.linkedCmvpModuleCount}`);
    }
    if (item.evidenceHighlights.length > 0) {
      lines.push('- Evidence focus:');
      for (const highlight of item.evidenceHighlights) {
        lines.push(`  - ${highlight}`);
      }
    }
    if (item.notes?.trim()) {
      lines.push('- Evidence notes:');
      lines.push(item.notes.trim());
    } else {
      lines.push('- Evidence notes: None');
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

function buildAssessmentQueuePresetView(
  title: string,
  description: string,
  queueComponent: AssessmentQueueComponent,
  snapshot: AssessmentViewSnapshot,
): View {
  return {
    title,
    description,
    components: [
      {
        type: 'AssessmentOverview',
        frameworkId: snapshot.frameworkId,
        assessmentId: snapshot.assessment.id,
        baseline: snapshot.baseline,
        showStatusBreakdown: false,
        showMetadata: true,
      },
      queueComponent,
    ],
  };
}

function buildQueueProjectArtifactMarkdown(options: {
  projectName: string;
  assessmentName: string;
  frameworkName: string;
  baselineLabel: string;
  queueLabel: string;
  visibleCount: number;
  systemName?: string;
  queueMarkdown: string;
}): string {
  const {
    projectName,
    assessmentName,
    frameworkName,
    baselineLabel,
    queueLabel,
    visibleCount,
    systemName,
    queueMarkdown,
  } = options;

  const lines = [
    '# Assessment Workbench Artifact',
    '',
    `- Project: ${projectName}`,
    `- Assessment: ${assessmentName}`,
    `- Framework: ${frameworkName}`,
    `- Scope: ${baselineLabel}`,
    `- Queue: ${queueLabel}`,
    `- Visible controls: ${visibleCount}`,
    `- Exported: ${new Date().toISOString()}`,
  ];

  if (systemName?.trim()) {
    lines.push(`- System: ${systemName.trim()}`);
  }

  lines.push('', '## Queue Snapshot', '', queueMarkdown);
  return lines.join('\n').trim();
}

/** Copy the visible queue items to the clipboard as markdown. */
export async function copyQueueMarkdown<T>(options: {
  snapshot: AssessmentViewSnapshot;
  items: T[];
  queueLabel: string;
  formatFn: QueueMarkdownFormatter<T>;
}): Promise<void> {
  const { snapshot, items, queueLabel, formatFn } = options;
  await navigator.clipboard.writeText(
    formatFn(snapshot.assessment.name, queueLabel, items),
  );
}

/** Download the visible queue items as a project artifact markdown file. */
export async function exportQueueArtifact<T>(options: {
  snapshot: AssessmentViewSnapshot;
  items: T[];
  queueLabel: string;
  /** Filename suffix, e.g. 'remediation-artifact' or 'evidence-artifact'. */
  artifactSuffix: string;
  formatFn: QueueMarkdownFormatter<T>;
}): Promise<void> {
  const { snapshot, items, queueLabel, artifactSuffix, formatFn } = options;
  const project = await getActiveProject();
  const framework = getFrameworkConfig(snapshot.frameworkId);
  const artifact = buildQueueProjectArtifactMarkdown({
    projectName: project?.name ?? 'General',
    assessmentName: snapshot.assessment.name,
    frameworkName: framework.name,
    baselineLabel: getAssessmentLabel(snapshot.frameworkId, snapshot.baseline),
    queueLabel,
    visibleCount: items.length,
    systemName: snapshot.assessment.systemName,
    queueMarkdown: formatFn(snapshot.assessment.name, queueLabel, items),
  });

  downloadFile(
    artifact,
    `${slugifyLabel(project?.name ?? 'general')}-${slugifyLabel(snapshot.assessment.name)}-${artifactSuffix}.md`,
    'text/markdown;charset=utf-8',
  );
}

/** Persist the current queue configuration as a saved-view preset. */
export async function saveQueuePreset(options: {
  snapshot: AssessmentViewSnapshot;
  queueKind: 'Remediation' | 'Evidence';
  groupBy: string;
  queueComponent: AssessmentQueueComponent;
}): Promise<void> {
  const { snapshot, queueKind, groupBy, queueComponent } = options;
  const lowerKind = queueKind.toLowerCase();
  const view = buildAssessmentQueuePresetView(
    `${snapshot.assessment.name} ${queueKind} Queue`,
    `Saved ${lowerKind} queue preset grouped by ${groupBy} for ${getAssessmentLabel(snapshot.frameworkId, snapshot.baseline)}.`,
    queueComponent,
    snapshot,
  );

  await saveSavedView(
    `Queue preset · ${snapshot.assessment.name} · ${queueKind}`,
    `Saved ${lowerKind} queue preset grouped by ${groupBy}.`,
    JSON.stringify(view),
    {
      source: 'assessment',
      frameworkId: snapshot.frameworkId,
      assessmentId: snapshot.assessment.id,
      baseline: snapshot.baseline,
      systemName: snapshot.assessment.systemName,
    },
  );
}
