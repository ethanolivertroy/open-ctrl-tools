import * as React from 'react';
import type { SearchEntryType } from '@/data/types';
import { CATEGORY_FILTERS } from '@/lib/search-constants';

interface SearchFiltersProps {
  typeFilter: SearchEntryType | null;
  onTypeChange: (type: SearchEntryType | null) => void;
  categoryFilters: string[];
  onCategoryChange: (categories: string[]) => void;
  frameworkFilter: string;
  onFrameworkChange: (framework: string) => void;
  frameworkOptions: { id: string; label: string }[];
  typeCounts: Record<string, number>;
  totalCount: number;
}

const TYPE_OPTIONS: { value: SearchEntryType | null; label: string; key: string }[] = [
  { value: null, label: 'All', key: 'all' },
  { value: 'control', label: 'Controls', key: 'control' },
  { value: 'framework', label: 'Frameworks', key: 'framework' },
  { value: 'guide', label: 'Guides', key: 'guide' },
  { value: 'crosswalk', label: 'Crosswalks', key: 'crosswalk' },
  { value: 'page', label: 'Pages', key: 'page' },
];

export function SearchFilters({
  typeFilter,
  onTypeChange,
  categoryFilters,
  onCategoryChange,
  frameworkFilter,
  onFrameworkChange,
  frameworkOptions,
  typeCounts,
  totalCount,
}: SearchFiltersProps) {
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  const toggleCategory = (categoryId: string) => {
    onCategoryChange(
      categoryFilters.includes(categoryId)
        ? categoryFilters.filter(c => c !== categoryId)
        : [...categoryFilters, categoryId]
    );
  };

  const clearAll = () => {
    onTypeChange(null);
    onCategoryChange([]);
    onFrameworkChange('');
  };

  const hasActiveFilters = typeFilter !== null || categoryFilters.length > 0 || frameworkFilter !== '';

  const filterContent = (
    <>
      {/* Content Type */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Content Type
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TYPE_OPTIONS.map(({ value, label, key }) => {
            const isSelected = typeFilter === value;
            const count = value === null ? totalCount : (typeCounts[value] || 0);
            return (
              <button
                key={key}
                onClick={() => onTypeChange(isSelected ? null : value)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-all ${
                  isSelected
                    ? 'bg-primary/10 text-primary border-primary/30 shadow-sm'
                    : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                }`}
              >
                {label}
                <span className="ml-1 opacity-60">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Category */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Category
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_FILTERS.map(({ id, label, frameworks, colorClass }) => {
            const isSelected = categoryFilters.includes(id);
            return (
              <button
                key={id}
                onClick={() => toggleCategory(id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-all ${
                  isSelected
                    ? `${colorClass} shadow-sm ring-1 ring-current/20`
                    : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                }`}
              >
                {label}
                <span className="ml-1 opacity-60">({frameworks.length})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Framework filter (shown when type=control or no type filter) */}
      {(typeFilter === 'control' || typeFilter === null) && frameworkOptions.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Framework
          </div>
          <select
            value={frameworkFilter}
            onChange={(e) => onFrameworkChange(e.target.value)}
            className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All frameworks</option>
            {frameworkOptions.map(({ id, label }) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Clear all */}
      {hasActiveFilters && (
        <button
          onClick={clearAll}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear all filters
        </button>
      )}
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 space-y-4">
        {filterContent}
      </aside>

      {/* Mobile collapsible */}
      <div className="lg:hidden">
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <svg className={`w-4 h-4 transition-transform ${filtersOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Filters
          {hasActiveFilters && (
            <span className="px-1.5 py-0.5 text-[11px] rounded-full bg-primary/10 text-primary">
              Active
            </span>
          )}
        </button>
        {filtersOpen && (
          <div className="space-y-4 pb-4 border-b border-border mb-4">
            {filterContent}
          </div>
        )}
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5 lg:hidden">
          {typeFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary border border-primary/20">
              {typeFilter}
              <button onClick={() => onTypeChange(null)} className="hover:text-foreground">x</button>
            </span>
          )}
          {categoryFilters.map(c => (
            <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-accent text-accent-foreground border border-border">
              {CATEGORY_FILTERS.find(cf => cf.id === c)?.label || c}
              <button onClick={() => toggleCategory(c)} className="hover:text-foreground">x</button>
            </span>
          ))}
          {frameworkFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-accent text-accent-foreground border border-border">
              {frameworkOptions.find(f => f.id === frameworkFilter)?.label || frameworkFilter}
              <button onClick={() => onFrameworkChange('')} className="hover:text-foreground">x</button>
            </span>
          )}
        </div>
      )}
    </>
  );
}
