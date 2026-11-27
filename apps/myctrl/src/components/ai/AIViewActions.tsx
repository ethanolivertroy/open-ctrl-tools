import { useCallback, useEffect, useState } from 'react';
import { Download, Save, Share2, Bookmark, X } from 'lucide-react';
import type { AIContext } from '@/lib/ai-data-context';
import { type View, type Component } from '@/lib/json-render/catalog';
import {
  getActiveProject,
} from '@/lib/storage/project-store';
import { saveView as saveViewToStorage } from '@/lib/storage/saved-view-store';
import { useProjectChange } from '@/hooks/useProjectChange';
import type { Project } from '@/lib/storage-types';

interface AIViewActionsProps {
  view: View;
  prompt: string;
  context?: AIContext;
}

interface ControlRow {
  framework: string;
  controlId: string;
  title: string;
  description?: string;
}

export function AIViewActions({ view, prompt, context }: AIViewActionsProps) {
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState(view.title);
  const [saved, setSaved] = useState(false);

  const loadProject = () => {
    getActiveProject().then(setActiveProject);
  };

  useEffect(() => {
    loadProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useProjectChange(loadProject);

  const handleSave = useCallback(() => {
    if (!saveName.trim()) return;

    void saveViewToStorage(saveName.trim(), prompt, JSON.stringify(view), {
      source: context?.controlId ? 'control' : context?.assessmentId ? 'assessment' : 'build',
      frameworkId: context?.frameworkId,
      controlId: context?.controlId,
      family: context?.family,
      assessmentId: context?.assessmentId,
      baseline: context?.baseline,
      systemName: context?.systemName,
    });
    setSaved(true);
    setShowSaveDialog(false);
    setTimeout(() => setSaved(false), 2000);
  }, [saveName, prompt, view, context]);

  const handleExportJSON = useCallback(() => {
    const dataStr = JSON.stringify(view, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    downloadBlob(blob, `${slugifyName(view.title)}-view.json`);
  }, [view]);

  const handleExportCSV = useCallback(() => {
    const rows = extractControlsFromView(view);
    if (rows.length === 0) {
      alert('No controls found in this view to export.');
      return;
    }

    const headers = ['Framework', 'Control ID', 'Title', 'Description'];
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        [row.framework, row.controlId, `"${row.title.replace(/"/g, '""')}"`, `"${(row.description || '').replace(/"/g, '""')}"`].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `${slugifyName(view.title)}-controls.csv`);
  }, [view]);

  const handleShare = useCallback(() => {
    const shareUrl = `${window.location.origin}/build?prompt=${encodeURIComponent(prompt)}`;
    navigator.clipboard.writeText(shareUrl);
    alert('Link copied to clipboard!');
  }, [prompt]);

  return (
    <div className="flex items-center gap-1">
      {showSaveDialog ? (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border">
          <div className="space-y-1">
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="View name"
              className="w-40 p-1 text-sm rounded border border-border bg-background"
              autoFocus
            />
            {activeProject && (
              <p className="text-[11px] text-muted-foreground">
                Saving to <span className="font-medium text-foreground">{activeProject.name}</span>
              </p>
            )}
          </div>
          <button
            onClick={handleSave}
            className="p-1 rounded hover:bg-muted transition-colors text-primary"
          >
            <Save className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowSaveDialog(false)}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowSaveDialog(true)}
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title="Save view"
        >
          {saved ? (
            <Bookmark className="w-4 h-4 text-primary fill-primary" />
          ) : (
            <Bookmark className="w-4 h-4" />
          )}
        </button>
      )}

      <div className="relative group">
        <button
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title="Export"
        >
          <Download className="w-4 h-4" />
        </button>
        <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-10">
          <div className="bg-card border border-border rounded-lg shadow-lg p-1 min-w-32">
            <button
              onClick={handleExportJSON}
              className="w-full px-3 py-1.5 text-sm text-left hover:bg-muted rounded transition-colors"
            >
              Export JSON
            </button>
            <button
              onClick={handleExportCSV}
              className="w-full px-3 py-1.5 text-sm text-left hover:bg-muted rounded transition-colors"
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={handleShare}
        className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        title="Copy shareable link"
      >
        <Share2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function slugifyName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function extractControlsFromView(view: View): ControlRow[] {
  const rows: ControlRow[] = [];

  function processComponent(component: Component) {
    if (component.type === 'ControlCard') {
      rows.push({
        framework: component.frameworkId,
        controlId: component.controlId,
        title: component.controlId,
        description: '',
      });
    } else if (component.type === 'ControlList') {
      rows.push({
        framework: component.frameworkId,
        controlId: `[${component.filters?.family || 'all'} family controls]`,
        title: `Control list from ${component.frameworkId}`,
        description: component.filters?.searchQuery || '',
      });
    } else if (component.type === 'Section' && component.children) {
      component.children.forEach(processComponent);
    }
  }

  view.components.forEach(processComponent);
  return rows;
}
