/**
 * AssessmentDashboard — Main React island for the /assess page.
 *
 * Manages assessment CRUD, displays readiness scores, and coordinates
 * the control list, crosswalk auto-fill, and report generation.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/db';
import type { Assessment } from '@/lib/db';
import {
  getStatusDistribution,
  type BaselineScore,
  type FamilyScore,
} from '@/lib/assessment-scoring';
import {
  getAssessmentBaselineOptions,
  getAssessmentCountNoun,
  getAssessmentCreateDescription,
  getAssessmentCreateTitle,
  getAssessmentFrameworkLabel,
  getAvailableAssessmentFrameworks,
  getPrimaryAssessmentFrameworkId,
  getAssessmentLabel as getAssessmentScopeLabel,
  getAssessmentNamePlaceholder,
  getAssessmentScopeFieldLabel,
  normalizeAssessmentBaseline,
  supportsAssessmentBaselineComparison,
  type AssessmentFrameworkId,
  type AssessmentTargetBaseline,
} from '@/lib/assessment-frameworks';

const ASSESSMENT_OPTION_LABELS: Record<AssessmentFrameworkId, string> = {
  'fedramp-rev5': 'FedRAMP Rev 5',
  'fedramp-20x-ksi': 'FedRAMP 20x KSI',
  'aiuc-1': 'AIUC-1 — AI Agent Security',
  'cmmc-v2': 'CMMC 2.0',
  'dod-srg': 'DoD SRG',
};
import { AssessmentControlList } from './AssessmentControlList';
import { CrosswalkAutoFill } from './CrosswalkAutoFill';
import { GapReportGenerator } from './GapReportGenerator';
import { AssessmentCryptoInventory } from './AssessmentCryptoInventory';
import { useAssessmentDashboardState } from './useAssessmentDashboardState';
import { useAssessmentDashboardActions } from './useAssessmentDashboardActions';
import { ActiveProjectSelect } from '@/components/projects/ActiveProjectSelect';
import { requestOpenAIChat } from '@/lib/ai-chat-events';
import { slugifyControlId as slugify } from '@/lib/slugify';
import { loadAssessmentScoreSummary } from '@/lib/services/assessment-summary';

// === Types ===

/** Get the primary framework ID for an assessment */
function getFrameworkId(a: Assessment): AssessmentFrameworkId {
  return getPrimaryAssessmentFrameworkId(a.targetFrameworks);
}

/** Check if an assessment targets AIUC-1 */
function isAIUC(a: Assessment): boolean {
  return getFrameworkId(a) === 'aiuc-1';
}

/** Check if an assessment targets FedRAMP 20x KSI */
function is20x(a: Assessment): boolean {
  return getFrameworkId(a) === 'fedramp-20x-ksi';
}

/** Get display label for an assessment's framework/baseline */
function getAssessmentLabel(a: Assessment): string {
  return getAssessmentScopeLabel(getFrameworkId(a), a.targetBaseline);
}

// === Main Component ===

