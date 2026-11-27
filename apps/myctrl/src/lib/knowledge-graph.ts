/**
 * Knowledge Graph Data Layer
 *
 * Builds a graph representation of active compliance frameworks and their
 * crosswalk relationships using built-in public-domain mappings plus any
 * loaded local overlay datasets.
 */

import type {
  FrameworkNode,
  ControlNode,
  GraphEdge,
  KnowledgeGraphData,
  Category,
} from './graph/graph-types';
import {
  getAllFrameworkIds,
  getFrameworkConfig,
  getAllControls,
  getStats,
  slugify,
  hasFrameworkData,
} from '../data/controls';
import {
  CROSSWALK_REGISTRY,
  countBridgeDerivedMappings,
  getBridgeFrameworkIds,
  getCrosswalkPairMaps,
  getLoadedBridgeData,
  hasFrameworkCrosswalk,
} from '../data/crosswalk';

const CATEGORY_MAP: Record<string, Category> = {
  // Federal
  'nist-800-53-r5': 'fed',
  'nist-csf-v2': 'fed',
  'ssdf': 'fed',
  'fedramp-rev5': 'fed',
  'fedramp-20x-ksi': 'fed',
  'dod-srg': 'fed',
  'kubernetes-stig-v2r4': 'fed',
  'itsg-33': 'fed',
  'nist-800-171-r2': 'fed',
  'cmmc-v2': 'fed',
  'nist-800-161': 'fed',
  'nist-800-171-r3': 'fed',
  'nist-800-171a-r3': 'fed',
  'nist-800-171a': 'fed',
  'nist-800-172': 'fed',
  'nist-800-207': 'fed',
  'nist-800-218': 'fed',
  'tic-3': 'fed',
  'cisa-cpg': 'fed',
  'cisa-ssdaf': 'fed',
  'cisa-sbd': 'fed',
  'cmmc-l1': 'fed',
  'cmmc-l1-aos': 'fed',
  'dod-zt-roadmap': 'fed',
  'dod-zta': 'fed',
  'eo-14028': 'fed',
  'cjis': 'fed',
  'govramp': 'fed',

  // AI
  'nist-ai-rmf': 'ai',
  'iso-42001': 'ai',
  'iso-23894': 'ai',
  'eu-ai-act': 'ai',
  'owasp-llm-top10': 'ai',
  'nist-ai-600-1': 'ai',
  'iso-42001-detailed': 'ai',
  'eu-ai-act-strm': 'ai',
  'aiuc-1': 'ai',

  // Meta
  'adobe-ccf-v5': 'meta',
  'uc-framework': 'meta',
  'hitrust-csf': 'meta',
  'csa-ccm': 'meta',
  'cobit': 'meta',
  'ocsf': 'meta',
  'fair': 'meta',
  'mitre-attack': 'meta',

  // Enterprise
  'pci-dss-v4': 'ent',
  'iso-27001-2022': 'ent',
  'soc2-tsc': 'ent',
  'cis-controls-v8': 'ent',
  'iso-27001-detailed': 'ent',
  'iso-27002': 'ent',
  'cis-v8-detailed': 'ent',
  'soc2-tsc-detailed': 'ent',
  'tisax': 'ent',
  'naic-668': 'ent',
  'glba': 'ent',
  'nerc-cip': 'ent',
  'sec-cyber': 'ent',
  'ny-dfs-500': 'ent',
  'fca-crm': 'ent',
  'tx-ramp': 'ent',

  // OWASP
  'owasp-web-top10': 'owasp',
  'owasp-api-top10': 'owasp',
  'owasp-mobile-top10': 'owasp',
  'owasp-smart-contract-top10': 'owasp',

  // Privacy
  'hipaa-security': 'priv',
  'gdpr': 'priv',
  'ccpa': 'priv',
  'nis2': 'priv',
  'india-dpdpa': 'priv',
  'sa-pdpl': 'priv',
  'apec-privacy': 'priv',
  'iso-27701': 'priv',
  'iso-29100': 'priv',
  'oecd-privacy': 'priv',
  'dpmp': 'priv',
  'us-dpf': 'priv',
  'fipps': 'priv',
  'nv-reg5': 'priv',
  'or-cpa': 'priv',
  'tn-ipa': 'priv',
  'tx-cdpa': 'priv',
  'va-cdpa': 'priv',
  'hipaa-simp': 'priv',
  'cms-45cfr': 'priv',

  // International
  'canada-itsp': 'intl',
  'canada-osfi-b13': 'intl',
  'au-essential-8': 'intl',
  'au-ism': 'intl',
  'china-csl': 'intl',
  'india-sebi': 'intl',
  'nz-hisf': 'intl',
  'nz-hisf-suppliers': 'intl',
  'sa-iot': 'intl',
  'spain-ens': 'intl',
  'uae-niaf': 'intl',
  'uk-caf': 'intl',
  'uk-defstan': 'intl',
  'cyber-essentials-uk': 'intl',
  'bsi-c5': 'intl',
  'iec-60601': 'intl',
  'imo-maritime': 'intl',
  'sparta': 'intl',
  'eu-cra': 'intl',
  'eu-cra-annexes': 'intl',
  'eu-dora': 'intl',
  'tx-sb2610': 'intl',
};

