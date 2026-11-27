import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  getCrosswalkStats,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type FrameworkNode,
  type FrameworkCategory,
} from '../../data/crosswalk-stats';

interface GraphData {
  nodes: FrameworkNode[];
  links: Array<{
    source: string;
    target: string;
    value: number;
  }>;
}

interface ConnectedFramework {
  id: string;
  name: string;
  mappingCount: number;
}

export function NetworkGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<{ source: string; target: string; value: number } | null>(null);
  const [ForceGraph, setForceGraph] = useState<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [visibleCategories, setVisibleCategories] = useState<Set<FrameworkCategory>>(
    new Set(Object.keys(CATEGORY_LABELS) as FrameworkCategory[])
  );

  // Load force graph library dynamically (client-side only)
  useEffect(() => {
    import('react-force-graph-2d').then((mod) => {
      setForceGraph(() => mod.default);
    });
  }, []);

  // Load data
  useEffect(() => {
    const stats = getCrosswalkStats();
    setGraphData({
      nodes: stats.nodes,
      links: stats.edges.map((e) => ({
        source: e.source,
        target: e.target,
        value: e.mappingCount,
      })),
    });
  }, []);

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width || 800,
          height: Math.max(600, window.innerHeight - 350),
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Configure d3 forces after graph initializes
  useEffect(() => {
    if (!graphRef.current || !graphData) return;

    // Give it time to initialize
    const timer = setTimeout(() => {
      const fg = graphRef.current;
      if (!fg) return;

      // Stronger repulsion to spread nodes apart
      fg.d3Force('charge')?.strength(-500);

      // Increase link distance
      fg.d3Force('link')?.distance(150);

      // Weaker center force
      fg.d3Force('center')?.strength(0.02);

      // Reheat simulation to apply changes
      fg.d3ReheatSimulation();
    }, 300);

    return () => clearTimeout(timer);
  }, [graphData, ForceGraph]);

  // Compute max control count for normalization
  const maxControlCount = useMemo(() => {
    if (!graphData) return 1;
    return Math.max(...graphData.nodes.map((n) => n.controlCount));
  }, [graphData]);

  // Get normalized node size using log scale
  const getNodeSize = useCallback(
    (count: number) => {
      const minSize = 18;
      const maxSize = 50;
      const logScale = Math.log(count + 1) / Math.log(maxControlCount + 1);
      return minSize + (maxSize - minSize) * logScale;
    },
    [maxControlCount]
  );

  // Filter data by visible categories
  const filteredData = useMemo(() => {
    if (!graphData) return null;

    const visibleNodeIds = new Set(
      graphData.nodes.filter((n) => visibleCategories.has(n.category)).map((n) => n.id)
    );

    return {
      nodes: graphData.nodes.filter((n) => visibleCategories.has(n.category)),
      links: graphData.links.filter((l) => visibleNodeIds.has(l.source) && visibleNodeIds.has(l.target)),
    };
  }, [graphData, visibleCategories]);

  // Get connected frameworks for selected node
  const connectedFrameworks = useMemo((): ConnectedFramework[] => {
    if (!selectedNode || !graphData) return [];

    const connections: ConnectedFramework[] = [];
    for (const link of graphData.links) {
      const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
      const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;

      if (sourceId === selectedNode) {
        const node = graphData.nodes.find((n) => n.id === targetId);
        if (node) {
          connections.push({ id: targetId, name: node.name, mappingCount: link.value });
        }
      } else if (targetId === selectedNode) {
        const node = graphData.nodes.find((n) => n.id === sourceId);
        if (node) {
          connections.push({ id: sourceId, name: node.name, mappingCount: link.value });
        }
      }
    }

    return connections.sort((a, b) => b.mappingCount - a.mappingCount);
  }, [selectedNode, graphData]);

  const selectedNodeData = useMemo(() => {
    if (!selectedNode || !graphData) return null;
    return graphData.nodes.find((n) => n.id === selectedNode) || null;
  }, [selectedNode, graphData]);

  const handleNodeClick = useCallback((node: FrameworkNode) => {
    setSelectedNode((prev) => (prev === node.id ? null : node.id));
  }, []);

  const toggleCategory = useCallback((category: FrameworkCategory) => {
    setVisibleCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        // Don't allow hiding all categories
        if (next.size > 1) {
          next.delete(category);
        }
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // Determine if a link should be highlighted
  const isLinkHighlighted = useCallback(
    (link: { source: any; target: any }) => {
      if (!selectedNode) return true;
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      return sourceId === selectedNode || targetId === selectedNode;
    },
    [selectedNode]
  );

  // Determine if a node should be highlighted
  const isNodeHighlighted = useCallback(
    (node: FrameworkNode) => {
      if (!selectedNode) return true;
      if (node.id === selectedNode) return true;
      return connectedFrameworks.some((fw) => fw.id === node.id);
    },
    [selectedNode, connectedFrameworks]
  );

  // Zoom controls
  const handleZoomIn = () => graphRef.current?.zoom(1.5, 400);
  const handleZoomOut = () => graphRef.current?.zoom(0.67, 400);
  const handleZoomFit = () => graphRef.current?.zoomToFit(400, 50);

  if (!ForceGraph || !filteredData) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-muted/20 rounded-lg">
        <div className="text-muted-foreground">Loading graph...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend with toggles */}
      <div className="flex flex-wrap gap-3 justify-center">
        {(Object.entries(CATEGORY_LABELS) as [FrameworkCategory, string][]).map(([key, label]) => {
          const isVisible = visibleCategories.has(key);
          return (
            <button
              type="button"
              key={key}
              onClick={() => toggleCategory(key)}
              className={`flex items-center gap-2 text-sm px-2 py-1 rounded transition-all ${
                isVisible ? 'opacity-100' : 'opacity-40'
              } hover:bg-muted/50`}
            >
              <div
                className="w-3 h-3 rounded-full transition-transform"
                style={{
                  backgroundColor: CATEGORY_COLORS[key],
                  transform: isVisible ? 'scale(1)' : 'scale(0.7)',
                }}
              />
              <span className={isVisible ? 'text-foreground' : 'text-muted-foreground line-through'}>
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Instructions and controls */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Click a node to see connections. Click legend to filter.
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-2 rounded hover:bg-muted transition-colors"
            title="Zoom out"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35M8 11h6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-2 rounded hover:bg-muted transition-colors"
            title="Zoom in"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleZoomFit}
            className="p-2 rounded hover:bg-muted transition-colors"
            title="Fit to view"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Graph */}
      <div
        ref={containerRef}
        className="bg-background border border-border rounded-lg overflow-hidden relative"
      >
        <ForceGraph
          ref={graphRef}
          graphData={filteredData}
          width={dimensions.width}
          height={dimensions.height}
          nodeLabel=""
          nodeColor={(node: FrameworkNode) => {
            const highlighted = isNodeHighlighted(node);
            return highlighted ? CATEGORY_COLORS[node.category] : `${CATEGORY_COLORS[node.category]}44`;
          }}
          nodeVal={(node: FrameworkNode) => getNodeSize(node.controlCount)}
          nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const label = node.shortName;
            const nodeSize = getNodeSize(node.controlCount);
            const highlighted = isNodeHighlighted(node);
            const isSelected = selectedNode === node.id;

            // Draw node circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI);
            ctx.fillStyle = highlighted
              ? CATEGORY_COLORS[node.category as FrameworkCategory]
              : `${CATEGORY_COLORS[node.category as FrameworkCategory]}44`;
            ctx.fill();

            // Draw border for selected node
            if (isSelected) {
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 3 / globalScale;
              ctx.stroke();
            }

            // Draw label with background
            const fontSize = Math.max(11, 13 / globalScale);
            ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const textMetrics = ctx.measureText(label);
            const textWidth = textMetrics.width;
            const textHeight = fontSize;
            const padding = 3 / globalScale;

            // Text background
            ctx.fillStyle = highlighted ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.roundRect(
              node.x - textWidth / 2 - padding,
              node.y - textHeight / 2 - padding / 2,
              textWidth + padding * 2,
              textHeight + padding,
              3 / globalScale
            );
            ctx.fill();

            // Text
            ctx.fillStyle = highlighted ? '#fff' : '#ffffff88';
            ctx.fillText(label, node.x, node.y);
          }}
          linkColor={(link: any) => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            const isHovered =
              hoveredLink && hoveredLink.source === sourceId && hoveredLink.target === targetId;
            if (isHovered) return '#a855f7';
            return isLinkHighlighted(link) ? '#888' : '#88888833';
          }}
          linkWidth={(link: any) => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            const isHovered =
              hoveredLink && hoveredLink.source === sourceId && hoveredLink.target === targetId;
            const baseWidth = Math.log(link.value + 1) / 2 + 1;
            return isHovered ? baseWidth + 2 : baseWidth;
          }}
          linkDirectionalParticles={0}
          onNodeClick={handleNodeClick}
          onLinkHover={(link: any) => {
            if (link) {
              const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
              const targetId = typeof link.target === 'object' ? link.target.id : link.target;
              setHoveredLink({ source: sourceId, target: targetId, value: link.value });
            } else {
              setHoveredLink(null);
            }
          }}
          cooldownTicks={200}
          d3AlphaDecay={0.01}
          d3VelocityDecay={0.2}
          d3AlphaMin={0.001}
          warmupTicks={100}
          onEngineStop={() => graphRef.current?.zoomToFit(400, 80)}
          dagMode={null}
          dagLevelDistance={100}
          onNodeDragEnd={(node: any) => {
            node.fx = node.x;
            node.fy = node.y;
          }}
        />

        {/* Edge hover tooltip */}
        {hoveredLink && graphData && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-popover border border-border rounded-lg px-3 py-2 shadow-lg pointer-events-none">
            <div className="text-sm font-medium">
              {graphData.nodes.find((n) => n.id === hoveredLink.source)?.shortName} ↔{' '}
              {graphData.nodes.find((n) => n.id === hoveredLink.target)?.shortName}
            </div>
            <div className="text-xs text-muted-foreground text-center">
              {hoveredLink.value.toLocaleString()} mappings
            </div>
          </div>
        )}

        {/* Details panel */}
        {selectedNodeData && (
          <div className="absolute top-4 right-4 w-72 bg-popover/95 backdrop-blur border border-border rounded-lg shadow-lg overflow-hidden">
            <div
              className="p-4 border-b border-border"
              style={{ borderTopColor: CATEGORY_COLORS[selectedNodeData.category], borderTopWidth: '3px' }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{selectedNodeData.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedNodeData.controlCount.toLocaleString()} controls
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNode(null)}
                  className="p-1 rounded hover:bg-muted transition-colors"
                  aria-label="Close details"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <span
                className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${CATEGORY_COLORS[selectedNodeData.category]}22`,
                  color: CATEGORY_COLORS[selectedNodeData.category],
                }}
              >
                {CATEGORY_LABELS[selectedNodeData.category]}
              </span>
            </div>

            {connectedFrameworks.length > 0 && (
              <div className="p-4 max-h-64 overflow-y-auto">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Connected Frameworks ({connectedFrameworks.length})
                </h4>
                <ul className="space-y-1">
                  {connectedFrameworks.map((fw) => (
                    <li key={fw.id} className="flex items-center justify-between text-sm py-1">
                      <span>{fw.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {fw.mappingCount.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="p-3 border-t border-border bg-muted/30">
              <a
                href={`/frameworks/${selectedNode}`}
                className="block text-center text-sm text-primary hover:underline"
              >
                View Framework →
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Edge thickness legend */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span>Edge thickness = mapping count</span>
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-muted-foreground/50" />
          <span>few</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-1.5 bg-muted-foreground/50" />
          <span>many</span>
        </div>
      </div>
    </div>
  );
}
