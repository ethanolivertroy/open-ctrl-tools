import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FormattedSTIGContent } from '../FormattedSTIGContent';
import type { STIGControl } from '@/data/types';
import { ControlSection } from './ControlSection';

export function StigSections({ control }: { control: STIGControl }) {
  return (
    <>
      {/* STIG Check Content */}
      {control.check_content && (
        <ControlSection title="Check Content">
          <Card className="bg-muted/50 border-border py-3">
            <CardContent>
              <FormattedSTIGContent content={control.check_content} type="check" />
            </CardContent>
          </Card>
        </ControlSection>
      )}

      {/* STIG Fix Text */}
      {control.fix_text && (
        <ControlSection title="Remediation">
          <Card className="bg-primary/5 border-primary/20 py-3">
            <CardContent>
              <FormattedSTIGContent content={control.fix_text} type="remediation" />
            </CardContent>
          </Card>
        </ControlSection>
      )}

      {/* STIG CCI References */}
      {control.cci_refs && control.cci_refs.length > 0 && (
        <ControlSection title="CCI References">
          <div className="flex flex-wrap gap-2">
            {control.cci_refs.map((cci) => (
              <a
                key={cci}
                href="https://ncp.nist.gov/checklist/996"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block"
              >
                <Badge variant="secondary" className="font-mono hover:bg-secondary/80 transition-colors">
                  {cci}
                </Badge>
              </a>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Control Correlation Identifiers (CCIs) map STIG findings to NIST 800-53 controls.
          </p>
        </ControlSection>
      )}
    </>
  );
}
