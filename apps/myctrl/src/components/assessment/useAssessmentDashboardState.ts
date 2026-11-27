import { useCallback, useEffect, useRef, useState } from 'react';
import type { Assessment } from '@/lib/db';
import { getAssessments } from '@/lib/storage/assessment-store';
import { useProjectChange } from '@/hooks/useProjectChange';

export type AssessmentDashboardViewMode = 'list' | 'dashboard' | 'controls' | 'report';

interface OpenAssessmentOptions {
  viewMode?: Exclude<AssessmentDashboardViewMode, 'list'>;
  controlId?: string;
}

export function useAssessmentDashboardState() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [activeAssessment, setActiveAssessment] = useState<Assessment | null>(null);
  const [viewMode, setViewMode] = useState<AssessmentDashboardViewMode>('list');
  const [initialControlId, setInitialControlId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const deepLinkHandledRef = useRef(false);

  const loadAssessments = useCallback(async () => {
    setLoading(true);
    const all = await getAssessments();
    setAssessments(all);
    setLoading(false);
    return all;
  }, []);

  const showAssessmentList = useCallback(() => {
    setActiveAssessment(null);
    setViewMode('list');
    setInitialControlId(undefined);
  }, []);

  const openAssessment = useCallback((assessment: Assessment, options: OpenAssessmentOptions = {}) => {
    setActiveAssessment(assessment);
    setViewMode(options.viewMode ?? 'dashboard');
    setInitialControlId(options.controlId);
  }, []);

  const showAssessmentDashboard = useCallback(() => {
    if (!activeAssessment) return;
    setViewMode('dashboard');
    setInitialControlId(undefined);
  }, [activeAssessment]);

  const showAssessmentControls = useCallback((controlId?: string) => {
    if (!activeAssessment) return;
    setViewMode('controls');
    setInitialControlId(controlId);
  }, [activeAssessment]);

  const showAssessmentReport = useCallback(() => {
    if (!activeAssessment) return;
    setViewMode('report');
  }, [activeAssessment]);

  const replaceActiveAssessment = useCallback((assessment: Assessment | null) => {
    setActiveAssessment(assessment);
    if (!assessment) {
      setViewMode('list');
      setInitialControlId(undefined);
    }
  }, []);

  const handleProjectChange = useCallback(async () => {
    showAssessmentList();
    await loadAssessments();
  }, [loadAssessments, showAssessmentList]);

  useEffect(() => {
    void loadAssessments();
  }, [loadAssessments]);

  useProjectChange(() => {
    void handleProjectChange();
  });

  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    if (loading || typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const assessmentId = params.get('assessmentId');
    const controlId = params.get('controlId') ?? undefined;
    if (!assessmentId) {
      deepLinkHandledRef.current = true;
      return;
    }

    const target = assessments.find((assessment) => assessment.id === assessmentId);
    if (!target) return;

    deepLinkHandledRef.current = true;
    openAssessment(target, {
      viewMode: controlId ? 'controls' : 'dashboard',
      controlId,
    });
  }, [assessments, loading, openAssessment]);

  return {
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
  };
}
