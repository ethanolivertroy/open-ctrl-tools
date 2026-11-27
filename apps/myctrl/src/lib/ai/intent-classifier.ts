/**
 * Intent Classifier for Browser Models
 *
 * Small LLMs classify user queries into structured intents,
 * then deterministic code builds Views from real framework data.
 * This bridges the gap between tiny models and the rich ViewSchema.
 */

import { getFrameworkConfig, getAllFrameworkIds } from '@/data/frameworks';
import type { AIContext } from '@/lib/ai-data-context';
import {
  isAssessmentFrameworkId,
  type AssessmentFrameworkId,
} from '@/lib/assessment-frameworks';

// ============================================================================
// Types
// ============================================================================

export type IntentType =
  | 'show_framework'
  | 'list_controls'
  | 'compare_frameworks'
  | 'show_control'
  | 'show_crosswalks'
  | 'show_assessment_overview'
  | 'show_assessment_gaps'
  | 'show_assessment_remediation'
  | 'show_assessment_evidence'
  | 'show_assessment_workbench'
  | 'explain';

export interface ClassifiedIntent {
  intent: IntentType;
  frameworks?: string[];
  controlId?: string;
  assessmentId?: string;
  family?: string;
  baseline?: string;
  severity?: string;
  riskTier?: string;
  searchQuery?: string;
}

// ============================================================================
// Framework Reference (compact, for the classifier prompt)
// ============================================================================

/** Build a compact framework reference for the classifier prompt. */
function buildFrameworkReference(): string {
  const ids = getAllFrameworkIds();
  const entries: string[] = [];
  for (const id of ids) {
    const config = getFrameworkConfig(id);
    if (config && !config.tags?.includes('TBD')) {
      entries.push(`${id} (${config.name})`);
    }
  }
  return entries.join(', ');
}

// ============================================================================
// Classifier Prompt
// ============================================================================

/** Generate the intent classifier system prompt. Called once, cached. */
let _cachedPrompt: string | null = null;

export function getClassifierPrompt(): string {
  if (_cachedPrompt) return _cachedPrompt;

  const frameworkRef = buildFrameworkReference();

  _cachedPrompt = `You classify user queries about compliance and security frameworks into structured intents.

Available framework IDs:
${frameworkRef}

Common family abbreviations: AC (Access Control), AU (Audit), CA (Assessment), CM (Configuration), CP (Contingency), IA (Identification), IR (Incident Response), MA (Maintenance), MP (Media Protection), PE (Physical), PL (Planning), PM (Program Management), PS (Personnel), RA (Risk Assessment), SA (System Acquisition), SC (System Communications), SI (System Information)

Respond with ONLY a JSON object. No markdown, no explanation.

Intent types:
- "show_framework": User wants an overview of a framework
- "list_controls": User wants to see controls, possibly filtered by family/baseline/severity
- "compare_frameworks": User wants to compare 2+ frameworks
- "show_control": User asks about a specific control by ID (e.g., AC-2, 6.1.1)
- "show_crosswalks": User wants to see how controls map across frameworks
- "show_assessment_overview": User wants readiness, coverage, or assessment summary for a framework/baseline
- "show_assessment_gaps": User wants open gaps, remediation priorities, blockers, or evidence gaps for an assessment
- "show_assessment_remediation": User wants remediation queues, owner assignments, unassigned work, or action-oriented assessment work
- "show_assessment_evidence": User wants evidence prep, artifacts, auditor expectations, interview prep, or documentation queues for an assessment
- "show_assessment_workbench": User wants a full assessment workbench combining readiness, family breakdown, and priority gaps
- "explain": General question, no specific framework lookup needed

JSON format:
{"intent":"...","frameworks":["framework-id"],"controlId":"AC-2","family":"AC","baseline":"moderate"}

Only include fields relevant to the query. Always use exact framework IDs from the list above.`;

  return _cachedPrompt;
}

// ============================================================================
// Intent Parser
// ============================================================================

