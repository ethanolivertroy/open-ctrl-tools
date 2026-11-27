import { useState, useEffect, useRef } from 'react';
import { applyTheme, type Theme } from '@/lib/theme';
import { getDb } from '@/lib/db';
import {
  BACKUP_TABLE_LABELS,
  exportBackupTables,
  importBackupPayload,
} from '@/lib/storage/backup';

interface TableInfo {
  name: string;
  label: string;
  count: number;
}

interface PreferencesExport {
  version: 2;
  exportedAt: string;
  data: Record<string, unknown[]>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TABLE_LABELS = BACKUP_TABLE_LABELS;

const HOLD_MS = 2000;
const SNAP_BACK_MS = 200;

/**
 * Destructive action guarded by press-and-hold: a fill sweeps across the
 * button while held (2s); releasing early snaps it back. Firing on completed
 * hold prevents the reflexive second click a two-step confirm invites.
 */
function HoldToClearButton({ onConfirm }: { onConfirm: () => void }) {
  const [holding, setHolding] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const cancelHold = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setHolding(false);
  };

  const startHold = () => {
    if (timeoutRef.current !== null) return;
    setHolding(true);
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      setHolding(false);
      onConfirm();
    }, HOLD_MS);
  };

  useEffect(() => cancelHold, []);

  return (
    <button
      type="button"
      onPointerDown={(event) => {
        event.preventDefault();
        startHold();
      }}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
          event.preventDefault();
          startHold();
        }
      }}
      onKeyUp={(event) => {
        if (event.key === 'Enter' || event.key === ' ') cancelHold();
      }}
      onContextMenu={(event) => event.preventDefault()}
      className="relative overflow-hidden select-none touch-none px-4 py-2 text-sm rounded-md text-destructive border border-destructive/30 hover:bg-destructive/10 transition-[color,background-color,transform] duration-[160ms] ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]"
      title="Press and hold to clear all data"
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-destructive/25"
        style={{
          clipPath: holding ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)',
          transition: holding
            ? `clip-path ${HOLD_MS}ms linear`
            : `clip-path ${SNAP_BACK_MS}ms cubic-bezier(0.23, 1, 0.32, 1)`,
        }}
      />
      <span className="relative">{holding ? 'Keep holding…' : 'Hold to Clear All Data'}</span>
    </button>
  );
}

export function StorageSection() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [storageUsage, setStorageUsage] = useState<number>(0);
  const [storageQuota, setStorageQuota] = useState<number>(0);
  const [includeApiKey, setIncludeApiKey] = useState(false);

  const refresh = async () => {
    const db = await getDb();
    const tableNames = Object.keys(TABLE_LABELS);
    const infos: TableInfo[] = [];
    for (const name of tableNames) {
      try {
        const count = await db.table(name).count();
        infos.push({ name, label: TABLE_LABELS[name], count });
      } catch {
        infos.push({ name, label: TABLE_LABELS[name], count: 0 });
      }
    }
    setTables(infos);

    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      setStorageUsage(est.usage ?? 0);
      setStorageQuota(est.quota ?? 0);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const totalRecords = tables.reduce((a, b) => a + b.count, 0);

  const handleExport = async () => {
    const db = await getDb();
    const data = await exportBackupTables(db, { includeApiKey });

    const exportData: PreferencesExport & { theme?: string | null } = {
      version: 2,
      exportedAt: new Date().toISOString(),
      data,
    };

    const theme = localStorage.getItem('theme');
    if (theme) {
      exportData.theme = theme;
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `myctrl-preferences-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const db = await getDb();
        const status = await importBackupPayload(db, parsed);
        if (status === 'v1') {
          alert('Legacy v1 export detected. Please use the migration feature instead.');
          return;
        }
        if (status === 'invalid') {
          alert('Invalid preferences file format.');
          return;
        }

        // Apply imported theme if present in settings
        const settings = parsed.data?.settings as Array<{ key: string; value: string }> | undefined;
        const themeSetting = settings?.find((s: { key: string }) => s.key === 'theme');
        if (themeSetting) {
          localStorage.setItem('theme', themeSetting.value);
          applyTheme(themeSetting.value as Theme);
        }

        await refresh();
        window.location.reload();
      } catch {
        alert('Failed to import preferences. Check the file format.');
      }
    };
    input.click();
  };

  const handleClearAll = async () => {
    const db = await getDb();
    await db.delete();
    await db.open();

    // Reapply default theme
    const defaultTheme: Theme = 'dracula';
    localStorage.setItem('theme', defaultTheme);
    applyTheme(defaultTheme);

    // Clear migration flag so re-migration doesn't happen from empty localStorage
    localStorage.removeItem('myctrl-dexie-migrated');

    // Remove old localStorage keys to prevent re-migration
    const keysToRemove = ['myctrl-favorites', 'myctrl-control-notes', 'myctrl-recently-viewed', 'myctrl-saved-views', 'myctrl-filter-presets', 'myctrl-api-key', 'myctrl-nav-scope', 'myctrl-ai-data-pref'];
    keysToRemove.forEach(k => localStorage.removeItem(k));

    await refresh();
    window.location.reload();
  };

  return (
    <section id="storage" className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span className="text-primary">{'>'}</span> Storage & Data
      </h2>
      <p className="text-sm text-muted-foreground">
        All data is stored locally in your browser using IndexedDB. Export to back up, import to restore.
      </p>

      {/* Record counts table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Table</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Records</th>
            </tr>
          </thead>
          <tbody>
            {tables.map(({ name, label, count }) => (
              <tr key={name} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-2">{label}</td>
                <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                  {count}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/30">
              <td className="px-4 py-2 font-medium">Total</td>
              <td className="px-4 py-2 text-right font-mono font-medium">{totalRecords}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Usage bar */}
      {storageQuota > 0 && (
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${Math.min((storageUsage / storageQuota) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-right">
            {formatBytes(storageUsage)} of {formatBytes(storageQuota)} IndexedDB quota
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleExport}
          className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted transition-colors"
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={handleImport}
          className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted transition-colors"
        >
          Import JSON
        </button>
        <HoldToClearButton onConfirm={() => void handleClearAll()} />
      </div>

      {/* Export options */}
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={includeApiKey}
          onChange={e => setIncludeApiKey(e.target.checked)}
          className="accent-[var(--color-primary)]"
        />
        Include API key in export
        <span className="text-yellow-500">(sensitive)</span>
      </label>
    </section>
  );
}
