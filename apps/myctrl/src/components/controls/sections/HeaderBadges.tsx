import { Badge } from '@/components/ui/badge';
import { BaselineBadges } from '../BaselineBadge';
import { ImpactBadges } from '../ImpactBadges';
import { slugify } from '@/data/controls';
import type { Control } from '@/data/types';
import {
  isNistControl,
  isPciControl,
  isFedRampKSIControl,
  isFedRAMPControl,
  isDoDSRGControl,
  isSTIGControl,
  isITSG33Control,
  isSSDFControl,
  isNIST171Control,
  isCMMCControl,
  isGovRAMPControl,
  isCISControl,
} from '@/data/types';

// Framework-specific header badges and metadata lines, rendered inside the page <header>
export function FrameworkHeaderBadges({ control }: { control: Control }) {
  return (
    <>
      {/* Section title for PCI-DSS */}
      {isPciControl(control) && control.section_title && (
        <p className="text-sm text-muted-foreground">
          <span className="font-mono">{control.section}</span>: {control.section_title}
        </p>
      )}

      {/* Only show baselines for NIST controls */}
      {isNistControl(control) && <BaselineBadges control={control} />}

      {/* Only show impact levels for FedRAMP KSI indicators */}
      {isFedRampKSIControl(control) && <ImpactBadges control={control} />}

      {/* Former ID for FedRAMP 20x KSI */}
      {isFedRampKSIControl(control) && control.fka && (
        <p className="text-sm text-muted-foreground">
          Formerly <span className="font-mono">{control.fka}</span>
        </p>
      )}

      {/* GovRAMP baselines + Core Control badge */}
      {isGovRAMPControl(control) && (
        <div className="flex flex-wrap gap-2">
          {control.baselines.low?.included && (
            <Badge variant="secondary" className="text-xs bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Low</Badge>
          )}
          {control.baselines.moderate?.included && (
            <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30">Moderate</Badge>
          )}
          {control.core_control && (
            <Badge variant="secondary" className="text-xs bg-sky-500/20 text-sky-700 dark:text-sky-400 border-sky-500/30">Core Control</Badge>
          )}
        </div>
      )}

      {/* FedRAMP Rev 5 baselines */}
      {isFedRAMPControl(control) && (
        <div className="flex flex-wrap gap-2">
          {control.baselines.li_saas?.included && (
            <Badge variant="outline" className="text-xs">LI-SaaS</Badge>
          )}
          {control.baselines.low?.included && (
            <Badge variant="secondary" className="text-xs bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Low</Badge>
          )}
          {control.baselines.moderate?.included && (
            <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30">Moderate</Badge>
          )}
          {control.baselines.high?.included && (
            <Badge variant="secondary" className="text-xs bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30">High</Badge>
          )}
        </div>
      )}

      {/* DoD SRG impact levels */}
      {isDoDSRGControl(control) && (
        <div className="flex flex-wrap gap-2">
          {control.impact_levels.il4_mod?.included && (
            <Badge variant="secondary" className="text-xs bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30">IL4 Mod</Badge>
          )}
          {control.impact_levels.il4_high?.included && (
            <Badge variant="secondary" className="text-xs bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border-indigo-500/30">IL4 High</Badge>
          )}
          {control.impact_levels.il5?.included && (
            <Badge variant="secondary" className="text-xs bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30">IL5</Badge>
          )}
          {control.impact_levels.il6?.included && (
            <Badge variant="secondary" className="text-xs bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30">IL6</Badge>
          )}
        </div>
      )}

      {/* ITSG-33 profile badges (Canadian Government) */}
      {isITSG33Control(control) && (
        <div className="flex flex-wrap gap-2">
          {control.profiles.pbmm?.included && (
            <Badge variant="secondary" className="text-xs bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
              PBMM{control.profiles.pbmm.priority && ` (P${control.profiles.pbmm.priority})`}
            </Badge>
          )}
          {control.profiles.secret?.included && (
            <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30">
              Secret{control.profiles.secret.priority && ` (P${control.profiles.secret.priority})`}
            </Badge>
          )}
          {control.class && (
            <Badge variant="outline" className="text-xs">{control.class}</Badge>
          )}
        </div>
      )}

      {/* SSDF practice badge */}
      {isSSDFControl(control) && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-xs bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30">
            {control.practice_id}
          </Badge>
        </div>
      )}

      {/* NIST 800-171 requirement type badge */}
      {isNIST171Control(control) && (
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="secondary"
            className={`text-xs ${
              control.requirement_type === 'basic'
                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30'
            }`}
          >
            {control.requirement_type === 'basic' ? 'Basic Requirement' : 'Derived Requirement'}
          </Badge>
        </div>
      )}

      {/* CMMC level badges */}
      {isCMMCControl(control) && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="secondary"
            className={`text-xs ${
              control.cmmc_level === 1
                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                : control.cmmc_level === 2
                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30'
                : 'bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30'
            }`}
          >
            Level {control.cmmc_level}
          </Badge>
          {control.far_clause && (
            <Badge variant="outline" className="text-xs font-mono">
              FAR {control.far_clause}
            </Badge>
          )}
          {control.nist_800_171 && (
            <a
              href={`/frameworks/nist-800-171-r2/${slugify(control.nist_800_171)}`}
              className="inline-block"
            >
              <Badge variant="outline" className="text-xs font-mono hover:bg-secondary/80 transition-colors">
                800-171: {control.nist_800_171}
              </Badge>
            </a>
          )}
          {control.nist_800_172 && (
            <Badge variant="outline" className="text-xs font-mono">
              800-172: {control.nist_800_172}
            </Badge>
          )}
        </div>
      )}

      {/* STIG severity badge */}
      {isSTIGControl(control) && (
        <div className="flex flex-wrap items-center gap-2">
          {control.severity === 'high' && (
            <Badge className="text-xs bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30">
              CAT I - High
            </Badge>
          )}
          {control.severity === 'medium' && (
            <Badge className="text-xs bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
              CAT II - Medium
            </Badge>
          )}
          {control.severity === 'low' && (
            <Badge className="text-xs bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30">
              CAT III - Low
            </Badge>
          )}
          {control.version_code && (
            <Badge variant="outline" className="text-xs font-mono">
              {control.version_code}
            </Badge>
          )}
        </div>
      )}

      {/* CIS Controls - Implementation Groups, Asset Type, Security Function */}
      {isCISControl(control) && (
        <div className="flex flex-wrap items-center gap-2">
          {([
            { key: 'ig1' as const, label: 'IG1', className: 'text-xs bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
            { key: 'ig2' as const, label: 'IG2', className: 'text-xs bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30' },
            { key: 'ig3' as const, label: 'IG3', className: 'text-xs bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30' },
          ] as const).filter(b => control[b.key]).map(b => (
            <Badge key={b.key} variant="secondary" className={b.className}>{b.label}</Badge>
          ))}
          {control.asset_type && (
            <Badge variant="outline" className="text-xs">{control.asset_type}</Badge>
          )}
          {control.security_function && (
            <Badge variant="outline" className="text-xs">{control.security_function}</Badge>
          )}
        </div>
      )}
    </>
  );
}
