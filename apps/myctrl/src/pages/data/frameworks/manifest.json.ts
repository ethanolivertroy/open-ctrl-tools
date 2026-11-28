import type { APIRoute } from 'astro';
import {
  getAllFrameworkIds,
  getAllControls,
  getAllFamilies,
  getBasePath,
  getControlsByFamily,
  getFamilyName,
  getFrameworkConfig,
  hasFrameworkData,
} from '@/data/controls';
import { getFrameworkCrosswalkTargets } from '@/data/crosswalk';
import { getDataVersion } from '@/lib/api-response';

export const prerender = true;

export const GET: APIRoute = async () => {
  const frameworks = getAllFrameworkIds().map((id) => {
    const config = getFrameworkConfig(id);
    const loaded = hasFrameworkData(id);
    const basePath = getBasePath(id) as '/frameworks' | '/risk-lists';
    const allControls = loaded ? getAllControls(id) : [];
    const familyCodes = loaded ? getAllFamilies(id) : [];
    const families = familyCodes.map((code) => ({
      code,
      name: getFamilyName(id, code),
      count: getControlsByFamily(id, code).length,
    }));

    return {
      id,
      name: config.name,
      version: config.version,
      description: config.description,
      type: config.type,
      basePath,
      loaded,
      controlCount: allControls.length,
      familyLabel: config.familyLabel,
      itemLabel: config.itemLabel,
      tags: config.tags ?? [],
      license: config.license,
      officialUrl: config.officialUrl,
      families,
      crosswalkTargets: getFrameworkCrosswalkTargets(id),
    };
  });

  const loadedIds = frameworks.filter((fw) => fw.loaded).map((fw) => fw.id);
  const totalLoadedControls = frameworks.reduce((sum, fw) => sum + fw.controlCount, 0);

  return new Response(
    JSON.stringify({
      generatedAt: getDataVersion(),
      loadedCount: loadedIds.length,
      totalLoadedControls,
      loadedIds,
      frameworks,
    }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    },
  );
};
