/**
 * Graph Renderer - D3 Physics + PixiJS GPU Rendering
 *
 * Adapted from Quartz/Obsidian graph implementation for compliance visualization.
 * Uses D3 for force simulation and PixiJS for GPU-accelerated rendering.
 *
 * Supports incremental updates: expanding frameworks adds/removes nodes
 * without recreating the entire renderer.
 *
 * Performance optimizations:
 * - Deferred label creation: control node labels only created when visible + zoom > threshold
 * - Virtual control nodes: Graphics objects pooled and recycled based on viewport visibility
 * - Batch edge rendering: 3 shared Graphics instead of per-edge objects (O(1) draw calls)
 * - Object pools: recycled Text and Graphics objects reduce GC pressure and GPU texture churn
 */

import {
  forceSimulation,
  forceManyBody,
  forceCenter,
  forceLink,
  forceCollide,
  forceRadial,
  type Simulation,
} from 'd3-force';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomTransform } from 'd3-zoom';
import { drag } from 'd3-drag';
import { Application, Graphics, Text, Container, Circle } from 'pixi.js';
import { Group as TweenGroup, Tween as Tweened } from '@tweenjs/tween.js';
import type {
  GraphNode,
  GraphEdge,
  KnowledgeGraphData,
  SimulationNode,
  SimulationEdge,
  GraphConfig,
  GraphDisplayConfig,
  GraphForceConfig,
  GraphDiff,
  Category,
  ColorMode,
} from '@/lib/graph/graph-types';
import {
  CATEGORY_COLORS,
  isFrameworkNode,
  isControlNode,
  DEFAULT_DISPLAY_CONFIG,
} from '@/lib/graph/graph-types';
import { STATUS_COLORS, OWNER_COLORS } from '../../lib/db';

// ---- Hex color utility (replaces THREE.Color) ----

/**
 * Parse CSS hex color string to numeric hex value for PixiJS.
 * Handles #RGB, #RRGGBB, and bare RRGGBB formats.
 */
function hexToNumber(hex: string): number {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  return parseInt(h, 16);
}

// d3-force types link endpoints as `string | number | Node`, but this renderer
// only ever constructs links with resolved node objects (see render/updateGraph),
// so a primitive here is an invariant violation rather than a lookup to perform.
function linkEndpoint(endpoint: string | number | SimulationNode): SimulationNode {
  if (typeof endpoint === 'string' || typeof endpoint === 'number') {
    throw new Error(`Unresolved simulation link endpoint: ${endpoint}`);
  }
  return endpoint;
}

// Internal render data types

interface NodeRenderData {
  simulationData: SimulationNode;
  gfx: Graphics | null;      // null for unmaterialized virtual control nodes
  label: Text | null;         // null for control nodes (deferred creation until visible + zoom)
  color: string;
  alpha: number;
  active: boolean;
}

interface LinkRenderData {
  simulationData: SimulationEdge;
  // No individual gfx — edges are drawn into batch Graphics objects
  baseAlpha: number;     // default alpha for this edge type
  renderAlpha: number;   // current effective alpha (modified by highlighting)
  active: boolean;
}

interface TweenNode {
  update: (time: number) => void;
  stop: () => void;
}

export interface GraphRendererCallbacks {
  onNodeClick?: (node: GraphNode, event?: { ctrlKey?: boolean; metaKey?: boolean }) => void;
  onNodeHover?: (node: GraphNode | null) => void;
  onNodeRightClick?: (node: GraphNode, screenX: number, screenY: number) => void;
}

/**
 * Main graph renderer class
 */
export class GraphRenderer {
  private container: HTMLElement;
  private config: GraphConfig;
  private callbacks: GraphRendererCallbacks;

  private app: Application | null = null;
  private simulation: Simulation<SimulationNode, SimulationEdge> | null = null;
  private graphData: { nodes: SimulationNode[]; links: SimulationEdge[] } | null = null;

  private nodeRenderData: NodeRenderData[] = [];
  private linkRenderData: LinkRenderData[] = [];
  private nodeRenderMap = new Map<string, NodeRenderData>();
  private tweens = new Map<string, TweenNode>();

  private hoveredNodeId: string | null = null;
  private hoveredNeighbours = new Set<string>();
  private currentTransform: ZoomTransform = zoomIdentity;
  private dragging = false;
  private dragStartTime = 0;
  private stopAnimationFlag = false;

  // Pre-computed radius cache — rebuilt only when graph structure changes
  private nodeRadiusMap = new Map<string, number>();

  // Search highlight state — null means no search active
  private highlightedNodeIds: Set<string> | null = null;

  // Visited node IDs — for coloring visited nodes differently
  private visitedNodeIds = new Set<string>();

  // Control implementation statuses — for heat map coloring
  private controlStatusMap = new Map<string, string>(); // nodeId → status color
  private controlOwnerMap = new Map<string, string>(); // nodeId → owner name
  private colorMode: ColorMode = 'category';

  private width = 0;
  private height = 0;

  // Display config (controlled by sliders)
  private displayConfig: GraphDisplayConfig = { ...DEFAULT_DISPLAY_CONFIG };

  // Containers (stored for incremental updates)
  private nodesContainer: Container<Graphics> | null = null;
  private labelsContainer: Container<Text> | null = null;
  private linkContainer: Container<Graphics> | null = null;

  // Object pools for deferred/virtual nodes
  private labelPool: Text[] = [];
  private graphicsPool: Graphics[] = [];
  private static MAX_LABEL_POOL = 200;
  private static MAX_GFX_POOL = 1000;
  private materializedCount = 0;

  // Batch edge rendering — 5 shared Graphics, one stroke() per group per frame
  // Normal: fw(1) + ctrlHigh(1) + ctrlLow(1) + active(1) = 4 strokes vs thousands
  // Highlight: same + dim(1) = 5 strokes
  private batchFwEdgeGfx: Graphics | null = null;
  private batchCtrlHighEdgeGfx: Graphics | null = null;
  private batchCtrlLowEdgeGfx: Graphics | null = null;
  private batchDimEdgeGfx: Graphics | null = null;  // dimmed edges during highlighting
  private activeEdgeGfx: Graphics | null = null;

  // Per-frame materialization budget — prevents frame spikes during fast panning
  private static MAX_LABELS_PER_FRAME = 15;
  private static MAX_GFX_PER_FRAME = 50;

