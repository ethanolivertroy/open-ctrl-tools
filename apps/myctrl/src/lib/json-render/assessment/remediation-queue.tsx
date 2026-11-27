import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ImplementationStatus } from '@/lib/db';
import { bulkAssignOwner, bulkUpdateStatus } from '@/lib/services/assessment-actions';
import { EmptyState, ErrorMessage, type ComponentProps } from '../primitives';
import { useAssessmentSnapshot } from './use-assessment-snapshot';
import { REMEDIATION_STATUS_GROUP_ORDER, groupItemsBy } from './grouping';
import {
  copyQueueMarkdown,
  exportQueueArtifact,
  formatRemediationQueueMarkdown,
  saveQueuePreset,
} from './export';
import { AssessmentRemediationQueueCard } from './queue-cards';
import { BulkStatusControls, QueueGroupHeader, QueueToolbarButtons } from './queue-shared';

export function AIAssessmentRemediationQueue({ config }: ComponentProps<'AssessmentRemediationQueue'>) {
  const {
    frameworkId,
    assessmentId,
    baseline,
    limit = 12,
    groupBy = 'status',
    includeStatuses,
    showOwners = true,
    showNotes = true,
  } = config;
  const { snapshot: loadedSnapshot, loading, error, refresh } = useAssessmentSnapshot({
    frameworkId,
    assessmentId,
    baseline,
    includeStatuses,
  });
  const [bulkOwner, setBulkOwner] = React.useState('');
  const [bulkAssigning, setBulkAssigning] = React.useState(false);
  const [bulkError, setBulkError] = React.useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = React.useState<ImplementationStatus>('planned');
  const [bulkStatusUpdating, setBulkStatusUpdating] = React.useState(false);
  const [bulkStatusError, setBulkStatusError] = React.useState<string | null>(null);
  const [exportState, setExportState] = React.useState<'idle' | 'copied' | 'error'>('idle');
  const [presetState, setPresetState] = React.useState<'idle' | 'saved' | 'error'>('idle');
  const [artifactState, setArtifactState] = React.useState<'idle' | 'exported' | 'error'>('idle');

  if (loading) {
    return <EmptyState message="Loading remediation queue..." />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  if (!loadedSnapshot) {
    return <EmptyState message="No matching assessment was found for this remediation queue." />;
  }

  const snapshot = loadedSnapshot;
  const items = snapshot.remediationQueue.slice(0, limit);
  if (items.length === 0) {
    return <EmptyState message="No remediation items matched the requested filters." />;
  }

  const groupedItems = groupItemsBy(items, groupBy, {
    defaultLabel: 'Remediation queue',
    statusOrder: REMEDIATION_STATUS_GROUP_ORDER,
  });
  const queueLabel = `Remediation Queue (${groupBy})`;
  const scope = { frameworkId: snapshot.frameworkId, assessmentId: snapshot.assessment.id };

  const handleBulkAssignVisible = async () => {
    setBulkAssigning(true);
    setBulkError(null);
    try {
      await bulkAssignOwner(scope, items.map((item) => item.controlId), bulkOwner);
      refresh();
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : 'Failed to assign visible remediation items.');
    } finally {
      setBulkAssigning(false);
    }
  };

  const handleBulkStatusVisible = async () => {
    setBulkStatusUpdating(true);
    setBulkStatusError(null);
    try {
      await bulkUpdateStatus(scope, items.map((item) => item.controlId), bulkStatus);
      refresh();
    } catch (error) {
      setBulkStatusError(error instanceof Error ? error.message : 'Failed to update visible remediation statuses.');
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
        formatFn: formatRemediationQueueMarkdown,
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
        queueKind: 'Remediation',
        groupBy,
        queueComponent: {
          type: 'AssessmentRemediationQueue',
          frameworkId: snapshot.frameworkId,
          assessmentId: snapshot.assessment.id,
          baseline: snapshot.baseline,
          limit,
          groupBy,
          includeStatuses,
          showOwners,
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
        artifactSuffix: 'remediation-artifact',
        formatFn: formatRemediationQueueMarkdown,
      });
      setArtifactState('exported');
    } catch {
      setArtifactState('error');
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>Remediation queue</CardTitle>
        <CardDescription>
          Action-oriented controls that still need implementation, assignment, or stronger notes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-border/60 bg-background/70 p-3 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Bulk owner assignment</p>
              <p className="text-xs text-muted-foreground">
                Assign the {items.length} visible remediation items in one shot. Leave blank to clear owners.
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

          <div className="flex flex-col gap-2 md:flex-row">
            <input
              type="text"
              value={bulkOwner}
              onChange={(event) => setBulkOwner(event.target.value)}
              placeholder="Owner for visible controls"
              className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm"
            />
            <Button
              type="button"
              size="sm"
              onClick={() => void handleBulkAssignVisible()}
              disabled={bulkAssigning}
            >
              {bulkAssigning ? 'Applying...' : 'Assign visible'}
            </Button>
          </div>

          <BulkStatusControls
            bulkStatus={bulkStatus}
            onBulkStatusChange={setBulkStatus}
            updating={bulkStatusUpdating}
            onApply={() => void handleBulkStatusVisible()}
          />

          {bulkError && (
            <p className="text-xs text-destructive">{bulkError}</p>
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
                <AssessmentRemediationQueueCard
                  key={`${item.controlId}:${item.status}`}
                  assessmentId={snapshot.assessment.id}
                  frameworkId={snapshot.frameworkId}
                  item={item}
                  showOwners={showOwners}
                  showNotes={showNotes}
                  onSaved={refresh}
                />
              ))}
            </div>
          </div>
        ))}

        {snapshot.remediationQueue.length > items.length && (
          <p className="text-xs text-center text-muted-foreground">
            Showing {items.length} of {snapshot.remediationQueue.length} remediation items
          </p>
        )}
      </CardContent>
    </Card>
  );
}
