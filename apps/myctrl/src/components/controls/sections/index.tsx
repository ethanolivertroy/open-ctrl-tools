import type { Control } from '@/data/types';
import {
  isNistControl,
  isPciControl,
  isOWASPLLMRisk,
  isFedRampKSIControl,
  isFedRAMPControl,
  isDoDSRGControl,
  isISO27001Control,
  isNistCSFControl,
  isSTIGControl,
  isAIRMFControl,
  isEUAIActControl,
  isITSG33Control,
  isSSDFControl,
  isNIST171Control,
  isAdobeCCFControl,
  isGovRAMPControl,
  isAIUCControl,
} from '@/data/types';
import { PciCustomizedApproachObjective, PciSections } from './PciSections';
import { IsoCsfMappings, CsfInformativeReferences } from './IsoSections';
import { FedRampBaselineTabs, FedRampDiscussion, GovRampDiscussion } from './FedRampSections';
import { Itsg33GuidanceSections, Itsg33ProfileParameters } from './Itsg33Sections';
import { Nist171Sections } from './Nist171Sections';
import { DodSrgSections } from './DodSrgSections';
import { StigSections } from './StigSections';
import { AiRmfSections } from './AiRmfSections';
import { EuAiActSections } from './EuAiActSections';
import { AiucSections } from './AiucSections';
import { SsdfPracticeSections, SsdfReferences } from './SsdfSections';
import { OwaspSections } from './OwaspSections';
import { NistEnhancements, NistSupplementalGuidance } from './NistSections';
import { AdobeCcfSections } from './AdobeCcfSections';
import { KsiDefinedTerms, KsiExtras, KsiUpdateHistory } from './KsiSections';

export { FrameworkHeaderBadges } from './HeaderBadges';
export { CrosswalkMappings } from './CrosswalkMappings';

// Framework-specific sections are interleaved with cross-cutting sections
// (kubernetes guidance, crosswalks, cloud implementation, ...) in ControlDetail.
// Each slot corresponds to one insertion point so the original render order is
// preserved exactly.
export type FrameworkSectionSlot =
  | 'pre-description'
  | 'after-description'
  | 'main'
  | 'after-kubernetes'
  | 'after-crosswalk'
  | 'after-cloud'
  | 'after-technologies'
  | 'after-related'
  | 'after-assessment';

interface FrameworkSectionsProps {
  control: Control;
  frameworkId: string;
  slot: FrameworkSectionSlot;
}

export function FrameworkSections({ control, frameworkId, slot }: FrameworkSectionsProps) {
  switch (slot) {
    case 'pre-description':
      return isPciControl(control) ? <PciCustomizedApproachObjective control={control} /> : null;

    case 'after-description':
      return isFedRampKSIControl(control) ? <KsiDefinedTerms control={control} /> : null;

    case 'main':
      return (
        <>
          {isPciControl(control) && <PciSections control={control} />}
          {isISO27001Control(control) && <IsoCsfMappings control={control} />}
          {isFedRAMPControl(control) && <FedRampBaselineTabs control={control} />}
          {isGovRAMPControl(control) && <GovRampDiscussion control={control} />}
          {isFedRAMPControl(control) && <FedRampDiscussion control={control} />}
          {isITSG33Control(control) && <Itsg33GuidanceSections control={control} />}
          {isNIST171Control(control) && <Nist171Sections control={control} />}
          {isITSG33Control(control) && <Itsg33ProfileParameters control={control} />}
          {isDoDSRGControl(control) && <DodSrgSections control={control} />}
          {isSTIGControl(control) && <StigSections control={control} />}
          {isAIRMFControl(control) && <AiRmfSections control={control} />}
          {isEUAIActControl(control) && <EuAiActSections control={control} />}
          {isAIUCControl(control) && <AiucSections control={control} />}
          {isSSDFControl(control) && <SsdfPracticeSections control={control} />}
        </>
      );

    case 'after-kubernetes':
      return (
        <>
          {isSSDFControl(control) && <SsdfReferences control={control} />}
          {isOWASPLLMRisk(control) && <OwaspSections control={control} />}
          {isNistControl(control) && <NistEnhancements control={control} frameworkId={frameworkId} />}
        </>
      );

    case 'after-crosswalk':
      return isNistCSFControl(control) ? <CsfInformativeReferences control={control} /> : null;

    case 'after-cloud':
      return isAdobeCCFControl(control) ? <AdobeCcfSections control={control} /> : null;

    case 'after-technologies':
      return isNistControl(control) ? <NistSupplementalGuidance control={control} /> : null;

    case 'after-related':
      return isFedRampKSIControl(control) ? <KsiExtras control={control} /> : null;

    case 'after-assessment':
      return isFedRampKSIControl(control) ? <KsiUpdateHistory control={control} /> : null;

    default: {
      const _exhaustive: never = slot;
      return _exhaustive;
    }
  }
}
