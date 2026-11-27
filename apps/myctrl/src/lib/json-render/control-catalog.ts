import { z } from 'zod';

export const ControlCardSchema = z.object({
  type: z.literal('ControlCard'),
  frameworkId: z.string().describe('Framework identifier (e.g., "nist-800-53-r5", "fedramp-rev5")'),
  controlId: z.string().describe('Control identifier (e.g., "AC-2", "3.1.1")'),
  variant: z.enum(['compact', 'full']).default('compact').describe('Display variant'),
  showBadges: z.boolean().default(true).describe('Show baseline/severity badges'),
  showDescription: z.boolean().default(true).describe('Show control description'),
});

export const ControlListSchema = z.object({
  type: z.literal('ControlList'),
  frameworkId: z.string().describe('Framework identifier'),
  filters: z.object({
    family: z.string().optional().describe('Filter by control family (e.g., "AC", "IA")'),
    baseline: z.enum(['low', 'moderate', 'high', 'privacy', 'li-saas']).optional(),
    severity: z.enum(['cat-i', 'cat-ii', 'cat-iii']).optional(),
    implementationGroup: z.enum(['ig1', 'ig2', 'ig3']).optional(),
    riskTier: z.enum(['prohibited', 'high-risk', 'limited-risk', 'minimal-risk', 'gpai']).optional(),
    searchQuery: z.string().optional().describe('Text search within controls'),
  }).optional(),
  filterDataPath: z.string().optional().describe('JSON pointer path to dynamic filter state'),
  groupBy: z.enum(['none', 'family', 'baseline', 'severity']).default('family'),
  variant: z.enum(['compact', 'detailed', 'table']).default('compact'),
  limit: z.number().min(1).max(100).default(20).describe('Maximum controls to display'),
});

export const ComparisonTableSchema = z.object({
  type: z.literal('ComparisonTable'),
  frameworkIds: z.array(z.string()).min(2).max(4).describe('Frameworks to compare'),
  compareBy: z.enum(['family', 'controlArea', 'baseline']).default('family'),
  showMappings: z.boolean().default(true).describe('Show cross-framework mappings'),
});

export const CrosswalkDisplaySchema = z.object({
  type: z.literal('CrosswalkDisplay'),
  sourceFramework: z.string().describe('Source framework ID'),
  sourceControl: z.string().describe('Source control ID'),
  targetFrameworks: z.array(z.string()).optional().describe('Filter to specific target frameworks'),
});

export const FilterControlsSchema = z.object({
  type: z.literal('FilterControls'),
  filters: z.array(z.object({
    id: z.string().describe('Filter identifier'),
    label: z.string().describe('Filter label'),
    type: z.enum(['select', 'checkbox', 'search', 'radio']).describe('Control type'),
    options: z.array(z.object({
      value: z.string(),
      label: z.string(),
    })).optional().describe('Options for select/radio filters'),
    dataPath: z.string().describe('JSON pointer path to bind filter value'),
    placeholder: z.string().optional().describe('Placeholder text for search'),
  })).describe('Filter definitions'),
  layout: z.enum(['horizontal', 'vertical', 'grid']).default('horizontal'),
});
