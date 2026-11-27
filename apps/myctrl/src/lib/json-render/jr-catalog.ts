/**
 * JSON Render Catalog Definition
 *
 * Wraps the existing Zod schemas from catalog.ts into a json-render
 * Catalog via createCatalog(). This keeps the experimental json-render
 * contract aligned with the production component/action schemas instead of
 * maintaining a second copy by hand.
 */

import { createCatalog } from '@json-render/core';
import { z } from 'zod';
import {
  AssessmentEvidenceQueueSchema,
  AssessmentFamilyBreakdownSchema,
  AssessmentGapsListSchema,
  AssessmentOverviewSchema,
  AssessmentRemediationQueueSchema,
  ApplyFilterActionSchema,
  ComparisonTableSchema,
  ControlCardSchema,
  ControlListSchema,
  CrosswalkDisplaySchema,
  ExpandableSectionSchema,
  ExportActionSchema,
  FavoritesPanelSchema,
  FilterControlsSchema,
  FrameworkCardSchema,
  KSIAssessmentTopicsGridSchema,
  KSIProgrammaticQueryGridSchema,
  KSIRequirementsGridSchema,
  NavigateControlActionSchema,
  NavigateFrameworkActionSchema,
  ProgressGaugeSchema,
  SectionSchema,
  StatCardSchema,
  TabPanelSchema,
  TextBlockSchema,
  TimelineChartSchema,
  ToggleFavoriteActionSchema,
  TrustCenterCardSchema,
  TrustCenterChecklistSchema,
  TrustCenterGridSchema,
  WorkflowActionSchema,
} from './catalog';

type SchemaWithType = z.ZodObject<{ type: z.ZodTypeAny } & z.ZodRawShape>;

const componentProps = (schema: SchemaWithType) => schema.omit({ type: true });

const actionParams = (schema: SchemaWithType) => schema.omit({ type: true });

/**
 * The json-render catalog defining all available component types.
 *
 * Each component has:
 * - props: Zod schema for the component's properties
 * - hasChildren: whether it can contain nested components
 * - description: used by generateCatalogPrompt() and for documentation
 */
export const myctrlCatalog = createCatalog({
  name: 'myctrl',

  components: {
    ControlCard: { props: componentProps(ControlCardSchema), description: 'Display a single control with its details' },
    ControlList: { props: componentProps(ControlListSchema), description: 'Display a filtered list of controls from a framework' },
    ComparisonTable: { props: componentProps(ComparisonTableSchema), description: 'Side-by-side framework comparison' },
    CrosswalkDisplay: { props: componentProps(CrosswalkDisplaySchema), description: 'Cross-framework mappings for a control' },
    StatCard: { props: componentProps(StatCardSchema), description: 'Display a metric or statistic' },
    FrameworkCard: { props: componentProps(FrameworkCardSchema), description: 'Framework overview card' },
    TimelineChart: { props: componentProps(TimelineChartSchema), description: 'Display deadlines and milestones' },
    FavoritesPanel: { props: componentProps(FavoritesPanelSchema), description: 'User favorites panel' },
    TextBlock: { props: componentProps(TextBlockSchema), description: 'Rich text content with full Markdown support' },
    Section: {
      props: componentProps(SectionSchema),
      hasChildren: true,
      description: 'Container for grouping components',
    },
    ExpandableSection: {
      props: componentProps(ExpandableSectionSchema),
      hasChildren: true,
      description: 'Collapsible section with expand/collapse toggle',
    },
    TabPanel: {
      props: componentProps(TabPanelSchema),
      hasChildren: true,
      description: 'Tabbed container for organizing content',
    },
    FilterControls: { props: componentProps(FilterControlsSchema), description: 'Interactive filter controls with data binding' },
    ProgressGauge: { props: componentProps(ProgressGaugeSchema), description: 'Visual progress/compliance indicator with thresholds' },
    AssessmentOverview: {
      props: componentProps(AssessmentOverviewSchema),
      description: 'Assessment summary card with readiness, coverage, and status distribution',
    },
    AssessmentFamilyBreakdown: {
      props: componentProps(AssessmentFamilyBreakdownSchema),
      description: 'Family-level readiness breakdown for a framework assessment',
    },
    AssessmentGapsList: {
      props: componentProps(AssessmentGapsListSchema),
      description: 'Prioritized open-gap list for a framework assessment',
    },
    AssessmentRemediationQueue: {
      props: componentProps(AssessmentRemediationQueueSchema),
      description: 'Action-oriented remediation queue for a framework assessment',
    },
    AssessmentEvidenceQueue: {
      props: componentProps(AssessmentEvidenceQueueSchema),
      description: 'Evidence collection and interview-prep queue for a framework assessment',
    },
    TrustCenterCard: { props: componentProps(TrustCenterCardSchema), description: 'Single trust center component card' },
    TrustCenterGrid: { props: componentProps(TrustCenterGridSchema), description: 'Grid of trust center components grouped by category' },
    TrustCenterChecklist: { props: componentProps(TrustCenterChecklistSchema), description: 'Interactive checklist for building a trust center' },
    KSIProgrammaticQueryGrid: { props: componentProps(KSIProgrammaticQueryGridSchema), description: 'CLI commands for verifying a KSI' },
    KSIAssessmentTopicsGrid: { props: componentProps(KSIAssessmentTopicsGridSchema), description: 'Assessment focus areas for a KSI' },
    KSIRequirementsGrid: { props: componentProps(KSIRequirementsGridSchema), description: 'FRMR requirements (MUST/SHOULD/MAY) for a KSI' },
  },

  actions: {
    navigateControl: {
      params: actionParams(NavigateControlActionSchema),
      description: 'Navigate to a specific control',
    },
    navigateFramework: {
      params: actionParams(NavigateFrameworkActionSchema),
      description: 'Navigate to a framework overview',
    },
    applyFilter: {
      params: actionParams(ApplyFilterActionSchema),
      description: 'Apply filters to the current view',
    },
    export: {
      params: actionParams(ExportActionSchema),
      description: 'Export the current view or data',
    },
    toggleFavorite: {
      params: actionParams(ToggleFavoriteActionSchema),
      description: 'Toggle a framework as favorite',
    },
    workflow: {
      params: actionParams(WorkflowActionSchema),
      description: 'Run a named workflow or workbench action',
    },
  },
});

export type MyCtrlCatalog = typeof myctrlCatalog;
