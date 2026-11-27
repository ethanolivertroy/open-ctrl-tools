/**
 * CrosswalkAutoFill — UI for adding crosswalk sources and applying suggestions.
 *
 * Flow:
 * 1. User selects a source framework (SOC 2, PCI, etc.) and compliance level
 * 2. Preview: shows how many FedRAMP controls would be suggested
 * 3. Apply: bulk-sets auto-suggested statuses with accept/reject
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getDb, STATUS_COLORS, STATUS_LABELS } from '@/lib/db';
import type { Assessment, ImplementationStatus } from '@/lib/db';
import { getAllControlStatuses } from '@/lib/storage/assessment-store';
import {
  CROSSWALK_SOURCE_FRAMEWORKS,
  getAvailableCrosswalkSourceFrameworks,
  generateAutoFillSummary,
  previewAutoFillCount,
  type AutoFillSummary,
  type CrosswalkSuggestion,
} from '@/lib/assessment-crosswalk';
import { isFedRampBaseline, type FedRampBaseline } from '@/lib/assessment-scoring';

export function CrosswalkAutoFill({
  assessment,
  onClose,
  onApplied,
}: {
  assessment: Assessment;
  onClose: () => void;
  onApplied: () => void;
}) {
  const rawBaseline = assessment.targetBaseline || 'moderate';
  const baselineSupported = isFedRampBaseline(rawBaseline);
  const baseline: FedRampBaseline = baselineSupported ? rawBaseline : 'moderate';
  const existingSources = assessment.crosswalkSources || [];

  const [selectedFramework, setSelectedFramework] = useState('');
  const [complianceLevel, setComplianceLevel] = useState<'full' | 'partial'>('full');
  const [summary, setSummary] = useState<AutoFillSummary | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  // Preview counts for all available frameworks
  const sourceFrameworks = useMemo(() => getAvailableCrosswalkSourceFrameworks(), []);

  const previewCounts = useMemo(() => {
    if (!baselineSupported) return {};
    const counts: Record<string, number> = {};
    for (const fw of sourceFrameworks) {
      // Skip already-added sources
      if (existingSources.some(s => s.frameworkId === fw.id)) continue;
      counts[fw.id] = previewAutoFillCount(fw.id, baseline);
    }
    return counts;
  }, [baseline, baselineSupported, existingSources, sourceFrameworks]);

  // Available frameworks (not already added)
  const availableFrameworks = useMemo(() => {
    return sourceFrameworks.filter(
      fw => !existingSources.some(s => s.frameworkId === fw.id)
    );
  }, [existingSources, sourceFrameworks]);

  async function handlePreview() {
    if (!selectedFramework) return;
    const statusMap = await getAllControlStatuses(assessment.id);
    const result = generateAutoFillSummary(
      selectedFramework, complianceLevel, statusMap, baseline,
    );
    setSummary(result);
  }

  async function handleApplyAll() {
    if (!summary || summary.suggestions.length === 0) return;
    setApplying(true);
    const db = await getDb();

    // Bulk apply all suggestions
    for (const s of summary.suggestions) {
      const id = `${assessment.id}:fedramp-rev5:${s.fedrampControlId}`;
      const existing = await db.controlStatuses.get(id);
      await db.controlStatuses.put({
        id,
        assessmentId: assessment.id,
        frameworkId: 'fedramp-rev5',
        controlId: s.fedrampControlId,
        status: s.suggestedStatus,
        owner: existing?.owner,
        notes: existing?.notes,
        autoSuggested: true,
        autoSuggestSource: `${s.sourceFrameworkId}:${s.sourceControlIds.slice(0, 3).join(',')}`,
        confidence: s.confidence,
        updatedAt: Date.now(),
        linkedCmvpModuleIds: existing?.linkedCmvpModuleIds,
      });
    }

    // Update assessment's crosswalk sources
    const newSources = [
      ...existingSources,
      { frameworkId: selectedFramework, complianceLevel },
    ];
    await db.assessments.update(assessment.id, {
      crosswalkSources: newSources,
      updatedAt: Date.now(),
    });

    setApplying(false);
    setApplied(true);
    onApplied();
  }

  if (!baselineSupported) {
    return (
      <Card className="border-blue-500/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Crosswalk Auto-Fill</CardTitle>
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Crosswalk auto-fill is available only for FedRAMP Rev 5 baselines (Low, Moderate, High, LI-SaaS).
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-500/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Crosswalk Auto-Fill</CardTitle>
            <CardDescription>
              Import compliance from other frameworks to pre-fill FedRAMP controls
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Already-added sources */}
        {existingSources.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Active Sources</div>
            <div className="flex flex-wrap gap-1">
              {existingSources.map(s => {
                const name = CROSSWALK_SOURCE_FRAMEWORKS.find(f => f.id === s.frameworkId)?.name || s.frameworkId;
                return (
                  <Badge key={s.frameworkId} variant="secondary">
                    {name} ({s.complianceLevel})
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {applied ? (
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
            <div className="text-sm font-medium text-green-600 dark:text-green-400">
              Applied {summary?.totalSuggestions} suggestions from {summary?.sourceFrameworkName}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Review the suggested statuses in the control list and promote to "Implemented" after verifying FedRAMP-specific parameters.
            </div>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => {
              setSummary(null);
              setApplied(false);
              setSelectedFramework('');
            }}>
              Add Another Source
            </Button>
          </div>
        ) : summary ? (
          /* Preview results */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{summary.sourceFrameworkName}</div>
                <div className="text-xs text-muted-foreground">
                  {summary.totalSuggestions} controls can be auto-filled
                  ({summary.complianceLevel} compliance)
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSummary(null)}>
                  Back
                </Button>
                <Button size="sm" onClick={handleApplyAll} disabled={applying || summary.totalSuggestions === 0}>
                  {applying ? 'Applying...' : `Apply All ${summary.totalSuggestions} Suggestions`}
                </Button>
              </div>
            </div>

            {/* Confidence breakdown */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'High', count: summary.highConfidence, color: '#a6da95' },
                { label: 'Medium', count: summary.mediumConfidence, color: '#eed49f' },
                { label: 'Low', count: summary.lowConfidence, color: '#f5a97f' },
              ].map(c => (
                <div key={c.label} className="p-2 rounded border text-center">
                  <div className="text-lg font-mono font-bold" style={{ color: c.color }}>
                    {c.count}
                  </div>
                  <div className="text-xs text-muted-foreground">{c.label} confidence</div>
                </div>
              ))}
            </div>

            {/* Suggestion preview list */}
            <div className="max-h-64 overflow-y-auto border rounded divide-y">
              {summary.suggestions.slice(0, 50).map(s => (
                <div key={s.fedrampControlId} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                  <span className="font-mono w-14 shrink-0">{s.fedrampControlId}</span>
                  <Badge
                    variant="outline"
                    className="text-[11px] shrink-0"
                    style={{ borderColor: STATUS_COLORS[s.suggestedStatus] + '60' }}
                  >
                    {STATUS_LABELS[s.suggestedStatus]}
                  </Badge>
                  <span
                    className="shrink-0 px-1 rounded text-[11px]"
                    style={{
                      backgroundColor: s.confidence === 'high' ? '#a6da9520' : s.confidence === 'medium' ? '#eed49f20' : '#f5a97f20',
                      color: s.confidence === 'high' ? '#a6da95' : s.confidence === 'medium' ? '#eed49f' : '#f5a97f',
                    }}
                  >
                    {s.confidence}
                  </span>
                  <span className="text-muted-foreground truncate">{s.reason}</span>
                </div>
              ))}
              {summary.suggestions.length > 50 && (
                <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                  +{summary.suggestions.length - 50} more
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground p-2 rounded bg-amber-500/5 border border-amber-500/20">
              <strong>Note:</strong> Auto-fill never suggests "Implemented." FedRAMP has parameter-specific requirements
              that other frameworks don't cover. Review each suggestion and manually promote to "Implemented" after
              verifying FedRAMP parameters.
            </div>
          </div>
        ) : (
          /* Framework selection */
          <div className="space-y-3">
            {availableFrameworks.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                All available crosswalk sources have been added.
              </div>
            ) : (
              <>
                <div className="text-xs text-muted-foreground">
                  Select a framework you're already compliant with. We'll traverse built-in NIST
                  alignments (and any local crosswalk overlays you load into{' '}
                  <code>src/data/local/crosswalks/</code> for SOC 2, PCI DSS, ISO 27001, CIS, or CJIS)
                  to suggest matching FedRAMP controls.
                </div>
                <div className="grid gap-2">
                  {availableFrameworks.map(fw => (
                    <button
                      key={fw.id}
                      onClick={() => setSelectedFramework(fw.id)}
                      className={`
                        flex items-center justify-between px-3 py-2 rounded-lg border text-sm text-left transition-colors
                        ${selectedFramework === fw.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/30'
                        }
                      `}
                    >
                      <span>{fw.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        ~{previewCounts[fw.id] || 0} controls
                      </span>
                    </button>
                  ))}
                </div>

                {selectedFramework && (
                  <div className="flex items-center gap-3 pt-2">
                    <label className="text-sm">Compliance Level:</label>
                    <select
                      value={complianceLevel}
                      onChange={e => setComplianceLevel(e.target.value as 'full' | 'partial')}
                      className="px-2 py-1 rounded border bg-background text-sm"
                    >
                      <option value="full">Fully Compliant → suggest "Partial"</option>
                      <option value="partial">Partially Compliant → suggest "Planned"</option>
                    </select>
                    <Button size="sm" onClick={handlePreview}>
                      Preview Suggestions
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
