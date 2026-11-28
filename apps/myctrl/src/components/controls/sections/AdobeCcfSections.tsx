import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { slugifyControlId as slugify } from '@/lib/slugify';
import { getFrameworkConfig } from '@/data/framework-configs';
import type { AdobeCCFControl } from '@/data/types';
import { ControlSection } from './ControlSection';

export function AdobeCcfSections({ control }: { control: AdobeCCFControl }) {
  return (
    <>
      {/* Adobe CCF Control Metadata */}
      {(control.control_theme || control.control_type || control.policy_standard) && (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Control Theme */}
            {control.control_theme && (
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-muted-foreground">Theme</h2>
                <Badge variant="outline" className="text-xs">
                  {control.control_theme}
                </Badge>
              </div>
            )}

            {/* Control Type */}
            {control.control_type && (
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-muted-foreground">Type</h2>
                <Badge
                  variant={
                    control.control_type === 'Preventive' ? 'default' :
                    control.control_type === 'Detective' ? 'secondary' :
                    'outline'
                  }
                  className={`text-xs ${
                    control.control_type === 'Preventive' ? 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30' :
                    control.control_type === 'Detective' ? 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30' :
                    control.control_type === 'Corrective' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30' :
                    ''
                  }`}
                >
                  {control.control_type}
                </Badge>
              </div>
            )}

            {/* Policy/Standard */}
            {control.policy_standard && (
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-muted-foreground">Policy/Standard</h2>
                <span className="text-sm">{control.policy_standard}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Adobe CCF Implementation Guidance */}
      {control.implementation_guidance && (
        <ControlSection title="Implementation Guidance">
          <Card className="bg-green-500/5 border-green-500/20">
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {control.implementation_guidance}
              </p>
            </CardContent>
          </Card>
        </ControlSection>
      )}

      {/* Adobe CCF Testing Procedure */}
      {control.testing_procedure && (
        <ControlSection title="Testing Procedure">
          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {control.testing_procedure}
              </p>
            </CardContent>
          </Card>
        </ControlSection>
      )}

      {/* Adobe CCF Audit Artifacts */}
      {control.audit_artifacts && control.audit_artifacts.length > 0 && (
        <ControlSection title="Audit Artifacts">
          <div className="flex flex-wrap gap-2">
            {control.audit_artifacts.map((artifact, i) => (
              <Badge key={i} variant="outline" className="font-mono text-xs">
                {artifact}
              </Badge>
            ))}
          </div>
        </ControlSection>
      )}

      {/* Adobe CCF Framework Mappings - Attribution: Adobe CCF Open Source (Creative Commons) */}
      {control.mappings && Object.keys(control.mappings).length > 0 && (
        <ControlSection title="Framework Mappings">
          <p className="text-xs text-muted-foreground">
            Cross-framework mappings provided by{' '}
            <a
              href="https://www.adobe.com/trust/compliance/adobe-ccf.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary/70 hover:text-primary hover:underline"
            >
              Adobe CCF Open Source
            </a>
            {' '}under{' '}
            <a
              href="https://creativecommons.org/licenses/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary/70 hover:text-primary hover:underline"
            >
              Creative Commons License
            </a>
            .
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(control.mappings).map(([fwId, refs]) => {
              // Safely get framework config - may not exist for all mapped frameworks
              let fwConfig;
              try { fwConfig = getFrameworkConfig(fwId); } catch { fwConfig = null; }
              const fwName = fwConfig?.name || fwId;
              return (
                <div key={fwId} className="rounded-lg border border-border bg-card p-3 space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    {fwConfig ? (
                      <a
                        href={`/frameworks/${fwId}`}
                        className="hover:text-primary hover:underline"
                      >
                        {fwName}
                      </a>
                    ) : (
                      fwName
                    )}
                    <Badge variant="outline" className="text-xs font-normal">
                      {refs.length}
                    </Badge>
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {refs.slice(0, 6).map((ref) => {
                      const href = fwConfig ? `/frameworks/${fwId}/${slugify(ref)}` : null;
                      const badge = (
                        <Badge
                          key={ref}
                          variant="secondary"
                          className="text-xs font-mono hover:bg-secondary/80 transition-colors"
                        >
                          {ref}
                        </Badge>
                      );
                      return href ? (
                        <a key={ref} href={href} className="inline-block">
                          {badge}
                        </a>
                      ) : (
                        badge
                      );
                    })}
                    {refs.length > 6 && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        +{refs.length - 6} more
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ControlSection>
      )}
    </>
  );
}
