import type { AIContext } from '@/lib/ai-data-context';
import { validateStructuredView, type StructuredViewParseResult } from '@/lib/ai/structured-view';
import { getSavedViewById } from '@/lib/storage/saved-view-store';
import type { SavedView } from '@/lib/storage-types';
import type { View } from '@/lib/json-render/catalog';

export interface SavedViewRuntime {
  savedView: SavedView;
  view: View;
  context: AIContext;
}

export function buildSavedViewContext(savedView: SavedView): AIContext {
  return {
    frameworkId: savedView.frameworkId,
    controlId: savedView.controlId,
    family: savedView.family,
    assessmentId: savedView.assessmentId,
    baseline: savedView.baseline,
    systemName: savedView.systemName,
  };
}

function parseSavedView(savedView: SavedView): StructuredViewParseResult {
  try {
    return validateStructuredView(JSON.parse(savedView.viewJson));
  } catch {
    return {
      view: null,
      error: 'Saved view contains invalid JSON.',
    };
  }
}

export function buildSavedViewRuntime(savedView: SavedView): SavedViewRuntime {
  const parsed = parseSavedView(savedView);
  if (!parsed.view) {
    throw new Error(parsed.error ?? 'Saved view has invalid structure.');
  }

  return {
    savedView,
    view: parsed.view,
    context: buildSavedViewContext(savedView),
  };
}

export async function loadSavedViewRuntime(savedViewId: string): Promise<SavedViewRuntime | null> {
  const savedView = await getSavedViewById(savedViewId);
  if (!savedView) {
    return null;
  }

  return buildSavedViewRuntime(savedView);
}