export function getFrameworkCategory(frameworkId: string): Category {
  return CATEGORY_MAP[frameworkId] || 'uncategorized';
}

function getShortName(_id: string, name: string): string {
  if (name.startsWith('NIST SP 800-')) {
    const match = name.match(/NIST SP (800-\d+[A-Z]?)/);
    return match ? match[1] : name.split(' ').slice(0, 2).join(' ');
  }
  if (name.startsWith('NIST CSF')) return 'CSF';
  if (name.startsWith('NIST AI RMF')) return 'AI RMF';
  if (name.startsWith('NIST AI 600')) return 'AI 600-1';

  if (name.startsWith('ISO')) {
    const match = name.match(/ISO(?:\/IEC)?\s*(\d+)/);
    return match ? `ISO ${match[1]}` : name.split(' ').slice(0, 2).join(' ');
  }

  if (name.startsWith('OWASP')) {
    if (name.includes('LLM')) return 'LLM Top 10';
    if (name.includes('API')) return 'API Top 10';
    if (name.includes('Mobile')) return 'Mobile Top 10';
    if (name.includes('Smart Contract')) return 'Smart Contract';
    return 'Web Top 10';
  }

  if (name.startsWith('EU AI Act')) return 'EU AI Act';
  if (name.startsWith('EU CRA')) return 'EU CRA';
  if (name.startsWith('EU DORA')) return 'DORA';
  if (name.startsWith('NIS2')) return 'NIS2';

  if (name.startsWith('CIS Controls')) return 'CIS';
  if (name.startsWith('SOC 2')) return 'SOC 2';
  if (name.startsWith('PCI DSS')) return 'PCI DSS';

  return name.split(' ')[0];
}

function buildFrameworkNodes(): FrameworkNode[] {
  const frameworkIds = getAllFrameworkIds();
  const nodes: FrameworkNode[] = [];

  for (const id of frameworkIds) {
    if (!hasFrameworkData(id) && !hasFrameworkCrosswalk(id)) {
      continue;
    }

    try {
      const config = getFrameworkConfig(id);
      const stats = getStats(id);
      const controls = getAllControls(id);
      const families = [...new Set(controls.map((c) => c.family))];

      nodes.push({
        type: 'framework',
        id,
        name: config.name + (config.version ? ` ${config.version}` : ''),
        shortName: getShortName(id, config.name),
        category: getFrameworkCategory(id),
        controlCount: stats.total,
        families,
      });
    } catch {
      // Skip frameworks that fail to load
    }
  }

  return nodes;
}

interface FrameworkPair {
  source: string;
  target: string;
}

