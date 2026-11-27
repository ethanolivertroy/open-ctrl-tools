import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { isFedRampKSIControl, isDoDSRGControl } from '@/data/types';
import type { ImpactLevel, DoDImpactLevel, Control } from '@/data/types';

interface ImpactBadgeProps {
  level: ImpactLevel;
  className?: string;
}

export function ImpactBadge({ level, className }: ImpactBadgeProps) {
  const variant = level.toLowerCase() as 'low' | 'moderate';

  return (
    <Badge variant={variant} className={className}>
      {level}
    </Badge>
  );
}

// DoD SRG Impact Level badge with custom colors
interface DoDImpactBadgeProps {
  level: DoDImpactLevel;
  className?: string;
}

const DOD_LEVEL_COLORS: Record<DoDImpactLevel, string> = {
  IL4_MOD: 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30',
  IL4_HIGH: 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
  IL5: 'bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30',
  IL6: 'bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30',
};

const DOD_LEVEL_LABELS: Record<DoDImpactLevel, string> = {
  IL4_MOD: 'IL4 Mod',
  IL4_HIGH: 'IL4 High',
  IL5: 'IL5',
  IL6: 'IL6',
};

export function DoDImpactBadge({ level, className }: DoDImpactBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${DOD_LEVEL_COLORS[level]} ${className || ''}`}
    >
      {DOD_LEVEL_LABELS[level]}
    </span>
  );
}

interface ImpactBadgesProps {
  control: Control;
  className?: string;
}

export function ImpactBadges({ control, className }: ImpactBadgesProps) {
  // FedRAMP KSI impact levels
  if (isFedRampKSIControl(control)) {
    const levels: ImpactLevel[] = [];

    if (control.impact_low) levels.push('LOW');
    if (control.impact_moderate) levels.push('MODERATE');

    if (levels.length === 0) {
      return null;
    }

    return (
      <div className={`flex flex-wrap gap-1.5 ${className || ''}`}>
        {levels.map((level) => (
          <ImpactBadge key={level} level={level} />
        ))}
      </div>
    );
  }

  // DoD SRG impact levels
  if (isDoDSRGControl(control)) {
    const levels: DoDImpactLevel[] = [];

    if (control.impact_levels.il4_mod?.included) levels.push('IL4_MOD');
    if (control.impact_levels.il4_high?.included) levels.push('IL4_HIGH');
    if (control.impact_levels.il5?.included) levels.push('IL5');
    if (control.impact_levels.il6?.included) levels.push('IL6');

    if (levels.length === 0) {
      return null;
    }

    return (
      <div className={`flex flex-wrap gap-1.5 ${className || ''}`}>
        {levels.map((level) => (
          <DoDImpactBadge key={level} level={level} />
        ))}
      </div>
    );
  }

  return null;
}
