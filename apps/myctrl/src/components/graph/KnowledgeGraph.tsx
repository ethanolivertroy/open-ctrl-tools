/**
 * Knowledge Graph Component
 *
 * Interactive visualization of compliance frameworks and their relationships.
 * Supports framework expansion to drill down into individual controls
 * and see crosswalk edges between control subnodes.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { GraphRenderer } from './graph-renderer';
import {
  type KnowledgeGraphProps,
  type GraphConfig,
  type GraphNode,
  type GraphDisplayConfig,
  type GraphForceConfig,
  type Category,
  type KnowledgeGraphData,
  GLOBAL_GRAPH_CONFIG,
  LOCAL_GRAPH_CONFIG,
  CATEGORY_COLORS,
  getCategoryColor,
  CATEGORY_LABELS,
  DEFAULT_DISPLAY_CONFIG,
  DEFAULT_FORCE_CONFIG,
  isFrameworkNode,
  isControlNode,
} from '@/lib/graph/graph-types';
import {
  createExpansionState,
  toggleExpansion,
  collapseAll as collapseAllState,
  buildCompositeGraph,
} from './graph-state';
import { GraphControlPanel, type SearchResult } from './GraphControlPanel';
import { getFrameworkGraph, filterGraphByCategories, getNeighborhood, getGraphStats, getControlCrosswalkPairs } from '../../lib/knowledge-graph';
import {
  getAllControlStatuses,
  setControlStatus,
  getAssessments,
  createAssessment,
} from '../../lib/storage/assessment-store';
import { getRecentlyViewed } from '../../lib/storage/recently-viewed-store';
import { useProjectChange } from '../../hooks/useProjectChange';
import { GraphToast } from './GraphToast';
import type { Assessment, ImplementationStatus } from '../../lib/db';
import { STATUS_COLORS, STATUS_LABELS, DEFAULT_ASSESSMENT_ID } from '../../lib/db';
import type { ColorMode } from '@/lib/graph/graph-types';

interface ExtendedKnowledgeGraphProps extends KnowledgeGraphProps {
  fullscreen?: boolean;
}

export function KnowledgeGraph({
  mode = 'galaxy',
  focusId: propFocusId,
  config: configOverrides,
  className = '',
  fullscreen = false,
  onNodeClick,
  onNodeHover,
}: ExtendedKnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<GraphRenderer | null>(null);
  const currentGraphRef = useRef<KnowledgeGraphData | null>(null);

  const [selectedCategories, setSelectedCategories] = useState<Category[]>([
    'fed', 'ai', 'ent', 'owasp', 'priv', 'intl', 'meta',
  ]);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [graphStats, setGraphStats] = useState<{ nodes: number; edges: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Expansion state
  const [expansionState, setExpansionState] = useState(createExpansionState);
  const expansionStateRef = useRef(expansionState);
  expansionStateRef.current = expansionState;

  // Display & force configs
  const [displayConfig, setDisplayConfig] = useState<GraphDisplayConfig>({ ...DEFAULT_DISPLAY_CONFIG });
  const [forceConfig, setForceConfig] = useState<GraphForceConfig>({ ...DEFAULT_FORCE_CONFIG });

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Local graph mode
  const [graphMode, setGraphMode] = useState<'global' | 'local'>('global');
  const [localDepth, setLocalDepth] = useState(1);
  const [localFocusId, setLocalFocusId] = useState<string | null>(null);

  // Visited node tracking
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set());

  // Color mode & control statuses
  const [colorMode, setColorMode] = useState<ColorMode>('category');
  const [statusMap, setStatusMap] = useState<Map<string, string>>(new Map());

  // Assessment management
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [activeAssessmentId, setActiveAssessmentId] = useState<string>(DEFAULT_ASSESSMENT_ID);

  // Toast notification for budget capping
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 4000);
  }, []);

  // Status quick-set menu
  const [statusMenu, setStatusMenu] = useState<{
    nodeId: string;
    frameworkId: string;
    controlId: string;
    x: number;
    y: number;
  } | null>(null);

  // Read focus param from URL
  const [focusId, setFocusId] = useState<string | undefined>(propFocusId);
  useEffect(() => {
    if (typeof window !== 'undefined' && !propFocusId) {
      const params = new URLSearchParams(window.location.search);
      const focus = params.get('focus');
      if (focus) setFocusId(focus);

      // Restore expansion state from URL
      const expand = params.get('expand');
      if (expand) {
        const ids = expand.split(',').filter(Boolean);
        if (ids.length > 0) {
          setExpansionState({ expandedFrameworks: new Set(ids) });
        }
      }
    }
  }, [propFocusId]);

  useEffect(() => {
    getRecentlyViewed().then(items => {
      const ids = new Set<string>();
      for (const item of items) {
        ids.add(item.frameworkId);
        if (item.controlSlug) {
          ids.add(`${item.frameworkId}:${item.controlSlug}`);
        }
      }
      setVisitedIds(ids);
    });
  }, []);

  const loadProjectAssessments = useCallback(async () => {
    const nextAssessments = await getAssessments();
    setAssessments(nextAssessments);
    setActiveAssessmentId(currentId => {
      if (currentId === DEFAULT_ASSESSMENT_ID) return currentId;
      return nextAssessments.some(assessment => assessment.id === currentId)
        ? currentId
        : DEFAULT_ASSESSMENT_ID;
    });
  }, []);

  // Load project-scoped assessments
  useEffect(() => {
    loadProjectAssessments();

  }, [loadProjectAssessments]);

  useProjectChange(loadProjectAssessments);

  // Load control statuses for the selected assessment
  useEffect(() => {
    getAllControlStatuses(activeAssessmentId).then(setStatusMap);
  }, [activeAssessmentId]);

  // Update URL when expansion state changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const expanded = Array.from(expansionState.expandedFrameworks);
    if (expanded.length > 0) {
      params.set('expand', expanded.join(','));
    } else {
      params.delete('expand');
    }
    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState(null, '', newUrl);
  }, [expansionState]);

  // Merge config with defaults
  const config: GraphConfig = {
    ...(mode === 'galaxy' ? GLOBAL_GRAPH_CONFIG : LOCAL_GRAPH_CONFIG),
    ...configOverrides,
    showCategories: selectedCategories,
  };

  // Toggle category filter
  const toggleCategory = useCallback((category: Category) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  }, []);

  // Handle node click — expand frameworks, navigate controls
  const handleNodeClick = useCallback((node: GraphNode, event?: { ctrlKey?: boolean; metaKey?: boolean }) => {
    if (onNodeClick) {
      onNodeClick(node);
      return;
    }

    if (isFrameworkNode(node)) {
      // Ctrl+click or meta+click → navigate to framework page
      if (event?.ctrlKey || event?.metaKey) {
        window.location.href = `/frameworks/${node.id}`;
        return;
      }

      // In local mode: set as focus node (triggers re-render with neighborhood)
      if (graphMode === 'local') {
        setLocalFocusId(node.id);
        return;
      }

      // Global mode: plain click → toggle expansion
      const newState = toggleExpansion(expansionStateRef.current, node.id);
      setExpansionState(newState);

      // Build composite graph and update renderer incrementally
      const baseGraph = getBaseGraph();
      const { graph, diff, cappedFrameworks } = buildCompositeGraph(baseGraph, newState, currentGraphRef.current || undefined);
      currentGraphRef.current = graph;

      if (cappedFrameworks.length > 0) {
        showToast(`Grouped ${cappedFrameworks.join(', ')} by family to keep the graph responsive`);
      }

      const stats = getGraphStats(graph);
      setGraphStats({ nodes: stats.nodeCount, edges: stats.edgeCount });

      if (rendererRef.current) {
        rendererRef.current.updateGraph(graph, diff);
      }
    } else if (isControlNode(node)) {
      // In local mode: set control's framework as focus
      if (graphMode === 'local') {
        setLocalFocusId(node.frameworkId);
        return;
      }
      // Global mode: navigate to control page
      window.location.href = node.url;
    }
  }, [onNodeClick, selectedCategories, focusId, config.depth]);

  // Handle node hover
  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoveredNode(node);
    onNodeHover?.(node);
  }, [onNodeHover]);

  // Get filtered base graph (memoize by category/focus)
  const getBaseGraph = useCallback((): KnowledgeGraphData => {
    let graphData = getFrameworkGraph();
    if (selectedCategories.length < 7) {
      graphData = filterGraphByCategories(graphData, selectedCategories);
    }
    if (focusId && config.depth >= 0) {
      graphData = getNeighborhood(graphData, focusId, config.depth);
    }
    // Local mode: filter to neighborhood of focused node
    if (graphMode === 'local' && localFocusId) {
      graphData = getNeighborhood(graphData, localFocusId, localDepth);
    }
    return graphData;
  }, [selectedCategories, focusId, config.depth, graphMode, localFocusId, localDepth]);

  // Handle display config changes
  const handleDisplayChange = useCallback((update: Partial<GraphDisplayConfig>) => {
    setDisplayConfig(prev => ({ ...prev, ...update }));
    rendererRef.current?.updateConfig({ display: update });
  }, []);

  // Handle force config changes
  const handleForceChange = useCallback((update: Partial<GraphForceConfig>) => {
    setForceConfig(prev => ({ ...prev, ...update }));
    rendererRef.current?.updateConfig({ forces: update });
  }, []);

  // Gap analysis state
  const [gapSource, setGapSource] = useState<string | null>(null);
  const [gapTarget, setGapTarget] = useState<string | null>(null);
  const [gapCount, setGapCount] = useState(0);

  // Available frameworks for gap analysis dropdowns
  const availableFrameworks = useMemo(() => {
    const graph = currentGraphRef.current;
    if (!graph) return [];
    return graph.nodes
      .filter(n => isFrameworkNode(n))
      .map(n => ({ id: n.id, name: (n as any).name || n.id }));
  }, [graphStats]); // Recompute when graph changes

  // Handle gap analysis selection
  const handleGapAnalysis = useCallback((source: string | null, target: string | null) => {
    setGapSource(source);
    setGapTarget(target);

    if (!source || !target || !rendererRef.current) {
      rendererRef.current?.highlightNodes(null);
      setGapCount(0);
      return;
    }

    // Find controls in source framework that have NO crosswalk to target
    const graph = currentGraphRef.current;
    if (!graph) return;

    // Get all crosswalk pairs between these frameworks
    const pairs = getControlCrosswalkPairs(source, target);
    const mappedSourceIds = new Set(pairs.map(p => p.sourceId));
    const mappedTargetIds = new Set(pairs.map(p => p.targetId));
    const allMappedIds = new Set([...mappedSourceIds, ...mappedTargetIds]);

    // Find source controls with no mapping
    const sourceControls = graph.nodes.filter(
      n => isControlNode(n) && n.frameworkId === source
    );
    const gapIds = new Set<string>();
    for (const c of sourceControls) {
      if (!allMappedIds.has(c.id)) {
        gapIds.add(c.id);
      }
    }

    setGapCount(gapIds.size);

    // Highlight gaps in red (via the highlight system)
    if (gapIds.size > 0) {
      rendererRef.current.highlightNodes(gapIds);
    } else {
      rendererRef.current.highlightNodes(null);
    }
  }, []);

  // Handle color mode change
  const handleColorModeChange = useCallback((mode: ColorMode) => {
    setColorMode(mode);
    rendererRef.current?.setColorMode(mode);
  }, []);

  // Handle assessment change
  const handleAssessmentChange = useCallback((id: string) => {
    setActiveAssessmentId(id);
    // Status map will reload via the useEffect dep on activeAssessmentId
  }, []);

  // Handle create assessment
  const handleCreateAssessment = useCallback(async (name: string) => {
    const expanded = Array.from(expansionState.expandedFrameworks);
    const assessment = await createAssessment(name, expanded);
    setAssessments(prev => [assessment, ...prev]);
    setActiveAssessmentId(assessment.id);
  }, [expansionState]);

  // Compute search results from current graph
  const searchResults: SearchResult[] = (() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    const graph = currentGraphRef.current;
    if (!graph) return [];

    const results: SearchResult[] = [];
    for (const node of graph.nodes) {
      if (isFrameworkNode(node)) {
        if (node.name.toLowerCase().includes(q) || node.shortName.toLowerCase().includes(q) || node.id.includes(q)) {
          results.push({ id: node.id, label: node.name, type: 'framework' });
        }
      } else if (isControlNode(node)) {
        if (node.controlId.toLowerCase().includes(q) || node.title.toLowerCase().includes(q)) {
          results.push({ id: node.id, label: `${node.controlId}: ${node.title}`, type: 'control', frameworkId: node.frameworkId });
        }
      }
      if (results.length >= 100) break; // Cap for perf
    }
    return results;
  })();

  // Apply search dimming to the graph
  useEffect(() => {
    if (!rendererRef.current) return;
    if (searchResults.length > 0) {
      const ids = new Set(searchResults.map(r => r.id));
      rendererRef.current.highlightNodes(ids);
    } else if (searchQuery.length >= 2) {
      // Search active but no matches — dim everything
      rendererRef.current.highlightNodes(new Set());
    } else {
      // No search — clear highlighting
      rendererRef.current.highlightNodes(null);
    }
  }, [searchResults, searchQuery]);

  // Handle search result click — zoom to node
  const handleSearchResultClick = useCallback((result: SearchResult) => {
    if (rendererRef.current) {
      // Clear search highlight, then zoom
      rendererRef.current.highlightNodes(null);
      rendererRef.current.zoomToNode(result.id);
    }
  }, []);

  // Handle expand all — expand every visible framework
  const handleExpandAll = useCallback(() => {
    const baseGraph = getBaseGraph();
    const frameworkIds = baseGraph.nodes
      .filter(n => isFrameworkNode(n))
      .map(n => n.id);

    const newState = { expandedFrameworks: new Set(frameworkIds) };
    setExpansionState(newState);

    const { graph, diff, cappedFrameworks } = buildCompositeGraph(baseGraph, newState, currentGraphRef.current || undefined);
    currentGraphRef.current = graph;

    if (cappedFrameworks.length > 0) {
      showToast(`Grouped ${cappedFrameworks.join(', ')} by family to keep the graph responsive`);
    }

    const stats = getGraphStats(graph);
    setGraphStats({ nodes: stats.nodeCount, edges: stats.edgeCount });

    if (rendererRef.current) {
      rendererRef.current.updateGraph(graph, diff);
    }
  }, [getBaseGraph, showToast]);

  // Handle collapse framework from panel
  const handleCollapseFramework = useCallback((frameworkId: string) => {
    const newState = toggleExpansion(expansionStateRef.current, frameworkId);
    setExpansionState(newState);

    const baseGraph = getBaseGraph();
    const { graph, diff } = buildCompositeGraph(baseGraph, newState, currentGraphRef.current || undefined);
    currentGraphRef.current = graph;

    const stats = getGraphStats(graph);
    setGraphStats({ nodes: stats.nodeCount, edges: stats.edgeCount });

    if (rendererRef.current) {
      rendererRef.current.updateGraph(graph, diff);
    }
  }, [getBaseGraph]);

  // Handle collapse all from panel
  const handleCollapseAll = useCallback(() => {
    const newState = collapseAllState();
    setExpansionState(newState);

    const baseGraph = getBaseGraph();
    const { graph, diff } = buildCompositeGraph(baseGraph, newState, currentGraphRef.current || undefined);
    currentGraphRef.current = graph;

    const stats = getGraphStats(graph);
    setGraphStats({ nodes: stats.nodeCount, edges: stats.edgeCount });

    if (rendererRef.current) {
      rendererRef.current.updateGraph(graph, diff);
    }
  }, [getBaseGraph]);

  // Initialize and render graph
  useEffect(() => {
    if (!containerRef.current) return;

    setIsLoading(true);

    // Get base graph data
    const baseGraph = getBaseGraph();

    // Build composite graph with any existing expansion state
    const { graph } = buildCompositeGraph(baseGraph, expansionState);
    currentGraphRef.current = graph;

    // Update stats
    const stats = getGraphStats(graph);
    setGraphStats({ nodes: stats.nodeCount, edges: stats.edgeCount });

    // Create renderer
    const renderer = new GraphRenderer(containerRef.current, config, {
      onNodeClick: handleNodeClick,
      onNodeHover: handleNodeHover,
      onNodeRightClick: (node, x, y) => {
        if (isControlNode(node)) {
          setStatusMenu({
            nodeId: node.id,
            frameworkId: node.frameworkId,
            controlId: node.controlId,
            x,
            y,
          });
        }
      },
    });

    rendererRef.current = renderer;

    // Pass visited nodes and status data for coloring
    renderer.setVisitedNodes(visitedIds);
    renderer.setControlStatuses(statusMap);
    renderer.setColorMode(colorMode);

    // Render graph
    renderer.render(graph, focusId).then(() => {
      setIsLoading(false);
    });

    // Cleanup
    return () => {
      renderer.cleanup();
      rendererRef.current = null;
    };
  }, [selectedCategories, focusId, config.depth, graphMode, localFocusId, localDepth]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && rendererRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        rendererRef.current.resize(width, height);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Compute coverage stats for expanded frameworks
  const coverageStats = useMemo(() => {
    const expanded = Array.from(expansionState.expandedFrameworks);
    if (expanded.length === 0 || statusMap.size === 0) return [];

    return expanded.map(fwId => {
      const graph = currentGraphRef.current;
      if (!graph) return { frameworkId: fwId, total: 0, implemented: 0, partial: 0, notImpl: 0 };

      const controlNodes = graph.nodes.filter(
        n => isControlNode(n) && n.frameworkId === fwId
      );
      let implemented = 0, partial = 0, notImpl = 0;
      for (const cn of controlNodes) {
        const status = statusMap.get(cn.id);
        if (status === 'implemented') implemented++;
        else if (status === 'partially-implemented') partial++;
        else if (status === 'not-implemented') notImpl++;
      }
      return { frameworkId: fwId, total: controlNodes.length, implemented, partial, notImpl };
    }).filter(s => s.total > 0);
  }, [expansionState.expandedFrameworks, statusMap]);

  // Aggregate readiness stats
  const readinessStats = useMemo(() => {
    if (statusMap.size === 0) return null;
    let total = 0, implemented = 0, partial = 0, notImpl = 0, notApplicable = 0;
    for (const [, status] of statusMap) {
      total++;
      if (status === 'implemented') implemented++;
      else if (status === 'partially-implemented') partial++;
      else if (status === 'not-implemented') notImpl++;
      else if (status === 'not-applicable') notApplicable++;
    }
    const assessed = implemented + partial + notImpl + notApplicable;
    const pct = total > 0 ? Math.round(((implemented + partial * 0.5) / total) * 100) : 0;
    return { total, implemented, partial, notImpl, notApplicable, assessed, pct };
  }, [statusMap]);

  // Dashboard visibility
  const [showDashboard, setShowDashboard] = useState(false);

  // Fullscreen mode: fixed viewport
  if (fullscreen) {
    return (
      <div className="knowledge-graph">
        {/* Graph container — full viewport below header */}
        <div
          ref={containerRef}
          className="fixed left-0 right-0 bottom-0 bg-background"
          style={{ zIndex: 1, top: '4rem' }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <div className="flex items-center gap-3 text-muted-foreground">
                <svg className="animate-spin h-5 w-5 text-ctp-teal" viewBox="0 0 24 24">
                  <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                  <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-xs font-medium uppercase tracking-[0.2em] opacity-60">Initializing Galaxy</span>
              </div>
            </div>
          )}
        </div>

        {/* Hover tooltip */}
        {hoveredNode && isFrameworkNode(hoveredNode) && (
          <div
            className="fixed top-[5.5rem] left-4 sm:left-auto sm:right-[22rem] sm:w-72 bg-background/60 backdrop-blur-xl border border-border/30 rounded-xl p-4 shadow-2xl z-20 pointer-events-none"
            style={{ animationDuration: '0.4s' }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-2 h-2 rounded-full mt-1.5 shrink-0 ring-1 ring-current/30"
                style={{ backgroundColor: getCategoryColor(hoveredNode.category) }}
              />
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-foreground tracking-tight leading-tight mb-1">{hoveredNode.name}</h4>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[0.6rem] font-bold text-foreground/40 uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/20 border border-border/20">
                    {CATEGORY_LABELS[hoveredNode.category]}
                  </span>
                  <span className="text-[0.6rem] text-foreground/30 uppercase tracking-widest">
                    {hoveredNode.controlCount} controls
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border/20 text-[0.55rem] text-muted-foreground/70">
                  <span>Click to expand</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span>Ctrl+click to navigate</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hover tooltip for control nodes */}
        {hoveredNode && isControlNode(hoveredNode) && (
          <div
            className="fixed top-[5.5rem] left-4 sm:left-auto sm:right-[22rem] sm:w-64 bg-background/60 backdrop-blur-xl border border-border/30 rounded-xl p-3 shadow-2xl z-20 pointer-events-none"
          >
            <div className="min-w-0">
              <p className="text-[0.6rem] text-muted-foreground/70 uppercase tracking-wider mb-1">{hoveredNode.frameworkId}</p>
              <h4 className="text-xs font-bold text-foreground tracking-tight leading-tight">{hoveredNode.controlId}</h4>
              <p className="text-[0.6rem] text-muted-foreground mt-1 line-clamp-2">{hoveredNode.title}</p>
              <div className="mt-2 pt-2 border-t border-border/20 text-[0.55rem] text-muted-foreground/70">
                Click to view control details
              </div>
            </div>
          </div>
        )}

        {/* Compliance Readiness Dashboard */}
        {readinessStats && readinessStats.total > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowDashboard(!showDashboard)}
              className="fixed bottom-4 left-4 z-40 px-3 py-1.5 text-[0.6rem] font-semibold bg-background/70 hover:bg-background/90 text-muted-foreground hover:text-foreground rounded-lg border border-border/30 backdrop-blur-xl transition-all uppercase tracking-wider"
            >
              {showDashboard ? 'Hide' : 'Readiness'} {readinessStats.pct}%
            </button>
            {showDashboard && (
              <div className="fixed bottom-14 left-4 z-40 w-64 bg-background/90 backdrop-blur-xl border border-border/30 rounded-xl p-4 shadow-2xl">
                <h3 className="text-[0.65rem] font-bold text-foreground uppercase tracking-[0.15em] mb-3">Compliance Readiness</h3>

                {/* Overall progress */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[0.55rem] text-muted-foreground/70">Overall</span>
                    <span className="text-sm font-bold text-low">{readinessStats.pct}%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden flex">
                    <div className="bg-low h-full transition-all" style={{ width: `${(readinessStats.implemented / readinessStats.total) * 100}%` }} />
                    <div className="bg-moderate h-full transition-all" style={{ width: `${(readinessStats.partial / readinessStats.total) * 100}%` }} />
                    <div className="bg-high h-full transition-all" style={{ width: `${(readinessStats.notImpl / readinessStats.total) * 100}%` }} />
                  </div>
                </div>

                {/* Breakdown */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-low" />
                      <span className="text-[0.55rem] text-muted-foreground">Implemented</span>
                    </div>
                    <span className="text-[0.6rem] font-mono text-foreground">{readinessStats.implemented}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-moderate" />
                      <span className="text-[0.55rem] text-muted-foreground">Partial</span>
                    </div>
                    <span className="text-[0.6rem] font-mono text-foreground">{readinessStats.partial}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-high" />
                      <span className="text-[0.55rem] text-muted-foreground">Not Implemented</span>
                    </div>
                    <span className="text-[0.6rem] font-mono text-foreground">{readinessStats.notImpl}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-muted" />
                      <span className="text-[0.55rem] text-muted-foreground">N/A</span>
                    </div>
                    <span className="text-[0.6rem] font-mono text-foreground">{readinessStats.notApplicable}</span>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-border/20">
                  <div className="flex items-center justify-between text-[0.5rem] text-zinc-600">
                    <span>{readinessStats.assessed} / {readinessStats.total} assessed</span>
                    <span>{activeAssessmentId === '_default' ? 'Default' : 'Assessment'}</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Status quick-set menu (right-click on control node) */}
        {statusMenu && (
          <div
            className="fixed z-50 bg-background/90 backdrop-blur-xl border border-border/30 rounded-lg p-1.5 shadow-2xl"
            style={{ left: statusMenu.x, top: statusMenu.y }}
          >
            <p className="text-[0.55rem] text-muted-foreground/70 px-2 py-1 border-b border-border/20 mb-1">{statusMenu.controlId}</p>
            {([
              ['not-assessed', 'Not Assessed'],
              ['not-implemented', 'Not Implemented'],
              ['partially-implemented', 'Partial'],
              ['implemented', 'Implemented'],
              ['not-applicable', 'N/A'],
            ] as [ImplementationStatus, string][]).map(([status, label]) => (
              <button
                key={status}
                type="button"
                onClick={async () => {
                  await setControlStatus(statusMenu.frameworkId, statusMenu.controlId, status, activeAssessmentId);
                  // Update local map — key is "frameworkId:controlId" (without assessmentId)
                  const graphKey = `${statusMenu.frameworkId}:${statusMenu.controlId}`;
                  setStatusMap(prev => {
                    const next = new Map(prev);
                    next.set(graphKey, status);
                    return next;
                  });
                  // Update renderer if in status mode
                  if (rendererRef.current) {
                    const newMap = new Map(statusMap);
                    newMap.set(statusMenu.nodeId, status);
                    rendererRef.current.setControlStatuses(newMap);
                    rendererRef.current.setColorMode(colorMode);
                  }
                  setStatusMenu(null);
                }}
                className="w-full flex items-center gap-2 px-2 py-1 text-[0.6rem] text-foreground hover:bg-muted/20 rounded transition-colors"
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: STATUS_COLORS[status] }}
                />
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setStatusMenu(null)}
              className="w-full mt-1 pt-1 border-t border-border/20 text-[0.5rem] text-zinc-600 hover:text-muted-foreground py-0.5"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Click-away to close status menu */}
        {statusMenu && (
          <div
            className="fixed inset-0 z-[45]"
            onClick={() => setStatusMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setStatusMenu(null); }}
          />
        )}

        {/* Budget-cap toast notification */}
        <GraphToast message={toastMessage} />

        {/* Control panel */}
        <div style={{ zIndex: 40 }}>
          <GraphControlPanel
            selectedCategories={selectedCategories}
            onToggleCategory={toggleCategory}
            displayConfig={displayConfig}
            onDisplayChange={handleDisplayChange}
            colorMode={colorMode}
            onColorModeChange={handleColorModeChange}
            forceConfig={forceConfig}
            onForceChange={handleForceChange}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchResults={searchResults}
            onSearchResultClick={handleSearchResultClick}
            graphMode={graphMode}
            localDepth={localDepth}
            localFocusId={localFocusId}
            onGraphModeChange={setGraphMode}
            onLocalDepthChange={setLocalDepth}
            expandedFrameworks={Array.from(expansionState.expandedFrameworks)}
            onExpandAll={handleExpandAll}
            onCollapseAll={handleCollapseAll}
            onCollapseFramework={handleCollapseFramework}
            assessments={assessments}
            activeAssessmentId={activeAssessmentId}
            onAssessmentChange={handleAssessmentChange}
            onCreateAssessment={handleCreateAssessment}
            gapSourceFramework={gapSource}
            gapTargetFramework={gapTarget}
            gapCount={gapCount}
            availableFrameworks={availableFrameworks}
            onGapAnalysis={handleGapAnalysis}
            coverageStats={coverageStats}
            nodeCount={graphStats?.nodes || 0}
            edgeCount={graphStats?.edges || 0}
          />
        </div>
      </div>
    );
  }

  // Non-fullscreen mode (legacy — embedded graph)
  return (
    <div className={`knowledge-graph group ${className}`}>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-background/40 backdrop-blur-md border-b border-border/20">
        <span className="text-[0.65rem] font-medium text-muted-foreground/60 uppercase tracking-[0.15em] mr-2">Filter:</span>
        {(['fed', 'ai', 'ent', 'owasp', 'priv', 'intl', 'meta'] as Category[]).map(category => {
          const isSelected = selectedCategories.includes(category);
          const color = getCategoryColor(category);
          return (
            <button
              type="button"
              key={category}
              onClick={() => toggleCategory(category)}
              className={`px-2.5 py-1 text-[0.7rem] font-semibold rounded-md border transition-all duration-500 ${
                isSelected
                  ? 'border-white/20'
                  : 'border-border/20 bg-muted/20 text-muted-foreground/70 hover:text-foreground'
              }`}
              style={isSelected ? {
                backgroundColor: `${color}25`,
                color: color,
                boxShadow: `0 0 12px ${color}15`,
              } : {}}
            >
              {CATEGORY_LABELS[category]}
            </button>
          );
        })}

        {graphStats && (
          <span className="text-[0.65rem] font-medium text-muted-foreground/40 uppercase tracking-widest ml-auto">
            {graphStats.nodes} nodes · {graphStats.edges} links
          </span>
        )}
      </div>

      {/* Graph container */}
      <div
        ref={containerRef}
        className="relative w-full bg-background"
        style={{ height: mode === 'galaxy' ? '75vh' : '350px', minHeight: '350px' }}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="flex items-center gap-3 text-muted-foreground">
              <svg className="animate-spin h-5 w-5 text-ctp-teal" viewBox="0 0 24 24">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-xs font-medium uppercase tracking-[0.2em] opacity-60">Initializing Galaxy</span>
            </div>
          </div>
        )}

        {/* Hover tooltip */}
        {hoveredNode && isFrameworkNode(hoveredNode) && (
          <div className="absolute top-6 left-6 right-6 sm:left-auto sm:right-6 sm:w-80 bg-background/60 backdrop-blur-xl border border-border/30 rounded-xl p-4 shadow-2xl z-20 animate-fade-in-up pointer-events-none filter blur-[0.25px]" style={{ animationDuration: '0.4s' }}>
            <div className="flex items-start gap-4">
              <div
                className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ring-1 ring-current/30"
                style={{ backgroundColor: getCategoryColor(hoveredNode.category) }}
              />
              <div className="min-w-0 flex-1">
                <h4 className="text-base font-bold text-foreground tracking-tight leading-tight mb-1">{hoveredNode.name}</h4>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[0.65rem] font-bold text-foreground/40 uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/20 border border-border/20">
                    {CATEGORY_LABELS[hoveredNode.category]}
                  </span>
                  <span className="text-[0.65rem] font-medium text-foreground/30 uppercase tracking-widest">
                    {hoveredNode.controlCount} controls
                  </span>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs text-foreground/50 leading-relaxed line-clamp-2">
                    Mappings to {hoveredNode.families.length} compliance families found in this framework.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border/20 flex items-center justify-between">
                  <span className="text-[0.65rem] font-bold text-ctp-teal uppercase tracking-[0.15em]">Click to Explore</span>
                  <svg className="w-3.5 h-3.5 text-ctp-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-6 p-4 bg-background/20 border-t border-border/20 text-[0.65rem] font-medium uppercase tracking-[0.15em] text-muted-foreground/70">
        {(['fed', 'ai', 'ent', 'owasp', 'priv', 'intl', 'meta'] as Category[]).map(category => (
          <div key={category} className="flex items-center gap-2 group/item cursor-help">
            <div
              className="w-2 h-2 rounded-full transition-transform group-hover/item:scale-125"
              style={{
                backgroundColor: getCategoryColor(category)
              }}
            />
            <span className="group-hover/item:text-foreground transition-colors">{CATEGORY_LABELS[category]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default KnowledgeGraph;
