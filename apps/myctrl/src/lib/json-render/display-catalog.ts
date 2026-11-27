import { z } from 'zod';

export const StatCardSchema = z.object({
  type: z.literal('StatCard'),
  title: z.string().describe('Metric title'),
  value: z.union([z.string(), z.number()]).optional().describe('Static value to display'),
  dataPath: z.string().optional().describe('JSON pointer path to dynamic value (e.g., "/stats/totalControls")'),
  subtitle: z.string().optional().describe('Additional context'),
  trend: z.enum(['up', 'down', 'neutral']).optional(),
  color: z.enum(['primary', 'success', 'warning', 'error']).optional(),
});

export const FrameworkCardSchema = z.object({
  type: z.literal('FrameworkCard'),
  frameworkId: z.string().describe('Framework identifier'),
  showStats: z.boolean().default(true).describe('Show control counts'),
  showDescription: z.boolean().default(true),
  variant: z.enum(['compact', 'detailed']).default('compact'),
});

export const TimelineEventSchema = z.object({
  date: z.string().describe('ISO date string (YYYY-MM-DD) or partial date (YYYY-MM)'),
  label: z.string().describe('Event title/label'),
  description: z.string().optional().describe('Additional event description'),
  status: z.enum(['past', 'upcoming', 'current', 'future']).optional().describe('Event status (auto-calculated if not provided)'),
  category: z.string().optional().describe('Category for color-coding (e.g., "prohibited", "high-risk", "gpai")'),
});

export const TimelineChartSchema = z.object({
  type: z.literal('TimelineChart'),
  frameworkId: z.string().optional().describe('Framework with built-in timeline data (e.g., "eu-ai-act")'),
  events: z.array(TimelineEventSchema).optional().describe('Custom timeline events (overrides framework data)'),
  title: z.string().optional().describe('Chart title (uses default if framework has one)'),
  groupBy: z.enum(['riskTier', 'article', 'year']).default('year'),
  filterPast: z.boolean().default(false).describe('Hide past deadlines'),
});

export const FavoritesPanelSchema = z.object({
  type: z.literal('FavoritesPanel'),
  showNotes: z.boolean().default(true).describe('Display user notes for each favorite'),
  variant: z.enum(['list', 'grid']).default('list').describe('list: compact vertical list, grid: 2-column grid'),
});

export const ProgressGaugeSchema = z.object({
  type: z.literal('ProgressGauge'),
  value: z.number().optional().describe('Current value (0-max)'),
  dataPath: z.string().optional().describe('JSON pointer path to dynamic value'),
  max: z.number().default(100).describe('Maximum value'),
  label: z.string().describe('Gauge label'),
  sublabel: z.string().optional().describe('Additional context'),
  variant: z.enum(['bar', 'circle', 'semicircle']).default('bar'),
  thresholds: z.array(z.object({
    value: z.number().describe('Threshold percentage (0-100)'),
    color: z.string().describe('Color at this threshold (CSS color or primary/success/warning/error)'),
  })).optional().describe('Color thresholds'),
  showValue: z.boolean().default(true).describe('Display numeric value'),
});
