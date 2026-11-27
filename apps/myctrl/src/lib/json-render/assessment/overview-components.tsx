import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getFrameworkConfig } from '@/data/controls';
import { getAssessmentLabel } from '@/lib/assessment-frameworks';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/db';
import { EmptyState, ErrorMessage, type ComponentProps } from '../primitives';
import { useAssessmentSnapshot } from './use-assessment-snapshot';
import { DEFAULT_STATUS_GROUP_ORDER, groupItemsBy } from './grouping';

export function AIAssessmentOverview({ config }: ComponentProps<'AssessmentOverview'>) {
  const {
    frameworkId,
    assessmentId,
    baseline,
    showStatusBreakdown = true,
    showMetadata = true,
  } = config;
  const { snapshot, loading, error } = useAssessmentSnapshot({
    frameworkId,
    assessmentId,
    baseline,
  });

  if (loading) {
    return <EmptyState message="Loading assessment snapshot..." />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  if (!snapshot) {
    return <EmptyState message="No matching assessment was found for this framework and baseline." />;
  }

  const framework = getFrameworkConfig(snapshot.frameworkId);
  const gapCount = snapshot.gaps.length;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>{snapshot.assessment.name}</CardTitle>
            <CardDescription>
              {framework.name} • {getAssessmentLabel(snapshot.frameworkId, snapshot.baseline)}
            </CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-sm">
            {snapshot.score.overallPercentComplete}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Overall readiness</p>
            <p className="mt-2 text-3xl font-semibold">{snapshot.score.overallPercentComplete}%</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Weighted implementation across {snapshot.score.totalControls} controls
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Coverage assessed</p>
            <p className="mt-2 text-3xl font-semibold">{snapshot.score.overallPercentAssessed}%</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {snapshot.score.totalControls - snapshot.score.notAssessedCount} controls evaluated
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Open gaps</p>
            <p className="mt-2 text-3xl font-semibold">{gapCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Not assessed, not implemented, partial, or planned
            </p>
          </div>
        </div>

        {showMetadata && (
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {snapshot.assessment.systemName && (
              <Badge variant="secondary">System: {snapshot.assessment.systemName}</Badge>
            )}
            {snapshot.assessment.assessorName && (
              <Badge variant="secondary">Assessor: {snapshot.assessment.assessorName}</Badge>
            )}
            <Badge variant="secondary">
              Updated {new Date(snapshot.assessment.updatedAt).toLocaleDateString()}
            </Badge>
          </div>
        )}

        {showStatusBreakdown && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {snapshot.distribution.map(item => (
              <div key={item.status} className="rounded-lg border border-border bg-muted/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[item.status] }}
                    />
                    <span className="text-sm font-medium">{STATUS_LABELS[item.status]}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {item.count} • {item.percent}%
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${item.percent}%`,
                      backgroundColor: STATUS_COLORS[item.status],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AIAssessmentFamilyBreakdown({ config }: ComponentProps<'AssessmentFamilyBreakdown'>) {
  const { frameworkId, assessmentId, baseline, limit = 12, sortBy = 'readiness' } = config;
  const { snapshot, loading, error } = useAssessmentSnapshot({
    frameworkId,
    assessmentId,
    baseline,
  });

  if (loading) {
    return <EmptyState message="Loading family readiness..." />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  if (!snapshot) {
    return <EmptyState message="No matching assessment was found for this family breakdown." />;
  }

  const familyScores = [...snapshot.score.familyScores]
    .sort((left, right) => {
      if (sortBy === 'family') {
        return left.family.localeCompare(right.family);
      }
      if (left.percentComplete !== right.percentComplete) {
        return left.percentComplete - right.percentComplete;
      }
      return left.family.localeCompare(right.family);
    })
    .slice(0, limit);

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>Family readiness breakdown</CardTitle>
        <CardDescription>
          Families with the most remaining work surface first.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {familyScores.map(family => (
          <div key={family.family} className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">
                  {family.family} <span className="text-muted-foreground">• {family.familyName}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {family.total - family.notAssessed} assessed of {family.total} total
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{family.percentComplete}%</p>
                <p className="text-xs text-muted-foreground">{family.percentAssessed}% assessed</p>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${family.percentComplete}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function AIAssessmentGapsList({ config }: ComponentProps<'AssessmentGapsList'>) {
  const {
    frameworkId,
    assessmentId,
    baseline,
    limit = 15,
    groupBy = 'status',
    includeStatuses,
  } = config;
  const { snapshot, loading, error } = useAssessmentSnapshot({
    frameworkId,
    assessmentId,
    baseline,
    includeStatuses,
  });

  if (loading) {
    return <EmptyState message="Loading assessment gaps..." />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  if (!snapshot) {
    return <EmptyState message="No matching assessment was found for this gaps view." />;
  }

  const gaps = snapshot.gaps.slice(0, limit);
  if (gaps.length === 0) {
    return <EmptyState message="No gaps matched the requested filters." />;
  }

  const groupedGaps = groupItemsBy(gaps, groupBy, {
    defaultLabel: 'Priority gaps',
    statusOrder: DEFAULT_STATUS_GROUP_ORDER,
  });

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>Priority gaps</CardTitle>
        <CardDescription>
          Controls that still need work in {snapshot.assessment.name}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {groupedGaps.map(([group, items]) => (
          <div key={group} className="space-y-3">
            {groupBy !== 'none' && (
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                  {groupBy === 'status' ? STATUS_LABELS[group as keyof typeof STATUS_LABELS] : group}
                </h4>
                <span className="text-xs text-muted-foreground">{items.length} controls</span>
              </div>
            )}
            <div className="space-y-2">
              {items.map(gap => (
                <div
                  key={`${gap.controlId}:${gap.status}`}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-muted/10 p-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="space-y-1">
                    <a href={gap.url} className="font-mono text-sm text-primary hover:underline">
                      {gap.controlId}
                    </a>
                    <p className="text-sm font-medium">{gap.title}</p>
                    <p className="text-xs text-muted-foreground">Family: {gap.family}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className="self-start"
                    style={{
                      color: STATUS_COLORS[gap.status],
                      borderColor: STATUS_COLORS[gap.status],
                    }}
                  >
                    {STATUS_LABELS[gap.status]}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        ))}

        {snapshot.gaps.length > gaps.length && (
          <p className="text-xs text-center text-muted-foreground">
            Showing {gaps.length} of {snapshot.gaps.length} matching gaps
          </p>
        )}
      </CardContent>
    </Card>
  );
}
