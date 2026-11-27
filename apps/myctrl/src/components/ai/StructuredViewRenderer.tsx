import * as React from 'react';
import { Renderer, JSONUIProvider } from '@json-render/react';
import type { View } from '@/lib/json-render/catalog';
import { viewToUITree } from '@/lib/json-render/tree-converter';
import { jsonRenderRegistry } from '@/lib/json-render/registry';
import { buildInitialViewData } from '@/lib/json-render/view-runtime';

interface StructuredViewRendererProps {
  view: View;
}

export function StructuredViewRenderer({ view }: StructuredViewRendererProps) {
  const initialData = React.useMemo(() => buildInitialViewData(view), [view]);
  const tree = React.useMemo(() => viewToUITree(view), [view]);

  return (
    <JSONUIProvider registry={jsonRenderRegistry} initialData={initialData}>
      <Renderer tree={tree} registry={jsonRenderRegistry} />
    </JSONUIProvider>
  );
}

export default StructuredViewRenderer;
