import { useMemo, useState } from 'react';
import {
  getCrosswalkStats,
  CATEGORY_COLORS,
  type FrameworkNode,
} from '../../data/crosswalk-stats';

interface CellData {
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  count: number;
}

export function CoverageMatrix() {
  const [hoveredCell, setHoveredCell] = useState<CellData | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const { nodes, matrix, maxCount } = useMemo(() => {
    const stats = getCrosswalkStats();

    // Sort nodes by category then name
    const sortedNodes = [...stats.nodes].sort((a, b) => {
      if (a.category !== b.category) {
        const order = ['meta', 'federal', 'enterprise', 'ai', 'privacy', 'international'];
        return order.indexOf(a.category) - order.indexOf(b.category);
      }
      return a.name.localeCompare(b.name);
    });

    // Find max count for color scaling
    let max = 0;
    for (const row of Object.values(stats.matrix)) {
      for (const count of Object.values(row)) {
        if (count > max) max = count;
      }
    }

    return { nodes: sortedNodes, matrix: stats.matrix, maxCount: max };
  }, []);

  const getIntensity = (count: number): number => {
    if (count === 0) return 0;
    // Use log scale for better visual distribution
    return Math.log(count + 1) / Math.log(maxCount + 1);
  };

  const getCellColor = (count: number): string => {
    if (count === 0) return 'transparent';
    const intensity = getIntensity(count);
    // Purple gradient
    const r = Math.round(168 * intensity);
    const g = Math.round(85 * intensity);
    const b = Math.round(247 * intensity);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center justify-center gap-4">
        <span className="text-sm text-muted-foreground">Fewer mappings</span>
        <div className="flex">
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((intensity) => (
            <div
              key={intensity}
              className="w-6 h-4"
              style={{
                backgroundColor:
                  intensity === 0
                    ? 'hsl(var(--muted))'
                    : `rgb(${Math.round(168 * intensity)}, ${Math.round(85 * intensity)}, ${Math.round(247 * intensity)})`,
              }}
            />
          ))}
        </div>
        <span className="text-sm text-muted-foreground">More mappings</span>
      </div>
      <p className="text-xs text-muted-foreground text-center">Diagonal cells = self-mapping (100% coverage)</p>

      {/* Matrix */}
      <div className="overflow-x-auto">
        <div
          className="inline-block min-w-full"
          onMouseMove={handleMouseMove}
        >
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="p-1 w-24"></th>
                {nodes.map((node) => (
                  <th
                    key={node.id}
                    className="p-1 text-xs font-medium text-muted-foreground"
                    style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', height: '100px' }}
                  >
                    <span
                      className="inline-block px-1 rounded"
                      style={{ borderLeft: `3px solid ${CATEGORY_COLORS[node.category]}` }}
                    >
                      {node.shortName}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {nodes.map((rowNode) => (
                <tr key={rowNode.id}>
                  <td className="p-1 text-xs font-medium text-muted-foreground text-right pr-2">
                    <span
                      className="inline-block px-1 rounded"
                      style={{ borderLeft: `3px solid ${CATEGORY_COLORS[rowNode.category]}` }}
                    >
                      {rowNode.shortName}
                    </span>
                  </td>
                  {nodes.map((colNode) => {
                    const count = matrix[rowNode.id]?.[colNode.id] || 0;
                    const isSame = rowNode.id === colNode.id;

                    return (
                      <td
                        key={colNode.id}
                        className="p-0"
                        onMouseEnter={() =>
                          setHoveredCell({
                            source: rowNode.id,
                            target: colNode.id,
                            sourceName: rowNode.name,
                            targetName: colNode.name,
                            count: isSame ? -1 : count,
                          })
                        }
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        <div
                          className={`w-8 h-8 ${isSame || count > 0 ? 'cursor-pointer hover:ring-2 hover:ring-primary' : ''}`}
                          style={{
                            backgroundColor: isSame ? getCellColor(maxCount) : getCellColor(count),
                            opacity: isSame ? 0.85 : 1,
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredCell && (
        <div
          className="fixed z-50 bg-popover border border-border rounded-lg p-3 shadow-lg pointer-events-none"
          style={{
            left: mousePos.x + 10,
            top: mousePos.y + 10,
          }}
        >
          <div className="font-medium text-sm">
            {hoveredCell.source === hoveredCell.target
              ? hoveredCell.sourceName
              : <>{hoveredCell.sourceName} ↔ {hoveredCell.targetName}</>}
          </div>
          <div className="text-muted-foreground text-sm">
            {hoveredCell.source === hoveredCell.target
              ? 'Self — 100% coverage'
              : hoveredCell.count > 0
                ? <>{hoveredCell.count.toLocaleString()} mappings</>
                : 'No direct crosswalk'}
          </div>
        </div>
      )}

      {/* Summary */}
      <p className="text-center text-sm text-muted-foreground">
        Showing crosswalk density between {nodes.length} frameworks. Hover over cells for details.
      </p>
    </div>
  );
}
