import { useState, useMemo, useCallback } from 'react';
import { getCrossFrameworkMappings, hasFrameworkCrosswalk } from '../../data/crosswalk';
import { FRAMEWORK_CONFIGS, hasFrameworkData } from '../../data/frameworks';
import { slugify } from '../../data/controls';
import { CATEGORY_COLORS, type FrameworkCategory } from '../../data/crosswalk-stats';

interface Mapping {
  frameworkId: string;
  frameworkName: string;
  controlIds: string[];
}

// Sample controls for quick access
const SAMPLE_CONTROLS = [
  { id: 'AC-1', framework: 'nist-800-53-r5', label: 'NIST AC-1' },
  { id: 'GV.OC-01', framework: 'nist-csf-v2', label: 'CSF GV.OC-01' },
  { id: 'DE.AE-02', framework: 'nist-csf-v2', label: 'CSF DE.AE-02' },
  { id: 'AC.L1-3.1.1', framework: 'cmmc-v2', label: 'CMMC AC.L1-3.1.1' },
  { id: 'Art. 5(1)(a)', framework: 'eu-ai-act', label: 'EU AI Act Art. 5(1)(a)' },
];

function getFrameworkCategory(id: string): FrameworkCategory {
  const config = FRAMEWORK_CONFIGS[id];
  if (!config) return 'international';
  const tags = config.tags || [];
  if (tags.includes('AI')) return 'ai';
  if (tags.includes('Privacy')) return 'privacy';
  if (tags.includes('Federal') || tags.includes('DoD')) return 'federal';
  if (tags.includes('International')) return 'international';
  if (tags.includes('Enterprise') || tags.includes('Industry')) return 'enterprise';
  return 'federal';
}

export function ControlExplorer() {
  const [controlId, setControlId] = useState('');
  const [frameworkId, setFrameworkId] = useState('nist-800-53-r5');
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const frameworkOptions = useMemo(() => {
    return Object.entries(FRAMEWORK_CONFIGS)
      .filter(([id]) => hasFrameworkCrosswalk(id))
      .map(([id, config]) => ({
        id,
        name: config.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const handleSearch = useCallback(() => {
    if (!controlId.trim()) {
      setError('Please enter a control ID');
      return;
    }

    setError('');
    setSearched(true);

    try {
      const results = getCrossFrameworkMappings(controlId.trim(), frameworkId);
      setMappings(results);
    } catch (e) {
      setError('Error fetching mappings');
      setMappings([]);
    }
  }, [controlId, frameworkId]);

  const handleSampleClick = useCallback((sample: typeof SAMPLE_CONTROLS[0]) => {
    setControlId(sample.id);
    setFrameworkId(sample.framework);
    setError('');
    setSearched(true);

    try {
      const results = getCrossFrameworkMappings(sample.id, sample.framework);
      setMappings(results);
    } catch (e) {
      setError('Error fetching mappings');
      setMappings([]);
    }
  }, []);

  const sourceFrameworkName = FRAMEWORK_CONFIGS[frameworkId]?.name || frameworkId;

  return (
    <div className="space-y-6">
      {/* Search form */}
      <div className="bg-muted/30 rounded-lg p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="explorer-framework" className="block text-sm font-medium mb-1">Framework</label>
            <select
              id="explorer-framework"
              value={frameworkId}
              onChange={(e) => setFrameworkId(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {frameworkOptions.map((fw) => (
                <option key={fw.id} value={fw.id}>
                  {fw.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor="explorer-control-id" className="block text-sm font-medium mb-1">Control ID</label>
            <input
              id="explorer-control-id"
              type="text"
              value={controlId}
              onChange={(e) => setControlId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="e.g., AC-1, GV.OC-01, AC.L1-3.1.1"
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleSearch}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Explore
            </button>
          </div>
        </div>

        {/* Quick samples */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground">Try:</span>
          {SAMPLE_CONTROLS.map((sample) => (
            <button
              type="button"
              key={`${sample.framework}-${sample.id}`}
              onClick={() => handleSampleClick(sample)}
              className="px-2 py-1 text-xs bg-background border border-border rounded hover:bg-muted transition-colors"
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="text-center text-destructive text-sm">{error}</div>
      )}

      {/* Results visualization */}
      {searched && !error && (
        <div className="space-y-4">
          {/* Central node */}
          <div className="flex justify-center">
            <div
              className="px-4 py-3 rounded-lg border-2 border-primary bg-primary/10 text-center"
              style={{ borderColor: CATEGORY_COLORS[getFrameworkCategory(frameworkId)] }}
            >
              <div className="text-xs text-muted-foreground">{sourceFrameworkName}</div>
              <div className="font-mono font-bold text-lg">{controlId}</div>
            </div>
          </div>

          {/* Arrow */}
          {mappings.length > 0 && (
            <div className="flex justify-center">
              <svg className="w-6 h-8 text-muted-foreground" viewBox="0 0 24 32">
                <path
                  d="M12 0 L12 24 M6 18 L12 24 L18 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </div>
          )}

          {/* Mapped frameworks */}
          {mappings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {mappings.map((mapping) => {
                const category = getFrameworkCategory(mapping.frameworkId);
                return (
                  <div
                    key={mapping.frameworkId}
                    className="p-4 rounded-lg border bg-card"
                    style={{ borderLeftColor: CATEGORY_COLORS[category], borderLeftWidth: '4px' }}
                  >
                    <div className="font-medium text-sm mb-2">{mapping.frameworkName}</div>
                    <div className="flex flex-wrap gap-1">
                      {(() => {
                        const targetLoaded = hasFrameworkData(mapping.frameworkId);
                        return mapping.controlIds.slice(0, 10).map((cid) => (
                          <a
                            key={cid}
                            href={targetLoaded ? `/frameworks/${mapping.frameworkId}/${slugify(cid)}` : `/frameworks/${mapping.frameworkId}`}
                            className="px-2 py-0.5 text-xs font-mono bg-muted rounded hover:bg-muted/80 transition-colors"
                            title={targetLoaded ? undefined : `${mapping.frameworkName} — view official source or load local overlay`}
                          >
                            {cid}
                          </a>
                        ));
                      })()}
                      {mapping.controlIds.length > 10 && (
                        <span className="px-2 py-0.5 text-xs text-muted-foreground">
                          +{mapping.controlIds.length - 10} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No cross-framework mappings found for this control.
            </div>
          )}

          {/* Link to control page */}
          {mappings.length > 0 && (
            <div className="text-center">
              <a
                href={`/frameworks/${frameworkId}/${slugify(controlId)}`}
                className="text-sm text-primary hover:underline"
              >
                View full control details →
              </a>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      {!searched && (
        <div className="text-center text-muted-foreground py-8">
          <p>Select a framework and enter a control ID to explore its cross-framework mappings.</p>
          <p className="text-sm mt-2">
            Or click one of the sample controls above to get started.
          </p>
        </div>
      )}
    </div>
  );
}