  constructor(
    container: HTMLElement,
    config: GraphConfig,
    callbacks: GraphRendererCallbacks = {}
  ) {
    this.container = container;
    this.config = config;
    this.callbacks = callbacks;
  }

  /**
   * Initialize and render the graph
   */
  async render(data: KnowledgeGraphData, focusNodeId?: string): Promise<void> {
    // Cleanup any existing render
    this.cleanup();

    this.width = this.container.offsetWidth || 800;
    this.height = this.container.offsetHeight || 600;

    // Convert to simulation data
    const nodeMap = new Map<string, SimulationNode>();
    const nodes: SimulationNode[] = data.nodes.map(n => {
      const simNode: SimulationNode = { ...n } as SimulationNode;
      nodeMap.set(n.id, simNode);
      return simNode;
    });

    const links: SimulationEdge[] = data.edges
      .filter(e => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map(e => ({
        source: nodeMap.get(e.source)!,
        target: nodeMap.get(e.target)!,
        type: e.type,
        weight: e.weight,
        level: e.level,
        confidence: e.confidence,
      }));

    this.graphData = { nodes, links };

    // Pre-compute radius cache
    this.rebuildRadiusCache();

    // Setup D3 force simulation
    this.setupSimulation();

    // Setup PixiJS application
    await this.setupPixi();

    // Create node and link graphics
    this.createGraphics();

    // Setup interactions
    this.setupInteractions();

    // Start animation loop
    this.startAnimation();

    // Zoom to fit after simulation settles
    if (focusNodeId) {
      this.focusOnNode(focusNodeId);
    }
  }

  /**
   * Incrementally update the graph with new data + diff.
   * Adds/removes nodes and edges without full re-render.
   */
  updateGraph(newData: KnowledgeGraphData, diff: GraphDiff): void {
    if (!this.app || !this.graphData || !this.simulation) return;

    const nodeMap = new Map<string, SimulationNode>();
    for (const n of this.graphData.nodes) {
      nodeMap.set(n.id, n);
    }

    // Remove nodes — batch with Set for single-pass filter
    if (diff.removedNodeIds.length > 0) {
      const removedSet = new Set(diff.removedNodeIds);
      for (const id of removedSet) {
        const renderData = this.nodeRenderMap.get(id);
        if (renderData) {
          if (renderData.gfx) {
            renderData.gfx.removeAllListeners();
            renderData.gfx.destroy();
            this.materializedCount--;
          }
          if (renderData.label) {
            renderData.label.destroy();
          }
          this.nodeRenderMap.delete(id);
        }
        nodeMap.delete(id);
      }
      this.nodeRenderData = this.nodeRenderData.filter(n => !removedSet.has(n.simulationData.id));
      this.graphData.nodes = this.graphData.nodes.filter(n => !removedSet.has(n.id));
    }

    // Remove edges — no per-link gfx to destroy with batch rendering
    const removedEdgeSet = new Set(diff.removedEdgeKeys);
    this.linkRenderData = this.linkRenderData.filter(l => {
      const source = linkEndpoint(l.simulationData.source);
      const target = linkEndpoint(l.simulationData.target);
      const key = `${source.id}|${target.id}`;
      return !removedEdgeSet.has(key);
    });
    this.graphData.links = this.graphData.links.filter(l => {
      const source = linkEndpoint(l.source);
      const target = linkEndpoint(l.target);
      const key = `${source.id}|${target.id}`;
      return !removedEdgeSet.has(key);
    });

    // Add nodes
    for (const node of diff.addedNodes) {
      const simNode: SimulationNode = { ...node } as SimulationNode;
      // Position near parent framework
      const parentId = isControlNode(node) ? node.frameworkId : null;
      const parent = parentId ? nodeMap.get(parentId) : null;
      if (parent && parent.x !== undefined && parent.y !== undefined) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 50;
        simNode.x = parent.x + Math.cos(angle) * dist;
        simNode.y = parent.y + Math.sin(angle) * dist;
      }
      nodeMap.set(node.id, simNode);
      this.graphData.nodes.push(simNode);

      // Create graphics (virtual for control nodes, eager for framework nodes)
      this.createNodeGraphics(simNode);
    }

    // Add edges — just store link data, batch rendering handles the rest
    for (const edge of diff.addedEdges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;
      const simEdge: SimulationEdge = {
        source,
        target,
        type: edge.type,
        weight: edge.weight,
        level: edge.level,
        confidence: edge.confidence,
      };
      this.graphData.links.push(simEdge);
      this.createLinkData(simEdge);
    }

    // Rebuild radius cache after structural changes
    this.rebuildRadiusCache();

    // Restart simulation gently
    this.simulation.nodes(this.graphData.nodes);
    const linkForce = this.simulation.force('link') as ReturnType<typeof forceLink>;
    if (linkForce) linkForce.links(this.graphData.links);
    this.simulation.alpha(0.3).restart();
  }

  /**
   * Update display/force config from sliders (live, no debounce needed).
   */
  updateConfig(update: {
    display?: Partial<GraphDisplayConfig>;
    forces?: Partial<GraphForceConfig>;
  }): void {
    if (update.display) {
      Object.assign(this.displayConfig, update.display);
    }

    if (update.forces && this.simulation) {
      const f = update.forces;
      if (f.repelStrength !== undefined) {
        const charge = this.simulation.force('charge') as ReturnType<typeof forceManyBody>;
        if (charge) charge.strength(-100 * f.repelStrength);
      }
      if (f.centerForce !== undefined) {
        const center = this.simulation.force('center') as ReturnType<typeof forceCenter>;
        if (center) center.strength(f.centerForce);
      }
      if (f.linkDistance !== undefined) {
        const link = this.simulation.force('link') as ReturnType<typeof forceLink>;
        if (link) link.distance(f.linkDistance);
      }
      if (f.frozen === true) {
        this.simulation.stop();
      } else if (f.frozen === false) {
        this.simulation.alpha(0.1).restart();
      } else {
        // Nudge simulation for force changes
        this.simulation.alpha(0.1).restart();
      }
    }
  }