export function AssessmentDashboard() {
  const {
    assessments,
    activeAssessment,
    viewMode,
    initialControlId,
    loading,
    loadAssessments,
    handleProjectChange,
    openAssessment,
    replaceActiveAssessment,
    showAssessmentControls,
    showAssessmentDashboard,
    showAssessmentList,
    showAssessmentReport,
  } = useAssessmentDashboardState();
  const [score, setScore] = useState<BaselineScore | null>(null);
  const [allScores, setAllScores] = useState<{ low: BaselineScore; moderate: BaselineScore; high: BaselineScore } | null>(null);
  const [cryptoInventoryVersion, setCryptoInventoryVersion] = useState(0);

  // Refresh score when active assessment changes
  const refreshScore = useCallback(async () => {
    if (!activeAssessment) {
      setScore(null);
      setAllScores(null);
      return;
    }
    const summary = await loadAssessmentScoreSummary(activeAssessment);
    setScore(summary.score);
    setAllScores(summary.allScores);
  }, [activeAssessment]);

  useEffect(() => {
    refreshScore();
  }, [refreshScore]);

  const {
    showCreate,
    setShowCreate,
    closeCreate,
    formName,
    setFormName,
    formFramework,
    formBaseline,
    setFormBaseline,
    formSystemName,
    setFormSystemName,
    formAssessorName,
    setFormAssessorName,
    formAssessorOrg,
    setFormAssessorOrg,
    formBaselineOptions,
    handleFrameworkChange,
    handleCreate,
    handleDelete,
    handleReset,
    handleClearAutoSuggestions,
    handleDuplicate,
    showCrosswalk,
    setShowCrosswalk,
    handleCrosswalkApplied,
  } = useAssessmentDashboardActions({
    activeAssessment,
    loadAssessments,
    openAssessment,
    replaceActiveAssessment,
    refreshScore,
  });

  const handleCryptoInventoryChange = useCallback(() => {
    setCryptoInventoryVersion((current) => current + 1);
  }, []);

  // === Renders ===

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Loading assessments...</div>
      </div>
    );
  }

  // Assessment list view
  if (viewMode === 'list' || !activeAssessment) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Your Assessments</h2>
            <p className="text-sm text-muted-foreground">
              Create a gap analysis to track your compliance readiness
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 justify-end">
            <ActiveProjectSelect onChange={handleProjectChange} showManageLink />
            <Button onClick={() => setShowCreate(true)}>
              + New Assessment
            </Button>
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle>{getAssessmentCreateTitle(formFramework)}</CardTitle>
              <CardDescription>{getAssessmentCreateDescription(formFramework)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">Assessment Name *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder={getAssessmentNamePlaceholder(formFramework)}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Framework</label>
                  <select
                    value={formFramework}
                    onChange={e => handleFrameworkChange(e.target.value as typeof formFramework)}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                  >
                    {getAvailableAssessmentFrameworks().map((id) => (
                      <option key={id} value={id}>
                        {ASSESSMENT_OPTION_LABELS[id]}
                      </option>
                    ))}
                  </select>
                </div>
                {formBaselineOptions.length > 0 ? (
                  <div>
                    <label className="text-sm font-medium block mb-1.5">{getAssessmentScopeFieldLabel(formFramework)}</label>
                    <select
                      value={formBaseline}
                      onChange={e => setFormBaseline(e.target.value as AssessmentTargetBaseline)}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                    >
                      {formBaselineOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label} ({option.count} {getAssessmentCountNoun(formFramework)})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="flex items-end">
                    <div className="px-3 py-2 rounded-lg border bg-muted/50 text-sm text-muted-foreground w-full">
                      All AIUC-1 requirements are included in this assessment
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium block mb-1.5">System Name</label>
                  <input
                    type="text"
                    value={formSystemName}
                    onChange={e => setFormSystemName(e.target.value)}
                    placeholder="e.g., CloudApp Production"
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Assessor Name</label>
                  <input
                    type="text"
                    value={formAssessorName}
                    onChange={e => setFormAssessorName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Organization</label>
                  <input
                    type="text"
                    value={formAssessorOrg}
                    onChange={e => setFormAssessorOrg(e.target.value)}
                    placeholder="Your organization"
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleCreate} disabled={!formName.trim()}>
                  Create Assessment
                </Button>
                <Button variant="outline" onClick={closeCreate}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Assessment cards */}
        {assessments.length === 0 && !showCreate ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-lg font-semibold mb-2">No assessments yet</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md">
                Create your first gap analysis to assess your security posture
                against {getAvailableAssessmentFrameworks().map(getAssessmentFrameworkLabel).join(', ')} controls.
              </p>
              <Button onClick={() => setShowCreate(true)}>
                Create Your First Assessment
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {assessments.map(a => (
              <AssessmentCard
                key={a.id}
                assessment={a}
                onOpen={() => openAssessment(a)}
                onDelete={() => handleDelete(a.id)}
                onDuplicate={() => handleDuplicate(a.id, a.name)}
                onReset={() => handleReset(a.id)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Dashboard view
  if (viewMode === 'dashboard') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={showAssessmentList}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              ← Back to assessments
            </button>
          </div>
          <div className="flex items-center gap-2">
            {getFrameworkId(activeAssessment) === 'fedramp-rev5' && (
              <Button variant="outline" size="sm" onClick={() => setShowCrosswalk(true)}>
                Crosswalk Auto-Fill
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                requestOpenAIChat({
                  frameworkId: getFrameworkId(activeAssessment),
                  prompt: `Show the latest gap assessment summary and priority gaps for ${activeAssessment.name}.`,
                  tab: 'chat',
                })
              }
            >
              Ask GRCLanker
            </Button>
            <Button variant="outline" size="sm" onClick={showAssessmentReport}>
              Generate Report
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleReset(activeAssessment.id)}>
              Reset
            </Button>
            {activeAssessment.crosswalkSources && activeAssessment.crosswalkSources.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => handleClearAutoSuggestions(activeAssessment.id)}>
                Clear Auto-Fill
              </Button>
            )}
            <Button size="sm" onClick={() => showAssessmentControls()}>
              Assess Controls
            </Button>
            <ActiveProjectSelect onChange={handleProjectChange} showManageLink />
          </div>
        </div>

        {/* Assessment info */}
        <div>
          <h2 className="text-2xl font-bold">{activeAssessment.name}</h2>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            <Badge variant="outline">
              {getAssessmentLabel(activeAssessment)}
            </Badge>
            {activeAssessment.systemName && <span>{activeAssessment.systemName}</span>}
            {activeAssessment.assessorOrg && <span>{activeAssessment.assessorOrg}</span>}
            <span>Created {new Date(activeAssessment.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Score overview */}
        {score && (
          <>
            {/* Main readiness card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <ReadinessDonut percent={score.overallPercentComplete} size={120} />
                    <div className="mt-3 text-sm text-muted-foreground">
                      Overall Readiness
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {score.overallPercentAssessed}% assessed
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 space-y-3">
                  <div className="text-sm font-medium">Status Breakdown</div>
                  {getStatusDistribution(score).map(d => (
                    <div key={d.status} className="flex items-center gap-2 text-sm">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: STATUS_COLORS[d.status] }}
                      />
                      <span className="text-muted-foreground flex-1">{STATUS_LABELS[d.status]}</span>
                      <span className="font-mono tabular-nums">{d.count}</span>
                      <span className="text-muted-foreground text-xs w-12 text-right">{d.percent}%</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 space-y-3">
                  {!supportsAssessmentBaselineComparison(getFrameworkId(activeAssessment)) ? (
                    <>
                      <div className="text-sm font-medium">
                        {is20x(activeAssessment)
                          ? 'By KSI Family'
                          : isAIUC(activeAssessment)
                            ? 'By Principle'
                            : 'By Control Family'}
                      </div>
                      {score.familyScores.map(f => (
                        <div key={f.family} className="flex items-center gap-3 text-sm">
                          <span className="w-28 truncate text-muted-foreground" title={f.familyName}>
                            {f.familyName}
                          </span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${f.percentComplete}%`,
                                backgroundColor: '#a6da95',
                              }}
                            />
                          </div>
                          <span className="font-mono tabular-nums w-12 text-right">
                            {f.percentComplete}%
                          </span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-medium">All Baselines</div>
                      {allScores && (['low', 'moderate', 'high'] as const).map(bl => {
                        const s = allScores[bl];
                        const isTarget = bl === normalizeAssessmentBaseline('fedramp-rev5', activeAssessment.targetBaseline);
                        return (
                          <div key={bl} className={`flex items-center gap-3 text-sm ${isTarget ? 'font-medium' : 'text-muted-foreground'}`}>
                            <span className="w-28">{getAssessmentScopeLabel('fedramp-rev5', bl)}</span>
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${s.overallPercentComplete}%`,
                                  backgroundColor: isTarget ? '#a6da95' : '#939ab7',
                                }}
                              />
                            </div>
                            <span className="font-mono tabular-nums w-12 text-right">
                              {s.overallPercentComplete}%
                            </span>
                          </div>
                        );
                      })}
                      {activeAssessment.crosswalkSources && activeAssessment.crosswalkSources.length > 0 && (
                        <div className="pt-2 border-t">
                          <div className="text-xs text-muted-foreground mb-1">Crosswalk Sources</div>
                          <div className="flex flex-wrap gap-1">
                            {activeAssessment.crosswalkSources.map(s => (
                              <Badge key={s.frameworkId} variant="secondary" className="text-xs">
                                {s.frameworkId} ({s.complianceLevel})
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Family breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Readiness by Control Family</CardTitle>
                <CardDescription>
                  {score.totalControls} controls across {score.familyScores.length} families
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {score.familyScores.map(f => (
                    <FamilyBar key={f.family} family={f} showFamilyCode={!isAIUC(activeAssessment) || is20x(activeAssessment)} />
                  ))}
                </div>
              </CardContent>
            </Card>

            <AssessmentCryptoInventory
              assessmentId={activeAssessment.id}
              frameworkId={getFrameworkId(activeAssessment)}
              onInventoryChange={handleCryptoInventoryChange}
            />
          </>
        )}

        {/* Crosswalk panel */}
        {showCrosswalk && activeAssessment && (
          <CrosswalkAutoFill
            assessment={activeAssessment}
            onClose={() => setShowCrosswalk(false)}
            onApplied={handleCrosswalkApplied}
          />
        )}
      </div>
    );
  }

  // Controls view
  if (viewMode === 'controls') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={showAssessmentDashboard}
            className="text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            ← Back to dashboard
          </button>
          <Badge variant="outline">
            {getAssessmentLabel(activeAssessment)}
          </Badge>
        </div>
        <AssessmentCryptoInventory
          assessmentId={activeAssessment.id}
          frameworkId={getFrameworkId(activeAssessment)}
          onInventoryChange={handleCryptoInventoryChange}
        />
        <AssessmentControlList
          assessment={activeAssessment}
          onStatusChange={refreshScore}
          inventoryVersion={cryptoInventoryVersion}
          onOpenAIView={(ctx, prompt) => {
            requestOpenAIChat({
              prompt,
              frameworkId: ctx?.frameworkId || getFrameworkId(activeAssessment),
              controlSlug: ctx?.controlId ? slugify(ctx.controlId) : undefined,
            });
          }}
          initialExpandedControlId={initialControlId}
        />
      </div>
    );
  }

  // Report view
  if (viewMode === 'report') {
    return (
      <div className="space-y-4">
        <button
          onClick={showAssessmentDashboard}
          className="text-muted-foreground hover:text-foreground transition-colors text-sm"
        >
          ← Back to dashboard
        </button>
        <GapReportGenerator
          assessment={activeAssessment}
          score={score}
        />
      </div>
    );
  }

  return null;
}

// === Sub-components ===

function AssessmentCard({
  assessment,
  onOpen,
  onDelete,
  onDuplicate,
  onReset,
}: {
  assessment: Assessment;
  onOpen: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onReset: () => void;
}) {
  const [score, setScore] = useState<BaselineScore | null>(null);

  useEffect(() => {
    (async () => {
      const summary = await loadAssessmentScoreSummary(assessment);
      setScore(summary.score);
    })();
  }, [assessment.id, assessment.targetBaseline]);

  const assessedCount = score ? score.totalControls - score.notAssessedCount : 0;

  return (
    <Card className="hover:border-primary/30 transition-colors cursor-pointer" onClick={onOpen}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{assessment.name}</h3>
              <Badge variant="outline" className="shrink-0">
                {getAssessmentLabel(assessment)}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              {assessment.systemName && <span>{assessment.systemName}</span>}
              <span>Created {new Date(assessment.createdAt).toLocaleDateString()}</span>
              {score && (
                <span>{assessedCount} of {score.totalControls} assessed</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 ml-4">
            {score && (
              <ReadinessDonut percent={score.overallPercentComplete} size={48} />
            )}
            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
              <button
                onClick={onReset}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                title="Reset all statuses"
              >
                ↺
              </button>
              <button
                onClick={onDuplicate}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                title="Duplicate"
              >
                ⧉
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                title="Delete"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Simple SVG donut chart */
function ReadinessDonut({ percent, size = 80 }: { percent: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  const color = percent >= 80 ? '#a6da95' : percent >= 50 ? '#eed49f' : percent >= 25 ? '#f5a97f' : '#ed8796';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span
        className="absolute font-mono font-bold"
        style={{ fontSize: size < 60 ? '0.625rem' : size < 100 ? '0.875rem' : '1.25rem' }}
      >
        {Math.round(percent)}%
      </span>
    </div>
  );
}

/** Horizontal bar for a control family */
function FamilyBar({ family, showFamilyCode = true }: { family: FamilyScore; showFamilyCode?: boolean }) {
  const total = family.total - family.notApplicable;
  if (total === 0) return null;

  const segments = [
    { status: 'implemented' as const, count: family.implemented, color: STATUS_COLORS['implemented'] },
    { status: 'partially-implemented' as const, count: family.partiallyImplemented, color: STATUS_COLORS['partially-implemented'] },
    { status: 'planned' as const, count: family.planned, color: STATUS_COLORS['planned'] },
    { status: 'not-implemented' as const, count: family.notImplemented, color: STATUS_COLORS['not-implemented'] },
    { status: 'not-assessed' as const, count: family.notAssessed, color: STATUS_COLORS['not-assessed'] },
  ];

  return (
    <div className="flex items-center gap-3 text-sm">
      {showFamilyCode && (
        <span className="w-6 font-mono text-muted-foreground shrink-0">{family.family}</span>
      )}
      <span className={`${showFamilyCode ? 'w-48' : 'w-56'} truncate text-muted-foreground`} title={family.familyName}>
        {family.familyName}
      </span>
      <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden flex">
        {segments.map(s => s.count > 0 && (
          <div
            key={s.status}
            className="h-full transition-all"
            style={{
              width: `${(s.count / family.total) * 100}%`,
              backgroundColor: s.color,
            }}
            title={`${STATUS_LABELS[s.status]}: ${s.count}`}
          />
        ))}
      </div>
      <span className="font-mono tabular-nums w-12 text-right text-muted-foreground">
        {family.percentComplete}%
      </span>
      <span className="text-xs text-muted-foreground w-8 text-right">
        {family.total}
      </span>
    </div>
  );
}
