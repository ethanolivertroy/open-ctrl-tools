import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { slugifyControlId as slugify } from '@/lib/slugify';
import { downloadFile } from '@/lib/export';
import type { CrosswalkEntry } from '@/data/types';

interface CrosswalkTableProps {
  entries: CrosswalkEntry[];
}

// CSF Function codes
const CSF_FUNCTIONS = ['GV', 'ID', 'PR', 'DE', 'RS', 'RC'];

// Extract NIST family from control ID (e.g., "PM-11" -> "PM")
function getNistFamily(controlId: string): string {
  const match = controlId.match(/^([A-Z]{2})/);
  return match ? match[1] : '';
}

// Get unique NIST families from entries
function getUniqueNistFamilies(entries: CrosswalkEntry[]): string[] {
  const families = new Set<string>();
  entries.forEach(e => {
    const family = getNistFamily(e.nist_id);
    if (family) families.add(family);
  });
  return Array.from(families).sort();
}

export function CrosswalkTable({ entries }: CrosswalkTableProps) {
  const [search, setSearch] = React.useState('');
  const [csfFilter, setCsfFilter] = React.useState('');
  const [nistFilter, setNistFilter] = React.useState('');

  const nistFamilies = React.useMemo(() => getUniqueNistFamilies(entries), [entries]);

  // Filter entries
  const filteredEntries = React.useMemo(() => {
    return entries.filter(entry => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch =
          entry.csf_id.toLowerCase().includes(searchLower) ||
          entry.csf_title.toLowerCase().includes(searchLower) ||
          entry.nist_id.toLowerCase().includes(searchLower) ||
          entry.nist_title.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // CSF function filter
      if (csfFilter && !entry.csf_id.startsWith(csfFilter + '.')) {
        return false;
      }

      // NIST family filter
      if (nistFilter && getNistFamily(entry.nist_id) !== nistFilter) {
        return false;
      }

      return true;
    });
  }, [entries, search, csfFilter, nistFilter]);

  // Export crosswalk data
  const handleExport = (format: 'csv' | 'json') => {
    const date = new Date().toISOString().split('T')[0];
    const filterSuffix = [
      csfFilter && `csf-${csfFilter}`,
      nistFilter && `nist-${nistFilter}`,
    ].filter(Boolean).join('-');
    const filename = `crosswalk-csf-nist${filterSuffix ? '-' + filterSuffix : ''}-${date}.${format}`;

    if (format === 'json') {
      const exportData = {
        metadata: {
          exportDate: new Date().toISOString(),
          totalMappings: filteredEntries.length,
          filters: {
            csfFunction: csfFilter || null,
            nistFamily: nistFilter || null,
            search: search || null,
          },
        },
        mappings: filteredEntries,
      };
      downloadFile(exportData, filename, 'application/json');
    } else {
      // CSV format
      const headers = ['csf_id', 'csf_title', 'nist_id', 'nist_title'];
      const rows = [headers.join(',')];

      for (const entry of filteredEntries) {
        const row = [
          `"${entry.csf_id}"`,
          `"${entry.csf_title.replace(/"/g, '""')}"`,
          `"${entry.nist_id}"`,
          `"${entry.nist_title.replace(/"/g, '""')}"`,
        ];
        rows.push(row.join(','));
      }

      downloadFile(rows.join('\n'), filename, 'text/csv;charset=utf-8');
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search crosswalk mappings"
          className="w-64 px-3 py-2 rounded-md border border-input bg-background text-sm"
        />

        <select
          value={csfFilter}
          onChange={(e) => setCsfFilter(e.target.value)}
          aria-label="Filter by CSF function"
          className="px-3 py-2 rounded-md border border-input bg-background text-sm"
        >
          <option value="">All CSF Functions</option>
          {CSF_FUNCTIONS.map(func => (
            <option key={func} value={func}>
              {func} - {func === 'GV' ? 'Govern' : func === 'ID' ? 'Identify' : func === 'PR' ? 'Protect' : func === 'DE' ? 'Detect' : func === 'RS' ? 'Respond' : 'Recover'}
            </option>
          ))}
        </select>

        <select
          value={nistFilter}
          onChange={(e) => setNistFilter(e.target.value)}
          aria-label="Filter by NIST family"
          className="px-3 py-2 rounded-md border border-input bg-background text-sm"
        >
          <option value="">All NIST Families</option>
          {nistFamilies.map(family => (
            <option key={family} value={family}>{family}</option>
          ))}
        </select>

        {(search || csfFilter || nistFilter) && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setCsfFilter('');
              setNistFilter('');
            }}
            className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear filters
          </button>
        )}

        {/* Export Buttons */}
        <div className="flex gap-2 ml-auto">
          <button
            type="button"
            onClick={() => handleExport('csv')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-md hover:bg-accent transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            CSV
          </button>
          <button
            type="button"
            onClick={() => handleExport('json')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-md hover:bg-accent transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            JSON
          </button>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredEntries.length} of {entries.length} mappings
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">CSF Subcategory</th>
                <th className="px-4 py-3 text-left font-medium">CSF Title</th>
                <th className="px-4 py-3 text-left font-medium">NIST Control</th>
                <th className="px-4 py-3 text-left font-medium">NIST Title</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredEntries.slice(0, 100).map((entry, idx) => (
                <tr key={`${entry.csf_id}-${entry.nist_id}-${idx}`} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <a
                      href={`/frameworks/nist-csf-v2/${slugify(entry.csf_id)}`}
                      className="inline-block"
                    >
                      <Badge variant="outline" className="font-mono hover:bg-muted transition-colors">
                        {entry.csf_id}
                      </Badge>
                    </a>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                    {entry.csf_title}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`/frameworks/nist-800-53-r5/${slugify(entry.nist_id)}`}
                      className="inline-block"
                    >
                      <Badge variant="secondary" className="font-mono hover:bg-secondary/80 transition-colors">
                        {entry.nist_id}
                      </Badge>
                    </a>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                    {entry.nist_title}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredEntries.length > 100 && (
          <div className="px-4 py-3 border-t bg-muted/30 text-sm text-muted-foreground text-center">
            Showing first 100 results. Use filters to narrow down.
          </div>
        )}

        {filteredEntries.length === 0 && (
          <div className="px-4 py-8 text-center text-muted-foreground">
            No mappings found matching your filters.
          </div>
        )}
      </div>
    </div>
  );
}
