/**
 * json-render ComponentRegistry — the single dispatch path.
 *
 * Maps every catalog component type to a json-render ComponentRenderer.
 * json-render passes { element: { key, type, props } }; our components expect
 * { config: { type, ...props } }, so each adapter reconstructs `config` and
 * hands it to the private dispatch function below.
 *
 * Container components (Section, ExpandableSection, TabPanel) keep their
 * children nested in `props` (see tree-converter.ts) and render them through
 * the same dispatch function, which they receive as a `renderComponent` prop.
 */

import * as React from 'react';
import type { ComponentRegistry, ComponentRenderProps, ComponentRenderer } from '@json-render/react';
import type { Component } from './catalog';
import { componentRegistry } from './components';
import {
  componentTypes,
  isContainerComponentType,
  type ComponentType,
} from './component-manifest';

interface RenderableComponentProps {
  config: Component;
  renderComponent?: (component: Component) => React.ReactNode;
}

/**
 * Dispatch a catalog component (including nested children of containers)
 * to its React implementation.
 */
function renderComponentNode(component: Component): React.ReactNode {
  const Impl = componentRegistry[component.type] as
    | React.ComponentType<RenderableComponentProps>
    | undefined;
  if (!Impl) {
    return React.createElement(
      'div',
      { className: 'rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-400' },
      `Unknown component type: ${component.type}`,
    );
  }

  if (isContainerComponentType(component.type)) {
    return React.createElement(Impl, { config: component, renderComponent: renderComponentNode });
  }

  return React.createElement(Impl, { config: component });
}

/**
 * Adapt a component type to json-render's ComponentRenderProps interface by
 * rebuilding `config` from `element.type` + `element.props` and dispatching.
 */
function makeRenderer(type: ComponentType): ComponentRenderer {
  return function AdaptedComponent({ element }: ComponentRenderProps) {
    const config = { type, ...element.props } as Component;
    return React.createElement(React.Fragment, null, renderComponentNode(config));
  };
}

/**
 * Root wrapper element created by viewToUITree().
 * Renders children with vertical spacing, matching the existing
 * `<div className="space-y-4">` wrapper around view components.
 */
function ViewRoot({ children }: ComponentRenderProps) {
  return React.createElement('div', { className: 'space-y-4' }, children);
}

/**
 * The json-render ComponentRegistry mapping every component type
 * to its adapted implementation.
 */
export const jsonRenderRegistry: ComponentRegistry = {
  // Root wrapper
  __ViewRoot: ViewRoot,
  ...Object.fromEntries(componentTypes.map((type) => [type, makeRenderer(type)])),
};
