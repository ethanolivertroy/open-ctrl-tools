import { useState, useMemo, useEffect } from 'react';
import { FRAMEWORK_CONFIGS } from '../../data/framework-configs';
import {
  getCrossFrameworkMappingsFromIndex,
  loadCrosswalkIndex,
  loadFrameworkDataset,
  loadFrameworkManifest,
  type CrosswalkIndexPayload,
  type FrameworkDatasetPayload,
  type FrameworkManifestEntry,
} from '../../lib/client-framework-data';
import { slugifyControlId as slugify } from '../../lib/slugify';
import { parseParentControlId } from '../../lib/control-graph';
import { downloadFile } from '../../lib/export';
import type { Control, FrameworkConfig } from '../../data/types';
import {
  isNistControl,
  isCISControl,
  isSTIGControl,
  isEUAIActControl,
  isCMMCControl,
  isNIST171Control,
  isTXRAMPControl,
} from '../../data/types';
import { ComparisonControlCard } from './ComparisonControlCard';
import { DiffView } from './DiffView';

interface ControlSlot {
  frameworkId: string;
  controlSlug: string;
}

interface ResolvedControl {
  slot: ControlSlot;
  control: Control;
  config: FrameworkConfig;
  families: Record<string, string>;
}

function encodeSlot(slot: ControlSlot): string {
  return `${slot.frameworkId}:${slot.controlSlug}`;
}

function decodeSlot(segment: string): ControlSlot {
  const idx = segment.indexOf(':');
  if (idx === -1) return { frameworkId: '', controlSlug: '' };
  return {
    frameworkId: segment.slice(0, idx),
    controlSlug: segment.slice(idx + 1),
  };
}

interface MetadataRow {
  label: string;
  values: (string | null)[];
}

function getMetadataRows(resolved: ResolvedControl[]): MetadataRow[] {
  const rows: MetadataRow[] = [];

  rows.push({
    label: 'Family',
    values: resolved.map((r) => {
      const name = r.families[r.control.family] || r.control.family;
      return name !== r.control.family ? `${r.control.family} — ${name}` : r.control.family;
    }),
  });

  if (resolved.some((r) => isNistControl(r.control))) {
    rows.push({
      label: 'Baseline',
      values: resolved.map((r) => {
        if (!isNistControl(r.control)) return null;
        const levels: string[] = [];
        if (r.control.baseline_low) levels.push('Low');
        if (r.control.baseline_moderate) levels.push('Moderate');
        if (r.control.baseline_high) levels.push('High');
        if (r.control.baseline_privacy) levels.push('Privacy');
        return levels.length > 0 ? levels.join(', ') : 'None';
      }),
    });
  }

  if (resolved.some((r) => isCISControl(r.control))) {
    rows.push({
      label: 'Implementation Group',
      values: resolved.map((r) => {
        if (!isCISControl(r.control)) return null;
        const igs: string[] = [];
        if (r.control.ig1) igs.push('IG1');
        if (r.control.ig2) igs.push('IG2');
        if (r.control.ig3) igs.push('IG3');
        return igs.length > 0 ? igs.join(', ') : 'None';
      }),
    });
  }

  if (resolved.some((r) => isSTIGControl(r.control))) {
    rows.push({
      label: 'Severity',
      values: resolved.map((r) => {
        if (!isSTIGControl(r.control)) return null;
        return r.control.severity || 'Unknown';
      }),
    });
  }

  if (resolved.some((r) => isCMMCControl(r.control))) {
    rows.push({
      label: 'CMMC Level',
      values: resolved.map((r) => {
        if (!isCMMCControl(r.control)) return null;
        return `Level ${r.control.cmmc_level}`;
      }),
    });
  }

  if (resolved.some((r) => isEUAIActControl(r.control))) {
    rows.push({
      label: 'Risk Tier',
      values: resolved.map((r) => {
        if (!isEUAIActControl(r.control)) return null;
        return r.control.risk_tier || 'Unknown';
      }),
    });
  }

  if (resolved.some((r) => isNIST171Control(r.control))) {
    rows.push({
      label: 'Requirement Type',
      values: resolved.map((r) => {
        if (!isNIST171Control(r.control)) return null;
        return r.control.requirement_type === 'basic' ? 'Basic' : 'Derived';
      }),
    });
  }

  if (resolved.some((r) => isTXRAMPControl(r.control))) {
    rows.push({
      label: 'TX-RAMP Level',
      values: resolved.map((r) => {
        if (!isTXRAMPControl(r.control)) return null;
        const levels: string[] = [];
        if (r.control.level1) levels.push('Level 1');
        if (r.control.level2) levels.push('Level 2');
        return levels.length > 0 ? levels.join(', ') : 'None';
      }),
    });
  }

  rows.push({
    label: 'Related Controls',
    values: resolved.map((r) => {
      const related = r.control.related_controls;
      if (!related || related.length === 0) return null;
      return related.join(', ');
    }),
  });

  return rows;
}

