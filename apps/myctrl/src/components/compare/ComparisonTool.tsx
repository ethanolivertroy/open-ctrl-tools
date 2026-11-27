import { useState, useMemo, useEffect } from 'react';
import { FRAMEWORK_CONFIGS, getFrameworkData } from '../../data/frameworks';
import { hasFrameworkCrosswalk, getFrameworkCrosswalkTargets } from '../../data/crosswalk';
import { downloadFile } from '../../lib/export';

interface FrameworkInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  controlCount: number;
  families: Map<string, number>;
  familyLabel: string;
  itemLabel: string;
}

// Get framework info with computed stats
function getFrameworkInfo(frameworkId: string): FrameworkInfo | null {
  try {
    const config = FRAMEWORK_CONFIGS[frameworkId];
    if (!config) return null;

    const data = getFrameworkData(frameworkId);
    const controls = (data as { controls: Array<{ family: string }> }).controls || [];

    // Count controls by family
    const families = new Map<string, number>();
    for (const control of controls) {
      const family = control.family || 'Other';
      families.set(family, (families.get(family) || 0) + 1);
    }

    return {
      id: frameworkId,
      name: config.name,
      version: config.version,
      description: config.description,
      controlCount: controls.length,
      families,
      familyLabel: config.familyLabel || 'Family',
      itemLabel: config.itemLabel || 'controls',
    };
  } catch {
    return null;
  }
}

