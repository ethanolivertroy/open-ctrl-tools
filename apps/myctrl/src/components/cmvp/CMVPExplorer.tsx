import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fetchCmvpMetadata, fetchCmvpSearch } from '@/lib/cmvp-client';
import type { CMVPScope, CmvpFilterMetadata, CmvpMetadataSummary, NormalizedCmvpModule } from '@/lib/cmvp';
import { CmvpModuleCard } from './CmvpModuleCard';

const SCOPE_OPTIONS: Array<{ value: CMVPScope; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'historical', label: 'Historical' },
  { value: 'in_process', label: 'In Process' },
  { value: 'all', label: 'All' },
];

export function CMVPExplorer() {
  const [metadata, setMetadata] = React.useState<CmvpMetadataSummary | null>(null);
  const [filters, setFilters] = React.useState<CmvpFilterMetadata | null>(null);
  const [results, setResults] = React.useState<NormalizedCmvpModule[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [query, setQuery] = React.useState('');
  const deferredQuery = React.useDeferredValue(query);
  const [scope, setScope] = React.useState<CMVPScope>('active');
  const [standard, setStandard] = React.useState('');
  const [moduleType, setModuleType] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [algorithm, setAlgorithm] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetchCmvpMetadata();
        if (cancelled) return;
        setMetadata(response.metadata);
        setFilters(response.filters);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unable to load CMVP metadata.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const response = await fetchCmvpSearch({
          q: deferredQuery,
          scope,
          standard,
          moduleType,
          status,
          algorithm,
          limit: 50,
        });

        if (cancelled) return;
        setResults(response.results);
        setTotal(response.total);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unable to search CMVP data.');
        setResults([]);
        setTotal(0);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [algorithm, deferredQuery, moduleType, scope, standard, status]);

  return (
    <div className="space-y-6">
      {metadata && (
        <div className="grid gap-4 md:grid-cols-4">
          <SummaryCard label="Active Modules" value={metadata.totalModules.toLocaleString()} />
          <SummaryCard label="Historical Modules" value={metadata.totalHistoricalModules.toLocaleString()} />
          <SummaryCard label="Modules In Process" value={metadata.totalModulesInProcess.toLocaleString()} />
          <SummaryCard
            label="Certificates With Algorithms"
            value={metadata.totalCertificatesWithAlgorithms.toLocaleString()}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search CMVP Modules</CardTitle>
          <CardDescription>
            Search validated and in-process cryptographic modules, filter by standard or algorithm, and review certificate metadata without leaving myctrl.tools.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-5">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Certificate, module, vendor, or algorithm"
              className="rounded-lg border bg-background px-3 py-2 text-sm lg:col-span-2"
            />
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value as CMVPScope)}
              className="rounded-lg border bg-background px-3 py-2 text-sm"
            >
              {SCOPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={standard}
              onChange={(event) => setStandard(event.target.value)}
              className="rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="">All Standards</option>
              {(filters?.standards ?? []).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              value={moduleType}
              onChange={(event) => setModuleType(event.target.value)}
              className="rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="">All Module Types</option>
              {(filters?.moduleTypes ?? []).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="">All Statuses</option>
              {(filters?.statuses ?? []).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              value={algorithm}
              onChange={(event) => setAlgorithm(event.target.value)}
              className="rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="">All Algorithms</option>
              {(filters?.algorithms ?? []).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <div className="flex items-center justify-between rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
              <span>{loading ? 'Searching...' : `${results.length} shown`}</span>
              <span>{total.toLocaleString()} total match{total === 1 ? '' : 'es'}</span>
            </div>
          </div>

          {metadata?.lastUpdated && (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>Upstream refresh: {new Date(metadata.lastUpdated).toLocaleString()}</span>
              {metadata.features.algorithmExtraction && (
                <Badge variant="outline" className="text-[11px]">
                  Algorithm extraction enabled
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-500/20">
          <CardContent className="pt-4 text-sm text-red-600 dark:text-red-400">
            {error}
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {results.map((module) => (
          <CmvpModuleCard key={`${module.dataset}:${module.id}`} module={module} />
        ))}
      </div>

      {!loading && results.length === 0 && !error && (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No CMVP modules matched the current filters.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-2 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
