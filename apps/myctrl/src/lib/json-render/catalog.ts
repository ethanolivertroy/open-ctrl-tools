/**
 * JSON Render Catalog - Component Definitions and System Prompt
 *
 * This file defines the Zod schemas for UI components that the AI can compose,
 * and generates the system prompt that guides the AI's behavior.
 */

import { z } from 'zod';
import type { ComponentSchemaMap } from './component-manifest';
import {
  AssessmentOverviewSchema,
  AssessmentFamilyBreakdownSchema,
  AssessmentGapsListSchema,
  AssessmentRemediationQueueSchema,
  AssessmentEvidenceQueueSchema,
} from './assessment-catalog';
import {
  TrustCenterCardSchema,
  TrustCenterGridSchema,
  TrustCenterChecklistSchema,
  KSIProgrammaticQueryGridSchema,
  KSIAssessmentTopicsGridSchema,
  KSIRequirementsGridSchema,
} from './ksi-catalog';
import {
  StatCardSchema,
  FrameworkCardSchema,
  TimelineEventSchema,
  TimelineChartSchema,
  FavoritesPanelSchema,
  ProgressGaugeSchema,
} from './display-catalog';
import {
  TextBlockSchema,
  SectionSchema,
  ExpandableSectionSchema,
  TabPanelSchema,
} from './layout-catalog';
import {
  ControlCardSchema,
  ControlListSchema,
  ComparisonTableSchema,
  CrosswalkDisplaySchema,
  FilterControlsSchema,
} from './control-catalog';
import { generateSystemPrompt } from './system-prompt';
export {
  AssessmentOverviewSchema,
  AssessmentFamilyBreakdownSchema,
  AssessmentGapsListSchema,
  AssessmentRemediationQueueSchema,
  AssessmentEvidenceQueueSchema,
} from './assessment-catalog';
export {
  TrustCenterCardSchema,
  TrustCenterGridSchema,
  TrustCenterChecklistSchema,
  KSIProgrammaticQueryGridSchema,
  KSIAssessmentTopicsGridSchema,
  KSIRequirementsGridSchema,
} from './ksi-catalog';
export {
  StatCardSchema,
  FrameworkCardSchema,
  TimelineEventSchema,
  TimelineChartSchema,
  FavoritesPanelSchema,
  ProgressGaugeSchema,
} from './display-catalog';
export {
  TextBlockSchema,
  SectionSchema,
  ExpandableSectionSchema,
  TabPanelSchema,
} from './layout-catalog';
export {
  ControlCardSchema,
  ControlListSchema,
  ComparisonTableSchema,
  CrosswalkDisplaySchema,
  FilterControlsSchema,
} from './control-catalog';
export { generateSystemPrompt } from './system-prompt';
import {
  NavigateControlActionSchema,
  NavigateFrameworkActionSchema,
  ApplyFilterActionSchema,
  ExportActionSchema,
  WorkflowActionSchema,
  ToggleFavoriteActionSchema,
} from './action-catalog';
export {
  NavigateControlActionSchema,
  NavigateFrameworkActionSchema,
  ApplyFilterActionSchema,
  ExportActionSchema,
  WorkflowActionSchema,
  ToggleFavoriteActionSchema,
} from './action-catalog';

// ============================================================================
// Component Schemas
// ============================================================================

// ============================================================================
// Union Types
// ============================================================================

export const ComponentSchema = z.discriminatedUnion('type', [
  ControlCardSchema,
  ControlListSchema,
  ComparisonTableSchema,
  CrosswalkDisplaySchema,
  AssessmentOverviewSchema,
  AssessmentFamilyBreakdownSchema,
  AssessmentGapsListSchema,
  AssessmentRemediationQueueSchema,
  AssessmentEvidenceQueueSchema,
  StatCardSchema,
  FrameworkCardSchema,
  TimelineChartSchema,
  FavoritesPanelSchema,
  TextBlockSchema,
  SectionSchema,
  ExpandableSectionSchema,
  TabPanelSchema,
  FilterControlsSchema,
  ProgressGaugeSchema,
  TrustCenterCardSchema,
  TrustCenterGridSchema,
  TrustCenterChecklistSchema,
  KSIProgrammaticQueryGridSchema,
  KSIAssessmentTopicsGridSchema,
  KSIRequirementsGridSchema,
]);

export const ActionSchema = z.discriminatedUnion('type', [
  NavigateControlActionSchema,
  NavigateFrameworkActionSchema,
  ApplyFilterActionSchema,
  ExportActionSchema,
  ToggleFavoriteActionSchema,
  WorkflowActionSchema,
]);

// ============================================================================
// View Schema (Root)
// ============================================================================

export const ViewSchema = z.object({
  title: z.string().describe('A brief title for this view'),
  description: z.string().optional().describe('Optional description of what this view shows'),
  components: z.array(ComponentSchema).describe('UI components to render'),
  actions: z.array(ActionSchema).optional().describe('Available actions'),
});

export type View = z.infer<typeof ViewSchema>;
export type Component = z.infer<typeof ComponentSchema>;
export type Action = z.infer<typeof ActionSchema>;

// Export schema for runtime validation
export const catalog = {
  ControlCard: ControlCardSchema,
  ControlList: ControlListSchema,
  ComparisonTable: ComparisonTableSchema,
  CrosswalkDisplay: CrosswalkDisplaySchema,
  AssessmentOverview: AssessmentOverviewSchema,
  AssessmentFamilyBreakdown: AssessmentFamilyBreakdownSchema,
  AssessmentGapsList: AssessmentGapsListSchema,
  AssessmentRemediationQueue: AssessmentRemediationQueueSchema,
  AssessmentEvidenceQueue: AssessmentEvidenceQueueSchema,
  StatCard: StatCardSchema,
  FrameworkCard: FrameworkCardSchema,
  TimelineChart: TimelineChartSchema,
  FavoritesPanel: FavoritesPanelSchema,
  TextBlock: TextBlockSchema,
  Section: SectionSchema,
  ExpandableSection: ExpandableSectionSchema,
  TabPanel: TabPanelSchema,
  FilterControls: FilterControlsSchema,
  ProgressGauge: ProgressGaugeSchema,
  TrustCenterCard: TrustCenterCardSchema,
  TrustCenterGrid: TrustCenterGridSchema,
  TrustCenterChecklist: TrustCenterChecklistSchema,
  KSIProgrammaticQueryGrid: KSIProgrammaticQueryGridSchema,
  KSIAssessmentTopicsGrid: KSIAssessmentTopicsGridSchema,
  KSIRequirementsGrid: KSIRequirementsGridSchema,
} satisfies ComponentSchemaMap;
