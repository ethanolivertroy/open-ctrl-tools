import { z } from 'zod';
import {
  ASSESSMENT_BASELINES,
  ASSESSMENT_FRAMEWORK_IDS,
} from '@/lib/assessment-frameworks';

const ImplementationStatusSchema = z.enum([
  'not-assessed',
  'not-implemented',
  'partially-implemented',
  'planned',
  'implemented',
  'not-applicable',
]);

export const AssessmentFrameworkSchema = z.enum(ASSESSMENT_FRAMEWORK_IDS);
export const AssessmentBaselineSchema = z.enum(ASSESSMENT_BASELINES);

export const AssessmentOverviewSchema = z.object({
  type: z.literal('AssessmentOverview'),
  frameworkId: AssessmentFrameworkSchema.describe('Assessment-capable framework identifier'),
  assessmentId: z.string().optional().describe('Optional specific assessment ID; latest matching assessment is used when omitted'),
  baseline: AssessmentBaselineSchema.optional().describe('Target baseline or impact level'),
  showStatusBreakdown: z.boolean().default(true).describe('Show status distribution bars'),
  showMetadata: z.boolean().default(true).describe('Show assessment metadata such as system and updated date'),
});

export const AssessmentFamilyBreakdownSchema = z.object({
  type: z.literal('AssessmentFamilyBreakdown'),
  frameworkId: AssessmentFrameworkSchema.describe('Assessment-capable framework identifier'),
  assessmentId: z.string().optional().describe('Optional specific assessment ID; latest matching assessment is used when omitted'),
  baseline: AssessmentBaselineSchema.optional().describe('Target baseline or impact level'),
  limit: z.number().min(1).max(50).default(12).describe('Maximum families to display'),
  sortBy: z.enum(['readiness', 'family']).default('readiness').describe('Sort by lowest readiness first or alphabetically'),
});

export const AssessmentGapsListSchema = z.object({
  type: z.literal('AssessmentGapsList'),
  frameworkId: AssessmentFrameworkSchema.describe('Assessment-capable framework identifier'),
  assessmentId: z.string().optional().describe('Optional specific assessment ID; latest matching assessment is used when omitted'),
  baseline: AssessmentBaselineSchema.optional().describe('Target baseline or impact level'),
  limit: z.number().min(1).max(100).default(15).describe('Maximum gaps to display'),
  groupBy: z.enum(['status', 'family', 'none']).default('status').describe('How to group returned gaps'),
  includeStatuses: z.array(ImplementationStatusSchema).default([
    'not-assessed',
    'not-implemented',
    'partially-implemented',
    'planned',
  ]).describe('Statuses to treat as open gaps'),
});

export const AssessmentRemediationQueueSchema = z.object({
  type: z.literal('AssessmentRemediationQueue'),
  frameworkId: AssessmentFrameworkSchema.describe('Assessment-capable framework identifier'),
  assessmentId: z.string().optional().describe('Optional specific assessment ID; latest matching assessment is used when omitted'),
  baseline: AssessmentBaselineSchema.optional().describe('Target baseline or impact level'),
  limit: z.number().min(1).max(100).default(12).describe('Maximum remediation items to display'),
  groupBy: z.enum(['status', 'family', 'owner', 'none']).default('status').describe('How to group remediation work'),
  includeStatuses: z.array(ImplementationStatusSchema).default([
    'not-implemented',
    'partially-implemented',
    'planned',
    'not-assessed',
  ]).describe('Statuses to include in remediation planning'),
  showOwners: z.boolean().default(true).describe('Show owner or unassigned badges'),
  showNotes: z.boolean().default(true).describe('Show note previews and note gaps'),
});

export const AssessmentEvidenceQueueSchema = z.object({
  type: z.literal('AssessmentEvidenceQueue'),
  frameworkId: AssessmentFrameworkSchema.describe('Assessment-capable framework identifier'),
  assessmentId: z.string().optional().describe('Optional specific assessment ID; latest matching assessment is used when omitted'),
  baseline: AssessmentBaselineSchema.optional().describe('Target baseline or impact level'),
  limit: z.number().min(1).max(100).default(12).describe('Maximum evidence items to display'),
  groupBy: z.enum(['status', 'family', 'none']).default('status').describe('How to group evidence work'),
  includeStatuses: z.array(ImplementationStatusSchema).default([
    'not-assessed',
    'not-implemented',
    'partially-implemented',
    'planned',
  ]).describe('Statuses to include in evidence collection'),
  showEvidenceHighlights: z.boolean().default(true).describe('Show evidence hints or interview topics'),
  showNotes: z.boolean().default(true).describe('Show note previews and missing-note badges'),
});

export const ASSESSMENT_COMPONENT_REFERENCE = `
#### AssessmentOverview
Display a summary of the latest matching assessment for an assessment-capable framework. Use this for readiness snapshots, audit prep summaries, or "where do we stand?" requests.
\`\`\`json
{
  "type": "AssessmentOverview",
  "frameworkId": "fedramp-rev5",
  "baseline": "moderate",
  "showStatusBreakdown": true,
  "showMetadata": true
}
\`\`\`

#### AssessmentFamilyBreakdown
Display family-level readiness, sorted by lowest readiness first by default. Useful for "which families need the most work?" requests.
\`\`\`json
{
  "type": "AssessmentFamilyBreakdown",
  "frameworkId": "fedramp-rev5",
  "baseline": "moderate",
  "limit": 12,
  "sortBy": "readiness"
}
\`\`\`

#### AssessmentGapsList
Display prioritized controls that are still open in an assessment. Use this for remediation planning and gap-review requests.
\`\`\`json
{
  "type": "AssessmentGapsList",
  "frameworkId": "fedramp-rev5",
  "baseline": "moderate",
  "groupBy": "status",
  "limit": 15,
  "includeStatuses": ["not-assessed", "not-implemented", "partially-implemented", "planned"]
}
\`\`\`

#### AssessmentRemediationQueue
Display an operator-focused remediation queue with ownership, note gaps, and action context for open controls.
\`\`\`json
{
  "type": "AssessmentRemediationQueue",
  "frameworkId": "fedramp-rev5",
  "baseline": "moderate",
  "groupBy": "status",
  "limit": 12,
  "showOwners": true,
  "showNotes": true
}
\`\`\`

#### AssessmentEvidenceQueue
Display an evidence collection queue with interview topics, AIUC evidence items, and controls that still need notes.
\`\`\`json
{
  "type": "AssessmentEvidenceQueue",
  "frameworkId": "fedramp-rev5",
  "baseline": "moderate",
  "groupBy": "status",
  "limit": 12,
  "showEvidenceHighlights": true,
  "showNotes": true
}
\`\`\`
`;
