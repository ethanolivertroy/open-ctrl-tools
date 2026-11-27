import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { EUAIActControl } from '@/data/types';
import { SectionHeading } from './ControlSection';

// EU AI Act Risk Tier and Details
export function EuAiActSections({ control }: { control: EUAIActControl }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center">
        {/* Risk Tier Badge */}
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-muted-foreground">Risk Tier</h2>
          <Badge
            variant={
              control.risk_tier === 'prohibited' ? 'destructive' :
              control.risk_tier === 'high-risk' ? 'default' :
              control.risk_tier === 'limited-risk' ? 'secondary' :
              control.risk_tier === 'gpai' ? 'outline' :
              'secondary'
            }
            className={`text-sm ${
              control.risk_tier === 'prohibited' ? 'bg-red-600 hover:bg-red-700' :
              control.risk_tier === 'high-risk' ? 'bg-amber-600 hover:bg-amber-700' :
              control.risk_tier === 'gpai' ? 'bg-purple-600 hover:bg-purple-700 text-white' :
              ''
            }`}
          >
            {control.risk_tier === 'prohibited' ? 'Prohibited' :
             control.risk_tier === 'high-risk' ? 'High-Risk' :
             control.risk_tier === 'limited-risk' ? 'Limited-Risk' :
             control.risk_tier === 'gpai' ? 'GPAI' :
             'Minimal-Risk'}
          </Badge>
        </div>

        {/* Article Reference */}
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-muted-foreground">Article</h2>
          <span className="text-sm font-mono">Art. {control.article}</span>
        </div>

        {/* Compliance Deadline */}
        {control.deadline && (
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-muted-foreground">Deadline</h2>
            <span className="text-sm">{control.deadline}</span>
          </div>
        )}

        {/* Penalty Tier */}
        {control.penalty_tier && (
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-muted-foreground">Penalty</h2>
            <span className="text-sm text-destructive">{control.penalty_tier}</span>
          </div>
        )}
      </div>

      {/* Applies To */}
      {control.applies_to && control.applies_to.length > 0 && (
        <div className="space-y-2">
          <SectionHeading>Applies To</SectionHeading>
          <div className="flex flex-wrap gap-2">
            {control.applies_to.map((role, i) => (
              <Badge key={i} variant="outline" className="font-normal capitalize">
                {role}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Key Requirements */}
      {control.key_requirements && control.key_requirements.length > 0 && (
        <div className="space-y-2">
          <SectionHeading>Key Requirements</SectionHeading>
          <Card className="bg-muted/50 border-border">
            <CardContent>
              <ul className="space-y-2">
                {control.key_requirements.map((req, i) => (
                  <li key={i} className="text-sm text-muted-foreground leading-relaxed flex gap-2">
                    <span className="text-primary shrink-0">•</span>
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Use Cases (for high-risk) */}
      {control.use_cases && control.use_cases.length > 0 && (
        <div className="space-y-2">
          <SectionHeading>Applicable Use Cases</SectionHeading>
          <div className="flex flex-wrap gap-2">
            {control.use_cases.map((useCase, i) => (
              <Badge key={i} variant="secondary" className="font-normal">
                {useCase}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
