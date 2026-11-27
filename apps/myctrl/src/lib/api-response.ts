/**
 * Shared API response utilities for /api/v1/* endpoints.
 * Provides consistent JSON error/success formatting and validation helpers.
 */

// Build timestamp for data_version field
const DATA_VERSION = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

export type ApiErrorCode =
  | 'bad_request'
  | 'not_found'
  | 'internal_error';

const STATUS_MAP: Record<ApiErrorCode, number> = {
  bad_request: 400,
  not_found: 404,
  internal_error: 500,
};

/**
 * Return a JSON error response with consistent structure.
 */
export function apiError(
  code: ApiErrorCode,
  message: string,
  extraHeaders?: Record<string, string>,
): Response {
  const status = STATUS_MAP[code];
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  return new Response(
    JSON.stringify({ error: { code, message } }),
    { status, headers },
  );
}

/**
 * Return a JSON success response with consistent structure.
 */
export function apiSuccess(
  data: unknown,
  extraHeaders?: Record<string, string>,
): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300, s-maxage=3600',
    ...extraHeaders,
  };

  return new Response(JSON.stringify(data), { status: 200, headers });
}

/**
 * Get data version string (build date).
 */
export function getDataVersion(): string {
  return DATA_VERSION;
}

/**
 * Validate and parse a slug parameter (alphanumeric + hyphens only).
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length <= 100;
}

/**
 * Parse query params from a request URL.
 */
export function getQueryParams(request: Request): URLSearchParams {
  return new URL(request.url).searchParams;
}
