import { z } from 'zod';

export const TrustCenterCardSchema = z.object({
  type: z.literal('TrustCenterCard'),
  name: z.string().describe('Trust center component name'),
  category: z.string().describe('Component category'),
  description: z.string().describe('Short description of what to show'),
  examples: z.array(z.string()).optional().describe('Optional concrete examples'),
  evidenceExamples: z.array(z.string()).optional().describe('Optional evidence examples'),
  validationHint: z.string().optional().describe('Optional validation or review hint'),
});

export const TrustCenterGridSchema = z.object({
  type: z.literal('TrustCenterGrid'),
  ksiId: z.string().optional().describe('Optional KSI ID to auto-load trust center components for'),
  implementationInsight: z.string().optional().describe('Optional context about what the trust center should emphasize'),
  components: z.array(TrustCenterCardSchema.omit({ type: true })).optional().describe('Optional custom trust center components'),
  groupBy: z.enum(['category']).default('category').describe('How to group components'),
});

export const TrustCenterChecklistSchema = z.object({
  type: z.literal('TrustCenterChecklist'),
  title: z.string().describe('Checklist title'),
  items: z.array(z.object({
    name: z.string().describe('Checklist item name'),
    category: z.string().describe('Item category'),
    status: z.enum(['not-started', 'in-progress', 'complete']).default('not-started'),
  })).describe('Checklist items'),
});

export const KSIProgrammaticQueryGridSchema = z.object({
  type: z.literal('KSIProgrammaticQueryGrid'),
  ksiId: z.string().describe('KSI ID to auto-load programmatic queries for (e.g., "KSI-IAM-APM")'),
});

export const KSIAssessmentTopicsGridSchema = z.object({
  type: z.literal('KSIAssessmentTopicsGrid'),
  ksiId: z.string().describe('KSI ID to auto-load assessment topics for (e.g., "KSI-IAM-APM")'),
});

export const KSIRequirementsGridSchema = z.object({
  type: z.literal('KSIRequirementsGrid'),
  ksiId: z.string().describe('KSI ID to auto-load FRMR requirements for (e.g., "KSI-IAM-APM")'),
  filter: z.enum(['all', 'must', 'should', 'may']).default('all').describe('Filter by requirement level'),
});

export const KSI_COMPONENT_REFERENCE = `
#### TrustCenterCard
Display a single trust center component suggestion.
\`\`\`json
{
  "type": "TrustCenterCard",
  "name": "Penetration Test Summary",
  "category": "documents-reports",
  "description": "Provide an executive summary of recent independent testing"
}
\`\`\`

#### TrustCenterGrid
Display a grid of trust center components, optionally auto-loaded from a KSI ID.
\`\`\`json
{
  "type": "TrustCenterGrid",
  "ksiId": "KSI-IAM-APM",
  "groupBy": "category"
}
\`\`\`
Or provide custom items:
\`\`\`json
{
  "type": "TrustCenterGrid",
  "components": [
    {
      "name": "Security Whitepaper",
      "category": "documents-reports",
      "description": "Overview of security architecture"
    }
  ]
}
\`\`\`

#### TrustCenterChecklist
Interactive checklist for planning trust center content.
\`\`\`json
{
  "type": "TrustCenterChecklist",
  "title": "FedRAMP Trust Center",
  "items": [
    { "name": "FedRAMP authorization package", "category": "certifications-badges", "status": "complete" },
    { "name": "Security architecture diagrams", "category": "architecture-diagrams", "status": "in-progress" }
  ]
}
\`\`\`

#### KSIProgrammaticQueryGrid
Display CLI commands and checks for verifying a FedRAMP 20x KSI.
\`\`\`json
{
  "type": "KSIProgrammaticQueryGrid",
  "ksiId": "KSI-IAM-APM"
}
\`\`\`

#### KSIAssessmentTopicsGrid
Display 20x assessment focus areas and interview topics for a KSI.
\`\`\`json
{
  "type": "KSIAssessmentTopicsGrid",
  "ksiId": "KSI-IAM-APM"
}
\`\`\`

#### KSIRequirementsGrid
Display FRMR MUST/SHOULD/MAY requirements for AFR-family KSIs.
\`\`\`json
{
  "type": "KSIRequirementsGrid",
  "ksiId": "KSI-IAM-APM",
  "filter": "must"
}
\`\`\`
`;
