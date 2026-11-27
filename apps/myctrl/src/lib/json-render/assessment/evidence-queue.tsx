import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ImplementationStatus } from '@/lib/db';
import { bulkApplyNotesTemplate, bulkUpdateStatus } from '@/lib/services/assessment-actions';
import { EmptyState, ErrorMessage, type ComponentProps } from '../primitives';
import { useAssessmentSnapshot } from './use-assessment-snapshot';
import { DEFAULT_STATUS_GROUP_ORDER, groupItemsBy } from './grouping';
import {
  copyQueueMarkdown,
  exportQueueArtifact,
  formatEvidenceQueueMarkdown,
  saveQueuePreset,
} from './export';
import { AssessmentEvidenceQueueCard } from './queue-cards';
import { BulkStatusControls, QueueGroupHeader, QueueToolbarButtons } from './queue-shared';

export function AIAssessmentEvidenceQueue({ config }: ComponentProps<'AssessmentEvidenceQueue'>) {
  const {
    frameworkId,
    assessmentId,
    baseline,
    limit = 12,
    groupBy = 'status',
    includeStatuses,
    showEvidenceHighlights = true,
    showNotes = true,
  } = config;
  const { snapshot: loadedSnapshot, loading, error, refresh } = useAssessmentSnapshot({
    frameworkId,
    assessmentId,
    baseline,
    includeStatuses,
  });
  const [templateDraft, setTemplateDraft] = React.useState('');
  const [templateMode, setTemplateMode] = React.useState<'append' | 'replace'>('append');
  const [templating, setTemplating] = React.useState(false);
  const [templateError, setTemplateError] = React.useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = React.useState<ImplementationStatus>('planned');
  const [bulkStatusUpdating, setBulkStatusUpdating] = React.useState(false);
  const [bulkStatusError, setBulkStatusError] = React.useState<string | null>(null);
  const [exportState, setExportState] = React.useState<'idle' | 'copied' | 'error'>('idle');
  const [presetState, setPresetState] = React.useState<'idle' | 'saved' | 'error'>('idle');
  const [artifactState, setArtifactState] = React.useState<'idle' | 'exported' | 'error'>('idle');

  if (loading) {
    return <EmptyState message="Loading evidence queue..." />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  if (!loadedSnapshot) {
    return <EmptyState message="No matching assessment was found for this evidence queue." />;
  }

  const snapshot = loadedSnapshot;
  const items = snapshot.evidenceQueue.slice(0, limit);
  if (items.length === 0) {
    return <EmptyState message="No evidence items matched the requested filters." />;
  }

  const groupedItems = groupItemsBy(items, groupBy, {
    defaultLabel: 'Evidence queue',
    statusOrder: DEFAULT_STATUS_GROUP_ORDER,
  });
  const queueLabel = `Evidence Queue (${groupBy})`;
  const scope = { frameworkId: snapshot.frameworkId, assessmentId: snapshot.assessment.id };

  const handleApplyTemplate = async () => {
    setTemplating(true);
    setTemplateError(null);
    try {
      await bulkApplyNotesTemplate(
        scope,
        items.map((item) => item.controlId),
        templateDraft,
        templateMode,
      );
      refresh();
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : 'Failed to apply the evidence template.');
    } finally {
      setTemplating(false);
    }
  };

  const handleBulkStatusVisible = async () => {
    setBulkStatusUpdating(true);
    setBulkStatusError(null);
    try {
      await bulkUpdateStatus(scope, items.map((item) => item.controlId), bulkStatus);
      refresh();
    } catch (error) {
      setBulkStatusError(error instanceof Error ? error.message : 'Failed to update visible evidence statuses.');
    } finally {
      setBulkStatusUpdating(false);
    }
  };

  const handleCopyVisible = async () => {
    try {
      await copyQueueMarkdown({
        snapshot,
        items,
        queueLabel,
        formatFn: formatEvidenceQueueMarkdown,
      });
      setExportState('copied');
    } catch {
      setExportState('error');
    }
  };

  const handleSavePreset = async () => {
    try {
      await saveQueuePreset({
        snapshot,
        queueKind: 'Evidence',
        groupBy,
        queueComponent: {
          type: 'AssessmentEvidenceQueue',
          frameworkId: snapshot.frameworkId,
          assessmentId: snapshot.assessment.id,
          baseline: snapshot.baseline,
          limit,
          groupBy,
          includeStatuses,
          showEvidenceHighlights,
          showNotes,
        },
      });
      setPresetState('saved');
    } catch {
      setPresetState('error');
    }
  };

  const handleExportArtifact = async () => {
    try {
      await exportQueueArtifact({
        snapshot,
        items,
        queueLabel,
        artifactSuffix: 'evidence-artifact',
        formatFn: formatEvidenceQueueMarkdown,
      });
      setArtifactState('exported');
    } catch {
      setArtifactState('error');
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>Evidence queue</CardTitle>
        <CardDescription>
          Interview topics, evidence hints, and controls that still need supporting notes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-border/60 bg-background/70 p-3 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Bulk evidence note template</p>
              <p className="text-xs text-muted-foreground">
                Stamp a reusable evidence template across the {items.length} visible controls in this queue.
              </p>
            </div>
            <QueueToolbarButtons
              exportState={exportState}
              artifactState={artifactState}
              presetState={presetState}
              onCopy={() => void handleCopyVisible()}
              onExport={() => void handleExportArtifact()}
              onSavePreset={() => void handleSavePreset()}
            />
          </div>

          <textarea
            value={templateDraft}
            onChange={(event) => setTemplateDraft(event.target.value)}
            placeholder="Evidence request template, owner prompt, interview checklist, or documentation stub..."
            className="min-h-[110px] w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <Button
                type="button"
                size="sm"
                variant={templateMode === 'append' ? 'default' : 'outline'}
                onClick={() => setTemplateMode('append')}
              >
                Append template
              </Button>
              <Button
                type="button"
                size="sm"
                variant={templateMode === 'replace' ? 'default' : 'outline'}
                onClick={() => setTemplateMode('replace')}
              >
                Replace notes
              </Button>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={() => void handleApplyTemplate()}
              disabled={templating || !templateDraft.trim()}
            >
              {templating ? 'Applying...' : 'Apply to visible'}
            </Button>
          </div>

          <BulkStatusControls
            bulkStatus={bulkStatus}
            onBulkStatusChange={setBulkStatus}
            updating={bulkStatusUpdating}
            onApply={() => void handleBulkStatusVisible()}
          />

          {templateError && (
            <p className="text-xs text-destructive">{templateError}</p>
          )}
          {bulkStatusError && (
            <p className="text-xs text-destructive">{bulkStatusError}</p>
          )}
        </div>

        {groupedItems.map(([group, groupItems]) => (
          <div key={group} className="space-y-3">
            {groupBy !== 'none' && (
              <QueueGroupHeader group={group} groupBy={groupBy} count={groupItems.length} />
            )}
            <div className="space-y-2">
              {groupItems.map(item => (
                <AssessmentEvidenceQueueCard
                  key={`${item.controlId}:${item.status}`}
                  assessmentId={snapshot.assessment.id}
                  frameworkId={snapshot.frameworkId}
                  item={item}
                  showEvidenceHighlights={showEvidenceHighlights}
                  showNotes={showNotes}
                  onSaved={refresh}
                />
              ))}
            </div>
          </div>
        ))}

        {snapshot.evidenceQueue.length > items.length && (
          <p className="text-xs text-center text-muted-foreground">
            Showing {items.length} of {snapshot.evidenceQueue.length} evidence items
          </p>
        )}
      </CardContent>
    </Card>
  );
}
