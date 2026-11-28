import type { Control, FrameworkConfig } from '../../data/types';
import {
  isNistControl, isPciControl, isSTIGControl, isAIRMFControl,
  isEUAIActControl, isCISControl, isCMMCControl,
  isFedRAMPControl, isISO27001Control, isNIST171Control,
} from '../../data/types';
import { isEnhancement, parseParentControlId } from '../../lib/control-graph';
import { slugifyControlId as slugify } from '../../lib/slugify';
import { CollapsibleSection } from './CollapsibleSection';
import { Badge } from '../ui/badge';
import {
  getFrameworkSectionContent,
  PCI_GUIDANCE_KEYS,
  type FrameworkSectionContent,
} from '../controls/sections/section-content';

interface ComparisonControlCardProps {
  control: Control;
  config: FrameworkConfig;
  frameworkId: string;
  allExpanded?: boolean;
}

export function ComparisonControlCard({
  control,
  config,
  frameworkId,
  allExpanded,
}: ComparisonControlCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Card Header */}
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <span className="px-2 py-0.5 text-xs font-mono bg-primary/10 text-primary rounded">
              {config.name}
            </span>
            <h3 className="font-semibold text-lg">
              {control.control_id}
            </h3>
            <p className="text-sm text-muted-foreground">{control.title}</p>
          </div>
          <a
            href={control.url}
            className="text-xs text-primary hover:underline whitespace-nowrap"
          >
            View →
          </a>
        </div>
        {/* Enhancement badge */}
        {isEnhancement(control.control_id) && (
          <div className="mt-2">
            <span className="px-2 py-0.5 text-xs bg-accent text-accent-foreground rounded">
              Enhancement of {parseParentControlId(control.control_id)}
            </span>
          </div>
        )}
        {/* Framework-specific badges */}
        <FrameworkBadges control={control} frameworkId={frameworkId} />
      </div>

      {/* Description (always visible) */}
      <div className="p-4">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Description
        </h4>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {control.description}
        </p>
      </div>

      {/* Framework-specific collapsible sections */}
      <FrameworkSections control={control} frameworkId={frameworkId} allExpanded={allExpanded} />
    </div>
  );
}

// --- Badge rendering ---

function FrameworkBadges({ control, frameworkId }: { control: Control; frameworkId: string }) {
  const badges: React.ReactNode[] = [];

  if (isNistControl(control)) {
    const levels = [];
    if (control.baseline_low) levels.push('Low');
    if (control.baseline_moderate) levels.push('Moderate');
    if (control.baseline_high) levels.push('High');
    if (control.baseline_privacy) levels.push('Privacy');
    if (levels.length > 0) {
      badges.push(
        <div key="nist-baselines" className="flex flex-wrap gap-1 mt-2">
          {levels.map(l => (
            <span key={l} className="px-1.5 py-0.5 text-xs rounded bg-primary/10 text-primary">
              {l}
            </span>
          ))}
        </div>
      );
    }
  }

  if (isSTIGControl(control)) {
    const severityColors = {
      high: 'bg-red-500/20 text-red-700 dark:text-red-400',
      medium: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
      low: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
    };
    const severityLabels = { high: 'CAT I', medium: 'CAT II', low: 'CAT III' };
    badges.push(
      <div key="stig-severity" className="mt-2">
        <span className={`px-1.5 py-0.5 text-xs rounded ${severityColors[control.severity]}`}>
          {severityLabels[control.severity]} - {control.severity.charAt(0).toUpperCase() + control.severity.slice(1)}
        </span>
      </div>
    );
  }

  if (isCISControl(control)) {
    const igs = [];
    if (control.ig1) igs.push('IG1');
    if (control.ig2) igs.push('IG2');
    if (control.ig3) igs.push('IG3');
    if (igs.length > 0) {
      badges.push(
        <div key="cis-ig" className="flex flex-wrap gap-1 mt-2">
          {igs.map(ig => (
            <span key={ig} className="px-1.5 py-0.5 text-xs rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
              {ig}
            </span>
          ))}
        </div>
      );
    }
  }

  if (isEUAIActControl(control)) {
    const tierColors: Record<string, string> = {
      'prohibited': 'bg-red-500/20 text-red-700 dark:text-red-400',
      'high-risk': 'bg-amber-500/20 text-amber-700 dark:text-amber-400',
      'limited-risk': 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
      'minimal-risk': 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
      'gpai': 'bg-purple-500/20 text-purple-700 dark:text-purple-400',
    };
    badges.push(
      <div key="euai-tier" className="mt-2">
        <span className={`px-1.5 py-0.5 text-xs rounded ${tierColors[control.risk_tier] || ''}`}>
          {control.risk_tier}
        </span>
      </div>
    );
  }

  if (isCMMCControl(control)) {
    const levelColors = {
      1: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
      2: 'bg-amber-500/20 text-amber-700 dark:text-amber-400',
      3: 'bg-rose-500/20 text-rose-700 dark:text-rose-400',
    };
    badges.push(
      <div key="cmmc-level" className="mt-2">
        <span className={`px-1.5 py-0.5 text-xs rounded ${levelColors[control.cmmc_level]}`}>
          Level {control.cmmc_level}
        </span>
      </div>
    );
  }

  if (isFedRAMPControl(control)) {
    const levels = [];
    if (control.baselines.low?.included) levels.push('Low');
    if (control.baselines.moderate?.included) levels.push('Moderate');
    if (control.baselines.high?.included) levels.push('High');
    if (levels.length > 0) {
      badges.push(
        <div key="fedramp-baselines" className="flex flex-wrap gap-1 mt-2">
          {levels.map(l => (
            <span key={l} className="px-1.5 py-0.5 text-xs rounded bg-primary/10 text-primary">
              {l}
            </span>
          ))}
        </div>
      );
    }
  }

  if (isNIST171Control(control)) {
    badges.push(
      <div key="nist171-type" className="mt-2">
        <span className={`px-1.5 py-0.5 text-xs rounded ${
          control.requirement_type === 'basic'
            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
            : 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
        }`}>
          {control.requirement_type === 'basic' ? 'Basic' : 'Derived'}
        </span>
      </div>
    );
  }

  if (badges.length === 0) return null;
  return <>{badges}</>;
}

