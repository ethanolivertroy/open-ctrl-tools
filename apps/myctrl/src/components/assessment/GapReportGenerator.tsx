/**
 * GapReportGenerator — Client-side gap analysis report.
 *
 * Renders a print-optimized report that can be exported via window.print()
 * or saved as PDF via the browser's "Save as PDF" print dialog.
 *
 * Report contents:
 * - Executive summary with readiness scores
 * - Per-family breakdown table
 * - Gap list with remediation guidance
 * - Assessment questions for each gap
 * - Crosswalk coverage summary
 */

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getDb, STATUS_COLORS, STATUS_LABELS } from '@/lib/db';
import type { Assessment, ControlStatus } from '@/lib/db';
import {
  getAssessmentControls,
  getAssessmentCountNoun,
  getAssessmentLabel,
  getPrimaryAssessmentFrameworkId,
  getAssessmentParameterInfo,
  getAssessmentScopeFieldLabel,
  normalizeAssessmentBaseline,
} from '@/lib/assessment-frameworks';
import {
  getAllControlStatuses,
  getAssessmentCryptoModules,
} from '@/lib/storage/assessment-store';
import {
  getStatusDistribution,
  get20xDifferentialKSIs,
  type BaselineScore,
} from '@/lib/assessment-scoring';
import {
  getRelatedRev5Statuses,
  type RelatedControlStatus,
} from '@/lib/assessment-20x-crosswalk';
import {
  buildAssessmentCryptoSummary,
  getFedRampCryptoPriorityControls,
  type AssessmentCryptoModule,
} from '@/lib/cmvp';
import type { AIUCEvidence, Control, FedRampKSIControl } from '@/data/types';
import { isAIUCControl, isFedRampKSIControl } from '@/data/types';
import { computeAssessmentScoreSummary } from '@/lib/services/assessment-summary';

type AnyControl = Control;

function isKSIControl(c: AnyControl): c is FedRampKSIControl {
  return isFedRampKSIControl(c);
}

