export const prerender = false;

import type { APIRoute } from 'astro';
import { withReadOnlyApi } from '@/lib/api-route';
import { apiSuccess, getDataVersion, getQueryParams } from '@/lib/api-response';
import { getControlSearchPayload, isRiskListHref } from '@/lib/api-static-data';
import { FRAMEWORK_CONFIGS } from '@/data/framework-configs';

export const GET: APIRoute = withReadOnlyApi(async (context) => {
  const params = getQueryParams(context.request);

  // Parse query params
  const category = params.get('category')?.toLowerCase();
  const limit = Math.min(Math.max(parseInt(params.get('limit') || '50', 10) || 50, 1), 200);
  const cursorParam = params.get('cursor');
  const offset = cursorParam ? parseInt(atob(cursorParam), 10) || 0 : 0;

  const payload = await getControlSearchPayload(context);
  let frameworks = payload.frameworkEntries.filter((entry) => !entry[6]?.includes('TBD'));

  // Filter by category/tag if specified
  if (category) {
    frameworks = frameworks.filter((entry) =>
      entry[6]?.some((tag) => tag.toLowerCase() === category),
    );
  }

  const total = frameworks.length;

  // Paginate
  const page = frameworks.slice(offset, offset + limit);
  const hasMore = offset + limit < total;
  const nextCursor = hasMore
    ? btoa(String(offset + limit))
    : null;

  // Build response
  const data = page.map((entry) => {
    const config = FRAMEWORK_CONFIGS[entry[0]];
    return {
      id: `framework:${entry[0]}`,
      slug: entry[0],
      name: entry[1],
      version: entry[5],
      description: entry[2],
      tags: entry[6] || [],
      content_type: isRiskListHref(entry[3]) ? 'risk-list' : 'framework',
      item_label: config?.itemLabel ?? (isRiskListHref(entry[3]) ? 'risks' : 'controls'),
      control_count: entry[4],
      data_availability: entry[4] > 0 ? 'built-in' : 'external-only',
      has_baselines: config?.hasBaselines ?? false,
      license: config?.license ?? null,
      canonical_url: `https://myctrl.tools${entry[3]}`,
      official_url: config?.officialUrl ?? null,
    };
  });

  return apiSuccess({
    data,
    page_info: {
      next_cursor: nextCursor,
      has_more: hasMore,
      total,
    },
    data_version: getDataVersion(),
  });
});
