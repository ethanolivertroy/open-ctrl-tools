/**
 * Technology Guidance Data
 *
 * This module contains technology-specific guidance that aggregates authoritative sources
 * (NIST, CIS, vendor docs) with practical verification commands. It provides bidirectional
 * linking between security controls and technologies.
 *
 * NOTE: src/data/technology-guides.json is the source of truth for the guide
 * content. This module is a thin typed accessor over that JSON plus the
 * routing/filtering logic. Two things intentionally live here in TS:
 *   - TECHNOLOGY_CATEGORIES (presentation config: SVG icon paths, routes)
 *   - the github-actions guide's content fields, which are re-attached at load
 *     time from ./github-actions-playbook so that module stays their single
 *     source of truth.
 */

import type {
  TechnologyGuide,
  TechnologyGuideSection,
  TechnologyCategory,
  TechnologyCategoryMeta,
  AuthoritativeSource,
  TechCommand,
  TechResponsibilitySection,
  ControlMapping,
} from './types';
import { AWS_RSC_DATA } from './aws-rsc-data';
import {
  GITHUB_ACTIONS_COMMANDS,
  GITHUB_ACTIONS_CONTROL_MAPPINGS,
  GITHUB_ACTIONS_PLAYBOOK,
  GITHUB_ACTIONS_SOURCES,
  GITHUB_ACTIONS_TOOLS,
} from './github-actions-playbook';
import technologyGuidesJson from './technology-guides.json';

// Category metadata for display
export const TECHNOLOGY_CATEGORIES: TechnologyCategoryMeta[] = [
  {
    id: 'identity',
    name: 'Identity & Access Management',
    description: 'Identity providers, SSO, MFA, and access management platforms',
    icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
    path: '/guidance/identity-access-management',
  },
  {
    id: 'containerized',
    name: 'Containerized & Serverless',
    description: 'Kubernetes, containers, service meshes, and serverless runtimes',
    icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    path: '/guidance/containerized',
  },
  {
    id: 'security-tools',
    name: 'Security Technology Guidance',
    description: 'SIEM, EDR, vulnerability management, and security platforms',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    path: '/guidance/security-tools',
  },
  {
    id: 'cloud',
    name: 'Cloud Platforms',
    description: 'AWS, Azure, GCP infrastructure and cloud services',
    icon: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z',
    path: '/guidance/cloud',
    detailPathPrefix: '/guidance/cloud',
  },
  {
    id: 'devsecops',
    name: 'DevSecOps',
    description: 'CI/CD security, code scanning, and secure development tools',
    icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
    path: '/guidance/devsecops',
  },
  {
    id: 'ai',
    name: 'AI Platforms',
    description: 'Foundation model platforms, safety tooling, and AI services',
    icon: 'M9.75 3.75h4.5M9.75 20.25h4.5M3.75 9.75v4.5M20.25 9.75v4.5M7.5 7.5h9v9h-9v-9z',
    path: '/guidance/ai',
    detailPathPrefix: '/guidance/ai',
  },
];

// Technology guidance data. The github-actions guide's content fields are
// wired in from ./github-actions-playbook (they are stripped from the JSON).
const rawGuides = (technologyGuidesJson as unknown as { guides: TechnologyGuide[] }).guides;

export const TECHNOLOGY_GUIDES: TechnologyGuide[] = rawGuides.map((guide) =>
  guide.id === 'github-actions'
    ? {
        ...guide,
        authoritativeSources: GITHUB_ACTIONS_SOURCES,
        commands: GITHUB_ACTIONS_COMMANDS,
        controlMappings: GITHUB_ACTIONS_CONTROL_MAPPINGS,
        tools: GITHUB_ACTIONS_TOOLS,
        playbook: GITHUB_ACTIONS_PLAYBOOK,
      }
    : guide
);

