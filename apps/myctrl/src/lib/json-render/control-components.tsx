import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BaselineBadges } from '@/components/controls/BaselineBadge';
import {
  getAllControls,
  getControlBySlug,
  getControlsByFamily,
  getFrameworkConfig,
  slugify,
  isValidFramework,
} from '@/data/controls';
import { getCrossFrameworkMappings } from '@/data/crosswalk';
import type { Control } from '@/data/types';
import { isNistControl, isFedRAMPControl, isSTIGControl, isCISControl, isEUAIActControl } from '@/data/types';
import type { Component } from './catalog';
import { resolveControlListFilters } from './view-runtime';
import { useData, useDataValue } from '@json-render/react';
import { EmptyState, ErrorMessage, type ComponentProps } from './primitives';

export function AIControlCard({ config }: ComponentProps<'ControlCard'>) {
  const { frameworkId, controlId, variant = 'compact', showBadges = true, showDescription = true } = config;

  if (!isValidFramework(frameworkId)) {
    return <ErrorMessage message={`Unknown framework: ${frameworkId}`} />;
  }

  const slug = slugify(controlId);
  const control = getControlBySlug(frameworkId, slug);

  if (!control) {
    return <ErrorMessage message={`Control not found: ${controlId}`} />;
  }

  const controlUrl = `/frameworks/${frameworkId}/${slug}`;

  if (variant === 'full') {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <a href={controlUrl} className="font-mono text-primary hover:underline">
                  {control.control_id}
                </a>
              </CardTitle>
              <CardDescription className="mt-1">{control.title}</CardDescription>
            </div>
            {showBadges && <BaselineBadges control={control} />}
          </div>
        </CardHeader>
        {showDescription && control.description && (
          <CardContent>
            <p className="text-sm text-muted-foreground">{control.description}</p>
          </CardContent>
        )}
      </Card>
    );
  }

  return (
    <a
      href={controlUrl}
      className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-mono text-sm text-primary shrink-0">{control.control_id}</span>
        <span className="text-sm text-muted-foreground truncate">{control.title}</span>
      </div>
      {showBadges && <BaselineBadges control={control} className="shrink-0 ml-2" />}
    </a>
  );
}

export function AIControlList({ config }: ComponentProps<'ControlList'>) {
  const { frameworkId, filters, filterDataPath, groupBy = 'family', variant = 'compact', limit = 20 } = config;
  const boundFilters = useDataValue<Record<string, unknown>>(filterDataPath || '');
  const activeFilters = resolveControlListFilters(filters, filterDataPath ? boundFilters : undefined);

  if (!isValidFramework(frameworkId)) {
    return <ErrorMessage message={`Unknown framework: ${frameworkId}`} />;
  }

  let controls = getAllControls(frameworkId);

  if (activeFilters) {
    if (activeFilters.family) {
      controls = getControlsByFamily(frameworkId, activeFilters.family);
    }
    if (activeFilters.baseline) {
      controls = controls.filter(c => {
        if (isNistControl(c)) {
          switch (activeFilters.baseline) {
            case 'low': return c.baseline_low;
            case 'moderate': return c.baseline_moderate;
            case 'high': return c.baseline_high;
            case 'privacy': return c.baseline_privacy;
          }
        }
        if (isFedRAMPControl(c)) {
          switch (activeFilters.baseline) {
            case 'low': return c.baselines.low?.included;
            case 'moderate': return c.baselines.moderate?.included;
            case 'high': return c.baselines.high?.included;
            case 'li-saas': return c.baselines.li_saas?.included;
          }
        }
        return true;
      });
    }
    if (activeFilters.severity && isSTIGFramework(frameworkId)) {
      controls = controls.filter(c => {
        if (isSTIGControl(c)) {
          const severityMap: Record<string, string> = {
            'cat-i': 'high',
            'cat-ii': 'medium',
            'cat-iii': 'low',
          };
          return c.severity?.toLowerCase() === severityMap[activeFilters.severity!];
        }
        return true;
      });
    }
    if (activeFilters.implementationGroup) {
      controls = controls.filter(c => {
        if (isCISControl(c)) {
          switch (activeFilters.implementationGroup) {
            case 'ig1': return c.ig1;
            case 'ig2': return c.ig2;
            case 'ig3': return c.ig3;
          }
        }
        return true;
      });
    }
    if (activeFilters.riskTier) {
      controls = controls.filter(c => {
        if (isEUAIActControl(c)) {
          return c.risk_tier?.toLowerCase().replace('-', '_') === activeFilters.riskTier!.replace('-', '_');
        }
        return true;
      });
    }
    if (activeFilters.searchQuery) {
      const query = activeFilters.searchQuery.toLowerCase();
      controls = controls.filter(c =>
        c.title.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query) ||
        c.control_id.toLowerCase().includes(query)
      );
    }
  }

  const displayControls = controls.slice(0, limit);
  const hasMore = controls.length > limit;

  if (displayControls.length === 0) {
    return <EmptyState message="No controls match the specified filters." />;
  }

  if (groupBy === 'family') {
    const grouped = groupControlsByFamily(displayControls);
    return (
      <div className="space-y-6">
        {Object.entries(grouped).map(([family, familyControls]) => (
          <div key={family} className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground">{family}</h4>
            <div className="space-y-1">
              {familyControls.map(control => (
                <ControlListItem key={control.control_id} control={control} frameworkId={frameworkId} variant={variant} />
              ))}
            </div>
          </div>
        ))}
        {hasMore && <MoreIndicator total={controls.length} shown={limit} />}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {displayControls.map(control => (
        <ControlListItem key={control.control_id} control={control} frameworkId={frameworkId} variant={variant} />
      ))}
      {hasMore && <MoreIndicator total={controls.length} shown={limit} />}
    </div>
  );
}