export function GapReportGenerator({
  assessment,
  score: providedScore,
}: {
  assessment: Assessment;
  score: BaselineScore | null;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const frameworkId = getPrimaryAssessmentFrameworkId(assessment.targetFrameworks);
  const isAiuc = frameworkId === 'aiuc-1';
  const isKsi = frameworkId === 'fedramp-20x-ksi';
  const baseline = normalizeAssessmentBaseline(frameworkId, assessment.targetBaseline);
  const [score, setScore] = useState<BaselineScore | null>(providedScore);
  const [controlStatuses, setControlStatuses] = useState<Map<string, ControlStatus>>(new Map());
  const [assessmentCryptoModules, setAssessmentCryptoModules] = useState<AssessmentCryptoModule[]>([]);
  const [crosswalkCache, setCrosswalkCache] = useState<Map<string, RelatedControlStatus[]>>(new Map());
  const [loading, setLoading] = useState(!providedScore);

  useEffect(() => {
    loadData();
  }, [assessment.id]);

  async function loadData() {
    setLoading(true);
    const [statusMap, cryptoModules] = await Promise.all([
      getAllControlStatuses(assessment.id),
      getAssessmentCryptoModules(assessment.id),
    ]);
    if (!providedScore) {
      setScore(computeAssessmentScoreSummary(assessment, statusMap).score);
    }

    // Load full ControlStatus records (with notes)
    const db = await getDb();
    const records = await db.controlStatuses
      .where('assessmentId').equals(assessment.id)
      .toArray();
    const map = new Map<string, ControlStatus>();
    for (const r of records) {
      map.set(r.controlId, r);
    }
    setControlStatuses(map);
    setAssessmentCryptoModules(cryptoModules);
    setLoading(false);
  }

  function handlePrint() {
    window.print();
  }

  async function handleExportJSON() {
    const exportData = {
      version: 2,
      exportedAt: new Date().toISOString(),
      assessment,
      score,
      controlStatuses: Array.from(controlStatuses.values()),
      assessmentCryptoModules,
      metadata: {
        totalControls: score?.totalControls || 0,
        assessedControls: (score?.totalControls || 0) - (score?.notAssessedCount || 0),
      },
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${assessment.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-gap-report.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading || !score) {
    return <div className="text-muted-foreground py-8 text-center">Loading report data...</div>;
  }

  const controls: AnyControl[] = getAssessmentControls(frameworkId, baseline);
  const differentialKSIs = isKsi && baseline === 'low'
    ? get20xDifferentialKSIs()
    : [];
  const gaps = controls.filter(c => {
    const status = controlStatuses.get(c.control_id)?.status || 'not-assessed';
    return status === 'not-implemented' || status === 'partially-implemented';
  });
  const notAssessed = controls.filter(c => {
    const status = controlStatuses.get(c.control_id)?.status || 'not-assessed';
    return status === 'not-assessed';
  });

  // Load crosswalk data for KSI gaps
  useEffect(() => {
    if (!isKsi || gaps.length === 0) return;
    const cache = new Map<string, RelatedControlStatus[]>();
    Promise.all(
      gaps.map(async (c) => {
        const statuses = await getRelatedRev5Statuses(c.control_id);
        cache.set(c.control_id, statuses);
      })
    ).then(() => setCrosswalkCache(cache));
  }, [isKsi, gaps.length]);

  const distribution = getStatusDistribution(score);
  const generatedAt = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const assessmentCryptoSummary = buildAssessmentCryptoSummary(assessmentCryptoModules);
  const linkedModulesByControl = new Map<string, AssessmentCryptoModule[]>();
  for (const status of controlStatuses.values()) {
    const linkedIds = new Set(status.linkedCmvpModuleIds ?? []);
    if (linkedIds.size === 0) continue;
    linkedModulesByControl.set(
      status.controlId,
      assessmentCryptoModules.filter((module) => linkedIds.has(module.moduleId)),
    );
  }
  const historicalCryptoModules = assessmentCryptoModules.filter((module) => module.dataset === 'historical');
  const sunsetCryptoModules = assessmentCryptoModules.filter((module) => !!module.sunsetDate);
  const priorityControlIds = getFedRampCryptoPriorityControls();
  const priorityControls = frameworkId === 'fedramp-rev5'
    ? priorityControlIds.map((controlId) => {
        const control = controls.find((candidate) => candidate.control_id === controlId);
        return {
          controlId,
          control,
          status: controlStatuses.get(controlId)?.status || 'not-assessed',
          linkedModules: linkedModulesByControl.get(controlId) ?? [],
        };
      }).filter((entry) => !!entry.control)
    : [];

  return (
    <div className="space-y-4">
      {/* Action bar (hidden in print) */}
      <div className="flex items-center gap-2 print:hidden">
        <Button onClick={handlePrint}>
          Print / Save as PDF
        </Button>
        <Button variant="outline" onClick={handleExportJSON}>
          Export JSON
        </Button>
      </div>

      {/* Printable report */}
      <div ref={printRef} className="print:text-black print:bg-white space-y-8">

        {/* Cover / Header */}
        <div className="border-b pb-6">
          <h1 className="text-2xl font-bold">
            {getAssessmentLabel(frameworkId, baseline)} Gap Analysis Report
          </h1>
          <div className="mt-2 space-y-1 text-sm text-muted-foreground print:text-gray-600">
            <div><strong>Assessment:</strong> {assessment.name}</div>
            <div><strong>{getAssessmentScopeFieldLabel(frameworkId)}:</strong> {getAssessmentLabel(frameworkId, baseline)} ({score.totalControls} {getAssessmentCountNoun(frameworkId)})</div>
            {assessment.systemName && <div><strong>System:</strong> {assessment.systemName}</div>}
            {assessment.assessorName && <div><strong>Assessor:</strong> {assessment.assessorName}</div>}
            {assessment.assessorOrg && <div><strong>Organization:</strong> {assessment.assessorOrg}</div>}
            <div><strong>Generated:</strong> {generatedAt}</div>
            <div><strong>Source:</strong> myctrl.tools — Free Compliance Framework Browser</div>
          </div>
        </div>

        {/* Executive Summary */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Executive Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard label="Overall Readiness" value={`${score.overallPercentComplete}%`}
              color={score.overallPercentComplete >= 80 ? '#a6da95' : score.overallPercentComplete >= 50 ? '#eed49f' : '#ed8796'} />
            <SummaryCard label="Controls Assessed" value={`${score.totalControls - score.notAssessedCount} / ${score.totalControls}`} />
            <SummaryCard label="Gaps Identified" value={String(gaps.length)} color="#ed8796" />
            <SummaryCard label="Implemented" value={String(score.implementedCount)} color="#a6da95" />
          </div>
          <div className="mt-4 text-sm text-muted-foreground print:text-gray-600">
            This assessment evaluates {score.totalControls} {getAssessmentCountNoun(frameworkId)} across the {getAssessmentLabel(frameworkId, baseline)} scope.
            {gaps.length > 0
              ? ` ${gaps.length} control${gaps.length !== 1 ? 's' : ''} require${gaps.length === 1 ? 's' : ''} remediation.`
              : ' No control gaps were identified.'
            }
            {notAssessed.length > 0 && ` ${notAssessed.length} control${notAssessed.length !== 1 ? 's have' : ' has'} not yet been assessed.`}
          </div>
        </section>

        {/* Status Distribution */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Status Distribution</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4">Status</th>
                  <th className="text-right py-2 px-4">Count</th>
                  <th className="text-right py-2 px-4">Percent</th>
                  <th className="text-left py-2 px-4 w-48">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {distribution.map(d => (
                  <tr key={d.status} className="border-b border-border/50">
                    <td className="py-2 pr-4 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full print:border" style={{ backgroundColor: STATUS_COLORS[d.status] }} />
                      {STATUS_LABELS[d.status]}
                    </td>
                    <td className="text-right py-2 px-4 font-mono">{d.count}</td>
                    <td className="text-right py-2 px-4 font-mono">{d.percent}%</td>
                    <td className="py-2 px-4">
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${d.percent}%`, backgroundColor: STATUS_COLORS[d.status] }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Cryptographic Module Inventory */}
        {assessmentCryptoModules.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3">Cryptographic Module Inventory</h2>
            <p className="text-sm text-muted-foreground print:text-gray-600 mb-3">
              {assessmentCryptoSummary}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4">Certificate</th>
                    <th className="text-left py-2 pr-4">Vendor / Module</th>
                    <th className="text-left py-2 pr-4">Status</th>
                    <th className="text-left py-2 pr-4">Usage</th>
                    <th className="text-left py-2">Algorithms</th>
                  </tr>
                </thead>
                <tbody>
                  {assessmentCryptoModules.map((module) => (
                    <tr key={module.id} className="border-b border-border/50 align-top">
                      <td className="py-2 pr-4 font-mono text-xs">
                        {module.certificateNumber ?? module.moduleId}
                      </td>
                      <td className="py-2 pr-4">
                        <div className="font-medium">{module.vendorName} / {module.moduleName}</div>
                        <div className="text-xs text-muted-foreground print:text-gray-600">
                          {module.standard ?? 'Unknown standard'}
                          {module.componentName && ` · ${module.componentName}`}
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        <div>{module.status}</div>
                        <div className="text-xs text-muted-foreground print:text-gray-600">
                          {module.dataset}
                          {module.sunsetDate && ` · Sunset ${module.sunsetDate}`}
                          {module.stale && ' · Snapshot stale'}
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground print:text-gray-600">
                        {(module.usageTypes ?? []).length > 0 ? module.usageTypes!.join(', ') : 'Not tagged'}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground print:text-gray-600">
                        {module.algorithms.length > 0 ? module.algorithms.join(', ') : 'Not listed'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* FedRAMP cryptography coverage */}
        {frameworkId === 'fedramp-rev5' && assessmentCryptoModules.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3">FedRAMP Cryptography Coverage</h2>
            <p className="text-sm text-muted-foreground print:text-gray-600 mb-3">
              Priority crypto controls linked to the current cryptographic module inventory. Historical modules:
              {' '}{historicalCryptoModules.length}. Modules with recorded sunset dates: {sunsetCryptoModules.length}.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4">Control</th>
                    <th className="text-left py-2 pr-4">Status</th>
                    <th className="text-left py-2 pr-4">Linked Modules</th>
                    <th className="text-left py-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {priorityControls.map((entry) => (
                    <tr key={entry.controlId} className="border-b border-border/50 align-top">
                      <td className="py-2 pr-4">
                        <div className="font-mono font-medium">{entry.controlId}</div>
                        <div className="text-xs text-muted-foreground print:text-gray-600">
                          {entry.control?.title}
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className="inline-flex rounded-full border px-2 py-0.5 text-xs"
                          style={{ borderColor: STATUS_COLORS[entry.status] + '60' }}
                        >
                          {STATUS_LABELS[entry.status]}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground print:text-gray-600">
                        {entry.linkedModules.length > 0
                          ? entry.linkedModules.map((module) => module.certificateNumber ?? module.moduleId).join(', ')
                          : 'No modules linked'}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground print:text-gray-600">
                        {entry.linkedModules.length > 0
                          ? entry.linkedModules.map((module) => `${module.vendorName} / ${module.moduleName}`).join('; ')
                          : 'Link relevant cryptographic modules in the assessment controls view.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Family Breakdown */}
        <section className="break-before-page">
          <h2 className="text-lg font-semibold mb-3">Readiness by Control Family</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Family</th>
                  <th className="text-right py-2 px-2">Total</th>
                  <th className="text-right py-2 px-2">Impl.</th>
                  <th className="text-right py-2 px-2">Partial</th>
                  <th className="text-right py-2 px-2">Planned</th>
                  <th className="text-right py-2 px-2">Not Impl.</th>
                  <th className="text-right py-2 px-2">N/A</th>
                  <th className="text-right py-2 px-2">Unassessed</th>
                  <th className="text-right py-2 px-2">Ready %</th>
                </tr>
              </thead>
              <tbody>
                {score.familyScores.map(f => (
                  <tr key={f.family} className="border-b border-border/50">
                    <td className="py-1.5">
                      <span className="font-mono text-xs text-muted-foreground mr-2">{f.family}</span>
                      {f.familyName}
                    </td>
                    <td className="text-right py-1.5 px-2 font-mono">{f.total}</td>
                    <td className="text-right py-1.5 px-2 font-mono">{f.implemented}</td>
                    <td className="text-right py-1.5 px-2 font-mono">{f.partiallyImplemented}</td>
                    <td className="text-right py-1.5 px-2 font-mono">{f.planned}</td>
                    <td className="text-right py-1.5 px-2 font-mono">{f.notImplemented}</td>
                    <td className="text-right py-1.5 px-2 font-mono">{f.notApplicable}</td>
                    <td className="text-right py-1.5 px-2 font-mono">{f.notAssessed}</td>
                    <td className="text-right py-1.5 px-2 font-mono font-medium">{f.percentComplete}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Gap Details */}
        {gaps.length > 0 && (
          <section className="break-before-page">
            <h2 className="text-lg font-semibold mb-3">Gap Details ({gaps.length} controls)</h2>
            <p className="text-sm text-muted-foreground mb-4 print:text-gray-600">
              Controls marked as "Not Implemented" or "Partially Implemented" that require remediation.
            </p>
            <div className="space-y-4">
              {gaps.map(c => {
                const cs = controlStatuses.get(c.control_id);
                const status = cs?.status || 'not-assessed';
                const aiuc = isAIUCControl(c);
                const parameterInfo = getAssessmentParameterInfo(frameworkId, c, baseline);
                const linkedModules = linkedModulesByControl.get(c.control_id) ?? [];

                return (
                  <div key={c.control_id} className="border rounded-lg p-3 break-inside-avoid">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-semibold text-sm">{c.control_id}</span>
                      <span className="text-sm">{c.title}</span>
                      {aiuc && (
                        <Badge variant="outline" className="text-[11px]">{c.application}</Badge>
                      )}
                      <Badge
                        variant="outline"
                        className="text-xs ml-auto"
                        style={{ borderColor: STATUS_COLORS[status] + '60' }}
                      >
                        {STATUS_LABELS[status]}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground print:text-gray-600 mb-2">
                      {c.description.slice(0, 300)}
                      {c.description.length > 300 && '...'}
                    </div>
                    {/* AIUC-1: Evidence items */}
                    {aiuc && c.controls_evidence && c.controls_evidence.length > 0 && (
                      <div className="text-xs mt-2 space-y-1.5">
                        <div className="font-medium mb-1">Evidence Items ({c.controls_evidence.length}):</div>
                        {c.controls_evidence.map(ev => (
                          <div key={ev.evidence_id} className="p-2 rounded bg-muted/50 print:bg-gray-50 border border-border print:border-gray-200">
                            <div className="flex items-start gap-1.5">
                              <span className="font-mono font-medium text-[11px]">{ev.evidence_id}</span>
                              <span className="text-[11px] text-primary/80">{ev.control_application}</span>
                            </div>
                            <div className="text-muted-foreground print:text-gray-600 mt-0.5">{ev.typical_evidence}</div>
                            {ev.location && (
                              <div className="text-muted-foreground/70 mt-0.5"><strong>Location:</strong> {ev.location}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Framework parameters */}
                    {parameterInfo && (
                      <div className="text-xs p-2 rounded bg-amber-500/5 print:bg-yellow-50 border border-amber-500/20 print:border-yellow-200 mb-2">
                        <strong>{parameterInfo.label}:</strong> <span className="whitespace-pre-line">{parameterInfo.text}</span>
                      </div>
                    )}
                    {cs?.notes && (
                      <div className="text-xs p-2 rounded bg-blue-500/5 print:bg-blue-50 border border-blue-500/20 print:border-blue-200 mb-2">
                        <strong>Notes:</strong> {cs.notes}
                      </div>
                    )}
                    {linkedModules.length > 0 && (
                      <div className="text-xs p-2 rounded bg-emerald-500/5 print:bg-green-50 border border-emerald-500/20 print:border-green-200 mb-2">
                        <strong>Linked CMVP Modules:</strong>
                        <ul className="mt-1 ml-4 space-y-0.5">
                          {linkedModules.map((module) => (
                            <li key={module.id}>
                              {(module.certificateNumber ?? module.moduleId)} — {module.vendorName} / {module.moduleName}
                              {module.algorithms.length > 0 && ` (${module.algorithms.join(', ')})`}
                              {module.componentName && ` · ${module.componentName}`}
                              {module.detailSnapshot?.validationHistory.length
                                ? ` · History: ${module.detailSnapshot.validationHistory.map((entry) => `${entry.date} ${entry.type}`).join('; ')}`
                                : ''}
                              {module.stale ? ' · Snapshot stale' : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {/* Assessment questions */}
                    {(() => {
                      const questions = c.assessment_questions;
                      if (!questions || questions.length === 0) return null;
                      return (
                        <div className="text-xs mt-2">
                          <div className="font-medium mb-1">Assessment Questions:</div>
                          {questions.map(g => (
                            <div key={g.category} className="ml-2 mb-1">
                              <span className="text-muted-foreground">{g.category}:</span>
                              <ul className="ml-3">
                                {g.questions.map((q, i) => (
                                  <li key={i} className="text-muted-foreground print:text-gray-600">• {q}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    {/* KSI: Rev 5 crosswalk context */}
                    {isKSIControl(c) && crosswalkCache.get(c.control_id) && crosswalkCache.get(c.control_id)!.length > 0 && (
                      <div className="text-xs mt-2 p-2 rounded bg-muted/50 print:bg-gray-50 border border-border print:border-gray-200">
                        <div className="font-medium mb-1">Related Rev 5 Controls (Informational):</div>
                        <div className="space-y-0.5">
                          {crosswalkCache.get(c.control_id)!.map(cs => (
                            <div key={cs.controlId} className="flex items-center gap-2 text-muted-foreground print:text-gray-600">
                              <span className="font-mono">{cs.controlId}</span>
                              <span className="flex-1 truncate">{cs.title}</span>
                              {cs.status && (
                                <span style={{ color: STATUS_COLORS[cs.status] }}>{STATUS_LABELS[cs.status]}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Crosswalk Coverage */}
        {assessment.crosswalkSources && assessment.crosswalkSources.length > 0 && (
          <section className="break-before-page">
            <h2 className="text-lg font-semibold mb-3">Crosswalk Coverage</h2>
            <p className="text-sm text-muted-foreground print:text-gray-600 mb-3">
              The following frameworks were used to pre-fill control statuses via derived crosswalk mappings.
            </p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Source Framework</th>
                  <th className="text-left py-2">Compliance Level</th>
                </tr>
              </thead>
              <tbody>
                {assessment.crosswalkSources.map(s => (
                  <tr key={s.frameworkId} className="border-b border-border/50">
                    <td className="py-1.5">{s.frameworkId}</td>
                    <td className="py-1.5 capitalize">{s.complianceLevel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Moderate Differential Appendix (20x Low only) */}
        {isKsi && differentialKSIs.length > 0 && (
          <section className="break-before-page">
            <h2 className="text-lg font-semibold mb-3">Appendix: Moderate Differential ({differentialKSIs.length} KSIs)</h2>
            <p className="text-sm text-muted-foreground mb-4 print:text-gray-600">
              These Key Security Indicators are required at the Moderate impact level but not at Low.
              They are shown here for reference if you plan to upgrade your authorization level.
            </p>
            <div className="space-y-3">
              {differentialKSIs.map(c => {
                const cs = controlStatuses.get(c.control_id);
                const cStatus = cs?.status || 'not-assessed';
                return (
                  <div key={c.control_id} className="border rounded-lg p-3 break-inside-avoid border-purple-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-semibold text-sm">{c.control_id}</span>
                      <span className="text-sm">{c.title}</span>
                      <Badge variant="outline" className="text-[11px] border-purple-500/40 text-purple-500 ml-auto">
                        Differential
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-xs"
                        style={{ borderColor: STATUS_COLORS[cStatus] + '60' }}
                      >
                        {STATUS_LABELS[cStatus]}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground print:text-gray-600">
                      {c.description.slice(0, 300)}
                      {c.description.length > 300 && '...'}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="border-t pt-4 text-xs text-muted-foreground print:text-gray-500 text-center">
          Generated by <strong>myctrl.tools</strong> — Free Compliance Framework Browser |
          {' '}{generatedAt} | Data stored locally in your browser
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="border rounded-lg p-3 text-center">
      <div className="text-2xl font-mono font-bold" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground print:text-gray-600 mt-1">{label}</div>
    </div>
  );
}