// O(1) lookup by guide ID, built once at module init.
// First-match semantics mirror the previous Array.find behavior.
const guidesById = new Map<string, TechnologyGuide>();
for (const guide of TECHNOLOGY_GUIDES) {
  if (!guidesById.has(guide.id)) {
    guidesById.set(guide.id, guide);
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get all technology guides
 */
export function getAllTechnologyGuides(): TechnologyGuide[] {
  return TECHNOLOGY_GUIDES;
}

/**
 * Get a technology guide by its ID
 */
export function getTechnologyById(id: string): TechnologyGuide | undefined {
  return guidesById.get(id);
}

/**
 * Get technologies by category
 */
export function getTechnologiesByCategory(category: TechnologyCategory): TechnologyGuide[] {
  return TECHNOLOGY_GUIDES.filter((t) => t.category === category);
}

/**
 * Get category metadata by ID
 */
export function getCategoryMeta(categoryId: TechnologyCategory): TechnologyCategoryMeta | undefined {
  return TECHNOLOGY_CATEGORIES.find((c) => c.id === categoryId);
}

/**
 * Get the canonical guidance path for a technology guide
 */
export function getTechnologyPath(tech: TechnologyGuide): string {
  const categoryMeta = getCategoryMeta(tech.category);
  if (categoryMeta?.detailPathPrefix) {
    return `${categoryMeta.detailPathPrefix}/${tech.id}`;
  }
  return `/guidance/${tech.id}`;
}

/**
 * Get technologies that map to a specific control
 * Returns technologies that have the given control ID in their mappings for the specified framework
 */
export function getTechnologiesForControl(
  controlId: string,
  frameworkId: string
): TechnologyGuide[] {
  // Normalize the control ID for comparison (handle variations like AC-2 vs ac-2)
  const normalizedControlId = controlId.toUpperCase();

  return TECHNOLOGY_GUIDES.filter((tech) =>
    tech.controlMappings.some(
      (mapping) =>
        mapping.frameworkId === frameworkId &&
        mapping.controlIds.some(
          (id) => id.toUpperCase() === normalizedControlId
        )
    )
  );
}

/**
 * Get all unique framework IDs that have technology mappings
 */
export function getFrameworksWithTechMappings(): string[] {
  const frameworkIds = new Set<string>();
  TECHNOLOGY_GUIDES.forEach((tech) => {
    tech.controlMappings.forEach((mapping) => {
      frameworkIds.add(mapping.frameworkId);
    });
  });
  return Array.from(frameworkIds);
}

/**
 * Get technologies grouped by category
 */
export function getTechnologiesGroupedByCategory(): Map<TechnologyCategory, TechnologyGuide[]> {
  const grouped = new Map<TechnologyCategory, TechnologyGuide[]>();

  for (const category of TECHNOLOGY_CATEGORIES) {
    const techs = getTechnologiesByCategory(category.id);
    if (techs.length > 0) {
      grouped.set(category.id, techs);
    }
  }

  return grouped;
}

// ============================================
// Section / Subpage Helpers
// ============================================

/**
 * Whether a technology guide has subpage sections
 */
export function hasSubpages(tech: TechnologyGuide): boolean {
  return !!tech.sections && tech.sections.length > 0;
}

/**
 * Check if a source matches a section's sourceIds (title substring match)
 */
function sourceMatchesSection(source: AuthoritativeSource, section: TechnologyGuideSection): boolean {
  if (!section.sourceIds || section.sourceIds.length === 0) return false;
  return section.sourceIds.some((id) => source.title.includes(id));
}

/**
 * Check if a responsibility section matches a section's responsibilityTitles (title substring match)
 */
function responsibilityMatchesSection(resp: TechResponsibilitySection, section: TechnologyGuideSection): boolean {
  if (!section.responsibilityTitles || section.responsibilityTitles.length === 0) return false;
  return section.responsibilityTitles.some((t) => resp.title.includes(t));
}

/**
 * Check if a command matches a section's commandGroups
 */
function commandMatchesSection(cmd: TechCommand, section: TechnologyGuideSection): boolean {
  if (!section.commandGroups || section.commandGroups.length === 0) return false;
  const group = cmd.group ?? 'General';
  return section.commandGroups.includes(group);
}

/**
 * Check if a control mapping matches a section's controlMappingFrameworks
 */
function mappingMatchesSection(mapping: ControlMapping, section: TechnologyGuideSection): boolean {
  if (!section.controlMappingFrameworks || section.controlMappingFrameworks.length === 0) return false;
  return section.controlMappingFrameworks.includes(mapping.frameworkId);
}

/**
 * Get filtered content for a specific section of a technology guide
 */
export function getSectionContent(tech: TechnologyGuide, section: TechnologyGuideSection): {
  sources: AuthoritativeSource[];
  responsibilities: TechResponsibilitySection[];
  commands: TechCommand[];
  controlMappings: ControlMapping[];
} {
  return {
    sources: tech.authoritativeSources.filter((s) => sourceMatchesSection(s, section)),
    responsibilities: (tech.responsibilities ?? []).filter((r) => responsibilityMatchesSection(r, section)),
    commands: tech.commands.filter((c) => commandMatchesSection(c, section)),
    controlMappings: tech.controlMappings.filter((m) => mappingMatchesSection(m, section)),
  };
}

/**
 * Get overview content — items NOT claimed by any section (for landing page)
 */
export function getOverviewContent(tech: TechnologyGuide): {
  sources: AuthoritativeSource[];
  responsibilities: TechResponsibilitySection[];
  commands: TechCommand[];
  controlMappings: ControlMapping[];
} {
  const sections = tech.sections ?? [];
  if (sections.length === 0) {
    return {
      sources: tech.authoritativeSources,
      responsibilities: tech.responsibilities ?? [],
      commands: tech.commands,
      controlMappings: tech.controlMappings,
    };
  }

  return {
    sources: tech.authoritativeSources.filter(
      (s) => !sections.some((sec) => sourceMatchesSection(s, sec))
    ),
    responsibilities: (tech.responsibilities ?? []).filter(
      (r) => !sections.some((sec) => responsibilityMatchesSection(r, sec))
    ),
    commands: tech.commands.filter(
      (c) => !sections.some((sec) => commandMatchesSection(c, sec))
    ),
    controlMappings: tech.controlMappings.filter(
      (m) => !sections.some((sec) => mappingMatchesSection(m, sec))
    ),
  };
}

/**
 * Get section badge counts for display on nav cards
 */
export function getSectionCounts(tech: TechnologyGuide, section: TechnologyGuideSection): {
  sources: number;
  responsibilities: number;
  commands: number;
  rscRequirements?: number;
} {
  if (section.rscServiceId) {
    const rsc = AWS_RSC_DATA[section.rscServiceId];
    return {
      sources: 0,
      responsibilities: 0,
      commands: 0,
      rscRequirements: rsc ? rsc.requirements.filter((r) => r.applicable).length : 0,
    };
  }
  const content = getSectionContent(tech, section);
  return {
    sources: content.sources.length,
    responsibilities: content.responsibilities.reduce((sum, r) => sum + r.items.length, 0),
    commands: content.commands.length,
  };
}

/** Re-export RSC data for use in section pages */
export { AWS_RSC_DATA };
