import { z } from 'zod';

export const NavigateControlActionSchema = z.object({
  type: z.literal('navigate_control'),
  frameworkId: z.string(),
  controlId: z.string(),
});

export const NavigateFrameworkActionSchema = z.object({
  type: z.literal('navigate_framework'),
  frameworkId: z.string(),
});

export const ApplyFilterActionSchema = z.object({
  type: z.literal('applyFilter'),
  filter: z.object({
    family: z.string().optional(),
    baseline: z.string().optional(),
    searchQuery: z.string().optional(),
  }),
});

export const ExportActionSchema = z.object({
  type: z.literal('export'),
  format: z.enum(['csv', 'json', 'pdf']).describe('Export format'),
  data: z.enum(['controls', 'crosswalks', 'view', 'favorites']).describe('Type of data to export'),
  params: z.object({
    scope: z.enum(['current', 'filtered', 'all']).optional().describe('Scope of data to export'),
    includeDescriptions: z.boolean().optional().describe('Include full descriptions in export'),
  }).optional(),
});

export const WorkflowActionSchema = z.object({
  type: z.literal('workflow'),
  name: z.string().optional().describe('Workflow name for logging'),
  steps: z.array(z.object({
    action: z.string().describe('Action type to execute'),
    params: z.record(z.string(), z.unknown()).optional().describe('Action parameters'),
    delay: z.number().optional().describe('Delay in ms before next step'),
  })).describe('Sequential workflow steps'),
});

export const ToggleFavoriteActionSchema = z.object({
  type: z.literal('toggleFavorite'),
  frameworkId: z.string(),
});
