/**
 * AssessmentControlList — Per-control status tracking for gap analysis.
 *
 * Shows all controls for the assessment's target baseline with:
 * - Status dropdown picker (color-coded)
 * - Expandable assessment questions (from framework data)
 * - Notes field
 * - Auto-suggested badge (from crosswalk auto-fill)
 * - Filter/sort by family, status, auto-suggested
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getDb, STATUS_COLORS, STATUS_LABELS } from '@/lib/db';
import type { Assessment, ImplementationStatus, ControlStatus } from '@/lib/db';
import type { AIContext } from '@/lib/ai-data-context';
import {
  buildAssessmentControlUrl,
  getAssessmentControls,
  getAssessmentFamilyNames,
  getAssessmentParameterInfo,
  getPrimaryAssessmentFrameworkId,
  normalizeAssessmentBaseline,
  type AssessmentFrameworkId,
} from '@/lib/assessment-frameworks';
import {
  getAssessmentCryptoModules,
  setControlCmvpLinks,
  setControlNotes,
  setControlStatus,
} from '@/lib/storage/assessment-store';
import {
  get20xDifferentialKSIs,
} from '@/lib/assessment-scoring';
import {
  getRelatedRev5Statuses,
  getRelatedKSIStatuses,
  hasRelatedKSIs,
  type RelatedControlStatus,
} from '@/lib/assessment-20x-crosswalk';
import {
  buildAssessmentCryptoSummary,
  buildControlCmvpEvidenceSummary,
  getFedRampCryptoPriorityControls,
  type AssessmentCryptoModule,
} from '@/lib/cmvp';
import { AssessmentGrcLanker } from './AssessmentGrcLanker';
import type { AIUCEvidence, Control, FedRampKSIControl } from '@/data/types';
import { isAIUCControl, isFedRampKSIControl } from '@/data/types';

type StatusFilter = ImplementationStatus | 'all' | 'gaps';

const ALL_STATUSES: ImplementationStatus[] = [
  'implemented',
  'partially-implemented',
  'planned',
  'not-implemented',
  'not-applicable',
  'not-assessed',
];
type AnyControl = Control & { _isDifferential?: boolean };

function isKSIControl(c: AnyControl): c is FedRampKSIControl & { _isDifferential?: boolean } {
  return isFedRampKSIControl(c);
}

export function AssessmentControlList({
  assessment,
  onStatusChange,
  inventoryVersion = 0,
  onOpenAIView,
  initialExpandedControlId,
}: {
  assessment: Assessment;
  onStatusChange: () => void;
  inventoryVersion?: number;
  onOpenAIView?: (context?: AIContext, prompt?: string) => void;
  initialExpandedControlId?: string;
}) {
  const frameworkId = getPrimaryAssessmentFrameworkId(assessment.targetFrameworks);
  const isAiuc = frameworkId === 'aiuc-1';
  const isKsi = frameworkId === 'fedramp-20x-ksi';
  const baseline = normalizeAssessmentBaseline(frameworkId, assessment.targetBaseline);
  const controls = useMemo(() => {
    if (isKsi) {
      const required = getAssessmentControls(frameworkId, baseline) as Array<FedRampKSIControl & { _isDifferential?: boolean }>;
      if (baseline === 'low') {
        const differential = get20xDifferentialKSIs().map(c => ({
          ...c,
          url: buildAssessmentControlUrl(frameworkId, c.control_id),
          _isDifferential: true,
        })) as Array<FedRampKSIControl & { _isDifferential?: boolean }>;
        return [...required, ...differential] as AnyControl[];
      }
      return required as AnyControl[];
    }
    return getAssessmentControls(frameworkId, baseline) as AnyControl[];
  }, [baseline, frameworkId, isKsi]);
  const familyNames = useMemo(() => getAssessmentFamilyNames(frameworkId), [frameworkId]);

  const [statuses, setStatuses] = useState<Map<string, ControlStatus>>(new Map());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [familyFilter, setFamilyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [assessmentCryptoModules, setAssessmentCryptoModules] = useState<AssessmentCryptoModule[]>([]);
  const rowRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  // Load all statuses for this assessment
  useEffect(() => {
    void Promise.all([loadStatuses(), loadAssessmentCryptoModules()]);
  }, [assessment.id, inventoryVersion]);

  async function loadStatuses() {
    const db = await getDb();
    const records = await db.controlStatuses
      .where('assessmentId').equals(assessment.id)
      .toArray();
    const map = new Map<string, ControlStatus>();
    for (const r of records) {
      map.set(r.controlId, r);
    }
    setStatuses(map);
  }

  async function loadAssessmentCryptoModules() {
    const modules = await getAssessmentCryptoModules(assessment.id);
    setAssessmentCryptoModules(modules);
  }

  // Filter controls
  const filteredControls = useMemo(() => {
    let result = controls;

    if (familyFilter !== 'all') {
      result = result.filter(c => c.family === familyFilter);
    }

    if (statusFilter === 'gaps') {
      result = result.filter(c => {
        const s = statuses.get(c.control_id)?.status || 'not-assessed';
        return s === 'not-implemented' || s === 'partially-implemented' || s === 'not-assessed';
      });
    } else if (statusFilter !== 'all') {
      result = result.filter(c => {
        const s = statuses.get(c.control_id)?.status || 'not-assessed';
        return s === statusFilter;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.control_id.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
      );
    }

    return result;
  }, [controls, familyFilter, statusFilter, searchQuery, statuses]);

  // Status counts for filter badges
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: controls.length, gaps: 0 };
    for (const s of ALL_STATUSES) counts[s] = 0;

    for (const c of controls) {
      const status = statuses.get(c.control_id)?.status || 'not-assessed';
      counts[status] = (counts[status] || 0) + 1;
      if (status === 'not-implemented' || status === 'partially-implemented' || status === 'not-assessed') {
        counts.gaps++;
      }
    }
    return counts;
  }, [controls, statuses]);

  // Handle status change for a control
  const handleStatusChange = useCallback(async (controlId: string, newStatus: ImplementationStatus) => {
    await setControlStatus(frameworkId, controlId, newStatus, assessment.id);
    await loadStatuses();
    onStatusChange();
  }, [assessment.id, frameworkId, onStatusChange]);

  // Handle notes change
  const handleNotesChange = useCallback(async (controlId: string, notes: string) => {
    await setControlNotes(frameworkId, controlId, notes, assessment.id);
    await loadStatuses();
  }, [assessment.id, frameworkId]);

  useEffect(() => {
    if (!initialExpandedControlId) return;
    setExpandedId(initialExpandedControlId);
  }, [initialExpandedControlId]);

  useEffect(() => {
    if (!expandedId) return;
    const frame = window.requestAnimationFrame(() => {
      const row = rowRefs.current.get(expandedId);
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [expandedId, filteredControls.length]);

  const handleCmvpLinksChange = useCallback(async (controlId: string, linkedModuleIds: string[]) => {
    await setControlCmvpLinks(frameworkId, controlId, linkedModuleIds, assessment.id);
    await loadStatuses();
  }, [assessment.id, frameworkId]);

  const handleAppendCmvpSummary = useCallback(async (controlId: string, linkedModuleIds: string[]) => {
    const linkedIdSet = new Set(linkedModuleIds);
    const linkedModules = assessmentCryptoModules.filter((module) => linkedIdSet.has(module.moduleId));
    const summary = buildControlCmvpEvidenceSummary(linkedModules);
    if (!summary) return;

    const existingNotes = statuses.get(controlId)?.notes?.trim();
    const heading = 'CMVP Evidence Summary';
    const nextNotes = existingNotes
      ? `${existingNotes}\n\n${heading}\n${summary}`
      : `${heading}\n${summary}`;

    await handleNotesChange(controlId, nextNotes);
  }, [assessmentCryptoModules, handleNotesChange, statuses]);

  const assessmentCryptoSummary = useMemo(
    () => buildAssessmentCryptoSummary(assessmentCryptoModules),
    [assessmentCryptoModules],
  );
  const cryptoPriorityControls = useMemo(
    () => new Set(frameworkId === 'fedramp-rev5' ? getFedRampCryptoPriorityControls() : []),
    [frameworkId],
  );

  // Unique family list for filter
  const familyList = useMemo(() => {
    const seen = new Set<string>();
    return controls
      .map(c => c.family)
      .filter(f => { if (seen.has(f)) return false; seen.add(f); return true; })
      .sort();
  }, [controls]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search controls..."
          className="px-3 py-1.5 rounded-lg border bg-background text-sm w-64"
        />
        <select
          value={familyFilter}
          onChange={e => setFamilyFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border bg-background text-sm"
        >
          <option value="all">All Families ({controls.length})</option>
          {familyList.map(f => (
            <option key={f} value={f}>{f} — {familyNames[f] || f}</option>
          ))}
        </select>
        <div className="flex gap-1 flex-wrap">
          <FilterBadge
            label="All"
            count={statusCounts.all}
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
          />
          <FilterBadge
            label="Gaps"
            count={statusCounts.gaps}
            active={statusFilter === 'gaps'}
            onClick={() => setStatusFilter('gaps')}
            color="#f5a97f"
          />
          {ALL_STATUSES.map(s => (
            <FilterBadge
              key={s}
              label={STATUS_LABELS[s]}
              count={statusCounts[s] || 0}
              active={statusFilter === s}
              onClick={() => setStatusFilter(s)}
              color={STATUS_COLORS[s]}
            />
          ))}
        </div>
      </div>

      {/* Controls list + GRCLanker sidebar */}
      <div className="text-xs text-muted-foreground">
        Showing {filteredControls.length} of {controls.length} controls
      </div>

      <div className="flex gap-4">
        {/* Control list */}
        <div className="flex-1 min-w-0 space-y-1">
          {filteredControls.map((control, idx) => {
            const isDiff = isKSIControl(control) && control._isDifferential;
            const prevControl = idx > 0 ? filteredControls[idx - 1] : null;
            const showDiffDivider = isDiff && prevControl && !(isKSIControl(prevControl) && prevControl._isDifferential);
            return (
              <div
                key={control.control_id}
                ref={(node) => {
                  rowRefs.current.set(control.control_id, node);
                }}
              >
                {showDiffDivider && (
                  <div className="flex items-center gap-3 py-3 mt-2">
                    <div className="flex-1 h-px bg-purple-500/30" />
                    <span className="text-xs font-medium text-purple-500">Moderate Differential</span>
                    <div className="flex-1 h-px bg-purple-500/30" />
                  </div>
                )}
                <ControlRow
                  control={control}
                  status={statuses.get(control.control_id)}
                  expanded={expandedId === control.control_id}
                  baseline={baseline}
                  frameworkId={frameworkId}
                  isDifferential={!!isDiff}
                  onToggleExpand={() => setExpandedId(
                    expandedId === control.control_id ? null : control.control_id
                  )}
                  onStatusChange={handleStatusChange}
                  onNotesChange={handleNotesChange}
                  assessmentCryptoModules={assessmentCryptoModules}
                  linkedCmvpModuleIds={statuses.get(control.control_id)?.linkedCmvpModuleIds ?? []}
                  highlightCrypto={cryptoPriorityControls.has(control.control_id)}
                  onCmvpLinksChange={handleCmvpLinksChange}
                  onAppendCmvpSummary={handleAppendCmvpSummary}
                />
              </div>
            );
          })}
        </div>

        {/* GRCLanker sidebar */}
        {expandedId && (() => {
          const expandedControl = controls.find(c => c.control_id === expandedId);
          if (!expandedControl) return null;
          const cs = statuses.get(expandedId);
          const isAiucCtrl = isAIUCControl(expandedControl);
          const isKsiCtrl = isKSIControl(expandedControl);
          const parameterInfo = getAssessmentParameterInfo(frameworkId, expandedControl, baseline);
          const linkedIds = cs?.linkedCmvpModuleIds ?? [];
          const linkedIdSet = new Set(linkedIds);
          const linkedCmvpModules = assessmentCryptoModules.filter((module) => linkedIdSet.has(module.moduleId));
          return (
            <div className="w-[440px] shrink-0 hidden lg:block">
              <AssessmentGrcLanker
                controlId={expandedControl.control_id}
                controlTitle={expandedControl.title}
                controlDescription={expandedControl.description}
                family={expandedControl.family}
                familyName={familyNames[expandedControl.family] || expandedControl.family}
                baseline={isAiucCtrl ? 'all' : baseline}
                status={cs?.status || 'not-assessed'}
                frameworkParameters={parameterInfo?.text}
                frameworkParametersLabel={parameterInfo?.label}
                assessmentQuestions={expandedControl.assessment_questions}
                userNotes={cs?.notes}
                controlStatus={cs}
                systemName={assessment.systemName}
                assessmentName={assessment.name}
                assessorName={assessment.assessorName}
                assessorOrg={assessment.assessorOrg}
                crosswalkSources={assessment.crosswalkSources}
                assessmentId={assessment.id}
                frameworkId={frameworkId}
                evidenceItems={isAiucCtrl ? expandedControl.controls_evidence : undefined}
                application={isAiucCtrl ? expandedControl.application : undefined}
                frequency={isAiucCtrl ? expandedControl.frequency : undefined}
                linkedCmvpModules={linkedCmvpModules}
                assessmentCryptoSummary={assessmentCryptoSummary}
                onOpenAIView={onOpenAIView}
              />
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// === Sub-components ===

function FilterBadge({
  label, count, active, onClick, color,
}: {
  label: string; count: number; active: boolean; onClick: () => void; color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-2 py-0.5 rounded-full text-xs transition-colors border
        ${active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background text-muted-foreground border-border hover:border-primary/50'
        }
      `}
    >
      {color && !active && (
        <span
          className="inline-block w-2 h-2 rounded-full mr-1"
          style={{ backgroundColor: color }}
        />
      )}
      {label} <span className="font-mono">{count}</span>
    </button>
  );
}

function ControlRow({
  control,
  status,
  expanded,
  baseline,
  frameworkId,
  isDifferential = false,
  onToggleExpand,
  onStatusChange,
  onNotesChange,
  assessmentCryptoModules,
  linkedCmvpModuleIds,
  highlightCrypto,
  onCmvpLinksChange,
  onAppendCmvpSummary,
}: {
  control: AnyControl;
  status: ControlStatus | undefined;
  expanded: boolean;
  baseline: string;
  frameworkId: AssessmentFrameworkId;
  isDifferential?: boolean;
  onToggleExpand: () => void;
  onStatusChange: (controlId: string, status: ImplementationStatus) => void;
  onNotesChange: (controlId: string, notes: string) => void;
  assessmentCryptoModules: AssessmentCryptoModule[];
  linkedCmvpModuleIds: string[];
  highlightCrypto: boolean;
  onCmvpLinksChange: (controlId: string, linkedModuleIds: string[]) => void;
  onAppendCmvpSummary: (controlId: string, linkedModuleIds: string[]) => void;
}) {
  const currentStatus = status?.status || 'not-assessed';
  const [notes, setNotes] = useState(status?.notes || '');
  const isAiuc = isAIUCControl(control);
  const isKsi = isKSIControl(control);
  const linkedModules = useMemo(() => {
    if (!expanded || linkedCmvpModuleIds.length === 0) return [];
    const linkedIdSet = new Set(linkedCmvpModuleIds);
    return assessmentCryptoModules.filter((module) => linkedIdSet.has(module.moduleId));
  }, [assessmentCryptoModules, expanded, linkedCmvpModuleIds]);

  // Sync notes when status data changes
  useEffect(() => {
    setNotes(status?.notes || '');
  }, [status?.notes]);

  const parameterInfo = getAssessmentParameterInfo(frameworkId, control, baseline);
  const [crosswalkStatuses, setCrosswalkStatuses] = useState<RelatedControlStatus[] | null>(null);
  const [showCrosswalk, setShowCrosswalk] = useState(false);

  useEffect(() => {
    if (!expanded || !showCrosswalk) return;
    if (isKsi) {
      getRelatedRev5Statuses(control.control_id).then(setCrosswalkStatuses);
    } else if (frameworkId === 'fedramp-rev5' && hasRelatedKSIs(control.control_id)) {
      getRelatedKSIStatuses(control.control_id).then(setCrosswalkStatuses);
    }
  }, [expanded, showCrosswalk, control.control_id, isKsi, frameworkId]);

  return (
    <div className={`border rounded-lg transition-colors ${isDifferential ? 'opacity-75 ' : ''}${expanded ? 'border-primary/30 bg-card' : 'border-transparent hover:border-border'}`}>
      {/* Collapsed row */}
      <div className="flex items-center gap-3 px-3 py-2 cursor-pointer" onClick={onToggleExpand}>
        <span className="text-xs text-muted-foreground w-3">{expanded ? '▼' : '▶'}</span>
        <span className="font-mono text-sm w-16 shrink-0">{control.control_id}</span>
        <span className="text-sm flex-1 truncate">{control.title}</span>
        {isDifferential && (
          <Badge variant="outline" className="text-[11px] shrink-0 border-purple-500/40 text-purple-500">
            Differential
          </Badge>
        )}
        {isKsi && control.fka && (
          <Badge variant="outline" className="text-[11px] shrink-0 border-muted-foreground/30 text-muted-foreground">
            {control.fka}
          </Badge>
        )}
        {isAiuc && (
          <Badge
            variant="outline"
            className={`text-[11px] shrink-0 ${control.application === 'Mandatory' ? 'border-amber-500/40 text-amber-600 dark:text-amber-400' : 'border-border'}`}
          >
            {control.application}
          </Badge>
        )}
        {status?.autoSuggested && (
          <Badge variant="secondary" className="text-xs shrink-0">
            Auto-filled
          </Badge>
        )}
        {highlightCrypto && !isAiuc && (
          <Badge variant="outline" className="text-[11px] shrink-0 border-primary/40 text-primary">
            Crypto Priority
          </Badge>
        )}
        {linkedCmvpModuleIds.length > 0 && (
          <Badge variant="outline" className="text-[11px] shrink-0">
            {linkedCmvpModuleIds.length} CMVP
          </Badge>
        )}
        <select
          value={currentStatus}
          onChange={e => {
            e.stopPropagation();
            onStatusChange(control.control_id, e.target.value as ImplementationStatus);
          }}
          onClick={e => e.stopPropagation()}
          className="px-2 py-1 rounded border text-xs bg-background shrink-0"
          style={{ borderColor: STATUS_COLORS[currentStatus] + '60' }}
        >
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: STATUS_COLORS[currentStatus] }}
        />
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-4 pt-1 space-y-4 border-t border-border/50 mx-3">
          {/* Description */}
          <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
            {control.description.slice(0, 500)}
            {control.description.length > 500 && (
              <a
                href={control.url || '#'}
                className="text-primary ml-1"
              >
                ...read more
              </a>
            )}
          </div>

          {/* AIUC-1: Application & frequency badges */}
          {isAiuc && (
            <div className="flex gap-2">
              <Badge variant="outline" className={`text-xs ${control.application === 'Mandatory' ? 'border-amber-500/40 text-amber-600 dark:text-amber-400' : ''}`}>
                {control.application}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {control.frequency}
              </Badge>
            </div>
          )}

          {/* AIUC-1: Evidence items */}
          {isAiuc && control.controls_evidence && control.controls_evidence.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium">Evidence Items ({control.controls_evidence.length})</div>
              {(() => {
                const categories = new Map<string, AIUCEvidence[]>();
                for (const ev of control.controls_evidence) {
                  const cat = ev.category || 'Other';
                  if (!categories.has(cat)) categories.set(cat, []);
                  categories.get(cat)!.push(ev);
                }
                return Array.from(categories.entries()).map(([category, items]) => (
                  <div key={category} className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      {category}
                    </div>
                    {items.map(ev => (
                      <div key={ev.evidence_id} className="p-2 rounded bg-muted/50 border border-border space-y-1.5">
                        <div className="flex items-start gap-2">
                          <Badge variant="outline" className="text-[11px] px-1.5 py-0 shrink-0 font-mono">
                            {ev.evidence_id}
                          </Badge>
                          <span className="text-xs font-medium">{ev.evidence_title.replace(/^[A-F]\d{3}\.\d+\s*/, '')}</span>
                        </div>
                        {ev.control_application && (
                          <p className="text-[11px] text-primary/80 font-medium">{ev.control_application}</p>
                        )}
                        {ev.control_text && (
                          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{ev.control_text}</p>
                        )}
                        {ev.typical_evidence && (
                          <div className="text-[11px] text-muted-foreground/80 border-t border-border pt-1.5 mt-1.5">
                            <span className="font-semibold">Typical evidence:</span> {ev.typical_evidence}
                          </div>
                        )}
                        {ev.location && (
                          <div className="text-[11px] text-muted-foreground/80">
                            <span className="font-semibold">Location:</span> {ev.location}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ));
              })()}
            </div>
          )}

          {/* KSI-specific: Terms, references, update history */}
          {isKsi && (
            <>
              {control.terms && control.terms.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {control.terms.map(term => (
                    <Badge key={term} variant="secondary" className="text-xs">
                      {term}
                    </Badge>
                  ))}
                </div>
              )}
              {control.references && control.references.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {control.references.map((ref, i) => (
                    <a
                      key={i}
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      {ref.title} ↗
                    </a>
                  ))}
                </div>
              )}
              {control.updated && control.updated.length > 0 && (
                <div className="p-2 rounded bg-muted/50 border border-border text-xs">
                  <div className="font-medium text-muted-foreground mb-1">Update History</div>
                  {control.updated.map((u, i) => (
                    <div key={i} className="text-muted-foreground">
                      <span className="font-mono">{u.date}</span>: {u.comment}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Framework parameters */}
          {parameterInfo && (
            <div className="p-2 rounded bg-amber-500/5 border border-amber-500/20">
              <div className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">{parameterInfo.label}</div>
              <div className="text-xs text-muted-foreground whitespace-pre-line">{parameterInfo.text}</div>
            </div>
          )}

          {/* Auto-suggestion info */}
          {status?.autoSuggested && status.autoSuggestSource && (
            <div className="p-2 rounded bg-blue-500/5 border border-blue-500/20">
              <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                Auto-Suggested via Crosswalk
              </div>
              <div className="text-xs text-muted-foreground">
                Source: {status.autoSuggestSource}
                {status.confidence && ` (${status.confidence} confidence)`}
              </div>
            </div>
          )}

          {/* CMVP linkage */}
          <div className={`rounded-lg border p-3 ${highlightCrypto ? 'border-primary/30 bg-primary/5' : 'border-border/60 bg-muted/20'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-medium">Cryptographic Modules</div>
                <div className="text-xs text-muted-foreground">
                  {highlightCrypto
                    ? 'This control is especially sensitive to the system cryptographic boundary. Link the modules that provide the relevant encryption, signing, or key management functions.'
                    : 'Link any already-selected CMVP modules that help satisfy this control or provide supporting evidence.'}
                </div>
              </div>
              {linkedCmvpModuleIds.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void onAppendCmvpSummary(control.control_id, linkedCmvpModuleIds)}
                >
                  Append CMVP Summary
                </Button>
              )}
            </div>

            {assessmentCryptoModules.length === 0 ? (
              <div className="mt-3 text-xs text-muted-foreground">
                No CMVP modules are in this assessment inventory yet. Add them in the inventory panel above, then link them here.
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {assessmentCryptoModules.map((module) => {
                  const isLinked = linkedCmvpModuleIds.includes(module.moduleId);
                  return (
                    <label
                      key={module.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-xs transition-colors ${
                        isLinked ? 'border-primary/40 bg-background' : 'border-border/60 hover:border-primary/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isLinked}
                        onChange={() => {
                          const next = isLinked
                            ? linkedCmvpModuleIds.filter((id) => id !== module.moduleId)
                            : [...linkedCmvpModuleIds, module.moduleId];
                          void onCmvpLinksChange(control.control_id, next);
                        }}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{module.moduleName}</span>
                          {module.certificateNumber && (
                            <a href={`/cmvp/certificate/${encodeURIComponent(module.certificateNumber)}`}>
                              <Badge variant="outline" className="text-[11px] font-mono">
                                Cert {module.certificateNumber}
                              </Badge>
                            </a>
                          )}
                          <Badge variant="outline" className="text-[11px]">
                            {module.status}
                          </Badge>
                          {module.stale && (
                            <Badge variant="outline" className="text-[11px] border-amber-500/40 text-amber-600 dark:text-amber-400">
                              Snapshot stale
                            </Badge>
                          )}
                        </div>
                        <div className="text-muted-foreground">
                          {module.vendorName}
                          {module.componentName && ` · ${module.componentName}`}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {module.standard && (
                            <Badge variant="secondary" className="text-[11px]">
                              {module.standard}
                            </Badge>
                          )}
                          {(module.usageTypes ?? []).map((usage) => (
                            <Badge key={usage} variant="outline" className="text-[11px]">
                              {usage}
                            </Badge>
                          ))}
                          {module.algorithms.slice(0, 4).map((algorithm) => (
                            <Badge key={algorithm} variant="outline" className="text-[11px]">
                              {algorithm}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {linkedModules.length > 0 && (
              <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
                <div className="text-xs font-medium">Linked Module Summary</div>
                {linkedModules.map((module) => (
                  <div key={module.id} className="rounded-lg border border-border/60 bg-background px-3 py-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{module.vendorName} / {module.moduleName}</span>
                      {module.certificateNumber && (
                        <a href={`/cmvp/certificate/${encodeURIComponent(module.certificateNumber)}`}>
                          <Badge variant="outline" className="text-[11px] font-mono">
                            Cert {module.certificateNumber}
                          </Badge>
                        </a>
                      )}
                      {module.stale && (
                        <Badge variant="outline" className="text-[11px] border-amber-500/40 text-amber-600 dark:text-amber-400">
                          Snapshot stale
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      {module.standard ?? 'Unknown standard'} · {module.status}
                      {module.componentName && ` · ${module.componentName}`}
                    </div>
                    {module.algorithms.length > 0 && (
                      <div className="mt-1 text-muted-foreground">
                        Algorithms: {module.algorithms.join(', ')}
                      </div>
                    )}
                    {module.notes && (
                      <div className="mt-1 text-muted-foreground">
                        Notes: {module.notes}
                      </div>
                    )}
                    {module.detailSnapshot?.validationHistory.length ? (
                      <div className="mt-1 text-muted-foreground">
                        Validation history: {module.detailSnapshot.validationHistory.map((entry) => `${entry.date} (${entry.type}${entry.lab ? ` via ${entry.lab}` : ''})`).join('; ')}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assessment questions */}
          {(() => {
            const questions = control.assessment_questions;
            if (!questions || questions.length === 0) return null;
            return (
              <div>
                <div className="text-xs font-medium mb-2">Assessment Interview Topics</div>
                {questions.map(group => (
                  <div key={group.category} className="mb-2">
                    <div className="text-xs font-medium text-muted-foreground">{group.category}:</div>
                    <ul className="ml-3 space-y-0.5">
                      {group.questions.map((q, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                          <span className="text-amber-500 shrink-0">•</span>
                          <span>{q}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Bidirectional crosswalk panel */}
          {(isKsi || (frameworkId === 'fedramp-rev5' && hasRelatedKSIs(control.control_id))) && (
            <div className="border border-border/60 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowCrosswalk(!showCrosswalk)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/50 transition-colors"
              >
                <span>
                  {isKsi ? 'Related Rev 5 Controls' : 'Related 20x KSIs'}
                </span>
                <span className="text-muted-foreground">{showCrosswalk ? '▲' : '▼'}</span>
              </button>
              {showCrosswalk && (
                <div className="px-3 pb-3 space-y-2">
                  <div className="text-[11px] text-muted-foreground italic">
                    Informational only — {isKsi
                      ? 'FedRAMP 20x is outcome-based. Rev 5 control status does not determine KSI compliance.'
                      : 'Shows which 20x KSIs reference this control.'}
                  </div>
                  {crosswalkStatuses === null ? (
                    <div className="text-xs text-muted-foreground">Loading...</div>
                  ) : crosswalkStatuses.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No related controls found.</div>
                  ) : (
                    <div className="space-y-1">
                      {crosswalkStatuses.map(cs => (
                        <div key={cs.controlId} className="flex items-center gap-2 text-xs">
                          <span className="font-mono shrink-0">{cs.controlId}</span>
                          <span className="text-muted-foreground flex-1 truncate">{cs.title}</span>
                          {!cs.inBaseline && (
                            <Badge variant="outline" className="text-[11px] shrink-0 border-muted-foreground/30">
                              Not in baseline
                            </Badge>
                          )}
                          {cs.status ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: STATUS_COLORS[cs.status] }}
                              />
                              <span className="text-[11px]">{STATUS_LABELS[cs.status]}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground shrink-0">No assessment</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs font-medium block mb-1">Notes & Evidence</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={() => onNotesChange(control.control_id, notes)}
              placeholder="Add implementation notes, evidence references, or remediation steps..."
              className="w-full px-2 py-1.5 rounded border bg-background text-xs min-h-[60px] resize-y"
              rows={2}
            />
          </div>
        </div>
      )}
    </div>
  );
}
