import type { APIRoute } from 'astro';
import {
  getAllControls,
  getBasePath,
  getFrameworkConfig,
  getLoadedFrameworkIds,
} from '@/data/controls';
import { getFrameworkData } from '@/data/frameworks';
import { getNISTForCCIs } from '@/data/crosswalk';
import { getCloudImplementation, type CloudImplementation } from '@/data/cloud-implementations';
import { getTechnologiesForControl, getTechnologyPath } from '@/data/technology-guides';
import { isDoDSRGControl, isFedRAMPControl, isNistControl, isSTIGControl } from '@/data/types';

export const prerender = true;

export function getStaticPaths() {
  return getLoadedFrameworkIds().map((framework) => ({
    params: { framework },
  }));
}

export const GET: APIRoute = async ({ params }) => {
  const frameworkId = params.framework;
  if (!frameworkId) {
    return new Response(JSON.stringify({ error: 'Missing framework id' }), { status: 400 });
  }

  const config = getFrameworkConfig(frameworkId);
  const raw = getFrameworkData(frameworkId);
  const controls = getAllControls(frameworkId);

  let stigNistMappings: Record<string, string[]> | undefined;
  if (config.hasSeverityLevels) {
    stigNistMappings = {};
    for (const control of controls) {
      if (isSTIGControl(control) && control.cci_refs.length > 0) {
        const mapped = getNISTForCCIs(control.cci_refs);
        if (mapped.length > 0) {
          stigNistMappings[control.control_id] = mapped;
        }
      }
    }
  }

  const cloudImplementations: Record<string, CloudImplementation> = {};
  const relevantTechnologies: Record<string, Array<{ id: string; name: string; path: string }>> = {};

  for (const control of controls) {
    if (isNistControl(control) || isFedRAMPControl(control) || isDoDSRGControl(control)) {
      const impl = getCloudImplementation(control.control_id);
      if (impl) {
        cloudImplementations[control.control_id] = impl;
      }
    }

    const techGuides = getTechnologiesForControl(control.control_id, frameworkId);
    if (techGuides.length > 0) {
      relevantTechnologies[control.control_id] = techGuides.map((tech) => ({
        id: tech.id,
        name: tech.name,
        path: getTechnologyPath(tech),
      }));
    }
  }

  return new Response(
    JSON.stringify({
      id: frameworkId,
      config,
      basePath: getBasePath(frameworkId),
      families: raw.families ?? {},
      controls,
      ...(stigNistMappings ? { stigNistMappings } : {}),
      ...(Object.keys(cloudImplementations).length > 0 ? { cloudImplementations } : {}),
      ...(Object.keys(relevantTechnologies).length > 0 ? { relevantTechnologies } : {}),
    }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    },
  );
};
