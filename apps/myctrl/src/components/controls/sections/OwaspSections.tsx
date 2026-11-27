import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { OWASPLLMRisk } from '@/data/types';
import { ControlSection } from './ControlSection';

export function OwaspSections({ control }: { control: OWASPLLMRisk }) {
  return (
    <>
      {/* Vulnerability Types (OWASP LLM only) */}
      {control.vulnerability_types && control.vulnerability_types.length > 0 && (
        <ControlSection title="Vulnerability Types">
          <Card className="bg-muted/50 border-border">
            <CardContent>
              <ul className="space-y-3">
                {control.vulnerability_types.map((type, i) => (
                  <li key={i} className="text-sm text-muted-foreground leading-relaxed flex gap-2">
                    <span className="text-primary font-mono shrink-0">{i + 1}.</span>
                    <span>{type}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </ControlSection>
      )}

      {/* Common Impacts (OWASP LLM only) */}
      {control.common_impacts && control.common_impacts.length > 0 && (
        <ControlSection title="Common Impacts">
          <div className="flex flex-wrap gap-2">
            {control.common_impacts.map((impact, i) => (
              <Badge key={i} variant="destructive" className="font-normal">
                {impact}
              </Badge>
            ))}
          </div>
        </ControlSection>
      )}

      {/* Prevention Strategies (OWASP LLM only) */}
      {control.prevention_strategies && control.prevention_strategies.length > 0 && (
        <ControlSection title="Prevention & Mitigation Strategies">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent>
              <ol className="space-y-3">
                {control.prevention_strategies.map((strategy, i) => (
                  <li key={i} className="text-sm text-foreground/90 leading-relaxed flex gap-3">
                    <span className="font-mono text-primary shrink-0 font-semibold">{i + 1}.</span>
                    <span>{strategy}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </ControlSection>
      )}

      {/* Attack Scenarios (OWASP LLM only) */}
      {control.attack_scenarios && control.attack_scenarios.length > 0 && (
        <ControlSection title="Attack Scenarios">
          <div className="space-y-3">
            {control.attack_scenarios.map((scenario, i) => (
              <Card key={i} className="bg-destructive/5 border-destructive/20">
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-destructive text-sm">#{i + 1}</span>
                      <span className="font-semibold text-sm">{scenario.title}</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed pl-6">
                      {scenario.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ControlSection>
      )}

      {/* MITRE ATLAS Mapping (OWASP LLM only) */}
      {control.mitre_atlas && control.mitre_atlas.length > 0 && (
        <ControlSection title="MITRE ATLAS Mapping">
          <div className="flex flex-wrap gap-2">
            {control.mitre_atlas.map((technique, i) => (
              <a
                key={i}
                href={`https://atlas.mitre.org/techniques/${technique}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block"
              >
                <Badge variant="secondary" className="font-mono hover:bg-secondary/80 transition-colors">
                  {technique}
                </Badge>
              </a>
            ))}
          </div>
        </ControlSection>
      )}

      {/* Related CWEs (OWASP only) */}
      {control.related_cwes && control.related_cwes.length > 0 && (
        <ControlSection title="Related CWEs">
          <div className="flex flex-wrap gap-2">
            {control.related_cwes.map((cwe) => (
              <a
                key={cwe}
                href={`https://cwe.mitre.org/data/definitions/${cwe.replace('CWE-', '')}.html`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block"
              >
                <Badge variant="secondary" className="font-mono hover:bg-secondary/80 transition-colors">
                  {cwe}
                </Badge>
              </a>
            ))}
          </div>
        </ControlSection>
      )}

      {/* References (OWASP LLM only) */}
      {control.references && control.references.length > 0 && (
        <ControlSection title="References">
          <Card className="bg-muted/50 border-border">
            <CardContent>
              <ul className="space-y-2">
                {control.references.map((ref, i) => (
                  <li key={i}>
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-2 break-words"
                    >
                      <span className="text-muted-foreground">•</span>
                      {ref.title}
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </ControlSection>
      )}
    </>
  );
}