  /**
   * Setup D3 force simulation
   */
  private setupSimulation(): void {
    if (!this.graphData) return;

    const { repelForce, centerForce, linkDistance, enableRadial } = this.config;
    const radius = (Math.min(this.width, this.height) / 2) * 0.8;

    this.simulation = forceSimulation<SimulationNode>(this.graphData.nodes)
      .force('charge', forceManyBody().strength(-100 * repelForce))
      .force('center', forceCenter().strength(centerForce))
      .force('link', forceLink<SimulationNode, SimulationEdge>(this.graphData.links).distance(linkDistance))
      .force('collide', forceCollide<SimulationNode>((n) => this.getNodeRadius(n)).iterations(3));

    if (enableRadial) {
      this.simulation.force('radial', forceRadial(radius).strength(0.2));
    }
  }

  /**
   * Setup PixiJS application
   */
  private async setupPixi(): Promise<void> {
    this.app = new Application();
    await this.app.init({
      width: this.width,
      height: this.height,
      antialias: true,
      autoStart: false,
      autoDensity: true,
      backgroundAlpha: 0,
      preference: 'webgpu',
      resolution: window.devicePixelRatio,
      eventMode: 'static',
    });

    this.container.appendChild(this.app.canvas);
    this.app.stage.interactive = false;
  }

  /**
   * Create graphics objects for nodes and links
   */
  private createGraphics(): void {
    if (!this.app || !this.graphData) return;

    const stage = this.app.stage;

    // Create containers with z-ordering
    this.labelsContainer = new Container<Text>({ zIndex: 3, isRenderGroup: true });
    this.nodesContainer = new Container<Graphics>({ zIndex: 2, isRenderGroup: true });
    this.linkContainer = new Container<Graphics>({ zIndex: 1, isRenderGroup: true });
    stage.addChild(this.linkContainer, this.nodesContainer, this.labelsContainer);

    // Batch edge graphics — 5 shared objects, one stroke() per group per frame
    this.batchFwEdgeGfx = new Graphics({ interactive: false, eventMode: 'none' });
    this.batchCtrlHighEdgeGfx = new Graphics({ interactive: false, eventMode: 'none' });
    this.batchCtrlLowEdgeGfx = new Graphics({ interactive: false, eventMode: 'none' });
    this.batchDimEdgeGfx = new Graphics({ interactive: false, eventMode: 'none' });
    this.activeEdgeGfx = new Graphics({ interactive: false, eventMode: 'none' });
    this.linkContainer.addChild(
      this.batchDimEdgeGfx, this.batchFwEdgeGfx, this.batchCtrlHighEdgeGfx,
      this.batchCtrlLowEdgeGfx, this.activeEdgeGfx,
    );

    // Create node graphics (framework = eager, control = virtual/deferred)
    for (const node of this.graphData.nodes) {
      this.createNodeGraphics(node);
    }

    // Create link data (no individual Graphics — batch rendering)
    for (const link of this.graphData.links) {
      this.createLinkData(link);
    }
  }

  /**
   * Create graphics for a single node and add to containers.
   * Framework nodes are created eagerly (always visible).
   * Control nodes start as virtual — no PixiJS objects until viewport entry.
   */
  private createNodeGraphics(node: SimulationNode): void {
    if (!this.nodesContainer || !this.labelsContainer) return;

    const color = this.getNodeColor(node);
    const isControl = isControlNode(node);

    if (isControl) {
      // Virtual control node — no PixiJS objects allocated.
      // Graphics + Text created lazily in the animation loop when
      // the node enters the viewport (see materializeControlNode/materializeLabel).
      const renderData: NodeRenderData = {
        simulationData: node,
        gfx: null,
        label: null,
        color,
        alpha: 1,
        active: false,
      };
      this.nodeRenderData.push(renderData);
      this.nodeRenderMap.set(node.id, renderData);
      return;
    }

    // Framework node — create Graphics and Text eagerly
    const { scale, fontSize } = this.config;
    const radius = this.getNodeRadius(node);
    const c = hexToNumber(color);

    // Label
    const label = new Text({
      interactive: false,
      eventMode: 'none',
      text: this.getNodeLabel(node),
      alpha: 0,
      anchor: { x: 0.5, y: -0.5 },
      style: {
        fontSize: fontSize * 14,
        fill: '#ffffff',
        fontFamily: "'Instrument Sans', system-ui, sans-serif",
        fontWeight: '600',
        dropShadow: {
          alpha: 0.2,
          blur: 4,
          color: '#000000',
          distance: 2,
        }
      },
      resolution: window.devicePixelRatio * 4,
    });
    label.scale.set(1 / scale);

    // Node graphic
    const gfx = new Graphics({
      interactive: true,
      label: node.id,
      eventMode: 'static',
      hitArea: new Circle(0, 0, radius + 8),
      cursor: 'pointer',
    });

    // Framework: soft outer halo + solid core
    gfx
      .circle(0, 0, radius * 1.3).fill({ color: c, alpha: 0.15 })
      .circle(0, 0, radius).fill({ color: c, alpha: 0.85 });

    // Event handlers
    gfx.on('pointerover', () => {
      this.updateHoverInfo(node.id);
      this.callbacks.onNodeHover?.(this.getOriginalNode(node.id));
      if (!this.dragging) {
        this.renderHoverEffects();
      }
    });

    gfx.on('pointerleave', () => {
      this.updateHoverInfo(null);
      this.callbacks.onNodeHover?.(null);
      if (!this.dragging) {
        this.renderHoverEffects();
      }
    });

    gfx.on('rightclick', (e: any) => {
      const originalNode = this.getOriginalNode(node.id);
      if (originalNode) {
        const domEvent = e.nativeEvent || e;
        this.callbacks.onNodeRightClick?.(originalNode, domEvent?.clientX || 0, domEvent?.clientY || 0);
      }
    });

    this.nodesContainer.addChild(gfx);
    this.labelsContainer.addChild(label);

    const renderData: NodeRenderData = {
      simulationData: node,
      gfx,
      label,
      color,
      alpha: 1,
      active: false,
    };
    this.nodeRenderData.push(renderData);
    this.nodeRenderMap.set(node.id, renderData);
  }

  /**
   * Store link data for batch rendering (no individual Graphics created).
   */
  private createLinkData(link: SimulationEdge): void {
    const isControlLevel = link.level === 'control';
    const alpha = isControlLevel ? 0.03 : 0.08;
    this.linkRenderData.push({
      simulationData: link,
      baseAlpha: alpha,
      renderAlpha: alpha,
      active: false,
    });
  }

