import { ValidationError } from './domain';

export const API_HEADERS: Record<string, string> = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()'
};

export function json(value: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...API_HEADERS, ...extraHeaders }
  });
}

export function noContent(): Response {
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}

export async function parseJson(request: Request, limit = 64 * 1024, allowEmpty = false): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > limit) throw new ValidationError('Request body is too large');
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('application/json')) {
    if (allowEmpty && !contentType && declared === 0) return {};
    throw new ValidationError('Content-Type must be application/json');
  }
  const text = await request.text();
  if (text.length > limit) throw new ValidationError('Request body is too large');
  if (allowEmpty && !text.trim()) return {};
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ValidationError('Request body must be valid JSON');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError('Request body must be a JSON object');
  }
  return value as Record<string, unknown>;
}

export interface PageInfo {
  startCursor: string | null;
  endCursor: string | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface Page<T> {
  results: { data: T[]; pageInfo: PageInfo };
}

function encodeCursor(index: number): string {
  return btoa(`offset:${index}`).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function decodeCursor(cursor: string | null | undefined): number {
  if (!cursor) return -1;
  try {
    const padded = cursor.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(cursor.length / 4) * 4, '=');
    const decoded = atob(padded);
    const match = decoded.match(/^offset:(\d{1,9})$/);
    if (!match) throw new Error('bad cursor');
    return Number(match[1]);
  } catch {
    throw new ValidationError('pageCursor is not valid');
  }
}

export function parsePageSize(value: string | null | undefined, fallback = 10): number {
  if (value === null || value === undefined || value === '') return fallback;
  const size = Number(value);
  if (!Number.isInteger(size) || size < 1 || size > 100) throw new ValidationError('pageSize must be an integer between 1 and 100');
  return size;
}

export function paginate<T>(items: T[], pageSize: number, pageCursor: string | null | undefined): Page<T> {
  const start = decodeCursor(pageCursor) + 1;
  const data = items.slice(start, start + pageSize);
  const end = start + data.length - 1;
  return {
    results: {
      data,
      pageInfo: {
        startCursor: data.length ? encodeCursor(start) : null,
        endCursor: data.length ? encodeCursor(end) : null,
        hasNextPage: end + 1 < items.length,
        hasPreviousPage: start > 0
      }
    }
  };
}

export function pageFromUrl<T>(items: T[], url: URL): Page<T> {
  return paginate(items, parsePageSize(url.searchParams.get('pageSize')), url.searchParams.get('pageCursor'));
}

export function arrayResponse<T>(results: T[]): { results: T[] } {
  return { results };
}
