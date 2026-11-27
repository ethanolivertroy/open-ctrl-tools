/**
 * JSON Render Component Registry
 *
 * Maps catalog component schemas to React implementations.
 * Dispatch happens in registry.ts (the json-render adapter layer), which is
 * the single render path for both top-level and nested components.
 */

import type { ComponentImplementationMap } from './component-manifest';
import {
  AIAssessmentOverview,
  AIAssessmentFamilyBreakdown,
  AIAssessmentGapsList,
  AIAssessmentRemediationQueue,
  AIAssessmentEvidenceQueue,
} from './assessment-components';
import {
  AITrustCenterCard,
  AITrustCenterGrid,
  AITrustCenterChecklist,
  AIKSIProgrammaticQueryGrid,
  AIKSIAssessmentTopicsGrid,
  AIKSIRequirementsGrid,
} from './ksi-components';
import {
  AIControlCard,
  AIControlList,
  AIComparisonTable,
  AICrosswalkDisplay,
  AIFilterControls,
} from './control-components';
import {
  AITextBlock,
  AISection,
  AIExpandableSection,
  AITabPanel,
} from './layout-components';
import {
  AIStatCard,
  AIFrameworkCard,
  AITimelineChart,
  AIFavoritesPanel,
  AIProgressGauge,
} from './display-components';

export {
  AIAssessmentOverview,
  AIAssessmentFamilyBreakdown,
  AIAssessmentGapsList,
  AIAssessmentRemediationQueue,
  AIAssessmentEvidenceQueue,
} from './assessment-components';
export {
  AITrustCenterCard,
  AITrustCenterGrid,
  AITrustCenterChecklist,
  AIKSIProgrammaticQueryGrid,
  AIKSIAssessmentTopicsGrid,
  AIKSIRequirementsGrid,
} from './ksi-components';
export {
  AIControlCard,
  AIControlList,
  AIComparisonTable,
  AICrosswalkDisplay,
  AIFilterControls,
} from './control-components';
export {
  AITextBlock,
  AISection,
  AIExpandableSection,
  AITabPanel,
} from './layout-components';
export {
  AIStatCard,
  AIFrameworkCard,
  AITimelineChart,
  AIFavoritesPanel,
  AIProgressGauge,
} from './display-components';

// ============================================================================
// Component Registry
// ============================================================================

export const componentRegistry = {
  ControlCard: AIControlCard,
  ControlList: AIControlList,
  ComparisonTable: AIComparisonTable,
  CrosswalkDisplay: AICrosswalkDisplay,
  AssessmentOverview: AIAssessmentOverview,
  AssessmentFamilyBreakdown: AIAssessmentFamilyBreakdown,
  AssessmentGapsList: AIAssessmentGapsList,
  AssessmentRemediationQueue: AIAssessmentRemediationQueue,
  AssessmentEvidenceQueue: AIAssessmentEvidenceQueue,
  StatCard: AIStatCard,
  FrameworkCard: AIFrameworkCard,
  TimelineChart: AITimelineChart,
  FavoritesPanel: AIFavoritesPanel,
  TextBlock: AITextBlock,
  Section: AISection,
  ExpandableSection: AIExpandableSection,
  TabPanel: AITabPanel,
  FilterControls: AIFilterControls,
  ProgressGauge: AIProgressGauge,
  TrustCenterCard: AITrustCenterCard,
  TrustCenterGrid: AITrustCenterGrid,
  TrustCenterChecklist: AITrustCenterChecklist,
  KSIProgrammaticQueryGrid: AIKSIProgrammaticQueryGrid,
  KSIAssessmentTopicsGrid: AIKSIAssessmentTopicsGrid,
  KSIRequirementsGrid: AIKSIRequirementsGrid,
} satisfies ComponentImplementationMap;
