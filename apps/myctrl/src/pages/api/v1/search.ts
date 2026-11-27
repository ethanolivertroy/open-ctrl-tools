export const prerender = false;

import type { APIRoute } from 'astro';
import { withReadOnlyApi } from '@/lib/api-route';
import { apiSuccess, apiError, getDataVersion, getQueryParams } from '@/lib/api-response';
import { getControlSearchPayload } from '@/lib/api-static-data';

type SearchResult = {
  type: 'control' | 'framework';
  id: string;
  title: string;
  framework_slug?: string;
  control_id?: string;
  family?: string;
  canonical_url: string;
  score: number;
  match_reason: string;
};

export const GET: APIRoute = withReadOnlyApi(async (context) => {
  const params = getQueryParams(context.request);

  const query = params.get('q')?.trim();
  if (!query) {
    return apiError('bad_request', 'Query parameter "q" is required.');
  }
  if (query.length > 200) {
    return apiError('bad_request', 'Query must be 200 characters or less.');
  }

  const typeFilter = params.get('type')?.toLowerCase() || 'all';
  if (!['control', 'framework', 'all'].includes(typeFilter)) {
    return apiError('bad_request', 'Type must be "control", "framework", or "all".');
  }

  const limit = Math.min(Math.max(parseInt(params.get('limit') || '10', 10) || 10, 1), 50);
  const queryLower = query.toLowerCase();
  const payload = await getControlSearchPayload(context);

  const results: SearchResult[] = [];

  // Search frameworks
  if (typeFilter === 'all' || typeFilter === 'framework') {
    for (const framework of payload.frameworkEntries) {
      const fid = framework[0];
      if (framework[6]?.includes('TBD')) continue;

      // Exact slug match
      if (fid === queryLower) {
        results.push({
          type: 'framework',
          id: `framework:${fid}`,
          title: `${framework[1]} ${framework[5]}`,
          canonical_url: `https://myctrl.tools${framework[3]}`,
          score: 1.0,
          match_reason: 'exact_framework_slug',
        });
        continue;
      }

      // Name substring match
      if (framework[1].toLowerCase().includes(queryLower)) {
        results.push({
          type: 'framework',
          id: `framework:${fid}`,
          title: `${framework[1]} ${framework[5]}`,
          canonical_url: `https://myctrl.tools${framework[3]}`,
          score: 0.7,
          match_reason: 'name_match',
        });
      }
    }
  }

  // Search controls from the prerendered static search artifact.
  if (typeFilter === 'all' || typeFilter === 'control') {
    for (const control of payload.entries) {
      const cidLower = control[0].toLowerCase();
      const titleLower = control[1].toLowerCase();

      // Exact control ID match
      if (cidLower === queryLower) {
        results.push({
          type: 'control',
          id: `control:${control[4]}:${control[0]}`,
          title: control[1],
          framework_slug: control[4],
          control_id: control[0],
          family: control[2],
          canonical_url: `https://myctrl.tools${control[5]}`,
          score: 1.0,
          match_reason: 'exact_control_id',
        });
        continue;
      }

      // Control ID prefix match (e.g., "AC-" matches "AC-1", "AC-2", etc.)
      if (cidLower.startsWith(queryLower) && queryLower.length >= 2) {
        results.push({
          type: 'control',
          id: `control:${control[4]}:${control[0]}`,
          title: control[1],
          framework_slug: control[4],
          control_id: control[0],
          family: control[2],
          canonical_url: `https://myctrl.tools${control[5]}`,
          score: 0.8,
          match_reason: 'control_id_prefix',
        });
        continue;
      }

      // Title match (only if query is 3+ chars to avoid noise)
      if (queryLower.length >= 3 && titleLower.includes(queryLower)) {
        results.push({
          type: 'control',
          id: `control:${control[4]}:${control[0]}`,
          title: control[1],
          framework_slug: control[4],
          control_id: control[0],
          family: control[2],
          canonical_url: `https://myctrl.tools${control[5]}`,
          score: 0.5,
          match_reason: 'title_match',
        });
      }

      if (results.length > limit * 10) break;
    }
  }

  // Sort by score descending, then by ID for stability
  results.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  // Apply limit
  const limited = results.slice(0, limit);

  return apiSuccess({
    query,
    type_filter: typeFilter,
    results: limited,
    page_info: {
      next_cursor: null,
      has_more: results.length > limit,
      total: Math.min(results.length, limit * 10),
    },
    data_version: getDataVersion(),
  });
});
