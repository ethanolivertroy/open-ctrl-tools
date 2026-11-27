/**
 * View Template Builders
 *
 * Deterministic functions that build View objects from real framework data.
 * Used by the hybrid intent classifier — the LLM classifies intent,
 * these functions build the actual View from src/data/*.json.
 *
 * Note: Component objects are cast to `any` before pushing to the components
 * array because the View type uses a strict discriminated Zod union with 19+
 * types, making manual TypeScript construction verbose. The json-render
 * Renderer validates components at render time.
 */

import {
  getAllControls,
  getControlById,
  getControlsByFamily,
  getAllFamilies,
  getStats,
} from '@/data/controls';
import { getFrameworkConfig } from '@/data/frameworks';
import { hasCrossFrameworkMappings } from '@/data/crosswalk';
import type { AIContext } from '@/lib/ai-data-context';
import {
  getAssessmentLabel,
  isAssessmentFrameworkId,
  type AssessmentFrameworkId,
} from '@/lib/assessment-frameworks';
import type { View, Component } from '@/lib/json-render/catalog';
import type { ClassifiedIntent } from './intent-classifier';

// ============================================================================
// Main Dispatcher
// ============================================================================

/**
 * Build a View from a classified intent. Returns null if the intent
 * can't be resolved (e.g., invalid framework ID).
 */
export function buildFromIntent(
  intent: ClassifiedIntent,
  context?: AIContext,
): View | null {
  try {
    switch (intent.intent) {
      case 'show_framework':
        return intent.frameworks?.[0]
          ? buildFrameworkOverview(intent.frameworks[0])
          : null;

      case 'list_controls':
        return intent.frameworks?.[0]
          ? buildControlList(intent.frameworks[0], {
              family: intent.family,
              baseline: intent.baseline,
              searchQuery: intent.searchQuery,
            })
          : null;

      case 'compare_frameworks':
        return intent.frameworks && intent.frameworks.length >= 2
          ? buildCompareFrameworks(intent.frameworks)
          : null;

      case 'show_control':
        return intent.frameworks?.[0] && intent.controlId
          ? buildControlDetail(intent.frameworks[0], intent.controlId)
          : null;

      case 'show_crosswalks':
        return intent.frameworks?.[0] && intent.controlId
          ? buildCrosswalkView(intent.frameworks[0], intent.controlId)
          : null;

      case 'show_assessment_overview':
        return buildAssessmentOverviewView(intent, context);

      case 'show_assessment_gaps':
        return buildAssessmentGapsView(intent, context);

      case 'show_assessment_remediation':
        return buildAssessmentRemediationView(intent, context);

      case 'show_assessment_evidence':
        return buildAssessmentEvidenceView(intent, context);

      case 'show_assessment_workbench':
        return buildAssessmentWorkbenchView(intent, context);

      case 'explain':
      default:
        return null;
    }
  } catch {
    return null;
  }
}

// ============================================================================
// Helper to build component objects (bypasses strict union typing)
// ============================================================================

function comp(obj: Record<string, any>): Component {
  return obj as Component;
}

function resolveAssessmentIntentContext(
  intent: ClassifiedIntent,
  context?: AIContext,
): {
  frameworkId: AssessmentFrameworkId;
  baseline?: string;
  assessmentId?: string;
} | null {
  const candidateFramework = intent.frameworks?.[0] ?? context?.frameworkId;
  if (!candidateFramework || !isAssessmentFrameworkId(candidateFramework)) {
    return null;
  }

  return {
    frameworkId: candidateFramework,
    baseline: intent.baseline ?? context?.baseline,
    assessmentId: intent.assessmentId ?? context?.assessmentId,
  };
}

// ============================================================================
// Template Builders
// ============================================================================

