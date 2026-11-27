import { catalog, ViewSchema, type View } from '@/lib/json-render/catalog';
import { wrapTextInView } from './view-utils';
import { parseStreamedResponse } from './parse-stream';

export interface StructuredViewParseResult {
  view: View | null;
  error: string | null;
}

const TEXT_BLOCK_VARIANTS = new Set(['default', 'callout', 'warning', 'info', 'success']);
// Derived from the canonical json-render catalog so new components are
// recognized automatically instead of being coerced into TextBlocks.
const KNOWN_COMPONENT_TYPES = new Set(Object.keys(catalog));

const VARIANT_DEFAULTS: Record<string, string> = {
  TextBlock: 'default',
  ControlCard: 'compact',
  ControlList: 'compact',
  FrameworkCard: 'compact',
  FavoritesPanel: 'list',
  ProgressGauge: 'bar',
};

function formatValidationError(error: { issues: Array<{ path: PropertyKey[]; message: string }> }): string {
  const firstIssue = error.issues[0];
  if (!firstIssue) {
    return 'Generated view has invalid structure';
  }

  const path = firstIssue.path.length > 0 ? firstIssue.path.join('.') : 'view';
  return `Generated view has invalid structure at ${path}: ${firstIssue.message}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function coerceComponent(raw: unknown): Record<string, unknown> {
  const component = asRecord(raw);
  if (!component) {
    return {
      type: 'TextBlock',
      content: typeof raw === 'string' ? raw : JSON.stringify(raw),
      variant: 'default',
    };
  }

  const type = typeof component.type === 'string' ? component.type : '';
  if (!type || !KNOWN_COMPONENT_TYPES.has(type)) {
    const content = typeof component.content === 'string'
      ? component.content
      : typeof component.text === 'string'
        ? component.text
        : JSON.stringify(component);
    return {
      type: 'TextBlock',
      content,
      variant: 'default',
    };
  }

  const next: Record<string, unknown> = { ...component, type };
  const defaultVariant = VARIANT_DEFAULTS[type];
  if (defaultVariant && (next.variant == null || next.variant === '')) {
    next.variant = defaultVariant;
  }
  if (type === 'TextBlock' && typeof next.variant === 'string' && !TEXT_BLOCK_VARIANTS.has(next.variant)) {
    next.variant = 'default';
  }

  if (Array.isArray(next.children)) {
    next.children = next.children.map(coerceComponent);
  }

  if (Array.isArray(next.tabs)) {
    next.tabs = next.tabs.map((tab) => {
      const tabRecord = asRecord(tab);
      if (!tabRecord) return tab;
      return {
        ...tabRecord,
        children: Array.isArray(tabRecord.children)
          ? tabRecord.children.map(coerceComponent)
          : tabRecord.children,
      };
    });
  }

  return next;
}

export function normalizeGeneratedView(candidate: unknown): unknown {
  const view = asRecord(candidate);
  if (!view || !Array.isArray(view.components)) {
    return candidate;
  }

  return {
    ...view,
    title: typeof view.title === 'string' && view.title.trim() ? view.title : 'AI Response',
    components: view.components.map(coerceComponent),
  };
}

export function validateStructuredView(candidate: unknown): StructuredViewParseResult {
  const validated = ViewSchema.safeParse(normalizeGeneratedView(candidate));
  if (validated.success) {
    return {
      view: validated.data,
      error: null,
    };
  }

  return {
    view: null,
    error: formatValidationError(validated.error),
  };
}

export function parseStructuredViewResponse(content: string): StructuredViewParseResult {
  const trimmed = content.trim();
  if (!trimmed) {
    return {
      view: null,
      error: 'Provider returned an empty response',
    };
  }

  if (/JSON Schema validation failed/i.test(trimmed) && !trimmed.includes('{')) {
    return {
      view: null,
      error: trimmed.slice(0, 400),
    };
  }

  const parsed = parseStreamedResponse(content);
  if (!parsed) {
    return {
      view: null,
      error: 'Failed to parse AI response',
    };
  }

  return validateStructuredView(parsed);
}

export function parseStructuredViewOrWrap(content: string): View {
  const result = parseStructuredViewResponse(content);
  return result.view ?? wrapTextInView(content);
}