  // ---- Object pool: materialization/dematerialization ----

  /**
   * Materialize a virtual control node — create or reuse a Graphics from the pool.
   * Called by the animation loop when a control node enters the viewport.
   */
  private materializeControlNode(n: NodeRenderData): void {
    if (n.gfx) return; // Already materialized

    const radius = this.getNodeRadius(n.simulationData);
    const c = hexToNumber(n.color);

    // Reuse from pool or create new
    let gfx = this.graphicsPool.pop();
    if (gfx) {
      gfx.clear();
    } else {
      gfx = new Graphics({
        interactive: true,
        eventMode: 'static',
        cursor: 'pointer',
      });
    }

    gfx.label = n.simulationData.id;
    gfx.hitArea = new Circle(0, 0, radius + 8);
    gfx.circle(0, 0, radius).fill({ color: c, alpha: 0.8 });
    gfx.visible = true;
    gfx.alpha = n.alpha;

    // Set initial position immediately to avoid 1-frame flash at origin
    const worldX = (n.simulationData.x || 0) + this.width / 2;
    const worldY = (n.simulationData.y || 0) + this.height / 2;
    gfx.position.set(worldX, worldY);

    // Attach event handlers (removed on dematerialization)
    gfx.removeAllListeners();
    const nodeId = n.simulationData.id;
    gfx.on('pointerover', () => {
      this.updateHoverInfo(nodeId);
      this.callbacks.onNodeHover?.(this.getOriginalNode(nodeId));
      if (!this.dragging) this.renderHoverEffects();
    });
    gfx.on('pointerleave', () => {
      this.updateHoverInfo(null);
      this.callbacks.onNodeHover?.(null);
      if (!this.dragging) this.renderHoverEffects();
    });
    gfx.on('rightclick', (e: any) => {
      const originalNode = this.getOriginalNode(nodeId);
      if (originalNode) {
        const domEvent = e.nativeEvent || e;
        this.callbacks.onNodeRightClick?.(originalNode, domEvent?.clientX || 0, domEvent?.clientY || 0);
      }
    });

    this.nodesContainer!.addChild(gfx);
    n.gfx = gfx;
    this.materializedCount++;
  }

  /**
   * Dematerialize a control node — recycle its Graphics back to the pool.
   * Called by the animation loop when a control node leaves the viewport.
   */
  private dematerializeControlNode(n: NodeRenderData): void {
    if (!n.gfx) return;

    n.gfx.removeAllListeners();
    this.nodesContainer!.removeChild(n.gfx);

    if (this.graphicsPool.length < GraphRenderer.MAX_GFX_POOL) {
      n.gfx.visible = false;
      this.graphicsPool.push(n.gfx);
    } else {
      n.gfx.destroy();
    }
    n.gfx = null;
    this.materializedCount--;

    // Also recycle label if present
    this.dematerializeLabel(n);
  }

  /**
   * Lazily create a label for a control node from the pool.
   * Called when a control node is visible AND zoom exceeds the label threshold.
   */
  private materializeLabel(n: NodeRenderData): void {
    if (n.label) return; // Already has label

    let label = this.labelPool.pop();
    if (label) {
      label.text = this.getNodeLabel(n.simulationData);
      label.visible = true;
    } else {
      label = new Text({
        interactive: false,
        eventMode: 'none',
        text: this.getNodeLabel(n.simulationData),
        alpha: 0,
        anchor: { x: 0.5, y: -0.5 },
        style: {
          fontSize: this.config.fontSize * 11,
          fill: '#ffffff',
          fontFamily: "'Instrument Sans', system-ui, sans-serif",
          fontWeight: '500',
          dropShadow: {
            alpha: 0.2,
            blur: 4,
            color: '#000000',
            distance: 2,
          },
        },
        resolution: window.devicePixelRatio * 2,
      });
      label.scale.set(1 / this.config.scale);
    }

    // Set initial alpha based on current zoom
    const scaleValue = this.currentTransform.k * this.config.opacityScale;
    const controlAlpha = Math.max((scaleValue - 1.5) / 2.0, 0);
    label.alpha = Math.min(controlAlpha, 0.6);

    // Set initial position
    const worldX = (n.simulationData.x || 0) + this.width / 2;
    const worldY = (n.simulationData.y || 0) + this.height / 2;
    label.position.set(worldX, worldY);

    this.labelsContainer!.addChild(label);
    n.label = label;
  }

  /**
   * Recycle a control node's label back to the pool.
   * Called when a control node leaves the viewport or zoom drops below threshold.
   */
  private dematerializeLabel(n: NodeRenderData): void {
    if (!n.label) return;

    this.labelsContainer!.removeChild(n.label);

    if (this.labelPool.length < GraphRenderer.MAX_LABEL_POOL) {
      n.label.visible = false;
      this.labelPool.push(n.label);
    } else {
      n.label.destroy();
    }
    n.label = null;
  }

