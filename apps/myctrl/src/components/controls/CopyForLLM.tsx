import { useState, useCallback } from 'react';
import type { Control } from '../../data/types';
import {
  isNistControl,
  isFedRAMPControl,
  isPciControl,
  isCISControl,
  isSTIGControl,
  isAIRMFControl,
  isEUAIActControl,
  isAIUCControl,
  isGovRAMPControl,
} from '../../data/types';
import { getFrameworkSectionContent, PCI_GUIDANCE_KEYS } from './sections/section-content';

interface CopyForLLMProps {
  control: Control;
  frameworkId: string;
  frameworkName: string;
  size?: 'sm' | 'md';
}

function buildMarkdown(control: Control, frameworkName: string): string {
  const lines: string[] = [
    `# ${control.control_id}: ${control.title}`,
    '',
    `**Framework:** ${frameworkName}`,
    `**Family:** ${control.family}`,
    '',
    '## Description',
    '',
    control.description,
  ];

  // Prose sections shared with the comparison view, keyed by section id
  const proseByKey = new Map(
    getFrameworkSectionContent(control).map((s) => [s.key, s]),
  );
  const pushProse = (key: string) => {
    const section = proseByKey.get(key);
    if (section) {
      lines.push('', `## ${section.title}`, '', section.content);
    }
  };

  // --- Framework-specific sections ---

  if (isNistControl(control)) {
    const baselines: string[] = [];
    if (control.baseline_low) baselines.push('Low');
    if (control.baseline_moderate) baselines.push('Moderate');
    if (control.baseline_high) baselines.push('High');
    if (control.baseline_privacy) baselines.push('Privacy');
    if (baselines.length > 0) {
      lines.push('', '## Baselines', '', baselines.join(', '));
    }
    pushProse('nist-supplemental-guidance');
  }

  if (isFedRAMPControl(control)) {
    const baselineEntries: string[] = [];
    const levels = [
      ['low', 'Low'],
      ['moderate', 'Moderate'],
      ['high', 'High'],
      ['li_saas', 'LI-SaaS'],
    ] as const;
    for (const [key, label] of levels) {
      const bl = control.baselines[key];
      if (bl?.included) {
        let entry = `- **${label}**: Included`;
        if (bl.fedramp_parameters) entry += `\n  - Parameters: ${bl.fedramp_parameters}`;
        if (bl.additional_requirements) entry += `\n  - Additional Requirements: ${bl.additional_requirements}`;
        baselineEntries.push(entry);
      }
    }
    if (baselineEntries.length > 0) {
      lines.push('', '## FedRAMP Baselines', '', ...baselineEntries);
    }
    pushProse('fedramp-discussion');
  }

  if (isPciControl(control)) {
    if (control.testing_procedures && control.testing_procedures.length > 0) {
      lines.push('', '## Testing Procedures', '');
      for (const proc of control.testing_procedures) {
        lines.push(`- **${proc.id}**: ${proc.text}`);
      }
    }
    for (const key of PCI_GUIDANCE_KEYS) {
      pushProse(key);
    }
  }

  if (isCISControl(control)) {
    const igs: string[] = [];
    if (control.ig1) igs.push('IG1');
    if (control.ig2) igs.push('IG2');
    if (control.ig3) igs.push('IG3');
    if (igs.length > 0) {
      lines.push('', '## Implementation Groups', '', igs.join(', '));
    }
    if (control.asset_type) {
      lines.push('', `**Asset Type:** ${control.asset_type}`);
    }
    if (control.security_function) {
      lines.push(`**Security Function:** ${control.security_function}`);
    }
  }

  if (isSTIGControl(control)) {
    lines.push('', '## STIG Details', '');
    lines.push(`- **STIG ID:** ${control.stig_id}`);
    lines.push(`- **Severity:** ${control.severity}`);
    if (control.cci_refs.length > 0) {
      lines.push(`- **CCI References:** ${control.cci_refs.join(', ')}`);
    }
    pushProse('stig-check-content');
    pushProse('stig-fix-text');
  }

  if (isAIRMFControl(control)) {
    lines.push('', `**Category:** ${control.category}`);
    if (control.ai_actors && control.ai_actors.length > 0) {
      lines.push(`**AI Actors:** ${control.ai_actors.join(', ')}`);
    }
    pushProse('airmf-about');
    pushProse('airmf-suggested-actions');
  }

  if (isEUAIActControl(control)) {
    lines.push('', '## EU AI Act Details', '');
    lines.push(`- **Article:** ${control.article}`);
    lines.push(`- **Risk Tier:** ${control.risk_tier}`);
    if (control.applies_to && control.applies_to.length > 0) {
      lines.push(`- **Applies To:** ${control.applies_to.join(', ')}`);
    }
    if (control.deadline) {
      lines.push(`- **Deadline:** ${control.deadline}`);
    }
    if (control.penalty_tier) {
      lines.push(`- **Penalty Tier:** ${control.penalty_tier}`);
    }
    if (control.key_requirements && control.key_requirements.length > 0) {
      lines.push('', '## Key Requirements', '');
      for (const req of control.key_requirements) {
        lines.push(`- ${req}`);
      }
    }
  }

  if (isAIUCControl(control)) {
    lines.push('', `**Application:** ${control.application}`);
    lines.push(`**Frequency:** ${control.frequency}`);
    if (control.controls_evidence.length > 0) {
      lines.push('', '## Evidence Items', '');
      for (const ev of control.controls_evidence) {
        lines.push(`### ${ev.evidence_id}: ${ev.evidence_title}`);
        lines.push('');
        lines.push(ev.control_text);
        if (ev.typical_evidence) {
          lines.push('', `**Typical Evidence:** ${ev.typical_evidence}`);
        }
        lines.push('');
      }
    }
  }

  if (isGovRAMPControl(control)) {
    const baselines: string[] = [];
    if (control.baselines.low?.included) baselines.push('Low');
    if (control.baselines.moderate?.included) baselines.push('Moderate');
    if (baselines.length > 0) {
      lines.push('', '## GovRAMP Baselines', '', baselines.join(', '));
    }
    if (control.core_control) {
      lines.push('', '**Core Control:** Yes');
    }
    pushProse('govramp-discussion');
  }

  // --- Related controls (always last) ---

  if (control.related_controls && control.related_controls.length > 0) {
    lines.push('', '## Related Controls', '', control.related_controls.join(', '));
  }

  return lines.join('\n');
}

export function CopyForLLM({
  control,
  frameworkId,
  frameworkName,
  size = 'md',
}: CopyForLLMProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const markdown = buildMarkdown(control, frameworkName);
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers or non-secure contexts
      const textarea = document.createElement('textarea');
      textarea.value = markdown;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [control, frameworkName]);

  const sizeClasses = size === 'sm'
    ? 'px-1.5 py-0.5 text-xs gap-1'
    : 'px-2.5 py-1 text-xs gap-1.5';

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center ${sizeClasses} rounded border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors`}
      title="Copy control as markdown for LLMs"
      aria-label="Copy control as markdown for LLMs"
    >
      {copied ? (
        <>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy for LLM
        </>
      )}
    </button>
  );
}