function extractFrameworkEdges(): FrameworkPair[] {
  const pairs = new Set<string>();

  const addPair = (a: string, b: string, requireLoadedBoth = true) => {
    if (requireLoadedBoth && (!hasFrameworkData(a) || !hasFrameworkData(b))) {
      return;
    }
    const key = [a, b].sort().join('|');
    pairs.add(key);
  };

  // Direct active crosswalks (including OLIR ID maps)
  for (const pair of CROSSWALK_REGISTRY) {
    addPair(pair.a, pair.b, false);
  }

  // Structural/published relationships among loaded frameworks
  addPair('nist-800-171-r2', 'nist-800-53-r5');
  addPair('fedramp-rev5', 'nist-800-53-r5');
  addPair('fedramp-20x-ksi', 'nist-800-53-r5');
  addPair('dod-srg', 'nist-800-53-r5');
  addPair('dod-srg', 'fedramp-rev5');

  // Bridge-derived connections when local bridge overlay is loaded
  const bridgeCoreTargets = [
    'nist-800-53-r5', 'nist-csf-v2', 'iso-27001-2022', 'pci-dss-v4',
    'cis-controls-v8', 'soc2-tsc', 'nist-800-171-r2', 'fedramp-rev5',
  ];
  for (const sourceId of getBridgeFrameworkIds()) {
    if (bridgeCoreTargets.includes(sourceId)) continue;
    const partners = bridgeCoreTargets
      .map((targetId) => ({ targetId, count: countBridgeDerivedMappings(sourceId, targetId) }))
      .filter((p) => p.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 2);
    for (const partner of partners) {
      addPair(sourceId, partner.targetId, false);
    }
  }

  // Topical structural links between loaded datasets
  addPair('hipaa-security', 'nist-800-53-r5');
  addPair('gdpr', 'nist-800-53-r5');
  addPair('nis2', 'eu-dora');
  addPair('nis2', 'eu-cra');
  addPair('owasp-llm-top10', 'nist-ai-rmf');
  addPair('owasp-llm-top10', 'eu-ai-act');
  addPair('au-essential-8', 'nist-csf-v2');
  addPair('au-ism', 'au-essential-8');
  addPair('nz-hisf', 'nz-hisf-suppliers');
  addPair('eu-cra', 'eu-cra-annexes');
  addPair('nist-800-171-r3', 'nist-800-53-r5');
  addPair('nist-800-171a-r3', 'nist-800-171-r3');
  addPair('nist-800-172', 'nist-800-171-r2');
  addPair('nist-800-161', 'nist-800-53-r5');
  addPair('nist-800-207', 'nist-csf-v2');
  addPair('nist-800-218', 'ssdf');
  addPair('cmmc-l1', 'cmmc-v2');
  addPair('cmmc-l1-aos', 'cmmc-l1');
  addPair('dod-zt-roadmap', 'dod-zta');
  addPair('dod-zta', 'nist-800-207');
  addPair('cisa-cpg', 'nist-csf-v2');
  addPair('cisa-ssdaf', 'ssdf');
  addPair('govramp', 'fedramp-rev5');
  addPair('tx-ramp', 'nist-800-53-r5');

  const privacyFrameworks = [
    'hipaa-simp', 'india-dpdpa', 'sa-pdpl', 'us-dpf', 'fipps', 'cms-45cfr',
    'ccpa', 'nv-reg5', 'or-cpa', 'tn-ipa', 'tx-cdpa', 'va-cdpa',
  ];
  for (const pf of privacyFrameworks) {
    addPair(pf, 'gdpr');
  }

  addPair('iso-27001-detailed', 'iso-27001-2022');
  addPair('iso-27002', 'iso-27001-2022');
  addPair('iso-42001-detailed', 'iso-42001');
  addPair('cis-v8-detailed', 'cis-controls-v8');
  addPair('soc2-tsc-detailed', 'soc2-tsc');

  return Array.from(pairs).map((key) => {
    const [source, target] = key.split('|');
    return { source, target };
  });
}

export function buildFrameworkGraph(): KnowledgeGraphData {
  const nodes = buildFrameworkNodes();
  const frameworkPairs = extractFrameworkEdges();

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: GraphEdge[] = frameworkPairs
    .filter((p) => nodeIds.has(p.source) && nodeIds.has(p.target))
    .map((p) => ({
      source: p.source,
      target: p.target,
      type: 'crosswalk' as const,
    }));

  return { nodes, edges };
}

export function filterGraphByCategories(
  graph: KnowledgeGraphData,
  categories: Category[],
): KnowledgeGraphData {
  const categorySet = new Set(categories);

  const nodes = graph.nodes.filter((node) => {
    if (node.type === 'framework') {
      return categorySet.has(node.category);
    }
    return true;
  });

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = graph.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

  return { nodes, edges };
}

export function getNeighborhood(
  graph: KnowledgeGraphData,
  nodeId: string,
  depth: number,
): KnowledgeGraphData {
  if (depth < 0) {
    return graph;
  }

  const adjacency = new Map<string, Set<string>>();

  for (const edge of graph.edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set());
    adjacency.get(edge.source)!.add(edge.target);
    adjacency.get(edge.target)!.add(edge.source);
  }

  const visited = new Set<string>([nodeId]);
  const queue: { id: string; dist: number }[] = [{ id: nodeId, dist: 0 }];

  while (queue.length > 0) {
    const { id, dist } = queue.shift()!;
    if (dist >= depth) continue;

    const neighbors = adjacency.get(id) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({ id: neighbor, dist: dist + 1 });
      }
    }
  }

  const nodes = graph.nodes.filter((n) => visited.has(n.id));
  const edges = graph.edges.filter((e) => visited.has(e.source) && visited.has(e.target));

  return { nodes, edges };
}