  /**
   * Setup drag and zoom interactions
   */
  private setupInteractions(): void {
    if (!this.app || !this.graphData) return;

    const { drag: enableDrag, zoom: enableZoom, opacityScale, scale } = this.config;

    // Drag behavior
    if (enableDrag) {
      select<HTMLCanvasElement, SimulationNode | undefined>(this.app.canvas).call(
        drag<HTMLCanvasElement, SimulationNode | undefined>()
          .container(() => this.app!.canvas)
          .subject(() => this.graphData?.nodes.find(n => n.id === this.hoveredNodeId))
          .on('start', (event) => {
            if (!event.active && this.simulation) {
              this.simulation.alphaTarget(0.3).restart();
            }
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
            (event.subject as any).__initialDragPos = {
              x: event.subject.x,
              y: event.subject.y,
            };
            this.dragStartTime = Date.now();
            this.dragging = true;
          })
          .on('drag', (event) => {
            const initPos = (event.subject as any).__initialDragPos;
            event.subject.fx = initPos.x + (event.x - initPos.x) / this.currentTransform.k;
            event.subject.fy = initPos.y + (event.y - initPos.y) / this.currentTransform.k;
          })
          .on('end', (event) => {
            if (!event.active && this.simulation) {
              this.simulation.alphaTarget(0);
            }
            event.subject.fx = null;
            event.subject.fy = null;
            this.dragging = false;

            // Click detection (< 300ms drag = click)
            if (Date.now() - this.dragStartTime < 300) {
              const originalNode = this.getOriginalNode(event.subject.id);
              if (originalNode) {
                // Pass keyboard modifiers for Ctrl+click detection
                const domEvent = event.sourceEvent as MouseEvent | undefined;
                this.callbacks.onNodeClick?.(originalNode, {
                  ctrlKey: domEvent?.ctrlKey || domEvent?.metaKey,
                });
              }
            }
          })
      );
    } else {
      // Simple click handler when drag is disabled
      for (const node of this.nodeRenderData) {
        if (!node.gfx) continue; // Skip virtual nodes
        node.gfx.on('click', () => {
          const originalNode = this.getOriginalNode(node.simulationData.id);
          if (originalNode) {
            this.callbacks.onNodeClick?.(originalNode);
          }
        });
      }
    }

    // Zoom behavior
    if (enableZoom) {
      select<HTMLCanvasElement, SimulationNode>(this.app.canvas).call(
        zoom<HTMLCanvasElement, SimulationNode>()
          .extent([[0, 0], [this.width, this.height]])
          .scaleExtent([0.05, 8])
          .on('zoom', ({ transform }) => {
            this.currentTransform = transform;
            this.app!.stage.scale.set(transform.k, transform.k);
            this.app!.stage.position.set(transform.x, transform.y);

            // Adjust label opacity based on zoom (framework labels only;
            // control labels are managed by the animation loop's materialize/dematerialize)
            const threshold = this.displayConfig.textFadeThreshold;
            const scaleValue = transform.k * this.config.opacityScale;
            const scaleOpacity = Math.max((scaleValue - threshold) / 3.0, 0);
            const activeLabelSet = new Set(
              this.nodeRenderData.filter(n => n.active && n.label).map(n => n.label!)
            );

            for (const node of this.nodeRenderData) {
              if (!node.label) continue; // Skip unmaterialized
              if (activeLabelSet.has(node.label)) continue; // Skip active (hover)

              const isControl = isControlNode(node.simulationData);
              const controlThreshold = isControl ? 1.5 : threshold;
              const nodeOpacity = isControl
                ? Math.max((scaleValue - controlThreshold) / 2.0, 0)
                : scaleOpacity;
              node.label.alpha = Math.min(nodeOpacity, 0.6);
            }
          })
      );
    }
  }