/** Show a framework overview with stats. */
function buildFrameworkOverview(frameworkId: string): View | null {
  const config = getFrameworkConfig(frameworkId);
  if (!config) return null;

  const families = getAllFamilies(frameworkId);
  const allControls = getAllControls(frameworkId);
  const stats = getStats(frameworkId);

  const components: Component[] = [
    comp({
      type: 'FrameworkCard',
      frameworkId,
      showStats: true,
      showDescription: true,
      variant: 'detailed',
    }),
  ];

  // Key metrics
  const statCards: Component[] = [
    comp({ type: 'StatCard', title: 'Total Controls', value: String(allControls.length) }),
    comp({ type: 'StatCard', title: 'Families', value: String(families.length) }),
  ];

  // Add baseline counts if the framework has them
  if (config.hasBaselines && stats) {
    if (stats.low) statCards.push(comp({ type: 'StatCard', title: 'Low Baseline', value: String(stats.low) }));
    if (stats.moderate) statCards.push(comp({ type: 'StatCard', title: 'Moderate Baseline', value: String(stats.moderate) }));
    if (stats.high) statCards.push(comp({ type: 'StatCard', title: 'High Baseline', value: String(stats.high) }));
  }

  components.push(comp({
    type: 'Section',
    title: 'Key Metrics',
    children: statCards,
  }));

  // Family overview (top 15)
  if (families.length > 0 && families.length <= 25) {
    components.push(comp({
      type: 'Section',
      title: `${config.familyLabel || 'Family'} Overview`,
      children: families.slice(0, 15).map(fam =>
        comp({ type: 'StatCard', title: fam, value: String(getControlsByFamily(frameworkId, fam).length) })
      ),
    }));
  }

  return {
    title: config.name,
    description: config.description,
    components,
  };
}

/** List controls filtered by family and/or baseline. */
function buildControlList(
  frameworkId: string,
  filters: { family?: string; baseline?: string; searchQuery?: string },
): View | null {
  const config = getFrameworkConfig(frameworkId);
  if (!config) return null;

  const controlListFilters: Record<string, string> = {};
  if (filters.family) controlListFilters.family = filters.family;
  if (filters.baseline) controlListFilters.baseline = filters.baseline.toLowerCase();
  if (filters.searchQuery) controlListFilters.searchQuery = filters.searchQuery;

  let title = config.name;
  const filterParts: string[] = [];
  if (filters.family) filterParts.push(`${filters.family} family`);
  if (filters.baseline) filterParts.push(`${filters.baseline} baseline`);
  if (filterParts.length > 0) title += ` — ${filterParts.join(', ')}`;

  const components: Component[] = [
    comp({
      type: 'ControlList',
      frameworkId,
      filters: Object.keys(controlListFilters).length > 0 ? controlListFilters : undefined,
      groupBy: 'family',
      limit: 25,
      variant: 'compact',
    }),
  ];

  return {
    title,
    description: `Controls from ${config.name}${filterParts.length > 0 ? ` filtered by ${filterParts.join(' and ')}` : ''}`,
    components,
  };
}

/** Compare two or more frameworks side by side. */
function buildCompareFrameworks(frameworkIds: string[]): View | null {
  const configs = frameworkIds
    .map(id => getFrameworkConfig(id))
    .filter(Boolean);

  if (configs.length < 2) return null;

  const components: Component[] = [];

  // Framework cards
  components.push(comp({
    type: 'Section',
    title: 'Framework Overview',
    children: frameworkIds.map(id =>
      comp({ type: 'FrameworkCard', frameworkId: id, showStats: true, showDescription: true, variant: 'detailed' })
    ),
  }));

  // Comparison stats
  const comparisonChildren: Component[] = [];
  for (const id of frameworkIds) {
    const allControls = getAllControls(id);
    const families = getAllFamilies(id);
    const c = getFrameworkConfig(id)!;
    comparisonChildren.push(comp({
      type: 'Section',
      title: c.name,
      children: [
        comp({ type: 'StatCard', title: 'Controls', value: String(allControls.length) }),
        comp({ type: 'StatCard', title: 'Families', value: String(families.length) }),
      ],
    }));
  }

  components.push(comp({
    type: 'Section',
    title: 'Comparison',
    children: comparisonChildren,
  }));

  const names = configs.map(c => c!.name);
  return {
    title: `Comparing ${names.join(' vs ')}`,
    description: `Side-by-side comparison of ${names.join(', ')}`,
    components,
  };
}

