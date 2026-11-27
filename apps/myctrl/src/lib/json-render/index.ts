/**
 * JSON Render Library
 *
 * Exports for the AI-powered view builder system.
 */

// Catalog - schemas and system prompt
export {
  // Component Schemas
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
  TimelineEventSchema,
  TimelineChartSchema,
  FavoritesPanelSchema,
  TextBlockSchema,
  SectionSchema,
  ExpandableSectionSchema,
  TabPanelSchema,
  FilterControlsSchema,
  ProgressGaugeSchema,
  // Action Schemas
  NavigateControlActionSchema,
  NavigateFrameworkActionSchema,
  ApplyFilterActionSchema,
  ExportActionSchema,
  ToggleFavoriteActionSchema,
  WorkflowActionSchema,
  KSIProgrammaticQueryGridSchema,
  KSIAssessmentTopicsGridSchema,
  // Union Types
  ComponentSchema,
  ActionSchema,
  ViewSchema,
  // Types
  type View,
  type Component,
  type Action,
  // Catalog
  catalog,
  generateSystemPrompt,
} from './catalog';

// Components - React implementations
export {
  AIControlCard,
  AIControlList,
  AIComparisonTable,
  AICrosswalkDisplay,
  AIAssessmentOverview,
  AIAssessmentFamilyBreakdown,
  AIAssessmentGapsList,
  AIAssessmentRemediationQueue,
  AIAssessmentEvidenceQueue,
  AIStatCard,
  AIFrameworkCard,
  AITimelineChart,
  AIFavoritesPanel,
  AITextBlock,
  AISection,
  AIExpandableSection,
  AITabPanel,
  AIFilterControls,
  AIProgressGauge,
  AIKSIProgrammaticQueryGrid,
  AIKSIAssessmentTopicsGrid,
  componentRegistry,
} from './components';

// Actions - handlers
export {
  createActionHandlers,
  executeAction,
  executeActions,
  useActionHandlers,
  type ActionHandler,
  type ActionContext,
} from './actions';

// Data & Visibility — re-exported from @json-render/react
export {
  DataProvider,
  useData,
  useDataValue,
  useDataBinding,
  VisibilityProvider,
  useVisibility,
  useIsVisible,
  Renderer,
  JSONUIProvider,
  type DataContextValue,
  type ComponentRegistry,
  type ComponentRenderProps,
} from '@json-render/react';

// Path utilities — re-exported from @json-render/core
export { getByPath, setByPath } from '@json-render/core';

export {
  componentTypes,
  containerComponentTypes,
  isContainerComponentType,
  type ComponentType,
  type ContainerComponentType,
} from './component-manifest';

// Tree converter — ViewSchema ↔ UITree bridge
export { viewToUITree, uiTreeToView } from './tree-converter';

// json-render ComponentRegistry
export { jsonRenderRegistry } from './registry';
