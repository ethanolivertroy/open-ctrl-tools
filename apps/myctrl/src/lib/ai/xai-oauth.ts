/**
 * xAI device-code OAuth (SuperGrok / X Premium).
 *
 * Mirrors earendil-works/pi: poll auth.x.ai via our worker proxy, then send the
 * access token to api.x.ai as a Bearer credential.
 */

import type { ProviderOAuthTokens } from '@/lib/storage-types';
import type { XaiDeviceCode } from './xai-oauth-protocol';

export const XAI_OAUTH_LOGIN_LABEL = 'Sign in with SuperGrok or X Premium';

export type XaiDeviceAuthorization = XaiDeviceCode;

export type XaiDevicePollResult =
  | { status: 'pending' }
  | { status: 'slow_down'; intervalSeconds?: number }
  | { status: 'complete'; tokens: ProviderOAuthTokens }
  | { status: 'failed'; message: string };

export type XaiDeviceLoginFlowResult =
  | { status: 'complete'; tokens: ProviderOAuthTokens }
  | { status: 'failed'; message: string }
  | { status: 'cancelled' };

async function postXaiOAuth<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/oauth/xai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as {
    error?: string;
    [key: string]: unknown;
  };
  if (!response.ok) {
    throw new Error(payload.error || `xAI OAuth failed (${response.status})`);
  }
  return payload as T;
}

export async function startXaiDeviceLogin(): Promise<XaiDeviceAuthorization> {
  return postXaiOAuth<XaiDeviceAuthorization>({ action: 'device' });
}

export async function pollXaiDeviceLogin(deviceCode: string): Promise<XaiDevicePollResult> {
  return postXaiOAuth<XaiDevicePollResult>({ action: 'poll', deviceCode });
}

export async function refreshXaiOAuth(refreshToken: string): Promise<ProviderOAuthTokens> {
  const result = await postXaiOAuth<{ tokens: ProviderOAuthTokens }>({
    action: 'refresh',
    refreshToken,
  });
  return result.tokens;
}

export function xaiAccessTokenIsFresh(tokens: ProviderOAuthTokens, skewMs = 60_000): boolean {
  return Boolean(tokens.accessToken) && tokens.expiresAt > Date.now() + skewMs;
}

/**
 * Run the full device-code login flow: request a device code, report it via
 * `onDevice` (so the UI can show the user code), then poll until the user
 * approves, denies, or the code expires. `isCancelled` lets the caller abandon
 * the flow between polls (e.g. the settings dialog closed).
 */
export async function runXaiDeviceLoginFlow(options: {
  onDevice: (device: XaiDeviceAuthorization) => void;
  isCancelled?: () => boolean;
}): Promise<XaiDeviceLoginFlowResult> {
  const cancelled = () => options.isCancelled?.() ?? false;

  const device = await startXaiDeviceLogin();
  if (cancelled()) return { status: 'cancelled' };
  options.onDevice(device);

  let intervalMs = Math.max(1, device.intervalSeconds) * 1000;
  const deadline = Date.now() + device.expiresInSeconds * 1000;
  await sleep(intervalMs);

  while (Date.now() < deadline) {
    if (cancelled()) return { status: 'cancelled' };
    const result = await pollXaiDeviceLogin(device.deviceCode);
    if (cancelled()) return { status: 'cancelled' };

    if (result.status === 'complete') {
      return { status: 'complete', tokens: result.tokens };
    }
    if (result.status === 'failed') {
      return result;
    }
    if (result.status === 'slow_down' && result.intervalSeconds) {
      intervalMs = Math.max(1, result.intervalSeconds) * 1000;
    }
    await sleep(intervalMs);
  }

  return { status: 'failed', message: 'Sign-in timed out. Start again.' };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
