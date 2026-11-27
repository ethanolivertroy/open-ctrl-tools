import { useState, useEffect } from 'react';
import type { FilterPreset } from '@/lib/db';
import { getPresets, deletePreset } from '@/lib/storage/filter-preset-store';

export function FilterPresetsSection() {
  const [presets, setPresets] = useState<FilterPreset[]>([]);

  useEffect(() => {
    getPresets().then(setPresets);
  }, []);

  const handleDelete = (id: string) => {
    deletePreset(id);
    setPresets(prev => prev.filter(p => p.id !== id));
  };

  return (
    <section id="presets" className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span className="text-primary">{'>'}</span> Filter Presets
      </h2>
      <p className="text-sm text-muted-foreground">
        Saved filter combinations from the framework browser.
      </p>

      {presets.length === 0 ? (
        <div className="text-center py-12 rounded-lg border border-border bg-card">
          <p className="text-muted-foreground text-sm">No saved presets.</p>
          <p className="text-muted-foreground text-xs mt-1">Save filter combinations from the All Frameworks page.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {presets.map(preset => (
            <div key={preset.id} className="p-3 rounded-lg border border-border bg-card flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{preset.name}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {preset.categories.map(cat => (
                    <span key={cat} className="px-1.5 py-0.5 text-xs rounded border border-border text-muted-foreground">
                      {cat}
                    </span>
                  ))}
                  {preset.searchTerm && (
                    <span className="text-xs text-muted-foreground">
                      "{preset.searchTerm}"
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(preset.id)}
                className="shrink-0 p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Delete preset"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