  /**
   * Start the animation loop with viewport culling, lazy materialization,
   * and batch edge rendering (one stroke() per style group per frame).
   */
  private startAnimation(): void {
    this.stopAnimationFlag = false;

    const animate = (time: number) => {
      if (this.stopAnimationFlag || !this.app) return;

      const t = time * 0.001;

      // Compute viewport bounds for culling (world-space)
      const k = this.currentTransform.k;
      const tx = this.currentTransform.x;
      const ty = this.currentTransform.y;

      // Materialization uses standard 20% margin
      const matMargin = 0.2;
      const vpLeft = (-tx / k) - (this.width * matMargin / k);
      const vpRight = ((this.width - tx) / k) + (this.width * matMargin / k);
      const vpTop = (-ty / k) - (this.height * matMargin / k);
      const vpBottom = ((this.height - ty) / k) + (this.height * matMargin / k);

      // Dematerialization uses larger 60% margin (hysteresis to prevent churn)
      const dematMargin = 0.6;
      const dematLeft = (-tx / k) - (this.width * dematMargin / k);
      const dematRight = ((this.width - tx) / k) + (this.width * dematMargin / k);
      const dematTop = (-ty / k) - (this.height * dematMargin / k);
      const dematBottom = ((this.height - ty) / k) + (this.height * dematMargin / k);

      const sizeMul = this.displayConfig.nodeSizeMultiplier;
      const thickMul = this.displayConfig.linkThicknessMultiplier;
      const labelZoomThreshold = 1.5;

      // Per-frame materialization budgets
      let gfxBudget = GraphRenderer.MAX_GFX_PER_FRAME;
      let labelBudget = GraphRenderer.MAX_LABELS_PER_FRAME;

      // ---- Update node positions with lazy materialization ----
      for (const n of this.nodeRenderData) {
        const { x, y } = n.simulationData;
        if (x === undefined || y === undefined) continue;

        const worldX = x + this.width / 2;
        const worldY = y + this.height / 2;

        const inViewport = worldX >= vpLeft && worldX <= vpRight &&
                           worldY >= vpTop && worldY <= vpBottom;
        // Wider check for dematerialization (hysteresis)
        const inDematZone = worldX >= dematLeft && worldX <= dematRight &&
                            worldY >= dematTop && worldY <= dematBottom;

        const isControl = isControlNode(n.simulationData);
        const showByZoom = isControl ? (k > 0.4 || n.active) : true;
        // Active nodes (hovered/neighbor) stay visible regardless of viewport
        const shouldBeVisible = (inViewport && showByZoom) || n.active;
        // Node stays materialized within the wider demat zone
        const shouldStayMaterialized = (inDematZone && showByZoom) || n.active;

        if (isControl) {
          // Lazy materialization with frame budget
          if (shouldBeVisible && !n.gfx && gfxBudget > 0) {
            this.materializeControlNode(n);
            gfxBudget--;
          } else if (!shouldStayMaterialized && n.gfx && !n.active) {
            this.dematerializeControlNode(n);
            continue;
          }

          // Lazy label creation with frame budget
          const shouldShowLabel = shouldBeVisible && k > labelZoomThreshold;
          const shouldKeepLabel = shouldStayMaterialized && k > labelZoomThreshold - 0.3;
          if (shouldShowLabel && !n.label && labelBudget > 0) {
            this.materializeLabel(n);
            labelBudget--;
          } else if (!shouldKeepLabel && n.label) {
            this.dematerializeLabel(n);
          }
        }

        // Skip virtual (unmaterialized) nodes
        if (!n.gfx) continue;

        n.gfx.visible = shouldBeVisible;
        if (n.label) n.label.visible = shouldBeVisible;

        if (!shouldBeVisible) continue;

        // Subtle ambient drift for framework nodes only
        let driftX = 0, driftY = 0;
        if (!isControl) {
          const phase = (n.simulationData as any).index || 0;
          driftX = Math.sin(t * 0.5 + phase) * 2;
          driftY = Math.cos(t * 0.4 + phase) * 2;
        }

        n.gfx.position.set(worldX + driftX, worldY + driftY);
        if (n.label) n.label.position.set(worldX + driftX, worldY + driftY);

        // Apply size multiplier
        if (sizeMul !== 1) {
          n.gfx.scale.set(sizeMul);
        }
      }

      // ---- Batch edge rendering (one stroke per style group) ----
      const fw = this.batchFwEdgeGfx;
      const ctrlHigh = this.batchCtrlHighEdgeGfx;
      const ctrlLow = this.batchCtrlLowEdgeGfx;
      const dim = this.batchDimEdgeGfx;
      const active = this.activeEdgeGfx;

      if (fw && ctrlHigh && ctrlLow && dim && active) {
        fw.clear();
        ctrlHigh.clear();
        ctrlLow.clear();
        dim.clear();
        active.clear();

        // Track which batches have paths (skip empty stroke calls)
        let hasFw = false, hasCtrlHigh = false, hasCtrlLow = false;
        let hasDim = false, hasActive = false;

        const isHighlighting = this.highlightedNodeIds !== null;
        // Pre-compute dim threshold: edges at or below this alpha are "dimmed"
        const dimAlphaThreshold = 0.02;

        for (const l of this.linkRenderData) {
          const source = linkEndpoint(l.simulationData.source);
          const target = linkEndpoint(l.simulationData.target);
          if (!source.x || !source.y || !target.x || !target.y) continue;

          const sx = source.x + this.width / 2;
          const sy = source.y + this.height / 2;
          const ex = target.x + this.width / 2;
          const ey = target.y + this.height / 2;

          // Cull links where both endpoints are off-screen
          const srcVisible = sx >= vpLeft && sx <= vpRight && sy >= vpTop && sy <= vpBottom;
          const tgtVisible = ex >= vpLeft && ex <= vpRight && ey >= vpTop && ey <= vpBottom;
          if (!srcVisible && !tgtVisible) continue;

          const isControlEdge = l.simulationData.level === 'control';
          const confidence = l.simulationData.confidence;

          // Active edges → active batch
          if (l.active) {
            active.moveTo(sx, sy).lineTo(ex, ey);
            hasActive = true;
            continue;
          }

          // During highlighting, route dimmed edges to the dim batch
          // (all dim edges share alpha ~0.01, style differences invisible)
          if (isHighlighting && l.renderAlpha <= dimAlphaThreshold) {
            dim.moveTo(sx, sy).lineTo(ex, ey);
            hasDim = true;
            continue;
          }

          // Route to style-specific batch and accumulate sub-paths
          if (!isControlEdge) {
            fw.moveTo(sx, sy).lineTo(ex, ey);
            hasFw = true;
          } else {
            // Dashed control edges — draw dash segments
            const dx = ex - sx;
            const dy = ey - sy;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 1) continue; // Skip zero-length edges
            const dashLen = 4;
            const gapLen = 4;
            const steps = Math.floor(len / (dashLen + gapLen));
            const targetGfx = confidence === 'high' ? ctrlHigh : ctrlLow;
            for (let i = 0; i < steps; i++) {
              const t0 = (i * (dashLen + gapLen)) / len;
              const t1 = Math.min((i * (dashLen + gapLen) + dashLen) / len, 1);
              targetGfx.moveTo(sx + dx * t0, sy + dy * t0);
              targetGfx.lineTo(sx + dx * t1, sy + dy * t1);
            }
            if (confidence === 'high') hasCtrlHigh = true;
            else hasCtrlLow = true;
          }
        }

        // One stroke() per style group — the key optimization
        // (was: one stroke per edge = thousands of calls)
        const fwAlpha = isHighlighting ? 0.3 : 0.08;
        if (hasFw) fw.stroke({ alpha: fwAlpha, width: 1.2 * thickMul, color: 0x888888 });
        const ctrlAlpha = isHighlighting ? 0.3 : 0.03;
        if (hasCtrlHigh) ctrlHigh.stroke({ alpha: ctrlAlpha, width: 0.8 * thickMul, color: 0xffffff });
        if (hasCtrlLow) ctrlLow.stroke({ alpha: ctrlAlpha, width: 0.4 * thickMul, color: 0x888888 });
        if (hasDim) dim.stroke({ alpha: 0.01, width: 0.5 * thickMul, color: 0x888888 });
        if (hasActive) active.stroke({ alpha: 0.8, width: 2.5 * thickMul, color: 0x94e2d5 });
      }

      // Update tweens
      this.tweens.forEach(t => t.update(time));

      // Render
      this.app.renderer.render(this.app.stage);
      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  /**
   * Update hover state
   */
  private updateHoverInfo(nodeId: string | null): void {
    this.hoveredNodeId = nodeId;

    if (nodeId === null) {
      this.hoveredNeighbours.clear();
      for (const n of this.nodeRenderData) n.active = false;
      for (const l of this.linkRenderData) l.active = false;
    } else {
      this.hoveredNeighbours = new Set<string>();
      this.hoveredNeighbours.add(nodeId);
      for (const l of this.linkRenderData) {
        const source = linkEndpoint(l.simulationData.source);
        const target = linkEndpoint(l.simulationData.target);
        if (source.id === nodeId || target.id === nodeId) {
          this.hoveredNeighbours.add(source.id);
          this.hoveredNeighbours.add(target.id);
          l.active = true;
        } else {
          l.active = false;
        }
      }
      for (const n of this.nodeRenderData) {
        n.active = this.hoveredNeighbours.has(n.simulationData.id);
      }
    }
  }

  /**
   * Render hover effects with animations
   */
  private renderHoverEffects(): void {
    const { scale } = this.config;
    const dimmedOpacity = this.displayConfig.dimmedNodeOpacity;

    // If search highlighting is active, skip hover dimming (search takes priority)
    if (this.highlightedNodeIds !== null) return;

    // Animate nodes — only create tweens for visible, materialized nodes
    this.tweens.get('hover')?.stop();
    const nodeTweenGroup = new TweenGroup();
    for (const n of this.nodeRenderData) {
      if (!n.gfx) continue; // Skip virtual nodes
      let alpha = 1;
      let targetScale = 1;
      if (this.hoveredNodeId !== null) {
        alpha = n.active ? 1 : dimmedOpacity;
        targetScale = n.active ? 1.1 : 0.9;
      }
      if (n.gfx.visible) {
        nodeTweenGroup.add(new Tweened<Graphics>(n.gfx).to({ alpha, scale: { x: targetScale, y: targetScale } }, 400).easing(t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2));
      } else {
        // Apply immediately without animation for off-screen nodes
        n.gfx.alpha = alpha;
        n.gfx.scale.set(targetScale);
      }
    }
    nodeTweenGroup.getAll().forEach(tw => tw.start());
    this.tweens.set('hover', {
      update: nodeTweenGroup.update.bind(nodeTweenGroup),
      stop: () => nodeTweenGroup.getAll().forEach(tw => tw.stop()),
    });

    // Animate labels — only visible, materialized
    this.tweens.get('label')?.stop();
    const labelTweenGroup = new TweenGroup();
    const defaultScale = 1 / scale;
    for (const n of this.nodeRenderData) {
      if (!n.label) continue; // Skip deferred labels
      const isHovered = this.hoveredNodeId === n.simulationData.id;
      const isNeighbour = this.hoveredNodeId !== null && n.active && !isHovered;

      let alpha = n.label.alpha;
      let s = defaultScale;

      if (isHovered) {
        alpha = 1;
        s = defaultScale * 1.3;
      } else if (isNeighbour) {
        alpha = 0.8;
        s = defaultScale * 1.1;
      } else if (this.hoveredNodeId !== null) {
        alpha = 0;
      }

      if (n.gfx && n.gfx.visible) {
        labelTweenGroup.add(
          new Tweened<Text>(n.label).to({
            alpha,
            scale: { x: s, y: s },
          }, 300).easing(t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
        );
      } else {
        n.label.alpha = alpha;
        n.label.scale.set(s);
      }
    }
    labelTweenGroup.getAll().forEach(tw => tw.start());
    this.tweens.set('label', {
      update: labelTweenGroup.update.bind(labelTweenGroup),
      stop: () => labelTweenGroup.getAll().forEach(tw => tw.stop()),
    });
  }

  /**
   * Get node color based on category
   */
  private getNodeColor(node: SimulationNode): string {
    // Status mode: color by implementation status
    if (this.colorMode === 'status' && isControlNode(node)) {
      const statusColor = this.controlStatusMap.get(node.id);
      return statusColor || STATUS_COLORS['not-assessed'];
    }

    // Owner mode: color by responsible team
    if (this.colorMode === 'owner' && isControlNode(node)) {
      const owner = this.controlOwnerMap.get(node.id);
      if (owner && OWNER_COLORS[owner]) return OWNER_COLORS[owner];
      if (owner) {
        // Hash unknown owner names to a color
        let hash = 0;
        for (let i = 0; i < owner.length; i++) hash = ((hash << 5) - hash + owner.charCodeAt(i)) | 0;
        const colors = Object.values(OWNER_COLORS);
        return colors[Math.abs(hash) % colors.length];
      }
      return '#494d64'; // unassigned
    }

    // Visited nodes get teal tint (in category mode)
    if (this.visitedNodeIds.has(node.id)) {
      return '#94e2d5';
    }

    if (isFrameworkNode(node)) {
      return CATEGORY_COLORS[node.category] || CATEGORY_COLORS.uncategorized;
    }
    // Control nodes inherit parent framework color
    if (isControlNode(node)) {
      const parent = this.graphData?.nodes.find(
        n => n.id === node.frameworkId && isFrameworkNode(n)
      );
      if (parent && isFrameworkNode(parent)) {
        return CATEGORY_COLORS[parent.category] || CATEGORY_COLORS.uncategorized;
      }
    }
    return '#6b7280';
  }

  /**
   * Rebuild the radius cache from current graph data.
   * One pass over edges to count links, then one pass over nodes.
   */
  private rebuildRadiusCache(): void {
    this.nodeRadiusMap.clear();
    if (!this.graphData) return;

    const linkCounts = new Map<string, number>();
    for (const l of this.graphData.links) {
      const source = linkEndpoint(l.source);
      const target = linkEndpoint(l.target);
      linkCounts.set(source.id, (linkCounts.get(source.id) || 0) + 1);
      linkCounts.set(target.id, (linkCounts.get(target.id) || 0) + 1);
    }

    for (const node of this.graphData.nodes) {
      const numLinks = linkCounts.get(node.id) || 0;
      let radius: number;
      if (isControlNode(node)) {
        radius = 4;
      } else if (isFrameworkNode(node)) {
        const baseSize = 8 + Math.sqrt(node.controlCount / 50);
        radius = Math.min(baseSize + Math.sqrt(numLinks) * 2, 30);
      } else {
        radius = 4 + Math.sqrt(numLinks);
      }
      this.nodeRadiusMap.set(node.id, radius);
    }
  }

  /**
   * Get node radius (from cache)
   */
  private getNodeRadius(node: SimulationNode): number {
    return this.nodeRadiusMap.get(node.id) || 8;
  }

  /**
   * Get node label text
   */
  private getNodeLabel(node: SimulationNode): string {
    if (isFrameworkNode(node)) {
      return node.shortName;
    }
    if (isControlNode(node)) {
      return node.controlId;
    }
    return (node as SimulationNode).id;
  }

  /**
   * Get original node data by ID
   */
  private getOriginalNode(id: string): GraphNode | null {
    const simNode = this.graphData?.nodes.find(n => n.id === id);
    if (!simNode) return null;

    // Return a clean copy without simulation properties
    if (isFrameworkNode(simNode)) {
      return {
        type: 'framework',
        id: simNode.id,
        name: simNode.name,
        shortName: simNode.shortName,
        category: simNode.category,
        controlCount: simNode.controlCount,
        families: simNode.families,
      };
    }

    if (isControlNode(simNode)) {
      return {
        type: 'control',
        id: simNode.id,
        controlId: simNode.controlId,
        frameworkId: simNode.frameworkId,
        title: simNode.title,
        family: simNode.family,
        url: simNode.url,
      };
    }

    return simNode as GraphNode;
  }

  /**
   * Focus/zoom to a specific node with smooth animation
   */
  focusOnNode(nodeId: string, zoomLevel: number = 1.5): void {
    if (!this.app || !this.graphData) return;

    // Find the node
    const node = this.nodeRenderData.find(n => n.simulationData.id === nodeId);
    if (!node) return;

    // Wait for simulation to settle a bit before zooming
    setTimeout(() => {
      const { x, y } = node.simulationData;
      if (x === undefined || y === undefined) return;

      // Calculate node position in screen coordinates
      const nodeX = x + this.width / 2;
      const nodeY = y + this.height / 2;

      // Calculate target transform to center on node
      const targetX = this.width / 2 - nodeX * zoomLevel;
      const targetY = this.height / 2 - nodeY * zoomLevel;

      // Animate the transition
      this.tweens.get('zoom')?.stop();
      const zoomTweenGroup = new TweenGroup();

      const current = {
        x: this.currentTransform.x,
        y: this.currentTransform.y,
        k: this.currentTransform.k,
      };

      const target = { x: targetX, y: targetY, k: zoomLevel };

      zoomTweenGroup.add(
        new Tweened(current)
          .to(target, 800)
          .easing((t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
          .onUpdate(() => {
            this.app!.stage.scale.set(current.k, current.k);
            this.app!.stage.position.set(current.x, current.y);
            this.currentTransform = zoomIdentity
              .translate(current.x, current.y)
              .scale(current.k);

            // Update label opacity during zoom
            const scaleOpacity = Math.max((current.k * this.config.opacityScale - 1) / 3.75, 0);
            for (const n of this.nodeRenderData) {
              if (!n.label) continue; // Skip deferred labels
              if (n.simulationData.id !== nodeId) {
                n.label.alpha = scaleOpacity;
              }
            }
          })
          .onComplete(() => {
            // Highlight the focused node
            this.updateHoverInfo(nodeId);
            this.renderHoverEffects();
          })
      );

      zoomTweenGroup.getAll().forEach(tw => tw.start());
      this.tweens.set('zoom', {
        update: zoomTweenGroup.update.bind(zoomTweenGroup),
        stop: () => zoomTweenGroup.getAll().forEach(tw => tw.stop()),
      });
    }, 500); // Wait for simulation to stabilize
  }

  /**
   * Public method to zoom to a node by ID
   */
  zoomToNode(nodeId: string): void {
    this.focusOnNode(nodeId);
  }

  /**
   * Highlight specific nodes (for search). Non-highlighted nodes dim.
   * Pass null to clear highlighting.
   */
  highlightNodes(nodeIds: Set<string> | null): void {
    this.highlightedNodeIds = nodeIds;

    // Apply immediately to all materialized nodes
    for (const n of this.nodeRenderData) {
      if (nodeIds === null) {
        // Clear: restore full opacity
        if (n.gfx) n.gfx.alpha = 1;
        if (n.label) n.label.alpha = 0; // Labels controlled by zoom level
      } else if (nodeIds.has(n.simulationData.id)) {
        // Match: full brightness
        if (n.gfx) n.gfx.alpha = 1;
        if (n.label) n.label.alpha = 1;
      } else {
        // Non-match: dim
        if (n.gfx) n.gfx.alpha = 0.08;
        if (n.label) n.label.alpha = 0;
      }
    }

    // Update link render alphas — batch rendering uses these values
    for (const l of this.linkRenderData) {
      if (nodeIds === null) {
        l.renderAlpha = l.baseAlpha; // Restore default
      } else {
        const srcMatch = nodeIds.has(linkEndpoint(l.simulationData.source).id);
        const tgtMatch = nodeIds.has(linkEndpoint(l.simulationData.target).id);
        l.renderAlpha = (srcMatch && tgtMatch) ? 0.3 : 0.01;
      }
    }
  }

  /**
   * Set visited node IDs (for coloring visited nodes with a distinct tint).
   */
  setVisitedNodes(ids: Set<string>): void {
    this.visitedNodeIds = ids;
  }

  /**
   * Set control status map for heat map coloring.
   * Map keys are "frameworkId:controlId", values are ImplementationStatus strings.
   */
  setControlStatuses(statusMap: Map<string, string>): void {
    this.controlStatusMap.clear();
    for (const [id, status] of statusMap) {
      const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS];
      if (color) this.controlStatusMap.set(id, color);
    }
  }

  /**
   * Set control owner map for owner coloring.
   */
  setControlOwners(ownerMap: Map<string, string>): void {
    this.controlOwnerMap = ownerMap;
  }

  /**
   * Set color mode (category, implementation status, or owner).
   * Triggers a full node re-color.
   */
  setColorMode(mode: ColorMode): void {
    this.colorMode = mode;
    // Re-color all nodes (only materialized ones)
    for (const n of this.nodeRenderData) {
      const color = this.getNodeColor(n.simulationData);
      n.color = color;
      // Only redraw materialized nodes
      if (!n.gfx) continue;
      const c = hexToNumber(color);
      n.gfx.clear();
      const radius = this.getNodeRadius(n.simulationData);
      const isControl = isControlNode(n.simulationData);
      if (isControl) {
        n.gfx.circle(0, 0, radius).fill({ color: c, alpha: 0.8 });
      } else {
        n.gfx
          .circle(0, 0, radius * 1.3).fill({ color: c, alpha: 0.15 })
          .circle(0, 0, radius).fill({ color: c, alpha: 0.85 });
      }
    }
  }

  /**
   * Resize the graph
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    if (this.app) {
      this.app.renderer.resize(width, height);
    }
  }

  /**
   * Cleanup and destroy the renderer
   */
  cleanup(): void {
    this.stopAnimationFlag = true;
    this.tweens.forEach(t => t.stop());
    this.tweens.clear();

    // Destroy pooled objects
    for (const label of this.labelPool) label.destroy();
    this.labelPool = [];
    for (const gfx of this.graphicsPool) gfx.destroy();
    this.graphicsPool = [];
    this.materializedCount = 0;

    this.nodeRenderData = [];
    this.linkRenderData = [];
    this.nodeRenderMap.clear();
    this.simulation?.stop();
    this.simulation = null;
    this.graphData = null;
    this.nodesContainer = null;
    this.labelsContainer = null;
    this.linkContainer = null;
    this.batchFwEdgeGfx = null;
    this.batchCtrlHighEdgeGfx = null;
    this.batchCtrlLowEdgeGfx = null;
    this.batchDimEdgeGfx = null;
    this.activeEdgeGfx = null;

    if (this.app) {
      this.app.destroy(true, { children: true });
      this.app = null;
    }
  }
}
