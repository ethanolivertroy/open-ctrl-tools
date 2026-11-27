export const prerender = false;

import type { APIRoute } from 'astro';
import { withReadOnlyApi } from '@/lib/api-route';
import { apiSuccess, apiError, getDataVersion } from '@/lib/api-response';
import {
  findFramework,
  getControlSearchPayload,
  slugifyControlId,
} from '@/lib/api-static-data';

export const GET: APIRoute = withReadOnlyApi(async (context) => {
  const pathParam = context.params.path;

  if (!pathParam) {
    return apiError('bad_request', 'Path must be /api/v1/controls/{frameworkSlug}/{controlId}');
  }

  // Parse path: could be "nist-800-53-r5/AC-2" or "nist-800-53-r5/ac-2"
  const segments = pathParam.split('/');
  if (segments.length < 2) {
    return apiError('bad_request', 'Path must be /api/v1/controls/{frameworkSlug}/{controlId}');
  }

  const frameworkSlug = segments[0];
  // Rejoin remaining segments (control IDs might have slashes in theory, though unlikely)
  const controlIdRaw = segments.slice(1).join('/');

  if (!frameworkSlug || !controlIdRaw) {
    return apiError('bad_request', 'Both framework slug and control ID are required.');
  }

  const payload = await getControlSearchPayload(context);
  const framework = findFramework(payload, frameworkSlug);

  if (!framework) {
    return apiError('not_found', `Framework '${frameworkSlug}' not found.`);
  }

  if (framework[4] === 0) {
    return apiError(
      'not_found',
      `Framework '${frameworkSlug}' is an external reference (control text is not redistributed). See /api/v1/frameworks/${frameworkSlug} for official_url or load a licensed copy locally into src/data/local/${frameworkSlug}.json.`,
    );
  }

  // Try to find the control: first by slug match, then by exact ID (case-insensitive)
  const slugified = slugifyControlId(controlIdRaw);
  const control = payload.entries.find((entry) =>
    entry[4] === frameworkSlug
    && (
      slugifyControlId(entry[0]) === slugified
      || entry[0].toLowerCase() === controlIdRaw.toLowerCase()
    ),
  );

  if (!control) {
    return apiError('not_found', `Control '${controlIdRaw}' not found in framework '${frameworkSlug}'.`);
  }

  // Build response
  return apiSuccess({
    id: `control:${frameworkSlug}:${control[0]}`,
    framework: {
      slug: frameworkSlug,
      name: framework[1],
    },
    control_id: control[0],
    title: control[1],
    family: control[2],
    description: control[3],
    related_controls: [],
    canonical_url: `https://myctrl.tools${control[5]}`,
    framework_specific: {
      baselines: control[6],
    },
    crosswalk_mappings: [],
    source: {
      publisher: framework[1].split(' ')[0],
      document: framework[1],
      license: null,
    },
    data_version: getDataVersion(),
  });
});