/** Common aliases for framework names → IDs. */
const FRAMEWORK_ALIASES: Record<string, string> = {
  'fedramp': 'fedramp-rev5',
  'fed ramp': 'fedramp-rev5',
  'nist': 'nist-800-53-r5',
  'nist 800-53': 'nist-800-53-r5',
  'nist 800 53': 'nist-800-53-r5',
  'pci': 'pci-dss-v4',
  'pci dss': 'pci-dss-v4',
  'iso 27001': 'iso-27001-2022',
  'iso27001': 'iso-27001-2022',
  'soc2': 'soc2-tsc',
  'soc 2': 'soc2-tsc',
  'cis': 'cis-controls-v8',
  'cis controls': 'cis-controls-v8',
  'cmmc': 'cmmc-v2',
  'cmmc 2.0': 'cmmc-v2',
  'cmmc 2': 'cmmc-v2',
  'csf': 'nist-csf-v2',
  'nist csf': 'nist-csf-v2',
  'ai rmf': 'nist-ai-rmf',
  'nist ai rmf': 'nist-ai-rmf',
  'eu ai act': 'eu-ai-act',
  'gdpr': 'gdpr',
  'ccpa': 'ccpa',
  'hipaa': 'hipaa-security',
  'fedramp 20x': 'fedramp-20x-ksi',
  '20x': 'fedramp-20x-ksi',
  'aiuc': 'aiuc-1',
  'aiuc-1': 'aiuc-1',
  'dod srg': 'dod-srg',
  'srg': 'dod-srg',
};

/** Resolve a potentially fuzzy framework name to an exact ID. */
function resolveFrameworkId(name: string): string | null {
  const lower = name.toLowerCase().trim();

  // Exact match
  const allIds = getAllFrameworkIds();
  if (allIds.includes(lower)) return lower;

  // Alias match
  if (FRAMEWORK_ALIASES[lower]) return FRAMEWORK_ALIASES[lower];

  // Partial match
  const match = allIds.find(id => id.includes(lower) || lower.includes(id));
  return match || null;
}

function normalizeBaselineToken(value?: string | null): string | undefined {
  if (!value) return undefined;

  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-');

  const baselineMap: Record<string, string> = {
    low: 'low',
    moderate: 'moderate',
    high: 'high',
    'li-saas': 'li_saas',
    'level-1': 'level-1',
    'level-2': 'level-2',
    'level-3': 'level-3',
    'il4-mod': 'il4-mod',
    'il4-moderate': 'il4-mod',
    'il-4-mod': 'il4-mod',
    'il-4-moderate': 'il4-mod',
    'il4': 'il4-mod',
    'il-4': 'il4-mod',
    'il4-high': 'il4-high',
    'il-4-high': 'il4-high',
    il5: 'il5',
    'il-5': 'il5',
    il6: 'il6',
    'il-6': 'il6',
  };

  return baselineMap[normalized];
}

function extractBaselineFromQuery(query: string): string | undefined {
  const lower = query.toLowerCase();

  if (/\blevel[\s-]?1\b/.test(lower)) return 'level-1';
  if (/\blevel[\s-]?2\b/.test(lower)) return 'level-2';
  if (/\blevel[\s-]?3\b/.test(lower)) return 'level-3';
  if (/\bli[\s-_]?saas\b/.test(lower)) return 'li_saas';
  if (/\bil[\s-]?4\b/.test(lower) && /\bhigh\b/.test(lower)) return 'il4-high';
  if (/\bil[\s-]?4\b/.test(lower)) return 'il4-mod';
  if (/\bil[\s-]?5\b/.test(lower)) return 'il5';
  if (/\bil[\s-]?6\b/.test(lower)) return 'il6';
  if (/\blow\b/.test(lower)) return 'low';
  if (/\bmoderate\b/.test(lower)) return 'moderate';
  if (/\bhigh\b/.test(lower)) return 'high';

  return undefined;
}

function resolveAssessmentFramework(
  query: string,
  context?: AIContext,
): AssessmentFrameworkId | null {
  if (context?.frameworkId && isAssessmentFrameworkId(context.frameworkId)) {
    return context.frameworkId;
  }

  const lower = query.toLowerCase();
  if (lower.includes('cmmc')) return 'cmmc-v2';
  if (lower.includes('aiuc')) return 'aiuc-1';
  if (lower.includes('20x')) return 'fedramp-20x-ksi';
  if (lower.includes('dod') && (lower.includes('srg') || /\bil[\s-]?[456]\b/.test(lower))) {
    return 'dod-srg';
  }
  if (lower.includes('fedramp')) return 'fedramp-rev5';

  return null;
}

