import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { slugify, hasFrameworkData } from '@/data/controls';
import type { PCICrosswalkEntry } from '@/data/types';

interface CSFPCICrosswalkTableProps {
  entries: PCICrosswalkEntry[];
}

// CSF Function codes
const CSF_FUNCTIONS = ['GV', 'ID', 'PR', 'DE', 'RS', 'RC'];

// PCI-DSS Requirement families (1-12)
const PCI_FAMILIES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

// Extract PCI family from requirement ID (e.g., "12.1.1" -> "12")
function getPCIFamily(reqId: string): string {
  const match = reqId.match(/^(\d+)\./);
  return match ? match[1] : '';
}

// Get unique PCI families from entries
function getUniquePCIFamilies(entries: PCICrosswalkEntry[]): string[] {
  const families = new Set<string>();
  entries.forEach(e => {
    const family = getPCIFamily(e.pci_id);
    if (family) families.add(family);
  });
  return Array.from(families).sort((a, b) => parseInt(a) - parseInt(b));
}

export function CSFPCICrosswalkTable({ entries }: CSFPCICrosswalkTableProps) {
  const pciLoaded = hasFrameworkData('pci-dss-v4');
  const [search, setSearch] = React.useState('');
  const [csfFilter, setCsfFilter] = React.useState('');
  const [pciFilter, setPciFilter] = React.useState('');

  const pciFamilies = React.useMemo(() => getUniquePCIFamilies(entries), [entries]);

  // Filter entries
  const filteredEntries = React.useMemo(() => {
    return entries.filter(entry => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch =
          entry.csf_id.toLowerCase().includes(searchLower) ||
          entry.csf_title.toLowerCase().includes(searchLower) ||
          entry.pci_id.toLowerCase().includes(searchLower) ||
          entry.pci_title.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // CSF function filter
      if (csfFilter && !entry.csf_id.startsWith(csfFilter + '.')) {
        return false;
      }

      // PCI family filter
      if (pciFilter && getPCIFamily(entry.pci_id) !== pciFilter) {
        return false;
      }

      return true;
    });
  }, [entries, search, csfFilter, pciFilter]);

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
          value={pciFilter}
          onChange={(e) => setPciFilter(e.target.value)}
          aria-label="Filter by PCI requirement"
          className="px-3 py-2 rounded-md border border-input bg-background text-sm"
        >
          <option value="">All PCI Requirements</option>
          {pciFamilies.map(family => (
            <option key={family} value={family}>Requirement {family}</option>
          ))}
        </select>

        {(search || csfFilter || pciFilter) && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setCsfFilter('');
              setPciFilter('');
            }}
            className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear filters
          </button>
        )}
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
                <th className="px-4 py-3 text-left font-medium">PCI Requirement</th>
                <th className="px-4 py-3 text-left font-medium">PCI Title</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredEntries.slice(0, 100).map((entry, idx) => (
                <tr key={`${entry.csf_id}-${entry.pci_id}-${idx}`} className="hover:bg-muted/30 transition-colors">
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
                      href={pciLoaded ? `/frameworks/pci-dss-v4/${slugify(entry.pci_id)}` : '/frameworks/pci-dss-v4'}
                      className="inline-block"
                      title={pciLoaded ? undefined : 'PCI DSS — view official source or load local overlay'}
                    >
                      <Badge variant="secondary" className="font-mono hover:bg-secondary/80 transition-colors">
                        {entry.pci_id}
                      </Badge>
                    </a>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                    {entry.pci_title}
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