function rowValuesMatch(values: (string | null)[]): boolean {
  const nonNull = values.filter((v) => v !== null);
  if (nonNull.length <= 1) return true;
  return nonNull.every((v) => v === nonNull[0]);
}

function getEnhancementInfo(resolved: ResolvedControl[]): string | null {
  if (resolved.length !== 2) return null;
  const [a, b] = resolved;
  if (a.slot.frameworkId !== b.slot.frameworkId) return null;

  const parentA = parseParentControlId(a.control.control_id);
  const parentB = parseParentControlId(b.control.control_id);

  if (parentA && parentA === b.control.control_id) {
    return `${a.control.control_id} is an enhancement of ${b.control.control_id}`;
  }
  if (parentB && parentB === a.control.control_id) {
    return `${b.control.control_id} is an enhancement of ${a.control.control_id}`;
  }
  return null;
}

export function ControlComparisonTool() {
  const [slots, setSlots] = useState<ControlSlot[]>([
    { frameworkId: '', controlSlug: '' },
    { frameworkId: '', controlSlug: '' },
  ]);
  const [manifestEntries, setManifestEntries] = useState<FrameworkManifestEntry[]>([]);
  const [datasets, setDatasets] = useState<Record<string, FrameworkDatasetPayload>>({});
  const [crosswalkIndex, setCrosswalkIndex] = useState<CrosswalkIndexPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadFrameworkManifest(), loadCrosswalkIndex()])
      .then(([manifest, index]) => {
        if (cancelled) return;
        setManifestEntries(manifest.frameworks.filter((f) => f.loaded && f.controlCount > 0));
        setCrosswalkIndex(index);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get('c');
    if (c) {
      const decoded = c.split(',').map(decodeSlot).filter((s) => s.frameworkId);
      if (decoded.length >= 2) {
        setSlots(decoded.slice(0, 4));
      }
    }
  }, []);

  useEffect(() => {
    const filled = slots.filter((s) => s.frameworkId && s.controlSlug);
    const url = new URL(window.location.href);
    if (filled.length > 0) {
      url.searchParams.set('c', filled.map(encodeSlot).join(','));
    } else {
      url.searchParams.delete('c');
    }
    window.history.replaceState({}, '', url.toString());
  }, [slots]);

  useEffect(() => {
    const needed = Array.from(
      new Set(slots.map((s) => s.frameworkId).filter((id) => id && !(id in datasets))),
    );
    if (needed.length === 0) return;

    let cancelled = false;
    for (const fwId of needed) {
      loadFrameworkDataset(fwId)
        .then((payload) => {
          if (cancelled) return;
          setDatasets((prev) => ({ ...prev, [fwId]: payload }));
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [slots, datasets]);

  const availableFrameworks = useMemo(
    () => manifestEntries.map((f) => ({ id: f.id, name: f.name })).sort((a, b) => a.name.localeCompare(b.name)),
    [manifestEntries],
  );

  const resolved = useMemo(() => {
    return slots
      .map((slot): ResolvedControl | null => {
        if (!slot.frameworkId || !slot.controlSlug) return null;
        const dataset = datasets[slot.frameworkId];
        const config = FRAMEWORK_CONFIGS[slot.frameworkId];
        if (!dataset || !config) return null;
        const control = dataset.controls.find(
          (c) => slugify(c.control_id) === slot.controlSlug,
        );
        if (!control) return null;
        return { slot, control, config, families: dataset.families };
      })
      .filter(Boolean) as ResolvedControl[];
  }, [slots, datasets]);

  const metadataRows = useMemo(() => {
    if (resolved.length < 2) return [];
    return getMetadataRows(resolved);
  }, [resolved]);

  const enhancementInfo = useMemo(() => getEnhancementInfo(resolved), [resolved]);

  const crossMappings = useMemo(() => {
    if (!crosswalkIndex) return resolved.map(() => []);
    return resolved.map((r) => {
      const ds = datasets[r.slot.frameworkId];
      return getCrossFrameworkMappingsFromIndex({
        index: crosswalkIndex,
        controlId: r.control.control_id,
        frameworkId: r.slot.frameworkId,
        stigNistMappings: ds?.stigNistMappings?.[r.control.control_id],
      });
    });
  }, [resolved, crosswalkIndex, datasets]);

  function getGroupedControls(frameworkId: string): Map<string, Control[]> {
    const controls = datasets[frameworkId]?.controls || [];
    const grouped = new Map<string, Control[]>();
    for (const c of controls) {
      const family = c.family || 'Other';
      if (!grouped.has(family)) grouped.set(family, []);
      grouped.get(family)!.push(c);
    }
    return grouped;
  }

  const updateSlot = (index: number, updates: Partial<ControlSlot>) => {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      if (updates.frameworkId !== undefined && updates.controlSlug === undefined) {
        next[index].controlSlug = '';
      }
      return next;
    });
  };

  const removeSlot = (index: number) => {
    if (slots.length <= 2) {
      setSlots((prev) => {
        const next = [...prev];
        next[index] = { frameworkId: '', controlSlug: '' };
        return next;
      });
    } else {
      setSlots((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const addSlot = () => {
    if (slots.length < 4) {
      setSlots((prev) => [...prev, { frameworkId: '', controlSlug: '' }]);
    }
  };

  const applyPreset = (newSlots: ControlSlot[]) => {
    setSlots(newSlots);
  };

  const handleExport = (format: 'csv' | 'json') => {
    if (resolved.length < 2) return;

    const date = new Date().toISOString().split('T')[0];
    const filename = `control-comparison-${date}.${format}`;

    if (format === 'json') {
      const exportData = {
        metadata: {
          exportDate: new Date().toISOString(),
          controlCount: resolved.length,
        },
        controls: resolved.map((r) => ({
          frameworkId: r.slot.frameworkId,
          frameworkName: r.config.name,
          controlId: r.control.control_id,
          title: r.control.title,
          family: r.control.family,
          description: r.control.description,
          relatedControls: r.control.related_controls || [],
          url: r.control.url,
        })),
        comparison: {
          enhancementRelationship: enhancementInfo,
          metadata: metadataRows.map((row) => ({
            field: row.label,
            values: row.values,
            allMatch: rowValuesMatch(row.values),
          })),
        },
      };
      downloadFile(exportData, filename, 'application/json');
    } else {
      const headers = ['Field', ...resolved.map((r) => `${r.config.name} — ${r.control.control_id}`)];
      const rows = [headers.join(',')];

      rows.push(['Title', ...resolved.map((r) => `"${r.control.title}"`)].join(','));
      rows.push(['Family', ...resolved.map((r) => `"${r.control.family}"`)].join(','));
      rows.push(
        [
          'Description',
          ...resolved.map(
            (r) => `"${r.control.description.replace(/"/g, '""').replace(/\r?\n|\r/g, ' ').slice(0, 500)}"`,
          ),
        ].join(','),
      );

      for (const row of metadataRows) {
        rows.push([`"${row.label}"`, ...row.values.map((v) => (v ? `"${v}"` : '""'))].join(','));
      }

      downloadFile(rows.join('\n'), filename, 'text/csv;charset=utf-8');
    }
  };

  const [allExpanded, setAllExpanded] = useState<boolean | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'cards' | 'diff'>('cards');

  const gridCols =
    resolved.length <= 1
      ? 'grid-cols-1'
      : resolved.length === 2
        ? 'grid-cols-1 md:grid-cols-2'
        : resolved.length === 3
          ? 'grid-cols-1 md:grid-cols-3'
          : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4">
          {slots.map((slot, index) => (
            <div key={index} className="flex-1 min-w-[280px] max-w-[380px] space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-muted-foreground">
                  Control {index + 1}
                </label>
                <button
                  type="button"
                  onClick={() => removeSlot(index)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  title="Remove"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <select
                value={slot.frameworkId}
                onChange={(e) => updateSlot(index, { frameworkId: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select framework...</option>
                {availableFrameworks.map((fw) => (
                  <option key={fw.id} value={fw.id}>
                    {fw.name}
                  </option>
                ))}
              </select>

              <select
                value={slot.controlSlug}
                onChange={(e) => updateSlot(index, { controlSlug: e.target.value })}
                disabled={!slot.frameworkId || !(slot.frameworkId in datasets)}
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              >
                <option value="">
                  {slot.frameworkId && !(slot.frameworkId in datasets)
                    ? 'Loading controls...'
                    : 'Select control...'}
                </option>
                {slot.frameworkId &&
                  Array.from(getGroupedControls(slot.frameworkId).entries()).map(
                    ([family, controls]) => (
                      <optgroup
                        key={family}
                        label={datasets[slot.frameworkId]?.families[family] || family}
                      >
                        {controls.map((c) => (
                          <option key={c.control_id} value={slugify(c.control_id)}>
                            {c.control_id} — {c.title}
                          </option>
                        ))}
                      </optgroup>
                    ),
                  )}
              </select>
            </div>
          ))}

          {slots.length < 4 && (
            <div className="flex items-end pb-[2px]">
              <button
                type="button"
                onClick={addSlot}
                className="px-4 py-2 border border-dashed border-border rounded-md text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                + Add Control
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground">Quick compare:</span>
            <button
              type="button"
              onClick={() =>
                applyPreset([
                  { frameworkId: 'nist-800-53-r5', controlSlug: 'ac-2' },
                  { frameworkId: 'nist-800-53-r5', controlSlug: 'ac-2-1' },
                ])
              }
              className="px-2 py-1 text-xs bg-muted rounded hover:bg-muted/80 transition-colors"
            >
              AC-2 vs AC-2(1)
            </button>
            <button
              type="button"
              onClick={() =>
                applyPreset([
                  { frameworkId: 'nist-800-53-r5', controlSlug: 'ac-2' },
                  { frameworkId: 'fedramp-rev5', controlSlug: 'ac-2' },
                ])
              }
              className="px-2 py-1 text-xs bg-muted rounded hover:bg-muted/80 transition-colors"
            >
              NIST AC-2 vs FedRAMP AC-2
            </button>
            <button
              type="button"
              onClick={() =>
                applyPreset([
                  { frameworkId: 'nist-800-53-r5', controlSlug: 'ac-1' },
                  { frameworkId: 'nist-800-53-r5', controlSlug: 'at-1' },
                  { frameworkId: 'nist-800-53-r5', controlSlug: 'au-1' },
                ])
              }
              className="px-2 py-1 text-xs bg-muted rounded hover:bg-muted/80 transition-colors"
            >
              Policy Controls: AC-1 vs AT-1 vs AU-1
            </button>
          </div>

          {resolved.length >= 2 && (
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
      </div>

      {enhancementInfo && (
        <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 text-sm">
          <span className="font-medium text-primary">Enhancement Comparison:</span>{' '}
          <span className="text-foreground">{enhancementInfo}</span>
        </div>
      )}

      {resolved.length >= 2 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAllExpanded((prev) => (prev === true ? false : true))}
                aria-pressed={!!allExpanded}
                className="px-3 py-1.5 text-xs border border-border rounded hover:bg-accent transition-colors"
              >
                {allExpanded ? 'Collapse All' : 'Expand All'}
              </button>
            </div>
            {resolved.length === 2 && (
              <div className="inline-flex h-8 items-center rounded-md bg-muted p-1" role="group" aria-label="View mode">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  aria-pressed={viewMode === 'cards'}
                  className={`inline-flex items-center justify-center rounded-sm px-3 py-1 text-xs font-medium transition-all ${
                    viewMode === 'cards'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('diff')}
                  aria-pressed={viewMode === 'diff'}
                  className={`inline-flex items-center justify-center rounded-sm px-3 py-1 text-xs font-medium transition-all ${
                    viewMode === 'diff'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Diff
                </button>
              </div>
            )}
          </div>

          {viewMode === 'diff' && resolved.length === 2 ? (
            <DiffView
              controlA={resolved[0].control}
              controlB={resolved[1].control}
              configA={resolved[0].config}
              configB={resolved[1].config}
            />
          ) : (
            <div className={`grid gap-4 ${gridCols}`}>
              {resolved.map((r, i) => (
                <ComparisonControlCard
                  key={i}
                  control={r.control}
                  config={r.config}
                  frameworkId={r.slot.frameworkId}
                  allExpanded={allExpanded}
                />
              ))}
            </div>
          )}

          {metadataRows.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold">Metadata Comparison</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground w-40">
                        Field
                      </th>
                      {resolved.map((r, i) => (
                        <th key={i} className="text-left py-2 px-2 font-medium text-muted-foreground">
                          {r.control.control_id}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {metadataRows.map((row) => {
                      const allNull = row.values.every((v) => v === null);
                      if (allNull) return null;
                      const match = rowValuesMatch(row.values);
                      return (
                        <tr key={row.label} className={`border-b border-border/50 ${!match ? 'bg-primary/5' : ''}`}>
                          <td className="py-2 pr-4 font-medium text-muted-foreground">
                            {row.label}
                            {!match && (
                              <span className="ml-1.5 text-xs text-primary" title="Values differ">
                                ●
                              </span>
                            )}
                          </td>
                          {row.values.map((val, i) => (
                            <td key={i} className="py-2 px-2">
                              {val !== null ? (
                                <span className="text-foreground">{val}</span>
                              ) : (
                                <span className="text-muted-foreground italic">N/A</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {resolved.length === 2 && (
                <p className="text-xs text-muted-foreground">
                  Rows with <span className="text-primary">●</span> indicate differing values between controls.
                </p>
              )}
            </div>
          )}

          {crossMappings.some((m) => m.length > 0) && (
            <div className="space-y-3">
              <h3 className="font-semibold">Cross-Framework Mappings</h3>
              <div className={`grid gap-4 ${gridCols}`}>
                {resolved.map((r, i) => (
                  <div key={i} className="rounded-lg border border-border p-4">
                    <h4 className="text-sm font-medium mb-2">{r.control.control_id}</h4>
                    {crossMappings[i].length > 0 ? (
                      <ul className="space-y-1.5">
                        {crossMappings[i].map((mapping) => (
                          <li key={mapping.frameworkId} className="text-sm">
                            <span className="text-muted-foreground">{mapping.frameworkName}:</span>{' '}
                            <span className="font-mono text-xs">
                              {mapping.controlIds.slice(0, 5).join(', ')}
                              {mapping.controlIds.length > 5 && (
                                <span className="text-muted-foreground">
                                  {' '}
                                  +{mapping.controlIds.length - 5} more
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        No crosswalk mappings available
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {resolved.length < 2 && (
        <div className="text-center py-12 text-muted-foreground">
          <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          <p>Select a framework and control in each slot above to compare them side-by-side.</p>
          <p className="text-sm mt-2">Or try one of the quick compare presets.</p>
        </div>
      )}
    </div>
  );
}
