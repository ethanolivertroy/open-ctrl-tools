import { z } from 'zod';

export const TextBlockSchema = z.object({
  type: z.literal('TextBlock'),
  content: z.string().describe('GitHub-flavored Markdown content. Supports: **bold**, *italic*, `code`, ```code blocks```, - lists, 1. numbered lists, [links](url), > quotes, ## headings, | tables |'),
  variant: z.enum(['default', 'callout', 'warning', 'info', 'success']).optional().default('default'),
});

export const SectionSchema = z.object({
  type: z.literal('Section'),
  title: z.string().optional(),
  description: z.string().optional(),
  children: z.array(z.any()).describe('Nested components'),
});

export const ExpandableSectionSchema = z.object({
  type: z.literal('ExpandableSection'),
  title: z.string().describe('Section header text'),
  subtitle: z.string().optional().describe('Secondary text in header'),
  defaultExpanded: z.boolean().default(false).describe('Initial expanded state'),
  children: z.array(z.any()).describe('Nested components to show when expanded'),
});

export const TabPanelSchema = z.object({
  type: z.literal('TabPanel'),
  tabs: z.array(z.object({
    id: z.string().describe('Unique tab identifier'),
    label: z.string().describe('Tab label text'),
    icon: z.string().optional().describe('Optional icon name'),
    children: z.array(z.any()).describe('Components for this tab'),
  })).min(1).describe('Tab definitions'),
  defaultTab: z.string().optional().describe('ID of initially selected tab'),
});
