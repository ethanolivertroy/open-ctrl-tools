/**
 * ViewSchema ↔ UITree Bidirectional Converter
 *
 * Bridges the gap between our nested ViewSchema format (what the LLM generates)
 * and json-render's flat UITree format (what the Renderer consumes).
 *
 * ViewSchema (nested):
 *   { title, description, components: [{ type, ...props, children: [...] }] }
 *
 * UITree (flat):
 *   { root: string, elements: Record<string, UIElement> }
 *
 * Design decision: Container components (Section, ExpandableSection, TabPanel)
 * keep their children nested in `props` rather than flattening to UITree key
 * references. This means existing component implementations require ZERO changes —
 * containers still receive `config.children` as Component[] and render them
 * internally via the existing renderComponent() function. The Renderer handles
 * top-level dispatch while containers manage their own subtrees.
 */

import type { UITree, UIElement } from '@json-render/core';
import type { View, Component } from './catalog';

/** Key used for the root wrapper element in every converted tree */
export const ROOT_KEY = '__root';

/** Component type for the root wrapper element */
export const VIEW_ROOT_TYPE = '__ViewRoot';

/**
 * Convert a ViewSchema to a json-render UITree.
 *
 * Each top-level component becomes a flat UIElement. Container components
 * (Section, ExpandableSection, TabPanel) keep their children nested in
 * props — the adapter + existing renderComponent handle rendering them.
 */
export function viewToUITree(view: View): UITree {
  const elements: Record<string, UIElement> = {};
  let counter = 0;

  function nextKey(): string {
    return `el${counter++}`;
  }

  function componentToElement(component: Component, parentKey: string): string {
    const key = nextKey();
    const { type, ...props } = component;

    elements[key] = {
      key,
      type,
      props,
      parentKey,
    };

    return key;
  }

  // Create child elements for each top-level component
  const childKeys = view.components.map(c => componentToElement(c, ROOT_KEY));

  // Create root wrapper element
  elements[ROOT_KEY] = {
    key: ROOT_KEY,
    type: VIEW_ROOT_TYPE,
    props: {
      title: view.title,
      description: view.description,
    },
    children: childKeys,
  };

  return { root: ROOT_KEY, elements };
}

/**
 * Convert a json-render UITree back to a ViewSchema.
 *
 * Used for:
 * - Backwards-compatible saved view export
 * - Debugging (nested format is easier to read)
 * - Re-generating the LLM prompt context
 */
export function uiTreeToView(tree: UITree): View {
  const root = tree.elements[tree.root];
  if (!root) {
    return { title: 'Untitled', components: [] };
  }

  const title = (root.props as Record<string, unknown>)?.title as string || 'Untitled';
  const description = (root.props as Record<string, unknown>)?.description as string | undefined;

  function elementToComponent(key: string): Component {
    const el = tree.elements[key];
    if (!el) {
      return { type: 'TextBlock', content: `Missing element: ${key}`, variant: 'default' } as unknown as Component;
    }

    return { type: el.type, ...el.props } as unknown as Component;
  }

  const components = (root.children || []).map(elementToComponent);

  return {
    title,
    ...(description ? { description } : {}),
    components,
  };
}
