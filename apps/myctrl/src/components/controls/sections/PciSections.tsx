import { Card, CardContent } from '@/components/ui/card';
import type { PciControl } from '@/data/types';
import { ControlSection } from './ControlSection';
import { GuidanceSection } from './shared';

// Rendered above the Control Description section
export function PciCustomizedApproachObjective({ control }: { control: PciControl }) {
  if (!control.customized_approach_objective) return null;
  return (
    <ControlSection title="Customized Approach Objective">
      <Card className="bg-primary/5 border-primary/20">
        <CardContent>
          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {control.customized_approach_objective}
          </p>
        </CardContent>
      </Card>
    </ControlSection>
  );
}

export function PciSections({ control }: { control: PciControl }) {
  return (
    <>
      {/* Applicability Notes (PCI-DSS only) */}
      {control.applicability_notes && (
        <ControlSection title="Applicability Notes">
          <Card className="bg-muted/30 border-border">
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {control.applicability_notes}
              </p>
            </CardContent>
          </Card>
        </ControlSection>
      )}

      {/* Testing Procedures (PCI-DSS only) */}
      {control.testing_procedures && control.testing_procedures.length > 0 && (
        <ControlSection title="Testing Procedures">
          <div className="space-y-3">
            {control.testing_procedures.map((proc) => (
              <Card key={proc.id} className="bg-muted/50 border-border">
                <CardContent>
                  <div className="flex gap-3">
                    <span className="font-mono text-primary text-sm shrink-0">{proc.id}</span>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {proc.text}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ControlSection>
      )}

      {/* Guidance (PCI-DSS only) - Structured */}
      {control.guidance && (
        <ControlSection title="Guidance">
          <Card className="bg-muted/50 border-border">
            <CardContent className="space-y-6">
              <GuidanceSection title="Purpose" content={control.guidance.purpose} />
              <GuidanceSection title="Good Practice" content={control.guidance.good_practice} />
              <GuidanceSection title="Definitions" content={control.guidance.definitions} />
              <GuidanceSection title="Examples" content={control.guidance.examples} />
              <GuidanceSection title="Further Information" content={control.guidance.further_information} />
            </CardContent>
          </Card>
        </ControlSection>
      )}
    </>
  );
}
