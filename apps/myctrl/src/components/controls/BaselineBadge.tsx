import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import type { BaselineLevel, Control } from '@/data/types';
import { isNistControl, isFedRAMPControl } from '@/data/types';

interface BaselineBadgeProps {
  level: BaselineLevel;
  className?: string;
}

export function BaselineBadge({ level, className }: BaselineBadgeProps) {
  const variant = level.toLowerCase() as 'low' | 'moderate' | 'high' | 'privacy';

  return (
    <Badge variant={variant} className={className}>
      {level}
    </Badge>
  );
}

interface BaselineBadgesProps {
  control: Control;
  className?: string;
}

export function BaselineBadges({ control, className }: BaselineBadgesProps) {
  const baselines: BaselineLevel[] = [];
  let hasLiSaas = false;

  // NIST 800-53 (flat boolean properties)
  if (isNistControl(control)) {
    if (control.baseline_low) baselines.push('LOW');
    if (control.baseline_moderate) baselines.push('MODERATE');
    if (control.baseline_high) baselines.push('HIGH');
    if (control.baseline_privacy) baselines.push('PRIVACY');
  }
  // FedRAMP Rev 5 (nested baselines structure)
  else if (isFedRAMPControl(control)) {
    if (control.baselines.li_saas?.included) hasLiSaas = true;
    if (control.baselines.low?.included) baselines.push('LOW');
    if (control.baselines.moderate?.included) baselines.push('MODERATE');
    if (control.baselines.high?.included) baselines.push('HIGH');
  }

  if (baselines.length === 0 && !hasLiSaas) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${className || ''}`}>
      {hasLiSaas && (
        <Badge variant="outline" className="text-xs">LI-SaaS</Badge>
      )}
      {baselines.map((level) => (
        <BaselineBadge key={level} level={level} />
      ))}
    </div>
  );
}
