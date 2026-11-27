import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { BaselineBadges } from './BaselineBadge';
import { ImpactBadges } from './ImpactBadges';
import type { Control } from '@/data/types';

interface ControlCardProps {
  control: Control;
}

export function ControlCard({ control }: ControlCardProps) {
  return (
    <a href={control.url} className="block group">
      <Card className="control-card h-full glass-card border">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="font-mono text-primary shrink-0">
                  {control.control_id}
                </span>
              </CardTitle>
              <CardDescription className="mt-1 line-clamp-1">
                {control.title}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {control.description}
          </p>
          <BaselineBadges control={control} />
          <ImpactBadges control={control} />
        </CardContent>
      </Card>
    </a>
  );
}

interface ControlCardCompactProps {
  control: Control;
}

export function ControlCardCompact({ control }: ControlCardCompactProps) {
  return (
    <a
      href={control.url}
      className="flex items-center justify-between p-3 rounded-lg border glass-card transition-colors group control-card"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-mono text-sm text-primary shrink-0">
          {control.control_id}
        </span>
        <span className="text-sm text-muted-foreground truncate group-hover:text-foreground transition-colors">
          {control.title}
        </span>
      </div>
      <BaselineBadges control={control} className="shrink-0 ml-2" />
      <ImpactBadges control={control} className="shrink-0 ml-2" />
    </a>
  );
}
