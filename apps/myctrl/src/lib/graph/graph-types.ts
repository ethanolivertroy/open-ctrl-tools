/**
 * Type definitions for the Compliance Knowledge Graph
 * Inspired by Quartz/Obsidian graph but purpose-built for compliance visualization
 */

import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';

// Category types matching our search filter categories
export type Category = 'fed' | 'ai' | 'ent' | 'owasp' | 'priv' | 'intl' | 'meta' | 'uncategorized';

// Semantic color tokens for each category — resolved at render time via getThemeColor()
import { getThemeColor, SEMANTIC_COLORS, type SemanticColor } from '@/lib/theme';

export const CATEGORY_COLOR_TOKENS: Record<Category, SemanticColor> = {
  fed: 'blue',
  ai: 'mauve',
  ent: 'teal',
  owasp: 'peach',
  priv: 'pink',
  intl: 'green',
  meta: 'yellow',
  uncategorized: 'overlay2',
};

/** Resolve category → current theme hex color. Call from client components only. */
export function getCategoryColor(cat: Category): string {
  return getThemeColor(SEMANTIC_COLORS[CATEGORY_COLOR_TOKENS[cat]]);
}

// Fallback static map for SSR / non-reactive contexts (Macchiato defaults)
export const CATEGORY_COLORS: Record<Category, string> = {
  fed: '#8aadf4',      // Blue
  ai: '#c6a0f6',       // Mauve
  ent: '#8bd5ca',      // Teal
  owasp: '#f5a97f',    // Peach
  priv: '#f5bde6',     // Pink
  intl: '#a6da95',     // Green
  meta: '#eed49f',     // Yellow
  uncategorized: '#939ab7', // Overlay2
};

export const CATEGORY_LABELS: Record<Category, string> = {
  fed: 'Federal',
  ai: 'AI',
  ent: 'Enterprise',
  owasp: 'OWASP',
  priv: 'Privacy',
  intl: 'International',
  meta: 'Meta',
  uncategorized: 'Other',
};

// Framework node in the graph
export interface FrameworkNode {
  type: 'framework';
  id: string;           // e.g., 'nist-800-53-r5'
  name: string;         // e.g., 'NIST 800-53 Rev 5'
  shortName: string;    // e.g., 'NIST'
  category: Category;
  controlCount: number;
  families: string[];
}

// Control node in the graph
export interface ControlNode {
  type: 'control';
  id: string;           // e.g., 'AC-2'
  controlId: string;    // Full control ID including framework context
  frameworkId: string;
  title: string;
  family: string;
  baselines?: string[]; // ['Low', 'Moderate', 'High']
  url: string;          // Navigation URL
}

// Union type for all node types
export type GraphNode = FrameworkNode | ControlNode;

// Extended node with D3 simulation properties
export type SimulationNode = GraphNode & SimulationNodeDatum;

// Edge/link between nodes
export interface GraphEdge {
  source: string;
  target: string;
  type: 'crosswalk' | 'contains' | 'enhances';
  weight?: number;      // Strength of relationship (for crosswalks)
  level?: 'framework' | 'control'; // LOD tier for rendering
  confidence?: 'high' | 'medium' | 'low'; // Mapping confidence
}

// Extended link with D3 simulation properties
export interface SimulationEdge extends SimulationLinkDatum<SimulationNode> {
  type: 'crosswalk' | 'contains' | 'enhances';
  weight?: number;
  level?: 'framework' | 'control';
  confidence?: 'high' | 'medium' | 'low';
}

// Complete graph data structure
export interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Simulation-ready graph data
export interface SimulationGraphData {
  nodes: SimulationNode[];
  links: SimulationEdge[];
}

// Graph configuration (adapted from Quartz D3Config)
export interface GraphConfig {
  // Physics
  drag: boolean;
  zoom: boolean;
  repelForce: number;     // Node repulsion strength
  centerForce: number;    // Center attraction strength
  linkDistance: number;   // Default edge length

  // Rendering
  scale: number;          // Initial zoom scale
  fontSize: number;       // Label font size multiplier
  opacityScale: number;   // Label opacity at default zoom

  // Behavior
  depth: number;          // Neighborhood depth (-1 = all)
  focusOnHover: boolean;  // Dim unrelated nodes on hover
  enableRadial: boolean;  // Radial layout

