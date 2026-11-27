import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { slugify } from '@/data/controls';
import type { SSDFControl } from '@/data/types';
import { ControlSection } from './ControlSection';

// SSDF reference key mappings to display names and our framework IDs
const SSDF_REF_MAPPINGS: Record<string, { displayName: string; frameworkId?: string }> = {
  'SP80053': { displayName: 'SP 800-53', frameworkId: 'nist-800-53-r5' },
  'NISTCSF': { displayName: 'NIST CSF', frameworkId: 'nist-csf-v2' },
  'BSAFSS': { displayName: 'BSA FSS' },
  'BSIMM': { displayName: 'BSIMM' },
  'CNCFSSCP': { displayName: 'CNCF SSCP' },
  'EO14028': { displayName: 'EO 14028' },
  'IDASOAR': { displayName: 'IDA SOAR' },
  'IEC62443': { displayName: 'IEC 62443' },
  'IR8397': { displayName: 'NIST IR 8397' },
  'ISO27034': { displayName: 'ISO 27034' },
  'ISO29147': { displayName: 'ISO 29147' },
  'ISO30111': { displayName: 'ISO 30111' },
  'MSSDL': { displayName: 'Microsoft SDL' },
  'NISTLABEL': { displayName: 'NIST Labels' },
  'NTIASBOM': { displayName: 'NTIA SBOM' },
  'OWASPASVS': { displayName: 'OWASP ASVS' },
  'OWASPMASVS': { displayName: 'OWASP MASVS' },
  'OWASPSAMM': { displayName: 'OWASP SAMM' },
  'OWASPSCVS': { displayName: 'OWASP SCVS' },
  'PCISSLC': { displayName: 'PCI SSLC' },
  'SCAGILE': { displayName: 'SAFECode Agile' },
  'SCFPSSD': { displayName: 'SAFECode FPSSD' },
  'SCSIC': { displayName: 'SAFECode SIC' },
  'SCTPC': { displayName: 'SAFECode TPC' },
  'SCTTM': { displayName: 'SAFECode TTM' },
  'SP800160': { displayName: 'SP 800-160' },
  'SP800161': { displayName: 'SP 800-161' },
  'SP800181': { displayName: 'SP 800-181 (NICE)' },
  'SP800216': { displayName: 'SP 800-216' },
};

// Practice info + implementation examples (rendered before Kubernetes guidance)
export function SsdfPracticeSections({ control }: { control: SSDFControl }) {
  return (
    <>
      {/* SSDF Practice Info */}
      <ControlSection title={`Practice: ${control.practice_id}`}>
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="space-y-3">
            <h3 className="font-semibold text-foreground">{control.practice_name}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {control.practice_description}
            </p>
          </CardContent>
        </Card>
      </ControlSection>

      {/* SSDF Implementation Examples */}
      {control.implementation_examples && control.implementation_examples.length > 0 && (
        <ControlSection title="Notional Implementation Examples">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent>
              <ol className="space-y-3">
                {control.implementation_examples.map((example, i) => (
                  <li key={i} className="text-sm text-foreground/90 leading-relaxed flex gap-3">
                    <span className="font-mono text-primary shrink-0 font-semibold">{i + 1}.</span>
                    <span>{example}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </ControlSection>
      )}
    </>
  );
}

// SSDF Cross-Framework References (rendered after Kubernetes guidance)
export function SsdfReferences({ control }: { control: SSDFControl }) {
  if (!control.references || Object.keys(control.references).length === 0) return null;

  return (
    <ControlSection title="Cross-Framework References">
      <p className="text-xs text-muted-foreground">
        Mappings to related frameworks and standards from{' '}
        <a
          href="https://csrc.nist.gov/pubs/sp/800/218/final"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary/70 hover:text-primary hover:underline"
        >
          NIST SP 800-218
        </a>
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(control.references).map(([framework, refs]) => {
          const mapping = SSDF_REF_MAPPINGS[framework];
          const displayName = mapping?.displayName || framework;
          const linkedFrameworkId = mapping?.frameworkId;

          return (
            <div key={framework} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">{displayName}</h3>
              <div className="flex flex-wrap gap-1">
                {refs.slice(0, 8).map((ref) => (
                  linkedFrameworkId ? (
                    <a
                      key={ref}
                      href={`/frameworks/${linkedFrameworkId}/${slugify(ref)}`}
                      className="inline-block"
                    >
                      <Badge
                        variant="outline"
                        className="text-xs font-mono hover:bg-secondary/80 transition-colors"
                      >
                        {ref}
                      </Badge>
                    </a>
                  ) : (
                    <Badge
                      key={ref}
                      variant="outline"
                      className="text-xs font-mono"
                    >
                      {ref}
                    </Badge>
                  )
                ))}
                {refs.length > 8 && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    +{refs.length - 8} more
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ControlSection>
  );
}
