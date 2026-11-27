import * as React from 'react';
import {
  loadAssessmentViewSnapshot,
  type AssessmentViewRequest,
  type AssessmentViewSnapshot,
} from '@/lib/services/assessment-view-data';

export function useAssessmentSnapshot(request: AssessmentViewRequest) {
  const [snapshot, setSnapshot] = React.useState<AssessmentViewSnapshot | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const includeStatusesKey = JSON.stringify(request.includeStatuses ?? []);
  const refresh = React.useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    loadAssessmentViewSnapshot(request)
      .then(result => {
        if (cancelled) return;
        setSnapshot(result);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setSnapshot(null);
        setError(err instanceof Error ? err.message : 'Failed to load assessment snapshot.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [request.assessmentId, request.baseline, request.frameworkId, includeStatusesKey, refreshKey]);

  return { snapshot, loading, error, refresh };
}
