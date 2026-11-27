/**
 * Shared primitives for json-render component implementations.
 *
 * Every *-components.tsx file renders the same error/empty cards and uses the
 * same config-prop shape; they live here once instead of being copy-pasted.
 */

import { Card, CardContent } from '@/components/ui/card';
import type { Component } from './catalog';

export interface ComponentProps<T extends Component['type']> {
  config: Extract<Component, { type: T }>;
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <Card className="bg-red-500/5 border-red-500/30">
      <CardContent className="p-4">
        <p className="text-sm text-red-700 dark:text-red-400">{message}</p>
      </CardContent>
    </Card>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <Card className="bg-muted/30 border-border">
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
