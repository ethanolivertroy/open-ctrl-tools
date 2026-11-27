/**
 * JSON Render Action Handlers
 *
 * Handles actions emitted by AI-generated views including:
 * - Navigation (controls, frameworks)
 * - Filtering
 * - Export (CSV, JSON, PDF)
 * - Favorites
 * - Multi-step workflows
 */

import * as React from 'react';
import type { Action } from './catalog';
import { slugify, getAllControls, isValidFramework } from '@/data/controls';
import { toggleFavorite } from '@/lib/storage/favorites-store';
import type { Control } from '@/data/types';

export type ActionHandler = (action: Action, context?: ActionContext) => void | Promise<void>;

export interface ActionContext {
  data?: Record<string, unknown>;
  controls?: Control[];
  frameworkId?: string;
}

// ============================================================================
// Export Utilities
// ============================================================================

/**
 * Convert controls to CSV format
 */
function controlsToCSV(controls: Control[], frameworkId?: string): string {
  const headers = ['control_id', 'title', 'family', 'description'];
  const rows = controls.map(c => [
    c.control_id,
    `"${(c.title || '').replace(/"/g, '""')}"`,
    c.family || '',
    `"${(c.description || '').replace(/"/g, '""').substring(0, 500)}"`,
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Convert controls to JSON format
 */
function controlsToJSON(controls: Control[], frameworkId?: string): string {
  const exportData = {
    framework: frameworkId,
    exportedAt: new Date().toISOString(),
    count: controls.length,
    controls: controls.map(c => ({
      control_id: c.control_id,
      title: c.title,
      family: c.family,
      description: c.description,
    })),
  };
  return JSON.stringify(exportData, null, 2);
}

/**
 * Trigger file download in browser
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Open print dialog for PDF-like export
 */
function printPage(): void {
  window.print();
}

// ============================================================================
// Action Handlers
// ============================================================================

/**
 * Default action handlers for client-side execution
 */
export function createActionHandlers(): Record<Action['type'], ActionHandler> {
  return {
    navigate_control: (action) => {
      if (action.type !== 'navigate_control') return;
      const slug = slugify(action.controlId);
      window.location.href = `/frameworks/${action.frameworkId}/${slug}`;
    },

    navigate_framework: (action) => {
      if (action.type !== 'navigate_framework') return;
      window.location.href = `/frameworks/${action.frameworkId}`;
    },

    applyFilter: (action) => {
      if (action.type !== 'applyFilter') return;
      const params = new URLSearchParams();
      if (action.filter.family) params.set('family', action.filter.family);
      if (action.filter.baseline) params.set('baseline', action.filter.baseline);
      if (action.filter.searchQuery) params.set('q', action.filter.searchQuery);

      const currentUrl = new URL(window.location.href);
      currentUrl.search = params.toString();
      window.location.href = currentUrl.toString();
    },

    export: async (action, context) => {
      if (action.type !== 'export') return;

      const { format, data: dataType, params } = action;
      const scope = params?.scope || 'current';

      // Determine what data to export
      let controls: Control[] = [];
      let frameworkId: string | undefined;

      if (context?.controls) {
        controls = context.controls;
        frameworkId = context.frameworkId;
      } else if (dataType === 'controls' && context?.frameworkId) {
        frameworkId = context.frameworkId;
        if (isValidFramework(frameworkId)) {
          controls = getAllControls(frameworkId);
        }
      }

      // Generate filename
      const timestamp = new Date().toISOString().split('T')[0];
      const filenameBase = frameworkId
        ? `${frameworkId}-${dataType}-${timestamp}`
        : `export-${dataType}-${timestamp}`;

      switch (format) {
        case 'csv':
          if (controls.length > 0) {
            const csv = controlsToCSV(controls, frameworkId);
            downloadFile(csv, `${filenameBase}.csv`, 'text/csv');
          } else {
            console.warn('No controls data to export as CSV');
          }
          break;

        case 'json':
          if (controls.length > 0) {
            const json = controlsToJSON(controls, frameworkId);
            downloadFile(json, `${filenameBase}.json`, 'application/json');
          } else if (context?.data) {
            // Export raw context data
            const json = JSON.stringify(context.data, null, 2);
            downloadFile(json, `${filenameBase}.json`, 'application/json');
          } else {
            console.warn('No data to export as JSON');
          }
          break;

        case 'pdf':
          printPage();
          break;

        default:
          console.warn(`Unknown export format: ${format}`);
      }

      // Emit event for UI updates/notifications
      window.dispatchEvent(new CustomEvent('ai-view-export-complete', {
        detail: { format, dataType, filename: filenameBase }
      }));
    },

    toggleFavorite: async (action) => {
      if (action.type !== 'toggleFavorite') return;
      const isFav = await toggleFavorite(action.frameworkId);

      // Emit event for UI updates
      window.dispatchEvent(new CustomEvent('favorite-toggled', {
        detail: { frameworkId: action.frameworkId, isFavorite: isFav }
      }));
    },

    workflow: async (action, context) => {
      if (action.type !== 'workflow') return;

      const handlers = createActionHandlers();

      // Execute steps sequentially
      for (const step of action.steps) {
        const handler = handlers[step.action as keyof typeof handlers];
        if (handler) {
          // Create a synthetic action from the step
          const stepAction = {
            type: step.action,
            ...step.params,
          } as Action;
          await handler(stepAction, context);

          // Optional delay between steps
          if (step.delay) {
            await new Promise(resolve => setTimeout(resolve, step.delay));
          }
        } else {
          console.warn(`Unknown workflow step action: ${step.action}`);
        }
      }

      // Emit workflow completion event
      window.dispatchEvent(new CustomEvent('ai-workflow-complete', {
        detail: { stepCount: action.steps.length }
      }));
    },
  } as Record<Action['type'], ActionHandler>;
}

/**
 * Execute an action with the default handlers
 */
export function executeAction(action: Action, context?: ActionContext): void | Promise<void> {
  const handlers = createActionHandlers();
  const handler = handlers[action.type];
  if (handler) {
    return handler(action, context);
  } else {
    console.warn(`Unknown action type: ${action.type}`);
  }
}

/**
 * Execute multiple actions sequentially
 */
export async function executeActions(actions: Action[], context?: ActionContext): Promise<void> {
  for (const action of actions) {
    await executeAction(action, context);
  }
}

/**
 * Hook for React components to use action handlers
 */
export function useActionHandlers(context?: ActionContext) {
  const execute = React.useCallback(
    (action: Action) => executeAction(action, context),
    [context]
  );

  const executeAll = React.useCallback(
    (actions: Action[]) => executeActions(actions, context),
    [context]
  );

  return {
    execute,
    executeAll,
    handlers: createActionHandlers(),
  };
}
