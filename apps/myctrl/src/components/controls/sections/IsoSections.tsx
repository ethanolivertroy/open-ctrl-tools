import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { slugifyControlId as slugify } from '@/lib/slugify';
import type { ISO27001Control, NistCSFControl } from '@/data/types';
import { ControlSection } from './ControlSection';

// NIST CSF 2.0 Mappings (ISO 27001 only)
export function IsoCsfMappings({ control }: { control: ISO27001Control }) {
  if (!control.csf_mappings || control.csf_mappings.filter(csf => csf.includes('-')).length === 0) {
    return null;
  }

  return (
    <ControlSection title="NIST CSF 2.0 Mappings">
      <Card className="bg-muted/50 border-border">
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {control.csf_mappings
              .filter((csf) => csf.includes('-'))  // Only subcategories (GV.OV-01), not categories (GV, GV.OV)
              .map((csf) => (
                <a
                  key={csf}
                  href={`/frameworks/nist-csf-v2/${slugify(csf)}`}
                  className="px-2 py-1 text-xs font-mono rounded border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  {csf}
                </a>
              ))}
          </div>
          <p className="text-xs text-muted-foreground/70 italic">
            Control mappings sourced from{' '}
            <a
              href="https://csrc.nist.gov/projects/olir/informative-reference-catalog/details?referenceId=154"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              NIST OLIR Catalog
            </a>{' '}
            (public domain).
          </p>
        </CardContent>
      </Card>
    </ControlSection>
  );
}

// Informative References (NIST CSF 2.0 only) — rendered after the Cross-Framework Mappings section
export function CsfInformativeReferences({ control }: { control: NistCSFControl }) {
  if (!control.informative_references || control.informative_references.length === 0) return null;

  return (
    <ControlSection title="Informative References">
      <p className="text-xs text-muted-foreground">
        Official NIST mappings to external frameworks and standards.{' '}
        <a
          href="https://www.nist.gov/cyberframework"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary/70 hover:text-primary hover:underline"
        >
          Source: NIST CSF 2.0
        </a>
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {control.informative_references.map((ref) => (
          <div key={ref.framework} className="rounded-lg border border-border bg-card p-3 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">{ref.framework}</h3>
            <div className="flex flex-wrap gap-1">
              {ref.controls.slice(0, 8).map((ctrl) => (
                <Badge
                  key={ctrl}
                  variant="outline"
                  className="text-xs font-mono"
                >
                  {ctrl}
                </Badge>
              ))}
              {ref.controls.length > 8 && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  +{ref.controls.length - 8} more
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </ControlSection>
  );
}