// --- Framework-specific sections ---

function FrameworkSections({
  control,
  frameworkId,
  allExpanded,
}: {
  control: Control;
  frameworkId: string;
  allExpanded?: boolean;
}) {
  const sections: React.ReactNode[] = [];

  // Plain-prose sections shared with CopyForLLM via the data-level registry
  const proseByKey = new Map(
    getFrameworkSectionContent(control).map((s) => [s.key, s]),
  );
  const proseSection = (registryKey: string, sectionKey: string) => {
    const entry = proseByKey.get(registryKey);
    if (!entry || !entry.content) return null;
    return (
      <CollapsibleSection key={sectionKey} title={entry.title} forceOpen={allExpanded}>
        <ProseBody text={entry.content} />
      </CollapsibleSection>
    );
  };

  // NIST 800-53 sections
  const suppGuidance = proseSection('nist-supplemental-guidance', 'supp-guidance');
  if (suppGuidance) sections.push(suppGuidance);

  // PCI-DSS sections
  if (isPciControl(control) && control.testing_procedures && control.testing_procedures.length > 0) {
    sections.push(
      <CollapsibleSection key="testing-procs" title="Testing Procedures" forceOpen={allExpanded}>
        <div className="space-y-2">
          {control.testing_procedures.map((proc) => (
            <div key={proc.id} className="flex gap-2 text-sm">
              <span className="font-mono text-primary shrink-0">{proc.id}</span>
              <span className="text-muted-foreground">{proc.text}</span>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    );
  }
  const guidanceParts = PCI_GUIDANCE_KEYS
    .map((key) => proseByKey.get(key))
    .filter((entry): entry is FrameworkSectionContent => entry !== undefined);
  if (guidanceParts.length > 0) {
    sections.push(
      <CollapsibleSection key="guidance" title="Guidance" forceOpen={allExpanded}>
        <div className="space-y-3">
          {guidanceParts.map((part) => (
            <GuidancePart key={part.key} label={part.title} text={part.content} />
          ))}
        </div>
      </CollapsibleSection>
    );
  }

  // STIG sections
  const checkContent = proseSection('stig-check-content', 'check-content');
  if (checkContent) sections.push(checkContent);
  const fixText = proseSection('stig-fix-text', 'fix-text');
  if (fixText) sections.push(fixText);
  if (isSTIGControl(control) && control.cci_refs && control.cci_refs.length > 0) {
    sections.push(
      <CollapsibleSection key="cci-refs" title="CCI References" forceOpen={allExpanded}>
        <div className="flex flex-wrap gap-1">
          {control.cci_refs.map((cci) => (
            <Badge key={cci} variant="secondary" className="font-mono text-xs">
              {cci}
            </Badge>
          ))}
        </div>
      </CollapsibleSection>
    );
  }

  // FedRAMP sections
  const fedrampDiscussion = proseSection('fedramp-discussion', 'discussion');
  if (fedrampDiscussion) sections.push(fedrampDiscussion);
  if (isFedRAMPControl(control)) {
    // Show baseline parameters in a condensed format
    const baselineEntries = Object.entries(control.baselines)
      .filter(([, data]) => data?.included && (data.fedramp_parameters || data.additional_requirements))
      .map(([level, data]) => ({ level, data: data! }));
    if (baselineEntries.length > 0) {
      sections.push(
        <CollapsibleSection key="baselines" title="Baseline Parameters" forceOpen={allExpanded}>
          <div className="space-y-3">
            {baselineEntries.map(({ level, data }) => (
              <div key={level} className="space-y-1">
                <span className="text-xs font-semibold text-primary capitalize">{level === 'li_saas' ? 'LI-SaaS' : level}</span>
                {data.fedramp_parameters && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{data.fedramp_parameters}</p>
                )}
                {data.additional_requirements && (
                  <p className="text-xs text-muted-foreground italic">{data.additional_requirements}</p>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      );
    }
  }

  // AI RMF sections
  const airmfAbout = proseSection('airmf-about', 'about');
  if (airmfAbout) sections.push(airmfAbout);
  const airmfActions = proseSection('airmf-suggested-actions', 'suggested-actions');
  if (airmfActions) sections.push(airmfActions);
  if (isAIRMFControl(control) && control.ai_actors && control.ai_actors.length > 0) {
    sections.push(
      <CollapsibleSection key="ai-actors" title="AI Actors" forceOpen={allExpanded}>
        <div className="flex flex-wrap gap-1">
          {control.ai_actors.map((actor, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {actor}
            </Badge>
          ))}
        </div>
      </CollapsibleSection>
    );
  }

  // EU AI Act sections
  if (isEUAIActControl(control)) {
    const details: string[] = [];
    if (control.article) details.push(`Article: ${control.article}`);
    if (control.deadline) details.push(`Deadline: ${control.deadline}`);
    if (control.penalty_tier) details.push(`Penalty: ${control.penalty_tier}`);
    if (control.applies_to?.length) details.push(`Applies to: ${control.applies_to.join(', ')}`);

    if (details.length > 0) {
      sections.push(
        <CollapsibleSection key="euai-details" title="Regulation Details" forceOpen={allExpanded}>
          <div className="space-y-1">
            {details.map((d, i) => (
              <p key={i} className="text-sm text-muted-foreground">{d}</p>
            ))}
          </div>
        </CollapsibleSection>
      );
    }

    if (control.key_requirements && control.key_requirements.length > 0) {
      sections.push(
        <CollapsibleSection key="euai-requirements" title="Key Requirements" forceOpen={allExpanded}>
          <ul className="space-y-1">
            {control.key_requirements.map((req, i) => (
              <li key={i} className="text-sm text-muted-foreground flex gap-2">
                <span className="text-primary shrink-0">•</span>
                <span>{req}</span>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      );
    }
  }

  // CIS Controls sections
  if (isCISControl(control)) {
    const details: string[] = [];
    if (control.asset_type) details.push(`Asset Type: ${control.asset_type}`);
    if (control.security_function) details.push(`Security Function: ${control.security_function}`);
    if (details.length > 0) {
      sections.push(
        <CollapsibleSection key="cis-details" title="Control Details" forceOpen={allExpanded}>
          <div className="space-y-1">
            {details.map((d, i) => (
              <p key={i} className="text-sm text-muted-foreground">{d}</p>
            ))}
          </div>
        </CollapsibleSection>
      );
    }
  }

  // CMMC sections
  if (isCMMCControl(control)) {
    const refs: string[] = [];
    if (control.nist_800_171) refs.push(`NIST 800-171: ${control.nist_800_171}`);
    if (control.nist_800_172) refs.push(`NIST 800-172: ${control.nist_800_172}`);
    if (control.far_clause) refs.push(`FAR: ${control.far_clause}`);
    if (refs.length > 0) {
      sections.push(
        <CollapsibleSection key="cmmc-refs" title="References" forceOpen={allExpanded}>
          <div className="space-y-1">
            {refs.map((r, i) => (
              <p key={i} className="text-sm text-muted-foreground font-mono">{r}</p>
            ))}
          </div>
        </CollapsibleSection>
      );
    }
  }

  // ISO 27001 CSF mappings
  if (isISO27001Control(control) && control.csf_mappings && control.csf_mappings.filter(c => c.includes('-')).length > 0) {
    sections.push(
      <CollapsibleSection key="csf-mappings" title="CSF Mappings" forceOpen={allExpanded}>
        <div className="flex flex-wrap gap-1">
          {control.csf_mappings.filter(c => c.includes('-')).map((csf) => (
            <a
              key={csf}
              href={`/frameworks/nist-csf-v2/${slugify(csf)}`}
              className="px-1.5 py-0.5 text-xs font-mono rounded border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              {csf}
            </a>
          ))}
        </div>
      </CollapsibleSection>
    );
  }

  // NIST 800-171 discussion
  const nist171Discussion = proseSection('nist171-discussion', 'nist171-discussion');
  if (nist171Discussion) sections.push(nist171Discussion);

  // Related Controls
  if (control.related_controls && control.related_controls.length > 0) {
    sections.push(
      <CollapsibleSection key="related" title="Related Controls" forceOpen={allExpanded}>
        <div className="flex flex-wrap gap-1">
          {control.related_controls.map((rc) => (
            <Badge key={rc} variant="outline" className="font-mono text-xs">
              {rc}
            </Badge>
          ))}
        </div>
      </CollapsibleSection>
    );
  }

  if (sections.length === 0) return null;
  return <>{sections}</>;
}

// Standard prose body used by registry-driven sections
function ProseBody({ text }: { text: string }) {
  return (
    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
      {text}
    </p>
  );
}

// Small helper for PCI guidance parts
function GuidancePart({ label, text }: { label: string; text: string }) {
  return (
    <div className="space-y-0.5">
      <h5 className="text-xs font-semibold text-primary/80">{label}</h5>
      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{text}</p>
    </div>
  );
}