const controlNodeCache = new Map<string, ControlNode[]>();

export function buildControlNodes(frameworkId: string): ControlNode[] {
  const cached = controlNodeCache.get(frameworkId);
  if (cached) return cached;

  const controls = getAllControls(frameworkId);

  const nodes = controls.map((control) => ({
    type: 'control' as const,
    id: `${frameworkId}:${control.control_id}`,
    controlId: control.control_id,
    frameworkId,
    title: control.title,
    family: control.family,
    baselines: (control as any).baselines,
    url: `/frameworks/${frameworkId}/${slugify(control.control_id)}`,
  }));

  controlNodeCache.set(frameworkId, nodes);
  return nodes;
}

export function getGraphStats(graph: KnowledgeGraphData): {
  nodeCount: number;
  edgeCount: number;
  categoryCounts: Record<Category, number>;
} {
  const categoryCounts: Record<Category, number> = {
    fed: 0,
    ai: 0,
    ent: 0,
    owasp: 0,
    priv: 0,
    intl: 0,
    meta: 0,
    uncategorized: 0,
  };

  for (const node of graph.nodes) {
    if (node.type === 'framework') {
      categoryCounts[node.category]++;
    }
  }

  return {
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    categoryCounts,
  };
}

function buildPairsFromMap(
  sourceFramework: string,
  targetFramework: string,
  map: Record<string, string[]>,
): { sourceId: string; targetId: string }[] {
  const pairs: { sourceId: string; targetId: string }[] = [];
  for (const [sourceControl, targetControls] of Object.entries(map)) {
    for (const targetControl of targetControls) {
      pairs.push({
        sourceId: `${sourceFramework}:${sourceControl}`,
        targetId: `${targetFramework}:${targetControl}`,
      });
    }
  }
  return pairs;
}

const ccfBridgeCache = new Map<string, { sourceId: string; targetId: string }[]>();

function buildCcfBridgePairs(
  frameworkA: string,
  frameworkB: string,
): { sourceId: string; targetId: string }[] {
  const cacheKey = [frameworkA, frameworkB].sort().join('|');
  const cached = ccfBridgeCache.get(cacheKey);
  if (cached) return cached;

  const { bridgeToFramework } = getLoadedBridgeData();
  const aByCcf = bridgeToFramework[frameworkA] || {};
  const bByCcf = bridgeToFramework[frameworkB] || {};

  const pairs: { sourceId: string; targetId: string }[] = [];
  const seen = new Set<string>();

  for (const [ccfId, aControls] of Object.entries(aByCcf)) {
    const bControls = bByCcf[ccfId];
    if (!bControls || bControls.length === 0) continue;

    for (const aCtrl of aControls) {
      for (const bCtrl of bControls) {
        const edgeKey = `${frameworkA}:${aCtrl}|${frameworkB}:${bCtrl}`;
        if (seen.has(edgeKey)) continue;
        seen.add(edgeKey);
        pairs.push({
          sourceId: `${frameworkA}:${aCtrl}`,
          targetId: `${frameworkB}:${bCtrl}`,
        });
      }
    }
  }

  ccfBridgeCache.set(cacheKey, pairs);
  return pairs;
}

export function getControlCrosswalkPairs(
  frameworkA: string,
  frameworkB: string,
): { sourceId: string; targetId: string; confidence: 'high' | 'medium' }[] {
  const pair = getCrosswalkPairMaps(frameworkA, frameworkB);
  if (pair) {
    let map = pair.aToB;
    if (pair.normalizeAKey) {
      const expanded: Record<string, string[]> = {};
      for (const control of getAllControls(pair.a)) {
        const ids = pair.aToB[pair.normalizeAKey(control.control_id)];
        if (ids && ids.length > 0) expanded[control.control_id] = ids;
      }
      map = expanded;
    }
    return buildPairsFromMap(pair.a, pair.b, map).map((p) => ({
      ...p,
      confidence: 'high' as const,
    }));
  }

  const { bridgeToFramework } = getLoadedBridgeData();
  if (bridgeToFramework[frameworkA] && bridgeToFramework[frameworkB]) {
    return buildCcfBridgePairs(frameworkA, frameworkB).map((p) => ({
      ...p,
      confidence: 'medium' as const,
    }));
  }

  return [];
}

let cachedFrameworkGraph: KnowledgeGraphData | null = null;

export function getFrameworkGraph(): KnowledgeGraphData {
  if (!cachedFrameworkGraph) {
    cachedFrameworkGraph = buildFrameworkGraph();
  }
  return cachedFrameworkGraph;
}