// Get frameworks that have data available
const availableFrameworks = Object.entries(FRAMEWORK_CONFIGS)
  .filter(([id]) => {
    try {
      const data = getFrameworkData(id);
      return (data as { controls: unknown[] }).controls?.length > 0;
    } catch {
      return false;
    }
  })
  .map(([id, config]) => ({
    id,
    name: config.name,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function ComparisonTool() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Parse URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const frameworks = params.get('frameworks');
    if (frameworks) {
      const ids = frameworks.split(',').filter(id => FRAMEWORK_CONFIGS[id]);
      if (ids.length > 0) {
        setSelectedIds(ids.slice(0, 3));
      }
    }
  }, []);

  // Update URL when selection changes
  useEffect(() => {
    if (selectedIds.length > 0) {
      const url = new URL(window.location.href);
      url.searchParams.set('frameworks', selectedIds.join(','));
      window.history.replaceState({}, '', url.toString());
    } else {
      const url = new URL(window.location.href);
      url.searchParams.delete('frameworks');
      window.history.replaceState({}, '', url.toString());
    }
  }, [selectedIds]);

  // Get framework info for selected frameworks
  const frameworks = useMemo(() => {
    return selectedIds.map(id => getFrameworkInfo(id)).filter(Boolean) as FrameworkInfo[];
  }, [selectedIds]);

  // Find crosswalk relationships between selected frameworks
  const crosswalkInfo = useMemo(() => {
    if (frameworks.length < 2) return null;

    const pairs: Array<{ from: string; to: string; fromId: string; toId: string }> = [];

    for (let i = 0; i < frameworks.length; i++) {
      for (let j = i + 1; j < frameworks.length; j++) {
        const fw1 = frameworks[i];
        const fw2 = frameworks[j];

        // Check if these two specific frameworks have a crosswalk relationship
        const fw1Targets = getFrameworkCrosswalkTargets(fw1.id);
        if (fw1Targets.includes(fw2.id)) {
          pairs.push({ from: fw1.name, to: fw2.name, fromId: fw1.id, toId: fw2.id });
        } else {
          // Check reverse direction
          const fw2Targets = getFrameworkCrosswalkTargets(fw2.id);
          if (fw2Targets.includes(fw1.id)) {
            pairs.push({ from: fw2.name, to: fw1.name, fromId: fw2.id, toId: fw1.id });
          } else if (hasFrameworkCrosswalk(fw1.id) && hasFrameworkCrosswalk(fw2.id)) {
            // Both have crosswalks but not to each other — they may connect via CCF
            pairs.push({ from: fw1.name, to: fw2.name, fromId: fw1.id, toId: fw2.id });
          }
        }
      }
    }

    return pairs.length > 0 ? pairs : null;
  }, [frameworks]);

  const handleSelect = (index: number, frameworkId: string) => {
    setSelectedIds(prev => {
      const next = [...prev];
      if (frameworkId === '') {
        // Remove this slot
        next.splice(index, 1);
      } else if (index < next.length) {
        next[index] = frameworkId;
      } else {
        next.push(frameworkId);
      }
      return next;
    });
  };

  const addSlot = () => {
    if (selectedIds.length < 3) {
      setSelectedIds(prev => [...prev, '']);
    }
  };

  // Get all unique families across selected frameworks
  const allFamilies = useMemo(() => {
    const families = new Set<string>();
    for (const fw of frameworks) {
      for (const family of fw.families.keys()) {
        families.add(family);
      }
    }
    return Array.from(families).sort();
  }, [frameworks]);

  // Export comparison data
  const handleExport = (format: 'csv' | 'json') => {
    if (frameworks.length === 0) return;

    const date = new Date().toISOString().split('T')[0];
    const filename = `comparison-${frameworks.map(f => f.id).join('-')}-${date}.${format}`;

    if (format === 'json') {
      const exportData = {
        metadata: {
          exportDate: new Date().toISOString(),
          frameworkCount: frameworks.length,
        },
        frameworks: frameworks.map(fw => ({
          id: fw.id,
          name: fw.name,
          version: fw.version,
          description: fw.description,
          controlCount: fw.controlCount,
          familyCount: fw.families.size,
          families: Object.fromEntries(fw.families),
        })),
        familyComparison: allFamilies.map(family => ({
          family,
          ...Object.fromEntries(frameworks.map(fw => [fw.id, fw.families.get(family) || 0])),
        })),
      };
      downloadFile(exportData, filename, 'application/json');
    } else {
      // CSV format - family comparison table
      const headers = ['Family', ...frameworks.map(fw => fw.name)];
      const rows = [headers.join(',')];

      for (const family of allFamilies) {
        const row = [
          `"${family}"`,
          ...frameworks.map(fw => fw.families.get(family) || 0),
        ];
        rows.push(row.join(','));
      }

      // Add summary row
      rows.push('');
      rows.push(['Total Controls', ...frameworks.map(fw => fw.controlCount)].join(','));
      rows.push(['Total Families', ...frameworks.map(fw => fw.families.size)].join(','));

      downloadFile(rows.join('\n'), filename, 'text/csv;charset=utf-8');
    }
  };

  return (
    <div className="space-y-8">
      {/* Framework Selectors */}
      <div className="flex flex-wrap gap-4">
        {selectedIds.map((id, index) => (
          <div key={index} className="flex-1 min-w-[200px] max-w-[300px]">
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Framework {index + 1}
            </label>
            <select
              value={id}
              onChange={(e) => handleSelect(index, e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select framework...</option>
              {availableFrameworks.map((fw) => (
                <option
                  key={fw.id}
                  value={fw.id}
                  disabled={selectedIds.includes(fw.id) && selectedIds[index] !== fw.id}
                >
                  {fw.name}
                </option>
              ))}
            </select>
          </div>
        ))}

        {selectedIds.length < 3 && (
          <div className="flex items-end">
            <button
              type="button"
              onClick={addSlot}
              className="px-4 py-2 border border-dashed border-border rounded-md text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              + Add Framework
            </button>
          </div>
        )}
      </div>

      {/* Quick Presets and Export */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground">Quick compare:</span>
          <button
            type="button"
            onClick={() => setSelectedIds(['nist-800-53-r5', 'fedramp-rev5'])}
            className="px-2 py-1 text-xs bg-muted rounded hover:bg-muted/80 transition-colors"
          >
            NIST 800-53 vs FedRAMP
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(['nist-csf-v2', 'nist-800-53-r5', 'cmmc-v2'])}
            className="px-2 py-1 text-xs bg-muted rounded hover:bg-muted/80 transition-colors"
          >
            CSF vs 800-53 vs CMMC
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(['cmmc-v2', 'nist-800-171-r2'])}
            className="px-2 py-1 text-xs bg-muted rounded hover:bg-muted/80 transition-colors"
          >
            CMMC vs 800-171
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(['gdpr', 'ccpa', 'hipaa-security'])}
            className="px-2 py-1 text-xs bg-muted rounded hover:bg-muted/80 transition-colors"
          >
            Privacy: GDPR vs CCPA vs HIPAA
          </button>
        </div>

        {/* Export Buttons */}
        {frameworks.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => handleExport('csv')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded hover:bg-accent transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              CSV
            </button>
            <button
              onClick={() => handleExport('json')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded hover:bg-accent transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              JSON
            </button>
          </div>
        )}
      </div>

      {/* Comparison Display */}
      {frameworks.length > 0 && (
        <div className="space-y-6">
          {/* Overview Cards */}
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${frameworks.length}, 1fr)` }}>
            {frameworks.map((fw) => (
              <div
                key={fw.id}
                className="p-4 rounded-lg border border-border bg-card"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 text-xs font-mono bg-primary/10 text-primary rounded">
                      v{fw.version}
                    </span>
                  </div>
                  <h3 className="font-semibold">{fw.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{fw.description}</p>
                  <div className="pt-2 border-t border-border">
                    <div className="text-2xl font-bold">{fw.controlCount.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">{fw.itemLabel}</div>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">{fw.families.size} </span>
                    <span className="text-muted-foreground">
                      {fw.families.size === 1 ? fw.familyLabel : (fw.familyLabel.endsWith('y') ? fw.familyLabel.slice(0, -1) + 'ies' : fw.familyLabel + 's')}
                    </span>
                  </div>
                  <a
                    href={`/frameworks/${fw.id}`}
                    className="inline-block text-sm text-primary hover:underline"
                  >
                    View framework →
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Crosswalk Info */}
          {crosswalkInfo && crosswalkInfo.length > 0 && (
            <div className="p-4 rounded-lg border border-border bg-card/50">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Cross-Framework Mappings Available
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                These frameworks have crosswalk mappings. Use the{' '}
                <a href="/crosswalk/visualize#explorer" className="text-primary hover:underline">
                  Control Explorer
                </a>{' '}
                to see detailed control-level mappings.
              </p>
              <a
                href="/crosswalk/visualize"
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
              >
                Open Crosswalk Visualizer
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          )}

          {/* Family Comparison Table */}
          {frameworks.length > 1 && allFamilies.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold">
                {frameworks[0].familyLabel} Breakdown
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                        {frameworks[0].familyLabel}
                      </th>
                      {frameworks.map((fw) => (
                        <th key={fw.id} className="text-right py-2 px-2 font-medium text-muted-foreground">
                          {fw.name.split(' ')[0]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allFamilies.slice(0, 20).map((family) => (
                      <tr key={family} className="border-b border-border/50">
                        <td className="py-2 pr-4">{family}</td>
                        {frameworks.map((fw) => {
                          const count = fw.families.get(family) || 0;
                          return (
                            <td key={fw.id} className="text-right py-2 px-2 font-mono">
                              {count > 0 ? count : <span className="text-muted-foreground">-</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {allFamilies.length > 20 && (
                      <tr>
                        <td colSpan={frameworks.length + 1} className="py-2 text-center text-muted-foreground text-sm">
                          ... and {allFamilies.length - 20} more
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {frameworks.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          <p>Select frameworks above to compare them side-by-side.</p>
          <p className="text-sm mt-2">Or try one of the quick compare presets.</p>
        </div>
      )}
    </div>
  );
}
