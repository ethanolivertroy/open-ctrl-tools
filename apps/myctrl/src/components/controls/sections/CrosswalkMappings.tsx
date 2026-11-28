import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { CompareButton } from '@/components/controls/CompareButton';
import { getFrameworkConfig } from '@/data/framework-configs';
import {
  getCrossFrameworkMappingsFromIndex,
  loadCrosswalkIndex,
  loadFrameworkManifest,
  type CrossFrameworkMapping,
} from '@/lib/client-framework-data';
import { slugifyControlId as slugify } from '@/lib/slugify';
import type { Control } from '@/data/types';
import { ControlSection } from './ControlSection';

interface CrosswalkMappingsProps {
  control: Control;
  frameworkId: string;
  initialMappings?: CrossFrameworkMapping[];
  loadedFrameworkIds?: string[];
}

// Cross-Framework Mappings — cross-cutting section shown for any control with crosswalk data
export function CrosswalkMappings({
  control,
  frameworkId,
  initialMappings,
  loadedFrameworkIds,
}: CrosswalkMappingsProps) {
  const config = getFrameworkConfig(frameworkId);
  const [showDerived, setShowDerived] = useState(false);
  const [allMappings, setAllMappings] = useState<CrossFrameworkMapping[]>(
    () => initialMappings ?? [],
  );
  const [loadedSet, setLoadedSet] = useState<Set<string>>(
    () => new Set(loadedFrameworkIds ?? []),
  );

  useEffect(() => {
    if (initialMappings && loadedFrameworkIds) {
      setAllMappings(initialMappings);
      setLoadedSet(new Set(loadedFrameworkIds));
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const [index, manifest] = await Promise.all([
          loadCrosswalkIndex(),
          loadFrameworkManifest(),
        ]);
        if (cancelled) return;
        setLoadedSet(new Set(manifest.loadedIds));
        if (!initialMappings) {
          setAllMappings(
            getCrossFrameworkMappingsFromIndex({
              index,
              controlId: control.control_id,
              frameworkId,
            }),
          );
        }
      } catch {
        // Keep initial mappings on fetch failure.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [control.control_id, frameworkId, initialMappings, loadedFrameworkIds]);

  if (allMappings.length === 0) return null;

  const directMappings = allMappings.filter(m => !m.derived);
  const derivedMappings = allMappings.filter(m => m.derived);
  // If there are no direct mappings, lead with the derived ones instead of an empty section
  const mappings = directMappings.length > 0 ? directMappings : derivedMappings.slice(0, 5);
  const collapsedDerived: CrossFrameworkMapping[] = directMappings.length > 0
    ? derivedMappings
    : derivedMappings.slice(5);

  // Get source attribution for each crosswalk
  const getCrosswalkSource = (mappedFrameworkId: string, currentFrameworkId: string) => {
    // CSF mappings to other frameworks
    if (currentFrameworkId === 'nist-csf-v2') {
      if (mappedFrameworkId === 'nist-800-53-r5') {
        return {
          name: 'NIST CSF 2.0 Concept Crosswalk',
          url: 'https://csrc.nist.gov/projects/olir/informative-reference-catalog/details?referenceId=186',
        };
      }
      if (mappedFrameworkId === 'pci-dss-v4') {
        return {
          name: 'NIST OLIR Catalog',
          url: 'https://csrc.nist.gov/projects/olir/informative-reference-catalog/details?referenceId=183',
        };
      }
      if (mappedFrameworkId === 'iso-27001-2022') {
        return {
          name: 'NIST OLIR Catalog',
          url: 'https://csrc.nist.gov/projects/olir/informative-reference-catalog/details?referenceId=154',
        };
      }
    }
    // SOC 2 TSC mappings
    if (currentFrameworkId === 'soc2-tsc') {
      return {
        name: 'AICPA TSC mapping structure',
        url: 'https://www.nist.gov/itl/applied-cybersecurity/privacy-engineering/american-institute-certified-public-accountants-aicpa',
      };
    }
    // ISO 27001 to SOC 2
    if (currentFrameworkId === 'iso-27001-2022' && mappedFrameworkId === 'soc2-tsc') {
      return {
        name: 'AICPA TSC mapping structure',
        url: 'https://www.nist.gov/itl/applied-cybersecurity/privacy-engineering/american-institute-certified-public-accountants-aicpa',
      };
    }
    // Other frameworks mapping back to CSF
    if (mappedFrameworkId === 'nist-csf-v2') {
      if (currentFrameworkId === 'nist-800-53-r5') {
        return {
          name: 'NIST CSF 2.0 Concept Crosswalk',
          url: 'https://csrc.nist.gov/projects/olir/informative-reference-catalog/details?referenceId=186',
        };
      }
      if (currentFrameworkId === 'pci-dss-v4') {
        return {
          name: 'NIST OLIR Catalog',
          url: 'https://csrc.nist.gov/projects/olir/informative-reference-catalog/details?referenceId=183',
        };
      }
    }
    // STIG mappings to NIST 800-53 via CCI
    if (mappedFrameworkId === 'nist-800-53-r5' && config.hasSeverityLevels) {
      return {
        name: 'DISA CCI List',
        url: 'https://public.cyber.mil/stigs/cci/',
      };
    }
    // AI RMF crosswalks
    if (currentFrameworkId === 'nist-ai-rmf') {
      if (mappedFrameworkId === 'iso-42001') {
        return {
          name: 'Microsoft/NIST AI RMF to ISO 42001 Crosswalk',
          url: 'https://airc.nist.gov/docs/NIST_AI_RMF_to_ISO_IEC_42001_Crosswalk.pdf',
        };
      }
      if (mappedFrameworkId === 'iso-23894') {
        return {
          name: 'INCITS/AI AI RMF to ISO 23894 Crosswalk',
          url: 'https://airc.nist.gov/docs/AI_RMF_to_ISO_IEC_23894_Crosswalk.pdf',
        };
      }
    }
    // Reverse crosswalks (ISO → AI RMF)
    if (mappedFrameworkId === 'nist-ai-rmf') {
      if (currentFrameworkId === 'iso-42001') {
        return {
          name: 'Microsoft/NIST AI RMF to ISO 42001 Crosswalk',
          url: 'https://airc.nist.gov/docs/NIST_AI_RMF_to_ISO_IEC_42001_Crosswalk.pdf',
        };
      }
      if (currentFrameworkId === 'iso-23894') {
        return {
          name: 'INCITS/AI AI RMF to ISO 23894 Crosswalk',
          url: 'https://airc.nist.gov/docs/AI_RMF_to_ISO_IEC_23894_Crosswalk.pdf',
        };
      }
    }
    return null;
  };

  const renderMapping = ({ frameworkId: mappedFrameworkId, frameworkName, controlIds, derived }: CrossFrameworkMapping) => {
          const source = getCrosswalkSource(mappedFrameworkId, frameworkId);
          return (
            <div key={mappedFrameworkId} className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  {frameworkName}
                </h3>
                {derived && (
                  <span className="text-xs text-muted-foreground/60" title="Derived transitively from published crosswalk mappings">
                    derived
                  </span>
                )}
                {source && (
                  <span className="text-xs text-muted-foreground/60">
                    via{' '}
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary/70 hover:text-primary hover:underline"
                    >
                      {source.name}
                    </a>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {(() => {
                  const targetLoaded = loadedSet.has(mappedFrameworkId);
                  return controlIds.map((controlId) => {
                    // Handle category/family-level mappings that don't have individual control pages
                    let href = targetLoaded
                      ? `/frameworks/${mappedFrameworkId}/${slugify(controlId)}`
                      : `/frameworks/${mappedFrameworkId}`;
                    // AI RMF category-level (e.g., "GOVERN 1" or "GOVERN-1.0" → family page)
                    const isCategoryLevel = mappedFrameworkId === 'nist-ai-rmf' && /^(GOVERN|MAP|MEASURE|MANAGE)[\s-]\d+(\.\d+)?$/.test(controlId);
                    if (targetLoaded && isCategoryLevel) {
                      const family = controlId.split(/[\s-]/)[0].toLowerCase();
                      href = `/frameworks/nist-ai-rmf/family/${family}`;
                    }
                    // NIST 800-53 family-level refs (e.g., "PT", "CP", "IR" → family page)
                    const isNistFamilyLevel = mappedFrameworkId === 'nist-800-53-r5' && /^[A-Z]{2}$/.test(controlId);
                    if (targetLoaded && isNistFamilyLevel) {
                      href = `/frameworks/nist-800-53-r5/family/${controlId.toLowerCase()}`;
                    }
                    // CSF function-level refs (e.g., "GV", "DE") or category-level (e.g., "RS.MA", "RC.RP") → family page
                    const isCsfFunctionLevel = mappedFrameworkId === 'nist-csf-v2' && /^[A-Z]{2}$/.test(controlId);
                    const isCsfCategoryLevel = mappedFrameworkId === 'nist-csf-v2' && /^[A-Z]{2}\.[A-Z]{2}$/.test(controlId);
                    if (targetLoaded && isCsfFunctionLevel) {
                      href = `/frameworks/nist-csf-v2/family/${controlId.toLowerCase()}`;
                    } else if (targetLoaded && isCsfCategoryLevel) {
                      const family = controlId.split('.')[0].toLowerCase();
                      href = `/frameworks/nist-csf-v2/family/${family}`;
                    }
                    const isFamilyOrCategoryLevel = isCategoryLevel || isNistFamilyLevel || isCsfFunctionLevel || isCsfCategoryLevel;
                    return (
                      <span key={controlId} className="inline-flex items-center gap-1">
                        <a
                          href={href}
                          className="inline-block"
                          title={targetLoaded ? undefined : `${frameworkName} — view official source or load local overlay`}
                        >
                          <Badge
                            variant="secondary"
                            className="font-mono hover:bg-secondary/80 transition-colors"
                          >
                            {controlId}
                          </Badge>
                        </a>
                        {targetLoaded && !isFamilyOrCategoryLevel && (
                          <CompareButton
                            frameworkId={frameworkId}
                            controlSlug={slugify(control.control_id)}
                            compareWith={{ frameworkId: mappedFrameworkId, controlSlug: slugify(controlId) }}
                            size="sm"
                          />
                        )}
                      </span>
                    );
                  });
                })()}
              </div>
            </div>
          );
  };

  return (
    <ControlSection title="Cross-Framework Mappings">
      <div className="space-y-4">
        {mappings.map(renderMapping)}
        {collapsedDerived.length > 0 && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowDerived(prev => !prev)}
              className="text-xs font-medium text-primary/80 hover:text-primary hover:underline"
            >
              {showDerived
                ? 'Hide related frameworks'
                : `Show related controls in ${collapsedDerived.length} more framework${collapsedDerived.length === 1 ? '' : 's'}`}
            </button>
            {showDerived && (
              <div className="space-y-4 reveal-rise">
                {collapsedDerived.map(renderMapping)}
              </div>
            )}
          </div>
        )}
      </div>
    </ControlSection>
  );
}
