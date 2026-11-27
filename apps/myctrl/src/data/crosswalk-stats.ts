/**
 * Crosswalk statistics for visualization
 * Aggregates active crosswalk data (built-in public-domain mappings plus
 * optional local overlays) into nodes and edges.
 */

import { CROSSWALK_REGISTRY, countMappings, countBridgeDerivedMappings } from './crosswalk';
import { FRAMEWORK_CONFIGS, getFrameworkData } from './frameworks';

export type FrameworkCategory = 'federal' | 'enterprise' | 'ai' | 'privacy' | 'international' | 'meta';

export interface FrameworkNode {
  id: string;
  name: string;
  shortName: string;
  controlCount: number;
  category: FrameworkCategory;
}

export interface CrosswalkEdge {
  source: string;
  target: string;
  mappingCount: number;
  label?: string;
}

export interface CrosswalkStats {
  nodes: FrameworkNode[];
  edges: CrosswalkEdge[];
  matrix: Record<string, Record<string, number>>;
}

function getFrameworkCategory(id: string): FrameworkCategory {
  const config = FRAMEWORK_CONFIGS[id];
  if (!config) return 'international';

  const tags = config.tags || [];
  if (tags.includes('AI')) return 'ai';
  if (tags.includes('Privacy')) return 'privacy';
  if (tags.includes('Federal') || tags.includes('DoD')) return 'federal';
  if (tags.includes('International')) return 'international';
  if (tags.includes('Enterprise') || tags.includes('Industry')) return 'enterprise';
  return 'federal';
}

function getShortName(id: string, name: string): string {
  const shortNames: Record<string, string> = {
    'nist-csf-v2': 'CSF',
    'nist-800-53-r5': '800-53',
    'pci-dss-v4': 'PCI',
    'iso-27001-2022': 'ISO 27001',
    'soc2-tsc': 'SOC 2',
    'cis-controls-v8': 'CIS',
    'nist-ai-rmf': 'AI RMF',
    'eu-ai-act': 'EU AI',
    'cmmc-v2': 'CMMC',
    'nist-800-171-r2': '800-171',
    'fedramp-rev5': 'FedRAMP',
    'hipaa-security': 'HIPAA',
    'gdpr': 'GDPR',
    'nis2': 'NIS2',
    'ccpa': 'CCPA',
    'iso-42001': 'ISO 42001',
    'iso-23894': 'ISO 23894',
  };
  return shortNames[id] || name.split(' ')[0];
}

function getControlCount(id: string): number {
  try {
    const data = getFrameworkData(id);
    return (data as { controls: unknown[] }).controls?.length || 0;
  } catch {
    return 0;
  }
}

export function getCrosswalkStats(): CrosswalkStats {
  const rawEdges: CrosswalkEdge[] = [];
  const activeIds = new Set<string>();

  const recordEdge = (source: string, target: string, count: number) => {
    if (count <= 0 || source === target) return;
    if (!FRAMEWORK_CONFIGS[source] || !FRAMEWORK_CONFIGS[target]) return;

    const [a, b] = [source, target].sort();
    const existing = rawEdges.find(
      (e) => (e.source === a && e.target === b) || (e.source === b && e.target === a),
    );
    if (existing) {
      existing.mappingCount = Math.max(existing.mappingCount, count);
    } else {
      rawEdges.push({ source: a, target: b, mappingCount: count });
    }
    activeIds.add(source);
    activeIds.add(target);
  };

  for (const pair of CROSSWALK_REGISTRY) {
    const count = Math.max(countMappings(pair.aToB), countMappings(pair.bToA));
    recordEdge(pair.a, pair.b, count);
  }

  for (const privacyId of ['hipaa-security', 'gdpr', 'nis2', 'ccpa']) {
    for (const targetId of ['nist-800-53-r5', 'iso-27001-2022']) {
      const count = countBridgeDerivedMappings(privacyId, targetId);
      if (count > 0) recordEdge(privacyId, targetId, count);
    }
  }

  const orderedCore = [
    'nist-csf-v2',
    'nist-800-53-r5',
    'pci-dss-v4',
    'iso-27001-2022',
    'soc2-tsc',
    'cis-controls-v8',
    'nist-ai-rmf',
    'eu-ai-act',
    'cmmc-v2',
    'nist-800-171-r2',
    'fedramp-rev5',
    'hipaa-security',
    'gdpr',
    'nis2',
    'ccpa',
    'iso-42001',
    'iso-23894',
  ];

  const sortedIds = [
    ...orderedCore.filter((id) => activeIds.has(id)),
    ...Array.from(activeIds).filter((id) => !orderedCore.includes(id)).sort(),
  ];

  const nodes: FrameworkNode[] = [];
  const matrix: Record<string, Record<string, number>> = {};

  for (const id of sortedIds) {
    const config = FRAMEWORK_CONFIGS[id];
    if (!config) continue;

    nodes.push({
      id,
      name: config.name,
      shortName: getShortName(id, config.name),
      controlCount: getControlCount(id),
      category: getFrameworkCategory(id),
    });
    matrix[id] = {};
  }

  for (const edge of rawEdges) {
    if (!matrix[edge.source]) matrix[edge.source] = {};
    if (!matrix[edge.target]) matrix[edge.target] = {};
    matrix[edge.source][edge.target] = (matrix[edge.source][edge.target] || 0) + edge.mappingCount;
    matrix[edge.target][edge.source] = (matrix[edge.target][edge.source] || 0) + edge.mappingCount;
  }

  return { nodes, edges: rawEdges, matrix };
}

export const CATEGORY_COLORS: Record<FrameworkCategory, string> = {
  federal: '#3b82f6',
  enterprise: '#22c55e',
  ai: '#a855f7',
  privacy: '#f59e0b',
  international: '#06b6d4',
  meta: '#ec4899',
};

export const CATEGORY_LABELS: Record<FrameworkCategory, string> = {
  federal: 'U.S. Federal',
  enterprise: 'Enterprise',
  ai: 'AI & ML',
  privacy: 'Privacy',
  international: 'International',
  meta: 'Meta-Framework',
};
