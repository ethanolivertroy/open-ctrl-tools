import type { APIRoute, APIContext } from 'astro';
import { apiError } from './api-response';

/**
 * Wrap a public read-only API route.
 */
export function withReadOnlyApi(
  handler: (context: APIContext) => Promise<Response> | Response,
): APIRoute {
  return async (context: APIContext) => {
    if (context.request.method !== 'GET') {
      return apiError('bad_request', 'Only GET requests are supported.');
    }

    return handler(context);
  };
}
