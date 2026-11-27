import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  fetchCmvpCertificateDetail,
  fetchCmvpMetadata,
  fetchCmvpSearch,
} from '@/lib/cmvp-client';
import { addAssessmentCryptoModule } from '@/lib/storage/assessment-store';
import type {
  CMVPScope,
  CmvpFilterMetadata,
  NormalizedCmvpModule,
} from '@/lib/cmvp';
import { CmvpModuleCard } from './CmvpModuleCard';

const SCOPE_OPTIONS: Array<{ value: CMVPScope; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'historical', label: 'Historical' },
  { value: 'in_process', label: 'In Process' },
  { value: 'all', label: 'All' },
];

export function CMVPPicker({
  assessmentId,
  existingModuleIds,
  onAdded,
}: {
  assessmentId: string;
  existingModuleIds: string[];
  onAdded?: (moduleId: string) => void;
}) {
  const [filters, setFilters] = React.useState<CmvpFilterMetadata | null>(null);
  const [results, setResults] = React.useState<NormalizedCmvpModule[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingModuleIds, setPendingModuleIds] = React.useState<string[]>([]);

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
        if (!cancelled) {
          setFilters(response.filters);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load CMVP filters.');
        }
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
          limit: 20,
        });

        if (!cancelled) {
          setResults(response.results);
          setTotal(response.total);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to search CMVP data.');
          setResults([]);
          setTotal(0);
        }
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

  async function handleAdd(module: NormalizedCmvpModule) {
    setPendingModuleIds((current) => [...current, module.id]);
    try {
      let detailSnapshot = undefined;
      if (module.certificateNumber) {
        try {
          detailSnapshot = await fetchCmvpCertificateDetail(module.certificateNumber);
        } catch {
          detailSnapshot = undefined;
        }
      }

      await addAssessmentCryptoModule(assessmentId, module, { detailSnapshot });
      onAdded?.(module.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add CMVP module to this assessment.');
    } finally {
      setPendingModuleIds((current) => current.filter((moduleId) => moduleId !== module.id));
    }
  }

  const existingModuleIdSet = React.useMemo(() => new Set(existingModuleIds), [existingModuleIds]);

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Add CMVP Modules</CardTitle>
          <CardDescription>
            Search the live CMVP catalog and add the cryptographic modules that are currently in scope
            for this assessment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-5">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Certificate, vendor, module, or algorithm"
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

          <div className="grid gap-3 lg:grid-cols-4">
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
            <div className="flex items-center rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
              {loading ? 'Searching CMVP data...' : `${results.length} shown / ${total.toLocaleString()} match${total === 1 ? '' : 'es'}`}
            </div>
            <Button asChild variant="outline">
              <a href="/cmvp" target="_blank" rel="noreferrer">
                Open Explorer
              </a>
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[11px]">
              Default scope: active
            </Badge>
            <span>
              Add modules once, then link them to controls and append CMVP evidence to assessment notes.
            </span>
          </div>
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
        {results.map((module) => {
          const alreadyAdded = existingModuleIdSet.has(module.id);
          const isPending = pendingModuleIds.includes(module.id);

          return (
            <CmvpModuleCard
              key={`${module.dataset}:${module.id}`}
              module={module}
              actionLabel={alreadyAdded ? 'Added' : isPending ? 'Adding...' : 'Add to Assessment'}
              actionDisabled={alreadyAdded || isPending}
              onAction={handleAdd}
            />
          );
        })}
      </div>

      {!loading && results.length === 0 && !error && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No CMVP modules matched the current filters.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
