/**
 * Graph Expansion State Manager
 *
 * Manages framework expansion/collapse and builds composite graphs
 * that merge framework-level nodes with control-level subnodes + crosswalk edges.
 */

import type {
  GraphNode,
  GraphEdge,
  KnowledgeGraphData,
  GraphExpansionState,
  GraphDiff,
  ControlNode,
} from '@/lib/graph/graph-types';
import { buildControlNodes, getControlCrosswalkPairs } from '../../lib/knowledge-graph';

/** Max controls before showing family-level grouping instead */
const EXPANSION_CAP = 500;

/** Max total simulation nodes before auto-grouping kicks in */
const MAX_SIMULATION_NODES = 5000;

/**
 * Create initial empty expansion state
 */
export function createExpansionState(): GraphExpansionState {
  return { expandedFrameworks: new Set() };
}

/**
 * Toggle expansion of a framework.
 * Returns new state (immutable pattern for React).
 */
export function toggleExpansion(
  state: GraphExpansionState,
  frameworkId: string,
): GraphExpansionState {
  const next = new Set(state.expandedFrameworks);
  if (next.has(frameworkId)) {
    next.delete(frameworkId);
  } else {
    next.add(frameworkId);
  }
  return { expandedFrameworks: next };
}

/**
 * Collapse all expanded frameworks.
 */
export function collapseAll(): GraphExpansionState {
  return { expandedFrameworks: new Set() };
}

/**
 * Build a composite graph by merging the base framework graph
 * with control nodes for expanded frameworks + crosswalk edges.
 *
 * Returns both the full composite graph and a diff from the previous state.
 */
export function buildCompositeGraph(
  baseGraph: KnowledgeGraphData,
  expansionState: GraphExpansionState,
  previousGraph?: KnowledgeGraphData,
): { graph: KnowledgeGraphData; diff: GraphDiff; cappedFrameworks: string[] } {
  const expandedIds = Array.from(expansionState.expandedFrameworks);
  const cappedFrameworks: string[] = [];

  // Start with base graph
  const allNodes: GraphNode[] = [...baseGraph.nodes];
  const allEdges: GraphEdge[] = [...baseGraph.edges];

  // For each expanded framework, add control nodes + "contains" edges
  for (const frameworkId of expandedIds) {
    const controlNodes = buildControlNodes(frameworkId);

    // Auto-group by family if: framework has too many controls, OR
    // adding all controls would exceed the global simulation budget
    const wouldExceedBudget = allNodes.length + controlNodes.length > MAX_SIMULATION_NODES;

    if (controlNodes.length > EXPANSION_CAP || wouldExceedBudget) {
      // Group by family instead of individual controls
      const familyGroups = groupByFamily(controlNodes, frameworkId);
      allNodes.push(...familyGroups.nodes);
      allEdges.push(...familyGroups.edges);

      // Track frameworks that were capped due to budget (not their own size)
      if (wouldExceedBudget && controlNodes.length <= EXPANSION_CAP) {
        cappedFrameworks.push(frameworkId);
      }
    } else {
      allNodes.push(...controlNodes);
      // Add "contains" edges from framework to each control
      for (const cn of controlNodes) {
        allEdges.push({
          source: frameworkId,
          target: cn.id,
          type: 'contains',
          level: 'control',
        });
      }
    }
  }

  // For each pair of expanded frameworks, add crosswalk edges between controls
  const nodeIdSet = new Set(allNodes.map(n => n.id)); // Compute once, not per-pair
  for (let i = 0; i < expandedIds.length; i++) {
    for (let j = i + 1; j < expandedIds.length; j++) {
      const pairs = getControlCrosswalkPairs(expandedIds[i], expandedIds[j]);
      for (const pair of pairs) {
        if (nodeIdSet.has(pair.sourceId) && nodeIdSet.has(pair.targetId)) {
          allEdges.push({
            source: pair.sourceId,
            target: pair.targetId,
            type: 'crosswalk',
            level: 'control',
            confidence: pair.confidence,
          });
        }
      }
    }
  }

  const graph: KnowledgeGraphData = { nodes: allNodes, edges: allEdges };

  // Compute diff
  const diff = computeDiff(previousGraph || baseGraph, graph);

  return { graph, diff, cappedFrameworks };
}

/**
 * Group controls by family for frameworks with > EXPANSION_CAP controls.
 * Creates one "control" node per family (labeled with family name + count).
 */
function groupByFamily(
  controls: ControlNode[],
  frameworkId: string,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const families = new Map<string, ControlNode[]>();
  for (const c of controls) {
    const list = families.get(c.family) || [];
    list.push(c);
    families.set(c.family, list);
  }

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const [family, familyControls] of families) {
    const familyNode: ControlNode = {
      type: 'control',
      id: `${frameworkId}:family:${family}`,
      controlId: family,
      frameworkId,
      title: `${family} (${familyControls.length})`,
      family,
      url: `/frameworks/${frameworkId}/family/${encodeURIComponent(family.toLowerCase().replace(/\s+/g, '-'))}`,
    };
    nodes.push(familyNode);
    edges.push({
      source: frameworkId,
      target: familyNode.id,
      type: 'contains',
      level: 'control',
    });
  }

  return { nodes, edges };
}

/**
 * Compute diff between previous and next graph states.
 */
function computeDiff(
  prev: KnowledgeGraphData,
  next: KnowledgeGraphData,
): GraphDiff {
  const prevNodeIds = new Set(prev.nodes.map(n => n.id));
  const nextNodeIds = new Set(next.nodes.map(n => n.id));
  const prevEdgeKeys = new Set(prev.edges.map(e => `${e.source}|${e.target}`));
  const nextEdgeKeys = new Set(next.edges.map(e => `${e.source}|${e.target}`));

  const addedNodes = next.nodes.filter(n => !prevNodeIds.has(n.id));
  const removedNodeIds = prev.nodes
    .filter(n => !nextNodeIds.has(n.id))
    .map(n => n.id);
  const addedEdges = next.edges.filter(e => !prevEdgeKeys.has(`${e.source}|${e.target}`));
  const removedEdgeKeys = Array.from(prevEdgeKeys).filter(k => !nextEdgeKeys.has(k));

  return { addedNodes, removedNodeIds, addedEdges, removedEdgeKeys };
}