/** Show a specific control with crosswalk mappings. */
function buildControlDetail(frameworkId: string, controlId: string): View | null {
  const config = getFrameworkConfig(frameworkId);
  if (!config) return null;

  const control = getControlById(frameworkId, controlId);
  if (!control) return null;

  const cid = control.control_id;

  const components: Component[] = [
    comp({
      type: 'ControlCard',
      frameworkId,
      controlId: cid,
      variant: 'full',
      showBadges: true,
      showDescription: true,
    }),
  ];

  if (hasCrossFrameworkMappings(cid, frameworkId)) {
    components.push(comp({
      type: 'CrosswalkDisplay',
      sourceFramework: frameworkId,
      sourceControl: cid,
    }));
  }

  return {
    title: `${cid}: ${control.title}`,
    description: `${config.name} control details`,
    components,
  };
}

/** Show crosswalk mappings for a control. */
function buildCrosswalkView(frameworkId: string, controlId: string): View | null {
  const config = getFrameworkConfig(frameworkId);
  if (!config) return null;

  const control = getControlById(frameworkId, controlId);
  if (!control) return null;

  const cid = control.control_id;

  if (!hasCrossFrameworkMappings(cid, frameworkId)) {
    return {
      title: `${cid} — Cross-Framework Mappings`,
      components: [
        comp({
          type: 'TextBlock',
          content: `No cross-framework mappings are available for ${cid} in ${config.name}.`,
          variant: 'info',
        }),
      ],
    };
  }

  return {
    title: `${cid} — Cross-Framework Mappings`,
    description: `How ${cid} maps to controls in other frameworks`,
    components: [
      comp({
        type: 'CrosswalkDisplay',
        sourceFramework: frameworkId,
        sourceControl: cid,
      }),
    ],
  };
}

function buildAssessmentOverviewView(
  intent: ClassifiedIntent,
  context?: AIContext,
): View | null {
  const resolved = resolveAssessmentIntentContext(intent, context);
  if (!resolved) return null;

  const label = getAssessmentLabel(resolved.frameworkId, resolved.baseline);

  return {
    title: `${label} Assessment Overview`,
    description: `Readiness and family-level coverage for ${label}`,
    components: [
      comp({
        type: 'AssessmentOverview',
        frameworkId: resolved.frameworkId,
        assessmentId: resolved.assessmentId,
        baseline: resolved.baseline,
        showStatusBreakdown: true,
        showMetadata: true,
      }),
      comp({
        type: 'AssessmentFamilyBreakdown',
        frameworkId: resolved.frameworkId,
        assessmentId: resolved.assessmentId,
        baseline: resolved.baseline,
        limit: 12,
        sortBy: 'readiness',
      }),
    ],
  };
}

function buildAssessmentGapsView(
  intent: ClassifiedIntent,
  context?: AIContext,
): View | null {
  const resolved = resolveAssessmentIntentContext(intent, context);
  if (!resolved) return null;

  const label = getAssessmentLabel(resolved.frameworkId, resolved.baseline);

  return {
    title: `${label} Priority Gaps`,
    description: `Remediation-oriented view for the highest-priority gaps in ${label}`,
    components: [
      comp({
        type: 'AssessmentOverview',
        frameworkId: resolved.frameworkId,
        assessmentId: resolved.assessmentId,
        baseline: resolved.baseline,
        showStatusBreakdown: false,
        showMetadata: true,
      }),
      comp({
        type: 'AssessmentRemediationQueue',
        frameworkId: resolved.frameworkId,
        assessmentId: resolved.assessmentId,
        baseline: resolved.baseline,
        limit: 20,
        groupBy: 'status',
      }),
      comp({
        type: 'AssessmentEvidenceQueue',
        frameworkId: resolved.frameworkId,
        assessmentId: resolved.assessmentId,
        baseline: resolved.baseline,
        limit: 12,
        groupBy: 'status',
      }),
    ],
  };
}

