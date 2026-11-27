/**
 * FILTER_CONFIGS — single source of truth for the per-framework filter route
 * trees (e.g. /frameworks/nist-800-53-r5/baseline/low). Each thin route file
 * under src/pages/frameworks/<id>/<dimension>/ delegates to FilterPage.astro,
 * which renders entirely from this config.
 *
 * URL parity matters: `dimension` + `levels[].param` must reproduce the exact
 * URLs the old copy-paste route files emitted.
 */
import type {
  BaselineLevel,
  CMMCLevel,
  Control,
  DoDImpactLevel,
  EURiskTier,
  ImpactLevel,
  ImplementationGroup,
  ITSG33Profile,
  SeverityLevel,
} from '@/data/types';
import {
  getControlsByBaseline,
  getControlsByCMMCLevel,
  getControlsByDoDImpactLevel,
  getControlsByIG,
  getControlsByImpactLevel,
  getControlsByITSG33Profile,
  getControlsByRiskTier,
  getControlsBySeverity,
  getStats,
  hasFrameworkData,
} from '@/data/controls';

export type FrameworkStatKey = keyof ReturnType<typeof getStats>;

export interface FilterLevel {
  /** URL param value, e.g. 'low', 'cat-i', '1' */
  param: string;
  /** <title> for the page */
  pageTitle: string;
  /** Final breadcrumb segment */
  breadcrumbLabel: string;
  /** Colored name in the "Showing N ..." line */
  displayName: string;
  /** CSS color for the "Showing" line */
  color: string;
  /** Badge text */
  badgeLabel: string;
  /** Badge classes when this level is active */
  badgeActiveClass: string;
  /** Badge classes when this level is inactive */
  badgeInactiveClass: string;
  /** Key into getStats() for the badge count */
  statKey: FrameworkStatKey;
  /** Hide the badge when its stat is 0 or undefined (CMMC Level 3) */
  hideBadgeWhenEmpty?: boolean;
  /** Italic description rendered under the "Showing" line */
  description?: string;
}

export interface FilterConfig {
  /** Route param name used by the [param].astro filename ('level' or 'tier') */
  paramName: string;
  /** URL dimension segment, e.g. 'baseline' in /frameworks/x/baseline/low */
  dimension: string;
  /** H1 text, with the accent rendered in the primary color */
  heading: string;
  headingAccent: string;
  /** Paragraph under the H1 */
  subtitle: string;
  /** Framework link label in the breadcrumb */
  breadcrumbFrameworkLabel: string;
  /** Second breadcrumb segment (defaults to a plain "Frameworks" span) */
  breadcrumbParent?: { label: string; href: string };
  /** What individual items are called: controls, practices, safeguards... */
  itemNoun: string;
  /** "Showing N <noun> <preposition> <level>" */
  showingPreposition: string;
  /** Optional trailing word: baseline, tier, profile, impact level */
  showingSuffix?: string;
  /** ExportButton filters key; omit to render no export button */
  exportFilterKey?: string;
  /** Prefix for family section anchors (e.g. 'domain-' for CMMC) */
  familyAnchorPrefix?: string;
  /** Sort families numerically (CIS Controls) instead of alphabetically */
  numericFamilySort?: boolean;
  /** Empty-state block when a level has no controls (CMMC Level 3) */
  emptyState?: { message: (param: string) => string; hint?: string };
  levels: FilterLevel[];
  getControls: (frameworkId: string, param: string) => Control[];
}

const SEVERITY_PARAM_MAP: Record<string, SeverityLevel> = {
  'cat-i': 'CAT_I',
  'cat-ii': 'CAT_II',
  'cat-iii': 'CAT_III',
};

