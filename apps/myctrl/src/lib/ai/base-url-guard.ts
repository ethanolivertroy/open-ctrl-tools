import { getDefaultBaseUrl, type ProviderId } from './providers';

export type BaseUrlCheckResult =
  | { ok: true; baseUrl: string | undefined }
  | { ok: false; error: string };

const CUSTOM_BASE_URL_ERROR =
  'Custom baseUrl requires a user-supplied API key; server credentials cannot be sent to custom endpoints.';

function normalizePathname(pathname: string): string {
  return pathname.replace(/\/+$/, '');
}

/**
 * Prevent unauthenticated callers from redirecting server-side API credentials
 * (`OPENROUTER_API_KEY`, `XAI_API_KEY`, etc.) to attacker-controlled endpoints.
 */
export function resolveSafeBaseUrl(
  provider: ProviderId,
  userApiKey: string | undefined,
  baseUrl: string | undefined,
): BaseUrlCheckResult {
  if (userApiKey?.trim()) {
    return { ok: true, baseUrl };
  }

  const trimmedBaseUrl = baseUrl?.trim();
  if (!trimmedBaseUrl) {
    return { ok: true, baseUrl: undefined };
  }

  const defaultBaseUrl = getDefaultBaseUrl(provider);
  if (!defaultBaseUrl) {
    return { ok: false, error: CUSTOM_BASE_URL_ERROR };
  }

  try {
    const parsed = new URL(trimmedBaseUrl);
    const expected = new URL(defaultBaseUrl);
    const matchesTrustedDefault =
      parsed.origin === expected.origin &&
      normalizePathname(parsed.pathname) === normalizePathname(expected.pathname) &&
      parsed.search === '' &&
      parsed.hash === '' &&
      parsed.username === '' &&
      parsed.password === '';

    if (matchesTrustedDefault) {
      return { ok: true, baseUrl: undefined };
    }
  } catch {
    return { ok: false, error: CUSTOM_BASE_URL_ERROR };
  }

  return { ok: false, error: CUSTOM_BASE_URL_ERROR };
}
