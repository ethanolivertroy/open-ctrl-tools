export const prerender = false;

import type { APIRoute } from 'astro';
import { withReadOnlyApi } from '@/lib/api-route';
import { apiSuccess, apiError, getDataVersion, getQueryParams } from '@/lib/api-response';
import {
  findFramework,
  getControlSearchPayload,
  getCrosswalkIndexPayload,
} from '@/lib/api-static-data';

interface CrosswalkMapping {
  from: { framework_slug: string; control_id: string };
  to: { framework_slug: string; control_id: string };
  relationship: string;
}

function pushMappings(
  mappings: CrosswalkMapping[],
  fromFramework: string,
  toFramework: string,
  map: Record<string, string[]>,
  controlId: string | undefined,
): void {
  if (controlId) {
    for (const targetId of map[controlId] ?? []) {
      mappings.push({
        from: { framework_slug: fromFramework, control_id: controlId },
        to: { framework_slug: toFramework, control_id: targetId },
        relationship: 'related',
      });
    }
    return;
  }

  for (const [sourceId, targetIds] of Object.entries(map)) {
    for (const targetId of targetIds) {
      mappings.push({
        from: { framework_slug: fromFramework, control_id: sourceId },
        to: { framework_slug: toFramework, control_id: targetId },
        relationship: 'related',
      });
    }
  }
}

export const GET: APIRoute = withReadOnlyApi(async (context) => {
  const params = getQueryParams(context.request);

  const from = params.get('from')?.trim();
  if (!from) {
    return apiError('bad_request', 'Query parameter "from" (source framework slug) is required.');
  }

  const to = params.get('to')?.trim() || undefined;
  const controlId = params.get('control')?.trim() || undefined;

  if (!controlId && !to) {
    return apiError('bad_request', 'Either "control" or "to" parameter is required.');
  }

  const payload = await getControlSearchPayload(context);

  // Validate source framework exists
  if (!findFramework(payload, from)) {
    return apiError('not_found', `Framework '${from}' not found.`);
  }

  // Validate target framework if specified
  if (to && !findFramework(payload, to)) {
    return apiError('not_found', `Framework '${to}' not found.`);
  }

  const crosswalkIndex = await getCrosswalkIndexPayload(context);

  const mappings: CrosswalkMapping[] = [];
  const directTargets = new Set<string>();

  for (const [a, b, aToB, bToA] of crosswalkIndex.pairs) {
    if (a === from) {
      directTargets.add(b);
      if (to && b !== to) continue;
      pushMappings(mappings, from, b, aToB, controlId);
    } else if (b === from) {
      directTargets.add(a);
      if (to && a !== to) continue;
      pushMappings(mappings, from, a, bToA, controlId);
    }
  }

  // Bridge-derived mappings: relate `from` to other frameworks transitively
  // through the internal crosswalk bridge (from -> bridge ids -> target).
  // Frameworks already covered by a direct pair are not repeated.
  const sourceBridge = crosswalkIndex.bridge.find(([fwId]) => fwId === from);
  if (sourceBridge) {
    const [, sourceToBridge] = sourceBridge;
    for (const [targetId, , targetFromBridge] of crosswalkIndex.bridge) {
      if (targetId === from || directTargets.has(targetId)) continue;
      if (to && targetId !== to) continue;

      const derive = (sourceControlId: string, bridgeIds: string[]) => {
        const targetIds = new Set<string>();
        for (const bridgeId of bridgeIds) {
          for (const id of targetFromBridge[bridgeId] ?? []) targetIds.add(id);
        }
        for (const targetControlId of targetIds) {
          mappings.push({
            from: { framework_slug: from, control_id: sourceControlId },
            to: { framework_slug: targetId, control_id: targetControlId },
            relationship: 'related-via-bridge',
          });
        }
      };

      if (controlId) {
        derive(controlId, sourceToBridge[controlId] ?? []);
      } else {
        for (const [sourceControlId, bridgeIds] of Object.entries(sourceToBridge)) {
          derive(sourceControlId, bridgeIds);
        }
      }
    }
  }

  return apiSuccess({
    query: { from, to: to || null, control: controlId || null },
    mappings,
    data_version: getDataVersion(),
  });
});
