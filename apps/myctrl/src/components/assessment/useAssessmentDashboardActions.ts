import { useCallback, useMemo, useState } from 'react';
import type { Assessment } from '@/lib/db';
import {
  getAssessmentBaselineOptions,
  getDefaultAssessmentBaseline,
  type AssessmentFrameworkId,
  type AssessmentTargetBaseline,
} from '@/lib/assessment-frameworks';
import {
  clearAssessmentAutoSuggestions,
  createAssessmentWithMetadata,
  resetAssessmentProgress,
} from '@/lib/services/assessment-workflows';
import {
  deleteAssessment,
  duplicateAssessment,
} from '@/lib/storage/assessment-store';

interface AssessmentDashboardActionsOptions {
  activeAssessment: Assessment | null;
  loadAssessments: () => Promise<Assessment[]>;
  openAssessment: (assessment: Assessment) => void;
  replaceActiveAssessment: (assessment: Assessment | null) => void;
  refreshScore: () => Promise<void>;
}

function getInitialFramework(): AssessmentFrameworkId {
  return 'fedramp-rev5';
}

function getInitialBaseline(): AssessmentTargetBaseline {
  return 'moderate';
}

export function useAssessmentDashboardActions({
  activeAssessment,
  loadAssessments,
  openAssessment,
  replaceActiveAssessment,
  refreshScore,
}: AssessmentDashboardActionsOptions) {
  const [showCreate, setShowCreate] = useState(false);
  const [formName, setFormName] = useState('');
  const [formFramework, setFormFramework] = useState<AssessmentFrameworkId>(getInitialFramework());
  const [formBaseline, setFormBaseline] = useState<AssessmentTargetBaseline>(getInitialBaseline());
  const [formSystemName, setFormSystemName] = useState('');
  const [formAssessorName, setFormAssessorName] = useState('');
  const [formAssessorOrg, setFormAssessorOrg] = useState('');
  const [showCrosswalk, setShowCrosswalk] = useState(false);

  const resetCreateForm = useCallback(() => {
    setFormName('');
    setFormFramework(getInitialFramework());
    setFormBaseline(getInitialBaseline());
    setFormSystemName('');
    setFormAssessorName('');
    setFormAssessorOrg('');
  }, []);

  const closeCreate = useCallback(() => {
    setShowCreate(false);
    resetCreateForm();
  }, [resetCreateForm]);

  const formBaselineOptions = useMemo(
    () => getAssessmentBaselineOptions(formFramework),
    [formFramework],
  );

  const handleFrameworkChange = useCallback((value: AssessmentFrameworkId) => {
    setFormFramework(value);
    if (value !== 'aiuc-1') {
      setFormBaseline(getDefaultAssessmentBaseline(value) as AssessmentTargetBaseline);
    }
  }, []);

  const handleCreate = useCallback(async () => {
    if (!formName.trim()) return;

    const assessment = await createAssessmentWithMetadata({
      name: formName,
      framework: formFramework,
      baseline: formBaseline,
      systemName: formSystemName,
      assessorName: formAssessorName,
      assessorOrg: formAssessorOrg,
    });

    closeCreate();
    await loadAssessments();
    openAssessment(assessment);
  }, [
    closeCreate,
    formAssessorName,
    formAssessorOrg,
    formBaseline,
    formFramework,
    formName,
    formSystemName,
    loadAssessments,
    openAssessment,
  ]);

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm('Delete this assessment and all its control statuses?')) return;

    await deleteAssessment(id);
    if (activeAssessment?.id === id) {
      replaceActiveAssessment(null);
    }
    await loadAssessments();
  }, [activeAssessment?.id, loadAssessments, replaceActiveAssessment]);

  const handleReset = useCallback(async (id: string) => {
    if (!window.confirm('Reset all control statuses to "Not Assessed"? The assessment itself will be kept.')) return;

    const refreshed = await resetAssessmentProgress(id);
    await loadAssessments();
    if (activeAssessment?.id === id) {
      replaceActiveAssessment(refreshed ?? null);
    }
  }, [activeAssessment?.id, loadAssessments, replaceActiveAssessment]);

  const handleClearAutoSuggestions = useCallback(async (id: string) => {
    if (!window.confirm('Clear all auto-suggested statuses? Manually set statuses will be kept.')) return;

    const refreshed = await clearAssessmentAutoSuggestions(id);
    await loadAssessments();
    if (activeAssessment?.id === id) {
      replaceActiveAssessment(refreshed ?? null);
    }
  }, [activeAssessment?.id, loadAssessments, replaceActiveAssessment]);

  const handleDuplicate = useCallback(async (id: string, name: string) => {
    await duplicateAssessment(id, `${name} (copy)`);
    await loadAssessments();
  }, [loadAssessments]);

  const handleCrosswalkApplied = useCallback(async () => {
    await refreshScore();
    await loadAssessments();
  }, [loadAssessments, refreshScore]);

  return {
    showCreate,
    setShowCreate,
    closeCreate,
    formName,
    setFormName,
    formFramework,
    setFormFramework,
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
  };
}