  // Filtering
  showCategories: Category[];
  showBaselines?: string[];
}

// Default configurations for different views
export const LOCAL_GRAPH_CONFIG: GraphConfig = {
  drag: true,
  zoom: true,
  depth: 1,
  scale: 1.1,
  repelForce: 0.5,
  centerForce: 0.3,
  linkDistance: 50,
  fontSize: 0.6,
  opacityScale: 1,
  focusOnHover: false,
  enableRadial: false,
  showCategories: ['fed', 'ai', 'ent', 'owasp', 'priv', 'intl', 'meta', 'uncategorized'],
};

export const GLOBAL_GRAPH_CONFIG: GraphConfig = {
  drag: true,
  zoom: true,
  depth: -1,
  scale: 0.9,
  repelForce: 0.4,
  centerForce: 0.15,
  linkDistance: 80,
  fontSize: 0.5,
  opacityScale: 0.8,
  focusOnHover: true,
  enableRadial: true,
  showCategories: ['fed', 'ai', 'ent', 'owasp', 'priv', 'intl', 'meta', 'uncategorized'],
};

// Render state for nodes (used by PixiJS renderer)
export interface NodeRenderState {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  alpha: number;
  label: string;
  labelAlpha: number;
  isHovered: boolean;
  isActive: boolean;
  isConnected: boolean;
}

// Render state for edges
export interface EdgeRenderState {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  color: string;
  alpha: number;
  width: number;
}

// Graph view mode
export type GraphViewMode = 'galaxy' | 'framework' | 'control';

// Props for the main graph component
export interface KnowledgeGraphProps {
  mode: GraphViewMode;
  focusId?: string;           // Framework or control ID to center on
  config?: Partial<GraphConfig>;
  className?: string;
  onNodeClick?: (node: GraphNode) => void;
  onNodeHover?: (node: GraphNode | null) => void;
}

// How nodes are colored in the graph
export type ColorMode = 'category' | 'status' | 'owner';

// Expansion state for drill-down
export interface GraphExpansionState {
  expandedFrameworks: Set<string>;
}

// Runtime display settings (controlled by sliders)
export interface GraphDisplayConfig {
  nodeSizeMultiplier: number;     // 0.5 – 3.0, default 1.0
  linkThicknessMultiplier: number; // 0.5 – 3.0, default 1.0
  textFadeThreshold: number;       // 0.3 – 2.0, default 0.8
  dimmedNodeOpacity: number;       // 0 – 0.5, default 0.15
}

// Runtime force settings (controlled by sliders)
export interface GraphForceConfig {
  repelStrength: number;   // 0.1 – 2.0, default 0.4
  centerForce: number;     // 0.05 – 0.5, default 0.15
  linkDistance: number;     // 30 – 200, default 80
  frozen: boolean;         // pause simulation
}

// Diff for incremental graph updates
export interface GraphDiff {
  addedNodes: GraphNode[];
  removedNodeIds: string[];
  addedEdges: GraphEdge[];
  removedEdgeKeys: string[]; // "source|target"
}

// Default display config
export const DEFAULT_DISPLAY_CONFIG: GraphDisplayConfig = {
  nodeSizeMultiplier: 1.0,
  linkThicknessMultiplier: 1.0,
  textFadeThreshold: 0.8,
  dimmedNodeOpacity: 0.15,
};

// Default force config
export const DEFAULT_FORCE_CONFIG: GraphForceConfig = {
  repelStrength: 0.4,
  centerForce: 0.15,
  linkDistance: 80,
  frozen: false,
};

// Family node (intermediate grouping for large frameworks)
export interface FamilyNode {
  type: 'family';
  id: string;            // e.g., 'nist-800-53-r5:family:AC'
  frameworkId: string;
  familyName: string;
  controlCount: number;
}

// Type guards
export function isFrameworkNode(node: GraphNode | FamilyNode): node is FrameworkNode {
  return node.type === 'framework';
}

export function isControlNode(node: GraphNode | FamilyNode): node is ControlNode {
  return node.type === 'control';
}

export function isFamilyNode(node: GraphNode | FamilyNode): node is FamilyNode {
  return node.type === 'family';
}
