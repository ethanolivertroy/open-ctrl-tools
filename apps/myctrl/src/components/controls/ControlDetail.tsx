import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CloudImplementation } from './CloudImplementation';
import { FormattedDescription } from './FormattedDescription';
import { slugify, getFrameworkConfig, getBasePath, getFamilyName, type ControlNeighbors } from '@/data/controls';
import { ControlNavFooter } from './ControlNavFooter';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import {
  getNavigationScope,
  setNavigationScope,
  getParameterOverrideEnabled,
  setParameterOverrideEnabled,
} from '@/lib/storage/settings-store';
import { substituteParameters, getBestBaselineParams } from '@/lib/fedramp-param-substitution';
import { getCloudImplementation } from '@/data/cloud-implementations';
import { getTechnologiesForControl, getTechnologyPath } from '@/data/technology-guides';
import type { Control } from '@/data/types';
import { AskAISection } from '@/components/ai/AskAISection';
import {
  isNistControl,
  isPciControl,
  isFedRampKSIControl,
  isFedRAMPControl,
  isDoDSRGControl,
} from '@/data/types';
import { FrameworkSections, FrameworkHeaderBadges, CrosswalkMappings } from './sections';
import { ControlSection, SectionHeading } from './sections/ControlSection';
import { KubernetesGuidanceSection, KubernetesExamplesSection } from './sections/shared';

interface ControlDetailProps {
  control: Control;
  frameworkId: string;
  neighbors?: ControlNeighbors;
}

