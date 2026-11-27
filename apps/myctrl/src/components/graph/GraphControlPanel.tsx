/**
 * Obsidian-style Control Panel for the Knowledge Graph
 *
 * Collapsible right sidebar with search, filters, display controls,
 * force tuning, and expanded frameworks management.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  Category,
  ColorMode,
  GraphDisplayConfig,
  GraphForceConfig,
} from '@/lib/graph/graph-types';
import {
  CATEGORY_COLORS,
  getCategoryColor,
  CATEGORY_LABELS,
  DEFAULT_DISPLAY_CONFIG,
  DEFAULT_FORCE_CONFIG,
} from '@/lib/graph/graph-types';
import type { Assessment } from '../../lib/db';
import { ActiveProjectSelect } from '@/components/projects/ActiveProjectSelect';

// A search result entry
export interface SearchResult {
  id: string;
  label: string;
  type: 'framework' | 'control';
  frameworkId?: string;
}

interface GraphControlPanelProps {
  // Filters
  selectedCategories: Category[];
  onToggleCategory: (category: Category) => void;

  // Display config
  displayConfig: GraphDisplayConfig;
  onDisplayChange: (update: Partial<GraphDisplayConfig>) => void;

  // Color mode
  colorMode: ColorMode;
  onColorModeChange: (mode: ColorMode) => void;

  // Force config
  forceConfig: GraphForceConfig;
  onForceChange: (update: Partial<GraphForceConfig>) => void;

  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchResults: SearchResult[];
  onSearchResultClick: (result: SearchResult) => void;

  // Local graph mode
  graphMode: 'global' | 'local';
  localDepth: number;
  localFocusId: string | null;
  onGraphModeChange: (mode: 'global' | 'local') => void;
  onLocalDepthChange: (depth: number) => void;

  // Expansion state
  expandedFrameworks: string[];
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onCollapseFramework: (id: string) => void;

  // Assessments
  assessments: Assessment[];
  activeAssessmentId: string;
  onAssessmentChange: (id: string) => void;
  onCreateAssessment: (name: string) => void;

  // Gap analysis
  gapSourceFramework: string | null;
  gapTargetFramework: string | null;
  gapCount: number;
  availableFrameworks: { id: string; name: string }[];
  onGapAnalysis: (source: string | null, target: string | null) => void;

  // Coverage stats (per expanded framework)
  coverageStats: { frameworkId: string; total: number; implemented: number; partial: number; notImpl: number }[];

  // Stats
  nodeCount: number;
  edgeCount: number;
}

// Reusable slider component
function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[0.6rem] text-muted-foreground/70 w-20 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 accent-primary bg-secondary rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
"
      />
      <span className="text-[0.55rem] text-muted-foreground/50 w-8 text-right font-mono">{value.toFixed(step < 1 ? (step < 0.1 ? 2 : 1) : 0)}</span>
    </div>
  );
}

export function GraphControlPanel({
  selectedCategories,
  onToggleCategory,
  displayConfig,
  onDisplayChange,
  colorMode,
  onColorModeChange,
  forceConfig,
  onForceChange,
  searchQuery,
  onSearchChange,
  searchResults,
  onSearchResultClick,
  graphMode,
  localDepth,
  localFocusId,
  onGraphModeChange,
  onLocalDepthChange,
  expandedFrameworks,
  onExpandAll,
  onCollapseAll,
  onCollapseFramework,
  assessments,
  activeAssessmentId,
  onAssessmentChange,
  onCreateAssessment,
  gapSourceFramework,
  gapTargetFramework,
  gapCount,
  availableFrameworks,
  onGapAnalysis,
  coverageStats,
  nodeCount,
  edgeCount,
}: GraphControlPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(['search', 'filters'])
  );
  const searchInputRef = useRef<HTMLInputElement>(null);

  const toggleSection = useCallback((section: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

  // Keyboard shortcut: / to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        const active = document.activeElement;
        if (active?.tagName !== 'INPUT' && active?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setIsOpen(true);
          setOpenSections(prev => new Set([...prev, 'search']));
          searchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const allCategories: Category[] = ['fed', 'ai', 'ent', 'owasp', 'priv', 'intl', 'meta'];

  return (
    <>
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-20 z-40 px-2 py-1.5 bg-background/70 hover:bg-background/90 text-muted-foreground hover:text-foreground rounded-lg border border-border/30 backdrop-blur-xl transition-all text-xs font-mono"
        style={{ right: isOpen ? '21rem' : '1rem' }}
      >
        {isOpen ? '>>' : '<<'}
      </button>

      {/* Panel */}
      <div
        className={`fixed top-16 right-0 z-30 h-[calc(100%-4rem)] w-80 bg-background/80 backdrop-blur-xl border-l border-border/30 overflow-y-auto scrollbar-thin transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-4 space-y-1">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold text-foreground uppercase tracking-[0.15em]">Graph Controls</h2>
            <span className="text-[0.55rem] text-muted-foreground/50 font-mono">
              {nodeCount}n · {edgeCount}e
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[0.5rem] text-muted-foreground/50 mb-3 pb-2 border-b border-border/20">
            <kbd className="px-1 py-0.5 bg-secondary/50 rounded border border-border/50 text-muted-foreground/70">Scroll</kbd>zoom
            <span className="text-zinc-700">·</span>
            <kbd className="px-1 py-0.5 bg-secondary/50 rounded border border-border/50 text-muted-foreground/70">Click</kbd>expand
            <span className="text-zinc-700">·</span>
            <kbd className="px-1 py-0.5 bg-secondary/50 rounded border border-border/50 text-muted-foreground/70">⌘+Click</kbd>navigate
          </div>

          {/* Search */}
          <Section title="Search" id="search" open={openSections.has('search')} onToggle={toggleSection}>
            <div className="space-y-2">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search frameworks & controls... (press /)"
                  className="w-full px-3 py-1.5 text-xs bg-muted/60 border border-border/20 rounded-md text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => onSearchChange('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground text-xs"
                  >
                    ×
                  </button>
                )}
              </div>
              {/* Search results */}
              {searchQuery && searchResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto scrollbar-thin space-y-0.5 rounded bg-muted/40 border border-border/20 p-1">
                  {searchResults.slice(0, 50).map(result => (
                    <button
                      type="button"
                      key={result.id}
                      onClick={() => onSearchResultClick(result)}
                      className="w-full text-left px-2 py-1 text-[0.6rem] rounded hover:bg-muted/20 transition-colors flex items-center gap-2"
                    >
                      <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                        result.type === 'framework' ? 'bg-primary' : 'bg-zinc-500'
                      }`} />
                      <span className="text-foreground truncate">{result.label}</span>
                      {result.frameworkId && (
                        <span className="text-muted-foreground/50 text-[0.5rem] ml-auto shrink-0">{result.frameworkId}</span>
                      )}
                    </button>
                  ))}
                  {searchResults.length > 50 && (
                    <p className="text-[0.5rem] text-muted-foreground/50 text-center py-1">
                      +{searchResults.length - 50} more results
                    </p>
                  )}
                </div>
              )}
              {searchQuery && searchResults.length === 0 && (
                <p className="text-[0.5rem] text-muted-foreground/50 text-center py-1">No matches found</p>
              )}
            </div>
          </Section>

          {/* View Mode */}
          <Section title="View Mode" id="viewmode" open={openSections.has('viewmode')} onToggle={toggleSection}>
            <div className="space-y-2">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => onGraphModeChange('global')}
                  className={`flex-1 px-2 py-1 text-[0.6rem] font-semibold rounded border transition-all ${
                    graphMode === 'global'
                      ? 'bg-primary/15 text-primary border-primary/30'
                      : 'bg-secondary/50 text-muted-foreground/70 border-border/20'
                  }`}
                >
                  Global
                </button>
                <button
                  type="button"
                  onClick={() => onGraphModeChange('local')}
                  className={`flex-1 px-2 py-1 text-[0.6rem] font-semibold rounded border transition-all ${
                    graphMode === 'local'
                      ? 'bg-primary/15 text-primary border-primary/30'
                      : 'bg-secondary/50 text-muted-foreground/70 border-border/20'
                  }`}
                >
                  Local
                </button>
              </div>
              {graphMode === 'local' && (
                <>
                  <Slider
                    label="Depth"
                    value={localDepth}
                    min={1} max={3} step={1}
                    onChange={onLocalDepthChange}
                  />
                  <p className="text-[0.5rem] text-muted-foreground/50">
                    {localFocusId
                      ? `Focused on: ${localFocusId}`
                      : 'Click a node to focus'}
                  </p>
                </>
              )}
            </div>
          </Section>

          {/* Filters */}
          <Section title="Categories" id="filters" open={openSections.has('filters')} onToggle={toggleSection}>
            <div className="flex flex-wrap gap-1.5">
              {allCategories.map(cat => {
                const isSelected = selectedCategories.includes(cat);
                const color = getCategoryColor(cat);
                return (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => onToggleCategory(cat)}
                    className={`px-2 py-0.5 text-[0.6rem] font-semibold rounded border transition-all ${
                      isSelected
                        ? 'border-border/40'
                        : 'border-border/20 bg-muted/20 text-muted-foreground/50'
                    }`}
                    style={isSelected ? {
                      backgroundColor: `${color}25`,
                      color: color,
                    } : {}}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Assessment */}
          <Section title="Assessment" id="assessment" open={openSections.has('assessment')} onToggle={toggleSection}>
            <div className="space-y-2">
              <ActiveProjectSelect
                label="Project"
                showManageLink
                className="justify-between"
              />
              <select
                value={activeAssessmentId}
                onChange={(e) => onAssessmentChange(e.target.value)}
                className="w-full px-2 py-1 text-[0.6rem] bg-muted/60 border border-border/20 rounded text-foreground focus:outline-none focus:border-primary/30"
              >
                <option value="_default">Default (unsaved)</option>
                {assessments.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  const name = prompt('Assessment name:');
                  if (name?.trim()) onCreateAssessment(name.trim());
                }}
                className="w-full py-1 text-[0.55rem] text-primary hover:text-primary/80 rounded bg-primary/10 border border-primary/20 transition-colors"
              >
                + New Assessment
              </button>
              <p className="text-[0.45rem] text-muted-foreground/50">
                Right-click controls to set status. Assessments track implementation progress per framework.
              </p>
            </div>
          </Section>

          {/* Display */}
          <Section title="Display" id="display" open={openSections.has('display')} onToggle={toggleSection}>
            <div className="space-y-2">
              {/* Color mode */}
              <div className="flex items-center gap-2">
                <span className="text-[0.6rem] text-muted-foreground/70 w-20 shrink-0">Color by</span>
                <div className="flex gap-1 flex-1">
                  <button
                    type="button"
                    onClick={() => onColorModeChange('category')}
                    className={`flex-1 px-1.5 py-0.5 text-[0.55rem] rounded border transition-all ${
                      colorMode === 'category'
                        ? 'bg-primary/15 text-primary border-primary/30'
                        : 'bg-secondary/50 text-muted-foreground/50 border-border/20'
                    }`}
                  >
                    Category
                  </button>
                  <button
                    type="button"
                    onClick={() => onColorModeChange('status')}
                    className={`flex-1 px-1.5 py-0.5 text-[0.55rem] rounded border transition-all ${
                      colorMode === 'status'
                        ? 'bg-low/15 text-low border-low/30'
                        : 'bg-secondary/50 text-muted-foreground/50 border-border/20'
                    }`}
                  >
                    Status
                  </button>
                  <button
                    type="button"
                    onClick={() => onColorModeChange('owner')}
                    className={`flex-1 px-1.5 py-0.5 text-[0.55rem] rounded border transition-all ${
                      colorMode === 'owner'
                        ? 'bg-privacy/15 text-privacy border-privacy/30'
                        : 'bg-secondary/50 text-muted-foreground/50 border-border/20'
                    }`}
                  >
                    Owner
                  </button>
                </div>
              </div>
              <Slider
                label="Node size"
                value={displayConfig.nodeSizeMultiplier}
                min={0.5} max={3} step={0.1}
                onChange={(v) => onDisplayChange({ nodeSizeMultiplier: v })}
              />
              <Slider
                label="Link width"
                value={displayConfig.linkThicknessMultiplier}
                min={0.5} max={3} step={0.1}
                onChange={(v) => onDisplayChange({ linkThicknessMultiplier: v })}
              />
              <Slider
                label="Text fade"
                value={displayConfig.textFadeThreshold}
                min={0.3} max={2} step={0.1}
                onChange={(v) => onDisplayChange({ textFadeThreshold: v })}
              />
              <Slider
                label="Dim opacity"
                value={displayConfig.dimmedNodeOpacity}
                min={0} max={0.5} step={0.05}
                onChange={(v) => onDisplayChange({ dimmedNodeOpacity: v })}
              />
            </div>
          </Section>

          {/* Forces */}
          <Section title="Forces" id="forces" open={openSections.has('forces')} onToggle={toggleSection}>
            <div className="space-y-2">
              <Slider
                label="Repel"
                value={forceConfig.repelStrength}
                min={0.1} max={2} step={0.1}
                onChange={(v) => onForceChange({ repelStrength: v })}
              />
              <Slider
                label="Center"
                value={forceConfig.centerForce}
                min={0.05} max={0.5} step={0.05}
                onChange={(v) => onForceChange({ centerForce: v })}
              />
              <Slider
                label="Link dist"
                value={forceConfig.linkDistance}
                min={30} max={200} step={5}
                onChange={(v) => onForceChange({ linkDistance: v })}
              />
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[0.6rem] text-muted-foreground/70 w-20 shrink-0">Freeze</span>
                <button
                  type="button"
                  onClick={() => onForceChange({ frozen: !forceConfig.frozen })}
                  className={`px-2 py-0.5 text-[0.55rem] rounded border transition-all ${
                    forceConfig.frozen
                      ? 'bg-moderate/20 text-moderate border-moderate/30'
                      : 'bg-secondary/50 text-muted-foreground/70 border-border/20'
                  }`}
                >
                  {forceConfig.frozen ? 'Frozen' : 'Running'}
                </button>
              </div>
            </div>
          </Section>

          {/* Expansion Controls */}
          <Section
            title={expandedFrameworks.length > 0 ? `Expanded (${expandedFrameworks.length})` : 'Expansion'}
            id="expanded"
            open={openSections.has('expanded')}
            onToggle={toggleSection}
          >
            <div className="space-y-1">
              {/* Expand All / Collapse All buttons */}
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={onExpandAll}
                  className="flex-1 py-1 text-[0.6rem] text-primary hover:text-primary/80 rounded bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors"
                >
                  Expand All
                </button>
                {expandedFrameworks.length > 0 && (
                  <button
                    type="button"
                    onClick={onCollapseAll}
                    className="flex-1 py-1 text-[0.6rem] text-muted-foreground/70 hover:text-foreground rounded bg-secondary/30 border border-border/20 transition-colors"
                  >
                    Collapse All
                  </button>
                )}
              </div>

              {/* Expanded framework list */}
              {expandedFrameworks.map(id => (
                <div key={id} className="flex items-center justify-between gap-2">
                  <span className="text-[0.6rem] text-muted-foreground truncate">{id}</span>
                  <button
                    type="button"
                    onClick={() => onCollapseFramework(id)}
                    className="text-[0.55rem] text-muted-foreground/50 hover:text-muted-foreground px-1.5 py-0.5 rounded bg-secondary/50 border border-border/20"
                  >
                    ×
                  </button>
                </div>
              ))}

              {expandedFrameworks.length === 0 && (
                <p className="text-[0.5rem] text-muted-foreground/50 text-center py-1">
                  Click a framework node to expand its controls
                </p>
              )}
            </div>
          </Section>

          {/* Coverage Stats */}
          {coverageStats.length > 0 && (
            <Section title="Coverage" id="coverage" open={openSections.has('coverage')} onToggle={toggleSection}>
              <div className="space-y-2">
                {coverageStats.map(stat => {
                  const pct = stat.total > 0 ? Math.round(((stat.implemented + stat.partial * 0.5) / stat.total) * 100) : 0;
                  return (
                    <div key={stat.frameworkId}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[0.55rem] text-muted-foreground truncate">{stat.frameworkId}</span>
                        <span className="text-[0.55rem] font-mono text-muted-foreground/70">{pct}%</span>
                      </div>
                      <div className="h-1 bg-secondary rounded-full overflow-hidden flex">
                        {stat.implemented > 0 && (
                          <div className="bg-low h-full" style={{ width: `${(stat.implemented / stat.total) * 100}%` }} />
                        )}
                        {stat.partial > 0 && (
                          <div className="bg-moderate h-full" style={{ width: `${(stat.partial / stat.total) * 100}%` }} />
                        )}
                        {stat.notImpl > 0 && (
                          <div className="bg-high h-full" style={{ width: `${(stat.notImpl / stat.total) * 100}%` }} />
                        )}
                      </div>
                      <div className="flex gap-2 mt-0.5 text-[0.45rem] text-muted-foreground/50">
                        <span>{stat.implemented} impl</span>
                        <span>{stat.partial} partial</span>
                        <span>{stat.notImpl} not impl</span>
                        <span className="ml-auto">{stat.total} total</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Gap Analysis */}
          <Section title="Gap Analysis" id="gap" open={openSections.has('gap')} onToggle={toggleSection}>
            <div className="space-y-2">
              <div>
                <label className="text-[0.5rem] text-muted-foreground/50 block mb-0.5">Source framework</label>
                <select
                  value={gapSourceFramework || ''}
                  onChange={(e) => onGapAnalysis(e.target.value || null, gapTargetFramework)}
                  className="w-full px-2 py-1 text-[0.6rem] bg-muted/60 border border-border/20 rounded text-foreground focus:outline-none focus:border-primary/30"
                >
                  <option value="">Select source...</option>
                  {availableFrameworks.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[0.5rem] text-muted-foreground/50 block mb-0.5">Target framework</label>
                <select
                  value={gapTargetFramework || ''}
                  onChange={(e) => onGapAnalysis(gapSourceFramework, e.target.value || null)}
                  className="w-full px-2 py-1 text-[0.6rem] bg-muted/60 border border-border/20 rounded text-foreground focus:outline-none focus:border-primary/30"
                >
                  <option value="">Select target...</option>
                  {availableFrameworks.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              {gapSourceFramework && gapTargetFramework && (
                <div className="bg-muted/40 border border-border/20 rounded p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[0.55rem] text-muted-foreground">Unmapped controls</span>
                    <span className={`text-[0.6rem] font-bold ${gapCount > 0 ? 'text-high' : 'text-low'}`}>
                      {gapCount}
                    </span>
                  </div>
                  <p className="text-[0.45rem] text-muted-foreground/50 mt-1">
                    Controls in {gapSourceFramework} with no mapping to {gapTargetFramework}. Highlighted in red on graph.
                  </p>
                </div>
              )}
              {(!gapSourceFramework || !gapTargetFramework) && (
                <p className="text-[0.45rem] text-muted-foreground/50">
                  Select two frameworks to find controls with no crosswalk mapping between them.
                </p>
              )}
              {gapSourceFramework && gapTargetFramework && (
                <button
                  type="button"
                  onClick={() => onGapAnalysis(null, null)}
                  className="w-full py-1 text-[0.55rem] text-muted-foreground/70 hover:text-foreground rounded bg-secondary/30 border border-border/20 transition-colors"
                >
                  Clear Gap Analysis
                </button>
              )}
            </div>
          </Section>

          {/* Legend */}
          <Section title="Legend" id="legend" open={openSections.has('legend')} onToggle={toggleSection}>
            <div className="grid grid-cols-2 gap-1.5">
              {allCategories.map(cat => (
                <div key={cat} className="flex items-center gap-1.5">
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: getCategoryColor(cat),
                    }}
                  />
                  <span className="text-[0.55rem] text-muted-foreground/70">{CATEGORY_LABELS[cat]}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-2 border-t border-border/20 space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-6 h-px bg-white/30" />
                <span className="text-[0.5rem] text-muted-foreground/50">Framework crosswalk</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-px border-t border-dashed border-border/50" />
                <span className="text-[0.5rem] text-muted-foreground/50">Control crosswalk (high confidence)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-px border-t border-dashed border-border/30" />
                <span className="text-[0.5rem] text-muted-foreground/50">Control crosswalk (derived)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-px bg-white/10" />
                <span className="text-[0.5rem] text-muted-foreground/50">Contains</span>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}

/** Collapsible section */
function Section({
  title,
  id,
  open,
  onToggle,
  children,
}: {
  title: string;
  id: string;
  open: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border/20 pb-2">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between py-2 group"
      >
        <span className="text-[0.6rem] font-semibold text-muted-foreground uppercase tracking-[0.15em] group-hover:text-foreground transition-colors">
          {title}
        </span>
        <svg
          className={`w-3 h-3 text-muted-foreground/50 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}

export default GraphControlPanel;
