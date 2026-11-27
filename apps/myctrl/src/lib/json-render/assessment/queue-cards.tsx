/**
 * Queue item cards for the assessment remediation and evidence queues.
 *
 * Both queues render the same card shell (header, status badges, counts,
 * notes preview, inline editor); the remediation card adds an owner field and
 * the evidence card adds highlight bullets. AssessmentQueueItemCard owns the
 * shared structure and the two thin wrappers fill in the differing slots.
 */

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OWNER_COLORS, STATUS_COLORS, STATUS_LABELS, type ImplementationStatus } from '@/lib/db';
import type {
  AssessmentEvidenceItem,
  AssessmentRemediationItem,
} from '@/lib/services/assessment-view-data';
import {
  updateControlNotes,
  updateControlOwnerAndNotes,
} from '@/lib/services/assessment-actions';

function truncateNote(note?: string, maxLength = 140): string | null {
  const trimmed = note?.trim();
  if (!trimmed) return null;
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trimEnd()}...`;
}

export function buildAssessmentControlHref(assessmentId: string, controlId: string): string {
  const params = new URLSearchParams({
    assessmentId,
    controlId,
  });
  return `/assess?${params.toString()}`;
}

export function QueueActionButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
    >
      {children}
    </a>
  );
}

interface QueueCardItem {
  controlId: string;
  title: string;
  family: string;
  url: string;
  status: ImplementationStatus;
  owner?: string;
  notes?: string;
  assessmentQuestionCount: number;
  evidenceItemCount: number;
  linkedCmvpModuleCount: number;
}

interface QueueCardEditor {
  /** Show the owner input + hint next to the notes textarea. */
  showOwnerField: boolean;
  notesLabel: string;
  notesPlaceholder: string;
  notesMinHeightClass: string;
  saveLabel: string;
  saveErrorFallback: string;
  onSave: (drafts: { owner: string; notes: string }) => Promise<void>;
}

interface AssessmentQueueItemCardProps {
  assessmentId: string;
  item: QueueCardItem;
  /** Extra badges rendered after the status badge in the header. */
  statusBadges?: React.ReactNode;
  /** Extra badges rendered after the shared count badges. */
  countBadges?: React.ReactNode;
  showNotes: boolean;
  emptyNotesMessage: string;
  /** Rendered between the notes preview and the action row. */
  afterNotes?: React.ReactNode;
  editToggleLabel: string;
  editor: QueueCardEditor;
  onSaved: () => void;
}

export function AssessmentQueueItemCard({
  assessmentId,
  item,
  statusBadges,
  countBadges,
  showNotes,
  emptyNotesMessage,
  afterNotes,
  editToggleLabel,
  editor,
  onSaved,
}: AssessmentQueueItemCardProps) {
  const notePreview = truncateNote(item.notes);
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [ownerDraft, setOwnerDraft] = React.useState(item.owner ?? '');
  const [notesDraft, setNotesDraft] = React.useState(item.notes ?? '');

  React.useEffect(() => {
    setOwnerDraft(item.owner ?? '');
    setNotesDraft(item.notes ?? '');
    setSaveError(null);
  }, [item.owner, item.notes]);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await editor.onSave({ owner: ownerDraft, notes: notesDraft });
      onSaved();
      setEditing(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : editor.saveErrorFallback);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <a href={item.url} className="font-mono text-sm text-primary hover:underline">
            {item.controlId}
          </a>
          <p className="text-sm font-medium">{item.title}</p>
          <p className="text-xs text-muted-foreground">Family: {item.family}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="outline"
            style={{
              color: STATUS_COLORS[item.status],
              borderColor: STATUS_COLORS[item.status],
            }}
          >
            {STATUS_LABELS[item.status]}
          </Badge>
          {statusBadges}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">{item.assessmentQuestionCount} questions</Badge>
        {item.evidenceItemCount > 0 && (
          <Badge variant="secondary">{item.evidenceItemCount} evidence items</Badge>
        )}
        {item.linkedCmvpModuleCount > 0 && (
          <Badge variant="secondary">{item.linkedCmvpModuleCount} CMVP links</Badge>
        )}
        {countBadges}
      </div>

      {showNotes && (
        notePreview ? (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {notePreview}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {emptyNotesMessage}
          </p>
        )
      )}

      {afterNotes}

      <div className="flex flex-wrap gap-2">
        <QueueActionButton href={buildAssessmentControlHref(assessmentId, item.controlId)}>
          Open in assessment
        </QueueActionButton>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setEditing((current) => !current)}
        >
          {editing ? 'Close editor' : editToggleLabel}
        </Button>
      </div>

      {editing && (
        <div className="rounded-lg border border-border/60 bg-background/80 p-3 space-y-3">
          {editor.showOwnerField && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium">Owner</span>
                <input
                  type="text"
                  value={ownerDraft}
                  onChange={(event) => setOwnerDraft(event.target.value)}
                  placeholder="Assign an owner"
                  className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm"
                />
              </label>
              <div className="rounded-md border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
                Leave owner blank to keep this item unassigned.
              </div>
            </div>
          )}

          <label className="block space-y-1">
            <span className="text-xs font-medium">{editor.notesLabel}</span>
            <textarea
              value={notesDraft}
              onChange={(event) => setNotesDraft(event.target.value)}
              placeholder={editor.notesPlaceholder}
              className={`${editor.notesMinHeightClass} w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm`}
            />
          </label>

          {saveError && (
            <p className="text-xs text-destructive">{saveError}</p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setOwnerDraft(item.owner ?? '');
                setNotesDraft(item.notes ?? '');
                setSaveError(null);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? 'Saving...' : editor.saveLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AssessmentRemediationQueueCard({
  assessmentId,
  frameworkId,
  item,
  showOwners,
  showNotes,
  onSaved,
}: {
  assessmentId: string;
  frameworkId: string;
  item: AssessmentRemediationItem;
  showOwners: boolean;
  showNotes: boolean;
  onSaved: () => void;
}) {
  return (
    <AssessmentQueueItemCard
      assessmentId={assessmentId}
      item={item}
      statusBadges={
        <>
          {showOwners && (
            item.owner ? (
              <Badge
                variant="secondary"
                style={{
                  backgroundColor: `${OWNER_COLORS[item.owner] ?? '#888888'}20`,
                  color: OWNER_COLORS[item.owner] ?? '#888888',
                }}
              >
                {item.owner}
              </Badge>
            ) : (
              <Badge variant="outline">Unassigned</Badge>
            )
          )}
          {item.needsNotes && (
            <Badge variant="outline">Needs notes</Badge>
          )}
        </>
      }
      countBadges={item.autoSuggestSource && (
        <Badge variant="outline">From {item.autoSuggestSource}</Badge>
      )}
      showNotes={showNotes}
      emptyNotesMessage="No operator notes yet. Capture the implementation plan, blockers, and evidence owner."
      editToggleLabel="Update owner and notes"
      editor={{
        showOwnerField: true,
        notesLabel: 'Implementation notes',
        notesPlaceholder: 'Capture blockers, remediation steps, owners, and evidence locations...',
        notesMinHeightClass: 'min-h-[110px]',
        saveLabel: 'Save changes',
        saveErrorFallback: 'Failed to update remediation item.',
        onSave: ({ owner, notes }) =>
          updateControlOwnerAndNotes({ frameworkId, assessmentId }, item.controlId, owner, notes),
      }}
      onSaved={onSaved}
    />
  );
}

export function AssessmentEvidenceQueueCard({
  assessmentId,
  frameworkId,
  item,
  showEvidenceHighlights,
  showNotes,
  onSaved,
}: {
  assessmentId: string;
  frameworkId: string;
  item: AssessmentEvidenceItem;
  showEvidenceHighlights: boolean;
  showNotes: boolean;
  onSaved: () => void;
}) {
  return (
    <AssessmentQueueItemCard
      assessmentId={assessmentId}
      item={item}
      statusBadges={
        <>
          {item.needsNotes && (
            <Badge variant="outline">Needs evidence notes</Badge>
          )}
          {item.application && (
            <Badge variant="secondary">{item.application}</Badge>
          )}
          {item.frequency && (
            <Badge variant="secondary">{item.frequency}</Badge>
          )}
        </>
      }
      showNotes={showNotes}
      emptyNotesMessage="No evidence notes yet. Capture artifact owners, interview prep, and where proof will come from."
      afterNotes={showEvidenceHighlights && item.evidenceHighlights.length > 0 && (
        <ul className="space-y-1">
          {item.evidenceHighlights.map((highlight, index) => (
            <li key={`${item.controlId}:${index}`} className="text-xs text-muted-foreground">
              • {highlight}
            </li>
          ))}
        </ul>
      )}
      editToggleLabel="Update evidence notes"
      editor={{
        showOwnerField: false,
        notesLabel: 'Evidence notes',
        notesPlaceholder: 'Capture expected artifacts, interview prep, owners, and missing documentation...',
        notesMinHeightClass: 'min-h-[120px]',
        saveLabel: 'Save notes',
        saveErrorFallback: 'Failed to update evidence item.',
        onSave: ({ notes }) =>
          updateControlNotes({ frameworkId, assessmentId }, item.controlId, notes),
      }}
      onSaved={onSaved}
    />
  );
}