export const FILTER_CONFIGS: Record<string, FilterConfig> = {
  'nist-800-53-r5': {
    paramName: 'level',
    dimension: 'baseline',
    heading: 'NIST SP 800-53',
    headingAccent: 'Revision 5',
    subtitle: 'Security and Privacy Controls for Information Systems and Organizations',
    breadcrumbFrameworkLabel: 'NIST 800-53',
    itemNoun: 'controls',
    showingPreposition: 'in',
    showingSuffix: 'baseline',
    exportFilterKey: 'baseline',
    levels: [
      {
        param: 'low',
        pageTitle: 'NIST 800-53 - LOW Baseline',
        breadcrumbLabel: 'LOW Baseline',
        displayName: 'LOW',
        color: 'var(--ctp-green)',
        badgeLabel: 'Low',
        badgeActiveClass: 'badge-low',
        badgeInactiveClass: 'badge-low opacity-70 hover:opacity-100',
        statKey: 'low',
      },
      {
        param: 'moderate',
        pageTitle: 'NIST 800-53 - MODERATE Baseline',
        breadcrumbLabel: 'MODERATE Baseline',
        displayName: 'MODERATE',
        color: 'var(--ctp-yellow)',
        badgeLabel: 'Moderate',
        badgeActiveClass: 'badge-moderate',
        badgeInactiveClass: 'badge-moderate opacity-70 hover:opacity-100',
        statKey: 'moderate',
      },
      {
        param: 'high',
        pageTitle: 'NIST 800-53 - HIGH Baseline',
        breadcrumbLabel: 'HIGH Baseline',
        displayName: 'HIGH',
        color: 'var(--ctp-red)',
        badgeLabel: 'High',
        badgeActiveClass: 'badge-high',
        badgeInactiveClass: 'badge-high opacity-70 hover:opacity-100',
        statKey: 'high',
      },
      {
        param: 'privacy',
        pageTitle: 'NIST 800-53 - PRIVACY Baseline',
        breadcrumbLabel: 'PRIVACY Baseline',
        displayName: 'PRIVACY',
        color: 'var(--ctp-sapphire)',
        badgeLabel: 'Privacy',
        badgeActiveClass: 'badge-privacy',
        badgeInactiveClass: 'badge-privacy opacity-70 hover:opacity-100',
        statKey: 'privacy',
      },
    ],
    getControls: (frameworkId, param) =>
      getControlsByBaseline(frameworkId, param.toUpperCase() as BaselineLevel),
  },

  'fedramp-rev5': {
    paramName: 'level',
    dimension: 'baseline',
    heading: 'FedRAMP',
    headingAccent: 'Rev 5',
    subtitle: 'Federal Risk and Authorization Management Program Security Baselines',
    breadcrumbFrameworkLabel: 'FedRAMP',
    itemNoun: 'controls',
    showingPreposition: 'in',
    showingSuffix: 'baseline',
    exportFilterKey: 'baseline',
    levels: [
      {
        param: 'li-saas',
        pageTitle: 'FedRAMP Rev 5 - LI-SaaS Baseline',
        breadcrumbLabel: 'LI-SaaS Baseline',
        displayName: 'LI-SaaS',
        color: 'var(--foreground)',
        badgeLabel: 'LI-SaaS',
        badgeActiveClass: 'border-foreground/50 bg-foreground/10 text-foreground',
        badgeInactiveClass:
          'border-border bg-transparent text-muted-foreground opacity-70 hover:opacity-100 hover:border-foreground/50',
        statKey: 'li_saas',
      },
      {
        param: 'low',
        pageTitle: 'FedRAMP Rev 5 - LOW Baseline',
        breadcrumbLabel: 'LOW Baseline',
        displayName: 'LOW',
        color: 'var(--ctp-green)',
        badgeLabel: 'Low',
        badgeActiveClass: 'badge-low',
        badgeInactiveClass: 'badge-low opacity-70 hover:opacity-100',
        statKey: 'low',
      },
      {
        param: 'moderate',
        pageTitle: 'FedRAMP Rev 5 - MODERATE Baseline',
        breadcrumbLabel: 'MODERATE Baseline',
        displayName: 'MODERATE',
        color: 'var(--ctp-yellow)',
        badgeLabel: 'Moderate',
        badgeActiveClass: 'badge-moderate',
        badgeInactiveClass: 'badge-moderate opacity-70 hover:opacity-100',
        statKey: 'moderate',
      },
      {
        param: 'high',
        pageTitle: 'FedRAMP Rev 5 - HIGH Baseline',
        breadcrumbLabel: 'HIGH Baseline',
        displayName: 'HIGH',
        color: 'var(--ctp-red)',
        badgeLabel: 'High',
        badgeActiveClass: 'badge-high',
        badgeInactiveClass: 'badge-high opacity-70 hover:opacity-100',
        statKey: 'high',
      },
    ],
    getControls: (frameworkId, param) =>
      getControlsByBaseline(frameworkId, param.toUpperCase().replace('-', '_') as BaselineLevel),
  },

  'govramp': {
    paramName: 'level',
    dimension: 'baseline',
    heading: 'GovRAMP',
    headingAccent: 'Rev 5',
    subtitle:
      'Government Risk and Authorization Management Program - Security Baselines for State and Local Government Cloud Services',
    breadcrumbFrameworkLabel: 'GovRAMP',
    itemNoun: 'controls',
    showingPreposition: 'in',
    showingSuffix: 'baseline',
    exportFilterKey: 'baseline',
    levels: [
      {
        param: 'low',
        pageTitle: 'GovRAMP - LOW Baseline',
        breadcrumbLabel: 'LOW Baseline',
        displayName: 'LOW',
        color: 'var(--ctp-green)',
        badgeLabel: 'Low',
        badgeActiveClass: 'badge-low',
        badgeInactiveClass: 'badge-low opacity-70 hover:opacity-100',
        statKey: 'low',
      },
      {
        param: 'moderate',
        pageTitle: 'GovRAMP - MODERATE Baseline',
        breadcrumbLabel: 'MODERATE Baseline',
        displayName: 'MODERATE',
        color: 'var(--ctp-yellow)',
        badgeLabel: 'Moderate',
        badgeActiveClass: 'badge-moderate',
        badgeInactiveClass: 'badge-moderate opacity-70 hover:opacity-100',
        statKey: 'moderate',
      },
    ],
    getControls: (frameworkId, param) =>
      getControlsByBaseline(frameworkId, param.toUpperCase() as BaselineLevel),
  },

  'itsg-33': {
    paramName: 'level',
    dimension: 'baseline',
    heading: 'ITSG-33',
    headingAccent: 'Security Control Catalogue',
    subtitle: 'Canadian Government IT Security Risk Management Framework',
    breadcrumbFrameworkLabel: 'ITSG-33',
    itemNoun: 'controls',
    showingPreposition: 'in',
    showingSuffix: 'profile',
    exportFilterKey: 'profile',
    levels: [
      {
        param: 'pbmm',
        pageTitle: 'ITSG-33 - PBMM (Protected B) Profile',
        breadcrumbLabel: 'PBMM Profile',
        displayName: 'PBMM (Protected B)',
        color: 'var(--ctp-green)',
        badgeLabel: 'PBMM',
        badgeActiveClass: 'badge-low',
        badgeInactiveClass: 'badge-low opacity-70 hover:opacity-100',
        statKey: 'pbmm',
      },
      {
        param: 'secret',
        pageTitle: 'ITSG-33 - Secret Profile',
        breadcrumbLabel: 'Secret Profile',
        displayName: 'Secret',
        color: 'var(--ctp-yellow)',
        badgeLabel: 'Secret',
        badgeActiveClass: 'badge-moderate',
        badgeInactiveClass: 'badge-moderate opacity-70 hover:opacity-100',
        statKey: 'secret',
      },
    ],
    getControls: (frameworkId, param) =>
      getControlsByITSG33Profile(frameworkId, param.toUpperCase() as ITSG33Profile),
  },

  'cmmc-v2': {
    paramName: 'level',
    dimension: 'level',
    heading: 'CMMC',
    headingAccent: 'v2.0',
    subtitle: 'Cybersecurity Maturity Model Certification for DoD contractors',
    breadcrumbFrameworkLabel: 'CMMC',
    itemNoun: 'practices',
    showingPreposition: 'in',
    exportFilterKey: 'level',
    familyAnchorPrefix: 'domain-',
    emptyState: {
      message: (param) => `No practices found for Level ${param}.`,
      hint: 'Level 3 practices from NIST 800-172 are not yet available in this data set.',
    },
    levels: [
      {
        param: '1',
        pageTitle: 'CMMC - Level 1',
        breadcrumbLabel: 'Level 1',
        displayName: 'Level 1 (FCI)',
        color: 'var(--ctp-green)',
        badgeLabel: 'Level 1',
        badgeActiveClass: 'badge-low',
        badgeInactiveClass: 'badge-low opacity-70 hover:opacity-100',
        statKey: 'level1',
        description: 'Foundational - Basic safeguarding of Federal Contract Information (FCI)',
      },
      {
        param: '2',
        pageTitle: 'CMMC - Level 2',
        breadcrumbLabel: 'Level 2',
        displayName: 'Level 2 (CUI)',
        color: 'var(--ctp-yellow)',
        badgeLabel: 'Level 2',
        badgeActiveClass: 'badge-moderate',
        badgeInactiveClass: 'badge-moderate opacity-70 hover:opacity-100',
        statKey: 'level2',
        description: 'Advanced - Protection of Controlled Unclassified Information (CUI)',
      },
      {
        param: '3',
        pageTitle: 'CMMC - Level 3',
        breadcrumbLabel: 'Level 3',
        displayName: 'Level 3 (Enhanced)',
        color: 'var(--ctp-red)',
        badgeLabel: 'Level 3',
        badgeActiveClass: 'badge-high',
        badgeInactiveClass: 'badge-high opacity-70 hover:opacity-100',
        statKey: 'level3',
        hideBadgeWhenEmpty: true,
        description: 'Expert - Enhanced protection against Advanced Persistent Threats (APTs)',
      },
    ],
    getControls: (frameworkId, param) =>
      getControlsByCMMCLevel(frameworkId, parseInt(param) as CMMCLevel),
  },

  'cis-controls-v8': {
    paramName: 'level',
    dimension: 'ig',
    heading: 'CIS Controls',
    headingAccent: 'v8.1',
    subtitle: 'Critical Security Controls for Effective Cyber Defense',
    breadcrumbFrameworkLabel: 'CIS Controls',
    itemNoun: 'safeguards',
    showingPreposition: 'in',
    exportFilterKey: 'ig',
    familyAnchorPrefix: 'control-',
    numericFamilySort: true,
    levels: [
      {
        param: '1',
        pageTitle: 'CIS Controls - IG1',
        breadcrumbLabel: 'IG1',
        displayName: 'IG1',
        color: 'var(--ctp-green)',
        badgeLabel: 'IG1',
        badgeActiveClass: 'badge-low',
        badgeInactiveClass: 'badge-low opacity-70 hover:opacity-100',
        statKey: 'ig1',
        description: 'Essential cyber hygiene - the minimum standard for all organizations',
      },
      {
        param: '2',
        pageTitle: 'CIS Controls - IG2',
        breadcrumbLabel: 'IG2',
        displayName: 'IG2',
        color: 'var(--ctp-yellow)',
        badgeLabel: 'IG2',
        badgeActiveClass: 'badge-moderate',
        badgeInactiveClass: 'badge-moderate opacity-70 hover:opacity-100',
        statKey: 'ig2',
        description: 'For organizations with greater risk exposure or more resources',
      },
      {
        param: '3',
        pageTitle: 'CIS Controls - IG3',
        breadcrumbLabel: 'IG3',
        displayName: 'IG3',
        color: 'var(--ctp-red)',
        badgeLabel: 'IG3',
        badgeActiveClass: 'badge-high',
        badgeInactiveClass: 'badge-high opacity-70 hover:opacity-100',
        statKey: 'ig3',
        description: 'For organizations with mature security programs facing sophisticated threats',
      },
    ],
    getControls: (frameworkId, param) =>
      getControlsByIG(frameworkId, `IG${param}` as ImplementationGroup),
  },

  'eu-ai-act': {
    paramName: 'tier',
    dimension: 'risk-tier',
    heading: 'EU AI Act',
    headingAccent: '2024/1689',
    subtitle:
      'European Union Artificial Intelligence Act - Risk-based regulatory framework for AI systems',
    breadcrumbFrameworkLabel: 'EU AI Act',
    itemNoun: 'requirements',
    showingPreposition: 'in',
    showingSuffix: 'tier',
    exportFilterKey: 'riskTier',
    levels: [
      {
        param: 'prohibited',
        pageTitle: 'EU AI Act - Prohibited Requirements',
        breadcrumbLabel: 'Prohibited',
        displayName: 'Prohibited',
        color: 'var(--ctp-red)',
        badgeLabel: 'Prohibited',
        badgeActiveClass:
          'border-[var(--ctp-red)]/50 bg-[var(--ctp-red)]/10 text-[var(--ctp-red)]',
        badgeInactiveClass:
          'border-[var(--ctp-red)]/30 bg-[var(--ctp-red)]/5 text-[var(--ctp-red)] opacity-70 hover:opacity-100',
        statKey: 'prohibited',
      },
      {
        param: 'high-risk',
        pageTitle: 'EU AI Act - High-Risk Requirements',
        breadcrumbLabel: 'High-Risk',
        displayName: 'High-Risk',
        color: 'var(--ctp-maroon)',
        badgeLabel: 'High-Risk',
        badgeActiveClass:
          'border-[var(--ctp-maroon)]/50 bg-[var(--ctp-maroon)]/10 text-[var(--ctp-maroon)]',
        badgeInactiveClass:
          'border-[var(--ctp-maroon)]/30 bg-[var(--ctp-maroon)]/5 text-[var(--ctp-maroon)] opacity-70 hover:opacity-100',
        statKey: 'high_risk',
      },
      {
        param: 'limited-risk',
        pageTitle: 'EU AI Act - Limited-Risk Requirements',
        breadcrumbLabel: 'Limited-Risk',
        displayName: 'Limited-Risk',
        color: 'var(--ctp-yellow)',
        badgeLabel: 'Limited-Risk',
        badgeActiveClass:
          'border-[var(--ctp-yellow)]/50 bg-[var(--ctp-yellow)]/10 text-[var(--ctp-yellow)]',
        badgeInactiveClass:
          'border-[var(--ctp-yellow)]/30 bg-[var(--ctp-yellow)]/5 text-[var(--ctp-yellow)] opacity-70 hover:opacity-100',
        statKey: 'limited_risk',
      },
      {
        param: 'minimal-risk',
        pageTitle: 'EU AI Act - Minimal-Risk Requirements',
        breadcrumbLabel: 'Minimal-Risk',
        displayName: 'Minimal-Risk',
        color: 'var(--ctp-green)',
        badgeLabel: 'Minimal-Risk',
        badgeActiveClass:
          'border-[var(--ctp-green)]/50 bg-[var(--ctp-green)]/10 text-[var(--ctp-green)]',
        badgeInactiveClass:
          'border-[var(--ctp-green)]/30 bg-[var(--ctp-green)]/5 text-[var(--ctp-green)] opacity-70 hover:opacity-100',
        statKey: 'minimal_risk',
      },
      {
        param: 'gpai',
        pageTitle: 'EU AI Act - GPAI Requirements',
        breadcrumbLabel: 'GPAI',
        displayName: 'GPAI',
        color: 'var(--ctp-sapphire)',
        badgeLabel: 'GPAI',
        badgeActiveClass:
          'border-[var(--ctp-sapphire)]/50 bg-[var(--ctp-sapphire)]/10 text-[var(--ctp-sapphire)]',
        badgeInactiveClass:
          'border-[var(--ctp-sapphire)]/30 bg-[var(--ctp-sapphire)]/5 text-[var(--ctp-sapphire)] opacity-70 hover:opacity-100',
        statKey: 'gpai',
      },
    ],
    getControls: (frameworkId, param) =>
      getControlsByRiskTier(frameworkId, param as EURiskTier),
  },

  'kubernetes-stig-v2r4': {
    paramName: 'level',
    dimension: 'severity',
    heading: 'Kubernetes STIG',
    headingAccent: 'V2R4',
    subtitle: 'DoD Security Technical Implementation Guide for Kubernetes container orchestration',
    breadcrumbFrameworkLabel: 'Kubernetes STIG',
    breadcrumbParent: { label: 'STIGs', href: '/stigs' },
    itemNoun: 'findings',
    showingPreposition: 'in',
    levels: [
      {
        param: 'cat-i',
        pageTitle: 'Kubernetes STIG - CAT I (High)',
        breadcrumbLabel: 'CAT I (High)',
        displayName: 'CAT I (High)',
        color: 'var(--ctp-red)',
        badgeLabel: 'CAT I',
        badgeActiveClass: 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30',
        badgeInactiveClass:
          'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 opacity-70 hover:opacity-100',
        statKey: 'cat_i',
      },
      {
        param: 'cat-ii',
        pageTitle: 'Kubernetes STIG - CAT II (Medium)',
        breadcrumbLabel: 'CAT II (Medium)',
        displayName: 'CAT II (Medium)',
        color: 'var(--ctp-yellow)',
        badgeLabel: 'CAT II',
        badgeActiveClass:
          'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
        badgeInactiveClass:
          'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20 opacity-70 hover:opacity-100',
        statKey: 'cat_ii',
      },
      {
        param: 'cat-iii',
        pageTitle: 'Kubernetes STIG - CAT III (Low)',
        breadcrumbLabel: 'CAT III (Low)',
        displayName: 'CAT III (Low)',
        color: 'var(--ctp-blue)',
        badgeLabel: 'CAT III',
        badgeActiveClass: 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30',
        badgeInactiveClass:
          'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 opacity-70 hover:opacity-100',
        statKey: 'cat_iii',
      },
    ],
    getControls: (frameworkId, param) =>
      getControlsBySeverity(frameworkId, SEVERITY_PARAM_MAP[param]),
  },

  'fedramp-20x-ksi': {
    paramName: 'level',
    dimension: 'impact',
    heading: 'FedRAMP 20x',
    headingAccent: 'Key Security Indicators',
    subtitle: 'Key Security Indicators for FedRAMP 20x authorization',
    breadcrumbFrameworkLabel: 'FedRAMP 20x KSI',
    itemNoun: 'indicators',
    showingPreposition: 'for',
    showingSuffix: 'impact level',
    levels: [
      {
        param: 'low',
        pageTitle: 'FedRAMP 20x KSI - LOW Impact',
        breadcrumbLabel: 'LOW Impact',
        displayName: 'LOW',
        color: 'var(--ctp-green)',
        badgeLabel: 'Low',
        badgeActiveClass: 'badge-low',
        badgeInactiveClass: 'badge-low opacity-70 hover:opacity-100',
        statKey: 'low',
      },
      {
        param: 'moderate',
        pageTitle: 'FedRAMP 20x KSI - MODERATE Impact',
        breadcrumbLabel: 'MODERATE Impact',
        displayName: 'MODERATE',
        color: 'var(--ctp-yellow)',
        badgeLabel: 'Moderate',
        badgeActiveClass: 'badge-moderate',
        badgeInactiveClass: 'badge-moderate opacity-70 hover:opacity-100',
        statKey: 'moderate',
      },
    ],
    getControls: (frameworkId, param) =>
      getControlsByImpactLevel(frameworkId, param.toUpperCase() as ImpactLevel),
  },

  'dod-srg': {
    paramName: 'level',
    dimension: 'impact-level',
    heading: 'DoD SRG',
    headingAccent: 'Rev 5',
    subtitle: 'DoD Cloud Computing Security Requirements Guide - FedRAMP+ controls by Impact Level',
    breadcrumbFrameworkLabel: 'DoD SRG',
    itemNoun: 'controls',
    showingPreposition: 'at',
    showingSuffix: 'impact level',
    levels: [
      {
        param: 'il4-mod',
        pageTitle: 'DoD SRG - IL4 Mod',
        breadcrumbLabel: 'IL4 Mod',
        displayName: 'IL4 Mod',
        color: 'var(--ctp-blue)',
        badgeLabel: 'IL4 Mod',
        badgeActiveClass: 'bg-blue-500/20 border-blue-500/50 text-blue-700 dark:text-blue-400',
        badgeInactiveClass:
          'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400 opacity-70 hover:opacity-100',
        statKey: 'il4_mod',
      },
      {
        param: 'il4-high',
        pageTitle: 'DoD SRG - IL4 High',
        breadcrumbLabel: 'IL4 High',
        displayName: 'IL4 High',
        color: 'var(--ctp-lavender)',
        badgeLabel: 'IL4 High',
        badgeActiveClass:
          'bg-indigo-500/20 border-indigo-500/50 text-indigo-700 dark:text-indigo-400',
        badgeInactiveClass:
          'bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-400 opacity-70 hover:opacity-100',
        statKey: 'il4_high',
      },
      {
        param: 'il5',
        pageTitle: 'DoD SRG - IL5',
        breadcrumbLabel: 'IL5',
        displayName: 'IL5',
        color: 'var(--ctp-mauve)',
        badgeLabel: 'IL5',
        badgeActiveClass:
          'bg-purple-500/20 border-purple-500/50 text-purple-700 dark:text-purple-400',
        badgeInactiveClass:
          'bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-400 opacity-70 hover:opacity-100',
        statKey: 'il5',
      },
      {
        param: 'il6',
        pageTitle: 'DoD SRG - IL6',
        breadcrumbLabel: 'IL6',
        displayName: 'IL6',
        color: 'var(--ctp-red)',
        badgeLabel: 'IL6',
        badgeActiveClass: 'bg-rose-500/20 border-rose-500/50 text-rose-700 dark:text-rose-400',
        badgeInactiveClass:
          'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400 opacity-70 hover:opacity-100',
        statKey: 'il6',
      },
    ],
    getControls: (frameworkId, param) =>
      getControlsByDoDImpactLevel(
        frameworkId,
        param.toUpperCase().replace('-', '_') as DoDImpactLevel,
      ),
  },
};

/**
 * getStaticPaths body for the thin per-framework route files. Emits the same
 * params (name and values, in order) as the original copy-paste routes.
 */
export function getFilterStaticPaths(frameworkId: string) {
  if (!hasFrameworkData(frameworkId)) {
    return [];
  }
  const config = FILTER_CONFIGS[frameworkId];
  return config.levels.map((level) => ({ params: { [config.paramName]: level.param } }));
}
