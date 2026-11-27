import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { NormalizedCmvpModule } from '@/lib/cmvp';

const DATASET_LABELS: Record<NormalizedCmvpModule['dataset'], string> = {
  active: 'Active',
  historical: 'Historical',
  in_process: 'In Process',
};

const DATASET_STYLES: Record<NormalizedCmvpModule['dataset'], string> = {
  active: 'border-green-500/30 text-green-600 dark:text-green-400',
  historical: 'border-zinc-500/30 text-zinc-600 dark:text-zinc-400',
  in_process: 'border-amber-500/30 text-amber-600 dark:text-amber-400',
};

function getDateTokens(value: string | null): string[] {
  if (!value) return [];
  return value.split(/\s*,\s*/).filter(Boolean);
}

export function CmvpModuleCard({
  module,
  actionLabel,
  onAction,
  actionDisabled = false,
  footer,
}: {
  module: NormalizedCmvpModule;
  actionLabel?: string;
  onAction?: (module: NormalizedCmvpModule) => void;
  actionDisabled?: boolean;
  footer?: React.ReactNode;
}) {
  const validationDates = React.useMemo(() => getDateTokens(module.validationDate), [module.validationDate]);
  const internalDetailHref = module.certificateNumber
    ? `/cmvp/certificate/${encodeURIComponent(module.certificateNumber)}`
    : null;

  return (
    <Card className="border-border/70">
      <CardContent className="pt-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-sm">{module.moduleName}</h3>
              <Badge variant="outline" className={`text-[11px] ${DATASET_STYLES[module.dataset]}`}>
                {DATASET_LABELS[module.dataset]}
              </Badge>
              {module.certificateNumber && (
                <Badge variant="outline" className="text-[11px] font-mono">
                  Cert {module.certificateNumber}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{module.vendorName}</p>
          </div>
          {actionLabel && onAction && (
            <Button
              size="sm"
              variant={actionDisabled ? 'outline' : 'default'}
              disabled={actionDisabled}
              onClick={() => onAction(module)}
            >
              {actionLabel}
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {module.standard && (
            <Badge variant="secondary" className="text-[11px]">
              {module.standard}
            </Badge>
          )}
          {module.moduleType && (
            <Badge variant="outline" className="text-[11px]">
              {module.moduleType}
            </Badge>
          )}
          <Badge variant="outline" className="text-[11px]">
            {module.status}
          </Badge>
          {module.overallLevel !== null && (
            <Badge variant="outline" className="text-[11px]">
              Level {module.overallLevel}
            </Badge>
          )}
        </div>

        {(validationDates.length > 0 || module.sunsetDate) && (
          <div className="flex flex-wrap items-start gap-6 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            {validationDates.length > 0 && (
              <div className="min-w-0 space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground">Validated</div>
                <div className="flex flex-wrap gap-1.5">
                  {validationDates.map((date) => (
                    <Badge key={date} variant="outline" className="text-[11px] font-mono">
                      {date}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {module.sunsetDate && (
              <div className="min-w-[140px] space-y-1 text-xs">
                <div className="text-[11px] font-medium text-muted-foreground">Sunset</div>
                <div className="font-mono">{module.sunsetDate}</div>
              </div>
            )}
          </div>
        )}

        {module.algorithms.length > 0 && (
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-muted-foreground">Algorithms</div>
            <div className="flex flex-wrap gap-1">
              {module.algorithms.map((algorithm) => (
                <Badge key={algorithm} variant="outline" className="text-[11px]">
                  {algorithm}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {module.caveat && (
          <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2 text-[11px] text-muted-foreground">
            {module.caveat}
          </div>
        )}

        {module.description && (
          <p className="text-xs leading-5 text-muted-foreground">
            {module.description.length > 280 ? `${module.description.slice(0, 280)}...` : module.description}
          </p>
        )}

        <div className="flex flex-wrap gap-3 text-xs">
          {internalDetailHref && (
            <a
              href={internalDetailHref}
              className="text-primary hover:underline"
            >
              View detail
            </a>
          )}
          {module.securityPolicyUrl && (
            <a
              href={module.securityPolicyUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              Security policy
            </a>
          )}
          {module.certificateDetailUrl && (
            <a
              href={module.certificateDetailUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              NIST page
            </a>
          )}
        </div>

        {footer}
      </CardContent>
    </Card>
  );
}
