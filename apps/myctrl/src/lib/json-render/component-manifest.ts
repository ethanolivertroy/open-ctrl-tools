import type * as React from 'react';
import type { z } from 'zod';

export const componentTypes = [
  'ControlCard',
  'ControlList',
  'ComparisonTable',
  'CrosswalkDisplay',
  'AssessmentOverview',
  'AssessmentFamilyBreakdown',
  'AssessmentGapsList',
  'AssessmentRemediationQueue',
  'AssessmentEvidenceQueue',
  'StatCard',
  'FrameworkCard',
  'TimelineChart',
  'FavoritesPanel',
  'TextBlock',
  'Section',
  'ExpandableSection',
  'TabPanel',
  'FilterControls',
  'ProgressGauge',
  'TrustCenterCard',
  'TrustCenterGrid',
  'TrustCenterChecklist',
  'KSIProgrammaticQueryGrid',
  'KSIAssessmentTopicsGrid',
  'KSIRequirementsGrid',
] as const;

export type ComponentType = typeof componentTypes[number];

export const containerComponentTypes = [
  'Section',
  'ExpandableSection',
  'TabPanel',
] as const satisfies readonly ComponentType[];

export type ContainerComponentType = typeof containerComponentTypes[number];

const containerComponentTypeSet = new Set<ComponentType>(containerComponentTypes);

export function isContainerComponentType(type: ComponentType): type is ContainerComponentType {
  return containerComponentTypeSet.has(type);
}

export type ComponentSchemaMap = Record<ComponentType, z.ZodTypeAny>;
export type ComponentImplementationMap = Record<ComponentType, React.ComponentType<any>>;