export function ControlDetail({ control, frameworkId, neighbors }: ControlDetailProps) {
  const config = getFrameworkConfig(frameworkId);
  const basePath = getBasePath(frameworkId);

  // Swipe navigation — scope is shared with ControlNavFooter
  const [navScope, setNavScope] = useState<'all' | 'family'>('all');

  useEffect(() => {
    getNavigationScope().then(setNavScope);
  }, []);

  const handleScopeChange = (newScope: 'all' | 'family') => {
    setNavScope(newScope);
    setNavigationScope(newScope);
  };

  // FedRAMP parameter override toggle
  const [paramOverride, setParamOverride] = useState(false);

  useEffect(() => {
    if (isFedRAMPControl(control)) {
      getParameterOverrideEnabled().then(setParamOverride);
    }
  }, [control]);

  const handleParamOverrideChange = (enabled: boolean) => {
    setParamOverride(enabled);
    setParameterOverrideEnabled(enabled);
  };

  const prevUrl = neighbors
    ? (navScope === 'family' ? neighbors.prevFamily?.url : neighbors.prev?.url) ?? null
    : null;
  const nextUrl = neighbors
    ? (navScope === 'family' ? neighbors.nextFamily?.url : neighbors.next?.url) ?? null
    : null;

  const { bind } = useSwipeNavigation({ prevUrl, nextUrl });

  return (
    <article className="space-y-8" {...bind()} style={{ touchAction: 'pan-y' }}>
      {/* Header */}
      <header className="space-y-4">
        <nav className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground flex-wrap">
          <a href="/" className="hover:text-foreground transition-colors">Home</a>
          <span>/</span>
          <a href={`${basePath}/${frameworkId}`} className="hover:text-foreground transition-colors">
            {config.name}
          </a>
          <span>/</span>
          <a
            href={
              basePath === '/risk-lists'
                ? `${basePath}/${frameworkId}#${control.family.toLowerCase()}`
                : `${basePath}/${frameworkId}/family/${control.family.toLowerCase()}`
            }
            className="hover:text-foreground transition-colors"
          >
            {control.family} — {getFamilyName(frameworkId, control.family)}
          </a>
          <span>/</span>
          {/* Show section for PCI-DSS */}
          {isPciControl(control) && control.section && (
            <>
              <span className="font-mono text-muted-foreground">
                {control.section}
              </span>
              <span>/</span>
            </>
          )}
          <span className="font-mono text-primary">{control.control_id}</span>
        </nav>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          <span className="font-mono text-primary">{control.control_id}</span>
          <span className="mx-3 text-muted-foreground">—</span>
          <span>{control.title}</span>
        </h1>

        <FrameworkHeaderBadges control={control} />
      </header>

      {/* Customized Approach Objective (PCI-DSS only) */}
      <FrameworkSections control={control} frameworkId={frameworkId} slot="pre-description" />

      {/* Description */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <SectionHeading>
            {config.id === 'pci-dss-v4' ? 'Requirement Description' : 'Control Description'}
          </SectionHeading>
          {isFedRAMPControl(control) && (() => {
            const bestBaseline = getBestBaselineParams(control.baselines);
            if (!bestBaseline) return null;
            return (
              <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
                <span className="text-xs text-muted-foreground hidden sm:inline">Apply FedRAMP parameters</span>
                <span className="text-xs text-muted-foreground sm:hidden">FedRAMP params</span>
                <button
                  role="switch"
                  aria-checked={paramOverride}
                  onClick={() => handleParamOverrideChange(!paramOverride)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    paramOverride
                      ? 'bg-emerald-500'
                      : 'bg-muted-foreground/30'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                      paramOverride ? 'translate-x-[18px]' : 'translate-x-[3px]'
                    }`}
                  />
                </button>
              </label>
            );
          })()}
        </div>
        {(() => {
          if (paramOverride && isFedRAMPControl(control)) {
            const bestBaseline = getBestBaselineParams(control.baselines);
            if (bestBaseline) {
              const substituted = substituteParameters(
                control.description,
                bestBaseline.params,
                control.control_id,
              );
              return (
                <>
                  <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                    Showing {bestBaseline.level} baseline parameter values
                  </div>
                  <FormattedDescription description={substituted} />
                </>
              );
            }
          }
          return <FormattedDescription description={control.description} />;
        })()}
      </section>

      {/* Defined Terms (FedRAMP 20x KSI only) */}
      <FrameworkSections control={control} frameworkId={frameworkId} slot="after-description" />

      {/* Framework-specific sections (guidance, baseline tabs, discussions, ...) */}
      <FrameworkSections control={control} frameworkId={frameworkId} slot="main" />

      {/* NIST/DoD/FedRAMP Kubernetes Implementation Guidance (preferred) */}
      {(isNistControl(control) || isDoDSRGControl(control) || isFedRAMPControl(control)) &&
       'kubernetes_guidance' in control &&
       control.kubernetes_guidance && (
        <ControlSection title="Kubernetes Implementation Guidance">
          <KubernetesGuidanceSection guidance={control.kubernetes_guidance} />
        </ControlSection>
      )}

      {/* NIST/DoD/FedRAMP Kubernetes Implementation Examples (legacy fallback) */}
      {(isNistControl(control) || isDoDSRGControl(control) || isFedRAMPControl(control)) &&
       !('kubernetes_guidance' in control && control.kubernetes_guidance) &&
       'kubernetes_examples' in control &&
       control.kubernetes_examples &&
       control.kubernetes_examples.length > 0 && (
        <ControlSection title="Kubernetes Implementation Examples">
          <KubernetesExamplesSection examples={control.kubernetes_examples} />
        </ControlSection>
      )}

      {/* SSDF references, OWASP sections, NIST enhancements */}
      <FrameworkSections control={control} frameworkId={frameworkId} slot="after-kubernetes" />

      {/* Cross-Framework Mappings */}
      <CrosswalkMappings control={control} frameworkId={frameworkId} />

      {/* Informative References (NIST CSF 2.0 only) */}
      <FrameworkSections control={control} frameworkId={frameworkId} slot="after-crosswalk" />

      {/* Cloud Implementation / Programmatic Queries (NIST, FedRAMP Rev 5, DoD SRG) */}
      {(isNistControl(control) || isFedRAMPControl(control) || isDoDSRGControl(control)) && (() => {
        const cloudImpl = getCloudImplementation(control.control_id);
        return cloudImpl ? (
          <section className="space-y-4">
            <CloudImplementation implementation={cloudImpl} />
          </section>
        ) : null;
      })()}

      {/* Adobe CCF sections */}
      <FrameworkSections control={control} frameworkId={frameworkId} slot="after-cloud" />

      {/* Relevant Technologies */}
      {(() => {
        const techGuides = getTechnologiesForControl(control.control_id, frameworkId);
        if (techGuides.length === 0) return null;

        return (
          <ControlSection title="Relevant Technologies">
            <p className="text-sm text-muted-foreground">
              Technology-specific guidance with authoritative sources and verification commands.
            </p>
            <div className="flex flex-wrap gap-2">
              {techGuides.map((tech) => (
                <a
                  key={tech.id}
                  href={getTechnologyPath(tech)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted/50 hover:border-primary/50 transition-all"
                >
                  <span className="text-sm font-medium">{tech.name}</span>
                  <svg
                    className="w-3.5 h-3.5 text-muted-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </a>
              ))}
            </div>
          </ControlSection>
        );
      })()}

      {/* Supplemental Guidance (NIST only) */}
      <FrameworkSections control={control} frameworkId={frameworkId} slot="after-technologies" />

      {/* Related Controls */}
      {control.related_controls && control.related_controls.length > 0 && (
        <ControlSection
          title={frameworkId === 'fedramp-20x-ksi'
            ? 'NIST 800-53 Controls'
            : `Related ${config.id === 'pci-dss-v4' ? 'Requirements' : 'Controls'}`}
        >
          <div className="flex flex-wrap gap-2">
            {control.related_controls.map((relatedId) => {
              // FedRAMP KSI links to NIST 800-53 controls
              const linkPath = frameworkId === 'fedramp-20x-ksi'
                ? `/frameworks/nist-800-53-r5/${slugify(relatedId)}`
                : `${basePath}/${frameworkId}/${slugify(relatedId)}`;

              return (
                <a
                  key={relatedId}
                  href={linkPath}
                  className="inline-block"
                >
                  <Badge variant="outline" className="font-mono hover:bg-muted transition-colors uppercase">
                    {relatedId}
                  </Badge>
                </a>
              );
            })}
          </div>
        </ControlSection>
      )}

      {/* FRMR requirements, Trust Center, and programmatic queries (FedRAMP 20x KSI only) */}
      <FrameworkSections control={control} frameworkId={frameworkId} slot="after-related" />

      {/* Assessment Interview Topics */}
      {control.assessment_questions && control.assessment_questions.length > 0 && (
        <ControlSection
          title={isFedRampKSIControl(control) ? '20x Assessment Focus Areas' : 'Assessment Interview Topics'}
        >
          <p className="text-sm text-muted-foreground">
            {isFedRampKSIControl(control) ? 'Aligned with FedRAMP 20x Phase Two assessment methodology' : 'Questions assessors commonly ask'}
          </p>
          <Card className="bg-amber-500/5 border-amber-500/20">
            <CardContent className="space-y-6">
              {control.assessment_questions.map((group) => (
                <div key={group.category}>
                  <h3 className="font-semibold text-sm mb-2">{group.category}:</h3>
                  <ul className="space-y-2 ml-1">
                    {group.questions.map((q, j) => (
                      <li key={j} className="text-sm text-foreground/90 flex gap-2">
                        <span className="text-amber-600 dark:text-amber-400 shrink-0">•</span>
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        </ControlSection>
      )}

      {/* Update History (FedRAMP 20x KSI only) */}
      <FrameworkSections control={control} frameworkId={frameworkId} slot="after-assessment" />

      {/* Ask AI Section */}
      <AskAISection
        frameworkId={frameworkId}
        controlId={control.control_id}
        quickQuestions={frameworkId === 'fedramp-20x-ksi' ? [
          `Show assessment focus areas and CLI commands for ${control.control_id}`,
          `Generate a trust center layout for ${control.control_id}`,
          `How does ${control.control_id} map to NIST 800-53 controls?`,
        ] : [
          'How does this control map to other frameworks?',
          'What evidence is needed for compliance?',
          'Show related controls across frameworks',
        ]}
      />

      {/* Footer navigation */}
      {neighbors ? (
        <ControlNavFooter
          neighbors={neighbors}
          frameworkId={frameworkId}
          family={control.family}
          familyLabel={config.familyLabel}
          basePath={basePath}
          controlTerm={config.id === 'pci-dss-v4' ? 'requirements' : 'controls'}
          scope={navScope}
          onScopeChange={handleScopeChange}
        />
      ) : (
        <footer className="pt-8 border-t border-border">
          <div className="flex items-center justify-between text-sm">
            <a
              href={`${basePath}/${frameworkId}`}
              className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
            >
              <span>←</span>
              <span>Back to all {config.id === 'pci-dss-v4' ? 'requirements' : 'controls'}</span>
            </a>
            <span className="text-muted-foreground font-mono text-xs">
              {config.familyLabel} {control.family}
            </span>
          </div>
        </footer>
      )}
    </article>
  );
}