function buildAssessmentRemediationView(
  intent: ClassifiedIntent,
  context?: AIContext,
): View | null {
  const resolved = resolveAssessmentIntentContext(intent, context);
  if (!resolved) return null;

  const label = getAssessmentLabel(resolved.frameworkId, resolved.baseline);

  return {
    title: `${label} Remediation Queue`,
    description: `Owner-aware remediation queue for the open controls in ${label}`,
    components: [
      comp({
        type: 'TextBlock',
        content: `This view groups open **${label}** work by owner so operators can spot unassigned controls, overloaded owners, and the next remediation actions.`,
        variant: 'info',
      }),
      comp({
        type: 'AssessmentOverview',
        frameworkId: resolved.frameworkId,
        assessmentId: resolved.assessmentId,
        baseline: resolved.baseline,
        showStatusBreakdown: false,
        showMetadata: true,
      }),
      comp({
        type: 'AssessmentRemediationQueue',
        frameworkId: resolved.frameworkId,
        assessmentId: resolved.assessmentId,
        baseline: resolved.baseline,
        limit: 28,
        groupBy: 'owner',
        showOwners: true,
        showNotes: true,
      }),
      comp({
        type: 'AssessmentRemediationQueue',
        frameworkId: resolved.frameworkId,
        assessmentId: resolved.assessmentId,
        baseline: resolved.baseline,
        limit: 16,
        groupBy: 'status',
        showOwners: true,
        showNotes: false,
      }),
    ],
  };
}

function buildAssessmentEvidenceView(
  intent: ClassifiedIntent,
  context?: AIContext,
): View | null {
  const resolved = resolveAssessmentIntentContext(intent, context);
  if (!resolved) return null;

  const label = getAssessmentLabel(resolved.frameworkId, resolved.baseline);

  return {
    title: `${label} Evidence Prep`,
    description: `Evidence and interview-prep queue for the open controls in ${label}`,
    components: [
      comp({
        type: 'TextBlock',
        content: `This view prioritizes **${label}** evidence collection, auditor-facing artifacts, and interview prep for controls that still need proof or documentation.`,
        variant: 'info',
      }),
      comp({
        type: 'AssessmentOverview',
        frameworkId: resolved.frameworkId,
        assessmentId: resolved.assessmentId,
        baseline: resolved.baseline,
        showStatusBreakdown: false,
        showMetadata: true,
      }),
      comp({
        type: 'AssessmentEvidenceQueue',
        frameworkId: resolved.frameworkId,
        assessmentId: resolved.assessmentId,
        baseline: resolved.baseline,
        limit: 24,
        groupBy: 'family',
        showEvidenceHighlights: true,
        showNotes: true,
      }),
      comp({
        type: 'AssessmentEvidenceQueue',
        frameworkId: resolved.frameworkId,
        assessmentId: resolved.assessmentId,
        baseline: resolved.baseline,
        limit: 16,
        groupBy: 'status',
        showEvidenceHighlights: false,
        showNotes: false,
      }),
    ],
  };
}

function buildAssessmentWorkbenchView(
  intent: ClassifiedIntent,
  context?: AIContext,
): View | null {
  const resolved = resolveAssessmentIntentContext(intent, context);
  if (!resolved) return null;

  const label = getAssessmentLabel(resolved.frameworkId, resolved.baseline);

  return {
    title: `${label} Assessment Workbench`,
    description: `Assessment-native workbench for readiness, family breakdown, and priority gaps in ${label}`,
    components: [
      comp({
        type: 'TextBlock',
        content: `This workbench focuses on **${label}** readiness, the weakest control families, and the highest-priority gaps that still need remediation or evidence.`,
        variant: 'info',
      }),
      comp({
        type: 'AssessmentOverview',
        frameworkId: resolved.frameworkId,
        assessmentId: resolved.assessmentId,
        baseline: resolved.baseline,
        showStatusBreakdown: true,
        showMetadata: true,
      }),
      comp({
        type: 'AssessmentFamilyBreakdown',
        frameworkId: resolved.frameworkId,
        assessmentId: resolved.assessmentId,
        baseline: resolved.baseline,
        limit: 10,
        sortBy: 'readiness',
      }),
      comp({
        type: 'AssessmentRemediationQueue',
        frameworkId: resolved.frameworkId,
        assessmentId: resolved.assessmentId,
        baseline: resolved.baseline,
        limit: 14,
        groupBy: 'status',
      }),
      comp({
        type: 'AssessmentEvidenceQueue',
        frameworkId: resolved.frameworkId,
        assessmentId: resolved.assessmentId,
        baseline: resolved.baseline,
        limit: 10,
        groupBy: 'status',
      }),
    ],
  };
}