function inferAssessmentIntent(
  query: string,
  context?: AIContext,
): ClassifiedIntent | null {
  const lower = query.toLowerCase().trim();
  const frameworkId = resolveAssessmentFramework(lower, context);
  if (!frameworkId) return null;

  const hasAssessmentSignals = !!context?.assessmentId || [
    'assessment',
    'readiness',
    'remediation',
    'gap',
    'gaps',
    'missing',
    'blocker',
    'blockers',
    'evidence',
    'workbench',
    'coverage',
    'status',
    'family',
    'families',
  ].some(term => lower.includes(term));

  if (!hasAssessmentSignals) return null;

  const baseline = normalizeBaselineToken(extractBaselineFromQuery(lower) ?? context?.baseline);
  const assessmentId = context?.assessmentId;

  let intent: IntentType = 'show_assessment_workbench';
  if (lower.includes('workbench')) {
    intent = 'show_assessment_workbench';
  } else if ([
    'owner',
    'owners',
    'assigned',
    'assignment',
    'unassigned',
    'accountable',
  ].some(term => lower.includes(term))) {
    intent = 'show_assessment_remediation';
  } else if ([
    'artifact',
    'artifacts',
    'evidence',
    'interview',
    'interviews',
    'document',
    'documentation',
    'auditor',
    'audit prep',
  ].some(term => lower.includes(term))) {
    intent = 'show_assessment_evidence';
  } else if ([
    'gap',
    'gaps',
    'missing',
    'remediation',
    'priority',
    'priorities',
    'blocker',
    'blockers',
    'evidence',
  ].some(term => lower.includes(term))) {
    intent = 'show_assessment_gaps';
  } else if ([
    'overview',
    'summary',
    'readiness',
    'coverage',
    'status',
  ].some(term => lower.includes(term))) {
    intent = 'show_assessment_overview';
  }

  return {
    intent,
    frameworks: [frameworkId],
    assessmentId,
    baseline,
  };
}

/**
 * Parse LLM output into a ClassifiedIntent.
 * Handles JSON embedded in markdown fences, extra text, etc.
 */
export function parseIntent(
  text: string,
  fallbackQuery?: string,
  context?: AIContext,
): ClassifiedIntent | null {
  const heuristicIntent = fallbackQuery
    ? inferAssessmentIntent(fallbackQuery, context)
    : null;

  if (!text || text.trim().length < 5) return heuristicIntent;

  try {
    // Try to extract JSON from the response
    let jsonStr = text.trim();

    // Strip markdown code fences
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();

    // Find first { ... } block
    const braceStart = jsonStr.indexOf('{');
    const braceEnd = jsonStr.lastIndexOf('}');
    if (braceStart === -1 || braceEnd === -1) return heuristicIntent;
    jsonStr = jsonStr.slice(braceStart, braceEnd + 1);

    const parsed = JSON.parse(jsonStr);

    // Validate intent type
    const validIntents: IntentType[] = [
      'show_framework', 'list_controls', 'compare_frameworks',
      'show_control', 'show_crosswalks', 'show_assessment_overview',
      'show_assessment_gaps', 'show_assessment_remediation',
      'show_assessment_evidence', 'show_assessment_workbench', 'explain',
    ];
    if (!parsed.intent || !validIntents.includes(parsed.intent)) {
      return heuristicIntent;
    }

    // Resolve framework IDs
    const frameworks = (parsed.frameworks || [])
      .map((f: string) => resolveFrameworkId(f))
      .filter(Boolean) as string[];
    const result: ClassifiedIntent = {
      intent: parsed.intent,
      frameworks: frameworks.length > 0 ? frameworks : undefined,
      controlId: parsed.controlId || undefined,
      assessmentId: parsed.assessmentId || context?.assessmentId || undefined,
      family: parsed.family?.toUpperCase() || undefined,
      baseline: normalizeBaselineToken(parsed.baseline) || undefined,
      severity: parsed.severity?.toUpperCase() || undefined,
      riskTier: parsed.riskTier?.toLowerCase() || undefined,
      searchQuery: parsed.searchQuery || undefined,
    };

    if (
      heuristicIntent
      && (
        result.intent === 'explain'
        || result.intent === 'show_framework'
        || result.intent === 'list_controls'
      )
    ) {
      return heuristicIntent;
    }

    if (
      (result.intent === 'show_assessment_overview'
        || result.intent === 'show_assessment_gaps'
        || result.intent === 'show_assessment_remediation'
        || result.intent === 'show_assessment_evidence'
        || result.intent === 'show_assessment_workbench')
      && (!result.frameworks || result.frameworks.length === 0)
      && heuristicIntent
    ) {
      return {
        ...heuristicIntent,
        ...result,
        frameworks: heuristicIntent.frameworks,
        baseline: result.baseline || heuristicIntent.baseline,
      };
    }

    return result;
  } catch {
    return heuristicIntent;
  }
}
