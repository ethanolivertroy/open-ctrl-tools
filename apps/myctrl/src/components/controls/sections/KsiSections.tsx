import { Badge } from '@/components/ui/badge';
import { TermPopover } from '@/components/ui/term-popover';
import { getTermDefinition } from '@/data/fedramp-20x-glossary';
import { getKSIRequirements } from '@/data/fedramp-20x-requirements';
import { getTrustCenterComponents, getImplementationInsight } from '@/data/ksi-trust-center-components';
import { getKSIProgrammaticQueries } from '@/data/ksi-programmatic-queries';
import { TrustCenterComponents } from '../TrustCenterComponents';
import { KSIProgrammaticQueries } from '../KSIProgrammaticQueries';
import { KSIRequirements } from '../KSIRequirements';
import type { FedRampKSIControl } from '@/data/types';

// Defined Terms (FedRAMP 20x KSI only) — rendered directly after the Description section
export function KsiDefinedTerms({ control }: { control: FedRampKSIControl }) {
  if (!control.terms || control.terms.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">Defined terms:</span>
      {control.terms.map((term) => {
        const definition = getTermDefinition(term);
        return definition ? (
          <TermPopover key={term} term={definition}>{term}</TermPopover>
        ) : (
          <Badge key={term} variant="outline" className="text-xs font-normal">
            {term}
          </Badge>
        );
      })}
    </div>
  );
}

// FRMR requirements, trust center components, and programmatic queries
// (FedRAMP 20x KSI only) — rendered after the Related Controls section
export function KsiExtras({ control }: { control: FedRampKSIControl }) {
  const requirements = getKSIRequirements(control.control_id);
  const trustCenterComponents = getTrustCenterComponents(control.control_id);
  const insight = getImplementationInsight(control.control_id);
  const queries = getKSIProgrammaticQueries(control.control_id);

  return (
    <>
      {requirements ? <KSIRequirements requirements={requirements} /> : null}
      {trustCenterComponents ? (
        <TrustCenterComponents components={trustCenterComponents} implementationInsight={insight} />
      ) : null}
      {queries ? <KSIProgrammaticQueries queries={queries} /> : null}
    </>
  );
}

// Update History (FedRAMP 20x KSI only) — rendered after Assessment Interview Topics
export function KsiUpdateHistory({ control }: { control: FedRampKSIControl }) {
  if (!control.updated || control.updated.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">Update History</h2>
      <div className="space-y-1">
        {control.updated.map((entry, i) => (
          <div key={i} className="flex gap-3 text-xs text-muted-foreground">
            <span className="font-mono shrink-0">{entry.date}</span>
            <span>{entry.comment}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
