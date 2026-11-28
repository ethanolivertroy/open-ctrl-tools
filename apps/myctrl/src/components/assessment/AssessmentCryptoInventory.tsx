import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { AssessmentCryptoModule, CryptoUsageType } from '@/lib/db';
import {
  deleteAssessmentCryptoModule,
  getAssessmentCryptoModules,
  refreshAssessmentCryptoModuleSnapshot,
  setAssessmentCryptoModuleStale,
  updateAssessmentCryptoModule,
} from '@/lib/storage/assessment-store';
import { buildAssessmentCryptoSummary } from '@/lib/cmvp';
import { CmvpModuleCard } from '@/components/cmvp/CmvpModuleCard';
import { CMVPPicker } from '@/components/cmvp/CMVPPicker';
import { fetchCmvpCertificateDetail } from '@/lib/cmvp-client';

const USAGE_OPTIONS: CryptoUsageType[] = [
  'at-rest',
  'in-transit',
  'key-management',
  'signing',
  'other',
];

function formatUsageLabel(value: CryptoUsageType): string {
  return value.replace(/-/g, ' ');
}

export function AssessmentCryptoInventory({
  assessmentId,
  frameworkId,
  onInventoryChange,
}: {
  assessmentId: string;
  frameworkId: string;
  onInventoryChange?: () => void;
}) {
  const [modules, setModules] = React.useState<AssessmentCryptoModule[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const reconcileFreshness = React.useCallback(async (records: AssessmentCryptoModule[]) => {
    const candidates = records.filter((module) => module.certificateNumber && module.detailSnapshot);
    if (candidates.length === 0) return;

    let mutated = false;
    await Promise.all(candidates.map(async (module) => {
      if (!module.certificateNumber) return;
      try {
        const detail = await fetchCmvpCertificateDetail(module.certificateNumber);
        const isStale = !!detail.generatedAt
          && !!module.sourceGeneratedAt
          && detail.generatedAt !== module.sourceGeneratedAt;
        if (isStale !== !!module.stale) {
          mutated = true;
          await setAssessmentCryptoModuleStale(assessmentId, module.moduleId, isStale);
        } else if (module.detailSnapshot?.generatedAt && !module.sourceGeneratedAt) {
          mutated = true;
          await setAssessmentCryptoModuleStale(
            assessmentId,
            module.moduleId,
            !!module.stale,
            module.detailSnapshot.generatedAt,
          );
        }
      } catch {
        // Ignore background freshness failures and preserve the stored snapshot.
      }
    }));

    if (mutated) {
      const next = await getAssessmentCryptoModules(assessmentId);
      setModules(next);
    }
  }, [assessmentId]);

  const loadModules = React.useCallback(async () => {
    setLoading(true);
    const records = await getAssessmentCryptoModules(assessmentId);
    setModules(records);
    setLoading(false);
    void reconcileFreshness(records);
  }, [assessmentId, reconcileFreshness]);

  React.useEffect(() => {
    loadModules();
  }, [loadModules]);

  const handleUpdate = React.useCallback(async (
    moduleId: string,
    updates: Partial<Pick<AssessmentCryptoModule, 'componentName' | 'usageTypes' | 'notes'>>,
  ) => {
    await updateAssessmentCryptoModule(assessmentId, moduleId, updates);
    await loadModules();
    onInventoryChange?.();
  }, [assessmentId, loadModules, onInventoryChange]);

  const handleDelete = React.useCallback(async (moduleId: string) => {
    await deleteAssessmentCryptoModule(assessmentId, moduleId);
    await loadModules();
    onInventoryChange?.();
  }, [assessmentId, loadModules, onInventoryChange]);

  const handleRefreshSnapshot = React.useCallback(async (module: AssessmentCryptoModule) => {
    if (!module.certificateNumber) return;
    const detail = await fetchCmvpCertificateDetail(module.certificateNumber);
    await refreshAssessmentCryptoModuleSnapshot(assessmentId, module.moduleId, detail);
    await loadModules();
    onInventoryChange?.();
  }, [assessmentId, loadModules, onInventoryChange]);

  const datasetCounts = React.useMemo(() => {
    return modules.reduce<Record<string, number>>((counts, module) => {
      counts[module.dataset] = (counts[module.dataset] ?? 0) + 1;
      return counts;
    }, {});
  }, [modules]);

  const summary = React.useMemo(() => buildAssessmentCryptoSummary(modules), [modules]);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="text-base">Cryptographic Module Inventory</CardTitle>
            <CardDescription>
              Record the CMVP-validated cryptographic modules used by this system, add usage notes,
              and reuse that evidence across gap assessment controls.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              render={<a href="/cmvp" target="_blank" rel="noreferrer" />}
            >
              Open Explorer
            </Button>
            <Button
              size="sm"
              onClick={() => setPickerOpen(true)}
            >
              Add CMVP Modules
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <SummaryTile label="Modules Recorded" value={String(modules.length)} />
            <SummaryTile label="Active" value={String(datasetCounts.active ?? 0)} />
            <SummaryTile label="Historical" value={String(datasetCounts.historical ?? 0)} />
            <SummaryTile label="In Process" value={String(datasetCounts.in_process ?? 0)} />
          </div>

          <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
            {summary}
          </div>

          {frameworkId === 'fedramp-rev5' && (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-[11px]">FedRAMP priority</Badge>
              <span>
                Use this inventory to support SC-12, SC-13, SC-28, SC-8, and IA-7 with linked module evidence.
              </span>
            </div>
          )}

          {loading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Loading cryptographic inventory...</div>
          ) : modules.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No CMVP modules have been added to this assessment yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {modules.map((module) => (
                <InventoryModuleEditor
                  key={module.id}
                  module={module}
                  onSave={handleUpdate}
                  onDelete={handleDelete}
                  onRefreshSnapshot={handleRefreshSnapshot}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>Search CMVP Catalog</SheetTitle>
            <SheetDescription>
              Add cryptographic modules to this assessment, then link them to specific controls as evidence.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <CMVPPicker
              assessmentId={assessmentId}
              existingModuleIds={modules.map((module) => module.moduleId)}
              onAdded={async () => {
                await loadModules();
                onInventoryChange?.();
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function InventoryModuleEditor({
  module,
  onSave,
  onDelete,
  onRefreshSnapshot,
}: {
  module: AssessmentCryptoModule;
  onSave: (
    moduleId: string,
    updates: Partial<Pick<AssessmentCryptoModule, 'componentName' | 'usageTypes' | 'notes'>>,
  ) => Promise<void>;
  onDelete: (moduleId: string) => Promise<void>;
  onRefreshSnapshot: (module: AssessmentCryptoModule) => Promise<void>;
}) {
  const [componentName, setComponentName] = React.useState(module.componentName ?? '');
  const [notes, setNotes] = React.useState(module.notes ?? '');
  const [usageTypes, setUsageTypes] = React.useState<CryptoUsageType[]>(module.usageTypes ?? []);
  const [saving, setSaving] = React.useState(false);
  const [refreshingSnapshot, setRefreshingSnapshot] = React.useState(false);
  const [snapshotError, setSnapshotError] = React.useState<string | null>(null);
  const detailHref = module.certificateNumber
    ? `/cmvp/certificate/${encodeURIComponent(module.certificateNumber)}`
    : '/cmvp';

  React.useEffect(() => {
    setComponentName(module.componentName ?? '');
    setNotes(module.notes ?? '');
    setUsageTypes(module.usageTypes ?? []);
  }, [module.componentName, module.notes, module.usageTypes]);

  async function persist(updates: Partial<Pick<AssessmentCryptoModule, 'componentName' | 'usageTypes' | 'notes'>>) {
    setSaving(true);
    try {
      await onSave(module.moduleId, updates);
    } finally {
      setSaving(false);
    }
  }

  const footer = (
    <div className="space-y-3 border-t border-border/50 pt-3">
      {module.certificateNumber && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <div className="space-y-1">
            <div className="font-medium text-foreground">Certificate Snapshot</div>
            <div>
              {module.detailSnapshot
                ? `Captured ${module.snapshottedAt ? new Date(module.snapshottedAt).toLocaleString() : 'previously'}`
                : 'No certificate detail snapshot stored yet.'}
            </div>
            {module.sourceGeneratedAt && (
              <div>Upstream generated at {new Date(module.sourceGeneratedAt).toLocaleString()}</div>
            )}
            {module.stale && (
              <div className="text-amber-600 dark:text-amber-400">
                A newer upstream certificate record is available. Refresh before relying on this snapshot as current evidence.
              </div>
            )}
            {snapshotError && (
              <div className="text-red-600 dark:text-red-400">{snapshotError}</div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              render={<a href={detailHref} />}
            >
              View Detail
            </Button>
            <Button
              size="sm"
              variant={module.stale || !module.detailSnapshot ? 'default' : 'outline'}
              disabled={refreshingSnapshot}
              onClick={async () => {
                setRefreshingSnapshot(true);
                setSnapshotError(null);
                try {
                  await onRefreshSnapshot(module);
                } catch (error) {
                  setSnapshotError(error instanceof Error ? error.message : 'Unable to refresh the CMVP snapshot.');
                } finally {
                  setRefreshingSnapshot(false);
                }
              }}
            >
              {refreshingSnapshot
                ? 'Refreshing...'
                : module.detailSnapshot
                  ? module.stale
                    ? 'Refresh Snapshot'
                    : 'Refresh Detail'
                  : 'Fetch Snapshot'}
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            System Component
          </label>
          <input
            type="text"
            value={componentName}
            onChange={(event) => setComponentName(event.target.value)}
            onBlur={() => {
              if (componentName !== (module.componentName ?? '')) {
                void persist({ componentName: componentName.trim() || undefined });
              }
            }}
            placeholder="e.g., VPN gateway, EBS volume encryption"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Usage Types
          </label>
          <div className="flex flex-wrap gap-1.5">
            {USAGE_OPTIONS.map((value) => {
              const selected = usageTypes.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    const next = selected
                      ? usageTypes.filter((entry) => entry !== value)
                      : [...usageTypes, value];
                    setUsageTypes(next);
                    void persist({ usageTypes: next });
                  }}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                    selected
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  {formatUsageLabel(value)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Assessor Notes
        </label>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          onBlur={() => {
            if (notes !== (module.notes ?? '')) {
              void persist({ notes: notes.trim() || undefined });
            }
          }}
          rows={3}
          placeholder="Capture where this module is used, how it is configured, and what evidence you have."
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{saving ? 'Saving changes...' : 'Changes save back into the assessment inventory.'}</span>
        <Button variant="outline" size="sm" onClick={() => void onDelete(module.moduleId)}>
          Remove Module
        </Button>
      </div>
    </div>
  );

  return <CmvpModuleCard module={module} footer={footer} />;
}
