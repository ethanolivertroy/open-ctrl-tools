import type { Control } from '@/data/types';
import {
  isNistControl,
  isFedRAMPControl,
  isGovRAMPControl,
  isPciControl,
  isSTIGControl,
  isAIRMFControl,
  isNIST171Control,
} from '@/data/types';

// Data-level registry of plain-prose framework sections, shared by CopyForLLM
// (markdown export) and ComparisonControlCard (collapsible prose sections).
// Consumers pick entries by key so each keeps its existing section coverage.
export interface FrameworkSectionContent {
  key: string;
  title: string;
  content: string;
}

export function getFrameworkSectionContent(control: Control): FrameworkSectionContent[] {
  const sections: FrameworkSectionContent[] = [];

  if (isNistControl(control) && control.supplemental_guidance) {
    sections.push({
      key: 'nist-supplemental-guidance',
      title: 'Supplemental Guidance',
      content: control.supplemental_guidance,
    });
  }

  if (isFedRAMPControl(control) && control.discussion) {
    sections.push({ key: 'fedramp-discussion', title: 'Discussion', content: control.discussion });
  }

  if (isGovRAMPControl(control) && control.discussion) {
    sections.push({ key: 'govramp-discussion', title: 'Discussion', content: control.discussion });
  }

  if (isPciControl(control) && control.guidance) {
    const g = control.guidance;
    if (g.purpose) {
      sections.push({ key: 'pci-purpose', title: 'Purpose', content: g.purpose });
    }
    if (g.good_practice) {
      sections.push({ key: 'pci-good-practice', title: 'Good Practice', content: g.good_practice });
    }
    if (g.definitions) {
      sections.push({ key: 'pci-definitions', title: 'Definitions', content: g.definitions });
    }
    if (g.examples) {
      sections.push({ key: 'pci-examples', title: 'Examples', content: g.examples });
    }
    if (g.further_information) {
      sections.push({ key: 'pci-further-information', title: 'Further Information', content: g.further_information });
    }
  }

  if (isSTIGControl(control)) {
    sections.push({ key: 'stig-check-content', title: 'Check Content', content: control.check_content });
    sections.push({ key: 'stig-fix-text', title: 'Fix Text', content: control.fix_text });
  }

  if (isAIRMFControl(control)) {
    if (control.about) {
      sections.push({ key: 'airmf-about', title: 'About', content: control.about });
    }
    if (control.suggested_actions) {
      sections.push({ key: 'airmf-suggested-actions', title: 'Suggested Actions', content: control.suggested_actions });
    }
  }

  if (isNIST171Control(control) && control.discussion) {
    sections.push({ key: 'nist171-discussion', title: 'Discussion', content: control.discussion });
  }

  return sections;
}

// The five PCI guidance parts, in display order (used to group them into a
// single "Guidance" section in the comparison view)
export const PCI_GUIDANCE_KEYS = [
  'pci-purpose',
  'pci-good-practice',
  'pci-definitions',
  'pci-examples',
  'pci-further-information',
] as const;
