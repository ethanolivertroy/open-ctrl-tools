import type { ProviderOAuthTokens } from '@/lib/storage-types';

export const XAI_OAUTH_CLIENT_ID = 'b1a00492-073a-47ea-816f-4c329264a828';
export const XAI_OAUTH_SCOPE = 'openid profile email offline_access grok-cli:access api:access';
export const XAI_DEVICE_CODE_URL = 'https://auth.x.ai/oauth2/device/code';
export const XAI_TOKEN_URL = 'https://auth.x.ai/oauth2/token';
export const XAI_REFRESH_SKEW_MS = 5 * 60 * 1000;
export const XAI_DEFAULT_TOKEN_LIFETIME_SECONDS = 3600;

type JsonObject = Record<string, unknown>;

export interface XaiDeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  intervalSeconds: number;
  expiresInSeconds: number;
}

function requiredString(body: JsonObject, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid xAI OAuth response field: ${field}`);
  }
  return value;
}

function positiveNumber(body: JsonObject, field: string, fallback?: number): number {
  const value = body[field];
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (fallback !== undefined) return fallback;
  throw new Error(`Invalid xAI OAuth response field: ${field}`);
}

export function validateVerificationUri(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Untrusted verification URI in xAI OAuth response');
  }
  if (url.protocol !== 'https:') {
    throw new Error('Untrusted verification URI in xAI OAuth response');
  }
  return url.href;
}

export function parseDeviceCode(body: JsonObject): XaiDeviceCode {
  const interval = body.interval;
  const verificationUriComplete = typeof body.verification_uri_complete === 'string' && body.verification_uri_complete
    ? validateVerificationUri(body.verification_uri_complete)
    : undefined;

  return {
    deviceCode: requiredString(body, 'device_code'),
    userCode: requiredString(body, 'user_code'),
    verificationUri: validateVerificationUri(requiredString(body, 'verification_uri')),
    verificationUriComplete,
    intervalSeconds: typeof interval === 'number' && Number.isFinite(interval) && interval > 0 ? interval : 5,
    expiresInSeconds: positiveNumber(body, 'expires_in'),
  };
}

export function credentialsFromTokenResponse(
  body: JsonObject,
  previousRefreshToken?: string,
): ProviderOAuthTokens {
  const refresh = body.refresh_token === undefined && previousRefreshToken
    ? previousRefreshToken
    : requiredString(body, 'refresh_token');
  const expiresInSeconds = body.expires_in === undefined
    ? XAI_DEFAULT_TOKEN_LIFETIME_SECONDS
    : positiveNumber(body, 'expires_in');

  return {
    accessToken: requiredString(body, 'access_token'),
    refreshToken: refresh,
    expiresAt: Date.now() + expiresInSeconds * 1000 - XAI_REFRESH_SKEW_MS,
  };
}

export function oauthErrorDetail(body: JsonObject, status: number, action: string): string {
  const error = typeof body.error === 'string' ? body.error : undefined;
  const description = typeof body.error_description === 'string' ? body.error_description : undefined;
  const detail = [error, description].filter(Boolean).join(': ');
  return `xAI OAuth ${action} failed (HTTP ${status})${detail ? `: ${detail}` : ''}`;
}