function ControlListItem({
  control,
  frameworkId,
  variant,
}: {
  control: Control;
  frameworkId: string;
  variant: 'compact' | 'detailed' | 'table';
}) {
  const controlUrl = `/frameworks/${frameworkId}/${slugify(control.control_id)}`;

  if (variant === 'detailed') {
    return (
      <Card className="bg-card/50 border-border">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <a href={controlUrl} className="font-mono text-sm text-primary hover:underline">
                {control.control_id}
              </a>
              <p className="text-sm font-medium">{control.title}</p>
              {control.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{control.description}</p>
              )}
            </div>
            <BaselineBadges control={control} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <a
      href={controlUrl}
      className="flex items-center justify-between p-2 rounded border border-transparent hover:border-border hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-mono text-xs text-primary shrink-0">{control.control_id}</span>
        <span className="text-sm text-muted-foreground truncate">{control.title}</span>
      </div>
      <BaselineBadges control={control} className="shrink-0 ml-2" />
    </a>
  );
}

export function AIComparisonTable({ config }: ComponentProps<'ComparisonTable'>) {
  const { frameworkIds, showMappings = true } = config;

  const frameworks = frameworkIds.map(id => ({
    id,
    config: isValidFramework(id) ? getFrameworkConfig(id) : null,
  }));

  const invalidFrameworks = frameworks.filter(f => !f.config);
  if (invalidFrameworks.length > 0) {
    return <ErrorMessage message={`Unknown frameworks: ${invalidFrameworks.map(f => f.id).join(', ')}`} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left p-3 text-sm font-semibold">Aspect</th>
            {frameworks.map(f => (
              <th key={f.id} className="text-left p-3 text-sm font-semibold">
                <a href={`/frameworks/${f.id}`} className="text-primary hover:underline">
                  {f.config!.name}
                </a>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border/50">
            <td className="p-3 text-sm text-muted-foreground">Version</td>
            {frameworks.map(f => (
              <td key={f.id} className="p-3 text-sm">{f.config!.version}</td>
            ))}
          </tr>
          <tr className="border-b border-border/50">
            <td className="p-3 text-sm text-muted-foreground">Total Controls</td>
            {frameworks.map(f => {
              const controls = getAllControls(f.id);
              return <td key={f.id} className="p-3 text-sm font-mono">{controls.length}</td>;
            })}
          </tr>
          <tr className="border-b border-border/50">
            <td className="p-3 text-sm text-muted-foreground">Has Baselines</td>
            {frameworks.map(f => (
              <td key={f.id} className="p-3 text-sm">
                {f.config!.hasBaselines ? (
                  <Badge variant="outline" className="text-green-700 dark:text-green-400 border-green-700/30 dark:border-green-400/30">Yes</Badge>
                ) : (
                  <span className="text-muted-foreground">No</span>
                )}
              </td>
            ))}
          </tr>
          {showMappings && (
            <tr className="border-b border-border/50">
              <td className="p-3 text-sm text-muted-foreground">Cross-References</td>
              {frameworks.map(f => (
                <td key={f.id} className="p-3 text-sm">
                  <a href={`/crosswalk?framework=${f.id}`} className="text-primary hover:underline text-xs">
                    View mappings
                  </a>
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function AICrosswalkDisplay({ config }: ComponentProps<'CrosswalkDisplay'>) {
  const { sourceFramework, sourceControl, targetFrameworks } = config;

  if (!isValidFramework(sourceFramework)) {
    return <ErrorMessage message={`Unknown framework: ${sourceFramework}`} />;
  }

  const slug = slugify(sourceControl);
  const control = getControlBySlug(sourceFramework, slug);

  if (!control) {
    return <ErrorMessage message={`Control not found: ${sourceControl}`} />;
  }

  const mappings = getCrossFrameworkMappings(control.control_id, sourceFramework);
  const filteredMappings = targetFrameworks
    ? mappings.filter(m => targetFrameworks.includes(m.frameworkId))
    : mappings;

  if (filteredMappings.length === 0) {
    return (
      <Card className="bg-muted/30 border-border">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            No cross-framework mappings found for {sourceControl}.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          Cross-Framework Mappings for{' '}
          <span className="font-mono text-primary">{sourceControl}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {filteredMappings.map(mapping => (
            <div key={mapping.frameworkId} className="flex items-start gap-3">
              <Badge variant="outline" className="shrink-0">
                {mapping.frameworkName || mapping.frameworkId}
              </Badge>
              <div className="flex flex-wrap gap-1">
                {mapping.controlIds.slice(0, 5).map(controlId => (
                  <a
                    key={controlId}
                    href={`/frameworks/${mapping.frameworkId}/${slugify(controlId)}`}
                    className="text-xs font-mono text-primary hover:underline"
                  >
                    {controlId}
                  </a>
                ))}
                {mapping.controlIds.length > 5 && (
                  <span className="text-xs text-muted-foreground">
                    +{mapping.controlIds.length - 5} more
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function AIFilterControls({ config }: ComponentProps<'FilterControls'>) {
  const { filters, layout = 'horizontal' } = config;
  const { get, set } = useData();

  const layoutClasses = {
    horizontal: 'flex flex-wrap gap-4 items-end',
    vertical: 'flex flex-col gap-3',
    grid: 'grid grid-cols-2 gap-4',
  };

  return (
    <div className={layoutClasses[layout]}>
      {filters.map(filter => {
        const currentValue = get(filter.dataPath) as string | boolean | undefined;

        switch (filter.type) {
          case 'select':
            return (
              <div key={filter.id} className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{filter.label}</label>
                <select
                  value={String(currentValue || '')}
                  onChange={e => set(filter.dataPath, e.target.value)}
                  className="h-9 px-3 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">All</option>
                  {filter.options?.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            );

          case 'checkbox':
            return (
              <div key={filter.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={filter.id}
                  checked={Boolean(currentValue)}
                  onChange={e => set(filter.dataPath, e.target.checked)}
                  className="h-4 w-4 rounded border border-border bg-card focus:ring-2 focus:ring-primary/30"
                />
                <label htmlFor={filter.id} className="text-sm">{filter.label}</label>
              </div>
            );

          case 'radio':
            return (
              <div key={filter.id} className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">{filter.label}</span>
                <div className="flex gap-3">
                  {filter.options?.map(opt => (
                    <label key={opt.value} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="radio"
                        name={filter.id}
                        value={opt.value}
                        checked={currentValue === opt.value}
                        onChange={e => set(filter.dataPath, e.target.value)}
                        className="h-4 w-4 border border-border bg-card focus:ring-2 focus:ring-primary/30"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            );

          case 'search':
            return (
              <div key={filter.id} className="flex flex-col gap-1.5 flex-1 min-w-48">
                <label className="text-xs font-medium text-muted-foreground">{filter.label}</label>
                <input
                  type="text"
                  value={String(currentValue || '')}
                  onChange={e => set(filter.dataPath, e.target.value)}
                  placeholder={filter.placeholder || 'Search...'}
                  className="h-9 px-3 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}

function MoreIndicator({ total, shown }: { total: number; shown: number }) {
  return (
    <p className="text-xs text-muted-foreground text-center pt-2">
      Showing {shown} of {total} controls
    </p>
  );
}

function groupControlsByFamily(controls: Control[]): Record<string, Control[]> {
  return controls.reduce((acc, control) => {
    const family = control.family || 'Other';
    if (!acc[family]) acc[family] = [];
    acc[family].push(control);
    return acc;
  }, {} as Record<string, Control[]>);
}

function isSTIGFramework(frameworkId: string): boolean {
  return frameworkId.includes('stig');
}
