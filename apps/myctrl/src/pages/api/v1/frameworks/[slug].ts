export const prerender = false;

import type { APIRoute } from 'astro';
import { withReadOnlyApi } from '@/lib/api-route';
import { apiSuccess, apiError, getDataVersion } from '@/lib/api-response';
import { findFramework, getControlSearchPayload, isRiskListHref } from '@/lib/api-static-data';
import { FRAMEWORK_CONFIGS } from '@/data/framework-configs';

export const GET: APIRoute = withReadOnlyApi(async (context) => {
  const slug = context.params.slug;

  if (!slug) {
    return apiError('bad_request', 'Framework slug is required.');
  }

  const payload = await getControlSearchPayload(context);
  const framework = findFramework(payload, slug);

  if (!framework) {
    return apiError('not_found', `Framework '${slug}' not found.`);
  }

  const config = FRAMEWORK_CONFIGS[slug];

  // Derive family names from the control index for this framework
  const families: Record<string, number> = {};
  for (const entry of payload.entries) {
    if (entry[4] !== slug) continue;
    const family = entry[2];
    if (!family) continue;
    families[family] = (families[family] ?? 0) + 1;
  }

  return apiSuccess({
    id: `framework:${slug}`,
    slug,
    name: framework[1],
    version: framework[5],
    description: framework[2],
    tags: framework[6] || [],
    content_type: isRiskListHref(framework[3]) ? 'risk-list' : 'framework',
    item_label: config?.itemLabel ?? (isRiskListHref(framework[3]) ? 'risks' : 'controls'),
    family_label: config?.familyLabel ?? 'Family',
    control_count: framework[4],
    data_availability: framework[4] > 0 ? 'built-in' : 'external-only',
    has_baselines: config?.hasBaselines ?? false,
    has_severity_levels: config?.hasSeverityLevels ?? false,
    has_implementation_groups: config?.hasImplementationGroups ?? false,
    has_risk_tiers: config?.hasRiskTiers ?? false,
    has_cmmc_levels: config?.hasCMMCLevels ?? false,
    license: config?.license ?? null,
    official_url: config?.officialUrl ?? null,
    canonical_url: `https://myctrl.tools${framework[3]}`,
    families,
    data_source: config?.dataSource ?? null,
    data_version: getDataVersion(),
  });
});
