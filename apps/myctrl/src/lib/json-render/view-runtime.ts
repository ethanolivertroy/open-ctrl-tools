import { setByPath } from '@json-render/core';
import type { View, Component } from './catalog';

export type ControlListFilters = Extract<Component, { type: 'ControlList' }>['filters'];

export function resolveControlListFilters(
  staticFilters?: ControlListFilters,
  boundFilters?: unknown,
): ControlListFilters {
  if (!boundFilters || typeof boundFilters !== 'object' || Array.isArray(boundFilters)) {
    return staticFilters;
  }

  return {
    ...(staticFilters || {}),
    ...(boundFilters as Record<string, unknown>),
  } as ControlListFilters;
}

export function buildInitialViewData(view: View): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  function seedComponents(components: Component[]) {
    for (const component of components) {
      switch (component.type) {
        case 'ControlList':
          if (component.filterDataPath && component.filters) {
            setByPath(data, component.filterDataPath, component.filters);
          }
          break;

        case 'StatCard':
          if (component.dataPath && component.value !== undefined) {
            setByPath(data, component.dataPath, component.value);
          }
          break;

        case 'ProgressGauge':
          if (component.dataPath && component.value !== undefined) {
            setByPath(data, component.dataPath, component.value);
          }
          break;

        case 'Section':
        case 'ExpandableSection':
          seedComponents(component.children);
          break;

        case 'TabPanel':
          for (const tab of component.tabs) {
            seedComponents(tab.children as Component[]);
          }
          break;
      }
    }
  }

  seedComponents(view.components);
  return data;
}
