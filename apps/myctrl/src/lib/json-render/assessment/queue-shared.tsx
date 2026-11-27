/**
 * Shared toolbar/header building blocks for the assessment queue components.
 */

import { Button } from '@/components/ui/button';
import { STATUS_LABELS, type ImplementationStatus } from '@/lib/db';

export const IMPLEMENTATION_STATUS_OPTIONS: ImplementationStatus[] = [
  'not-assessed',
  'not-implemented',
  'partially-implemented',
  'planned',
  'implemented',
  'not-applicable',
];

export function BulkStatusControls({
  bulkStatus,
  onBulkStatusChange,
  updating,
  onApply,
}: {
  bulkStatus: ImplementationStatus;
  onBulkStatusChange: (status: ImplementationStatus) => void;
  updating: boolean;
  onApply: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 md:flex-row">
      <select
        value={bulkStatus}
        onChange={(event) => onBulkStatusChange(event.target.value as ImplementationStatus)}
        className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm"
      >
        {IMPLEMENTATION_STATUS_OPTIONS.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status]}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onApply}
        disabled={updating}
      >
        {updating ? 'Updating...' : 'Apply status'}
      </Button>
    </div>
  );
}

export function QueueToolbarButtons({
  exportState,
  artifactState,
  presetState,
  onCopy,
  onExport,
  onSavePreset,
}: {
  exportState: 'idle' | 'copied' | 'error';
  artifactState: 'idle' | 'exported' | 'error';
  presetState: 'idle' | 'saved' | 'error';
  onCopy: () => void;
  onExport: () => void;
  onSavePreset: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" onClick={onCopy}>
        {exportState === 'copied' ? 'Copied markdown' : exportState === 'error' ? 'Copy failed' : 'Copy visible'}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={onExport}>
        {artifactState === 'exported' ? 'Artifact exported' : artifactState === 'error' ? 'Export failed' : 'Export artifact'}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={onSavePreset}>
        {presetState === 'saved' ? 'Preset saved' : presetState === 'error' ? 'Save failed' : 'Save preset'}
      </Button>
    </div>
  );
}

export function QueueGroupHeader({
  group,
  groupBy,
  count,
}: {
  group: string;
  groupBy: string;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <h4 className="text-sm font-semibold">
        {groupBy === 'status' ? STATUS_LABELS[group as keyof typeof STATUS_LABELS] : group}
      </h4>
      <span className="text-xs text-muted-foreground">{count} controls</span>
    </div>
  );
}
