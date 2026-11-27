export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import {
  credentialsFromTokenResponse,
  oauthErrorDetail,
  parseDeviceCode,
  XAI_DEVICE_CODE_URL,
  XAI_OAUTH_CLIENT_ID,
  XAI_OAUTH_SCOPE,
  XAI_TOKEN_URL,
} from '@/lib/ai/xai-oauth-protocol';

const RequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('device') }),
  z.object({
    action: z.literal('poll'),
    deviceCode: z.string().min(1).max(2048),
  }),
  z.object({
    action: z.literal('refresh'),
    refreshToken: z.string().min(1).max(8192),
  }),
]);

type JsonObject = Record<string, unknown>;

async function postForm(url: string, fields: Record<string, string>): Promise<{
  ok: boolean;
  status: number;
  body: JsonObject;
}> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(fields),
  });

  let body: JsonObject = {};
  try {
    const parsed = await response.json() as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      body = parsed as JsonObject;
    }
  } catch {
    body = {};
  }

  return { ok: response.ok, status: response.status, body };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const parseResult = RequestSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return json({ error: 'Invalid request' }, 400);
    }

    const input = parseResult.data;

    if (input.action === 'device') {
      const response = await postForm(XAI_DEVICE_CODE_URL, {
        client_id: XAI_OAUTH_CLIENT_ID,
        scope: XAI_OAUTH_SCOPE,
      });
      if (!response.ok) {
        return json({ error: oauthErrorDetail(response.body, response.status, 'device authorization') }, 502);
      }
      try {
        return json(parseDeviceCode(response.body));
      } catch (error) {
        return json({
          error: error instanceof Error ? error.message : 'Invalid device authorization response',
        }, 502);
      }
    }

    if (input.action === 'poll') {
      const response = await postForm(XAI_TOKEN_URL, {
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: XAI_OAUTH_CLIENT_ID,
        device_code: input.deviceCode,
      });

      if (response.ok) {
        return json({
          status: 'complete',
          tokens: credentialsFromTokenResponse(response.body),
        });
      }

      const error = response.body.error;
      if (error === 'authorization_pending') {
        return json({ status: 'pending' });
      }
      if (error === 'slow_down') {
        const interval = response.body.interval;
        return json({
          status: 'slow_down',
          intervalSeconds: typeof interval === 'number' ? interval : undefined,
        });
      }
      if (error === 'access_denied' || error === 'authorization_denied') {
        return json({ status: 'failed', message: 'xAI device authorization was denied' });
      }
      if (error === 'expired_token') {
        return json({ status: 'failed', message: 'xAI device code expired. Start sign-in again.' });
      }
      return json({
        status: 'failed',
        message: oauthErrorDetail(response.body, response.status, 'device token polling'),
      });
    }

    const response = await postForm(XAI_TOKEN_URL, {
      grant_type: 'refresh_token',
      client_id: XAI_OAUTH_CLIENT_ID,
      refresh_token: input.refreshToken,
    });
    if (!response.ok) {
      return json({ error: oauthErrorDetail(response.body, response.status, 'token refresh') }, 401);
    }
    return json({
      tokens: credentialsFromTokenResponse(response.body, input.refreshToken),
    });
  } catch (error) {
    console.error('xAI OAuth proxy error:', error);
    return json({ error: 'xAI OAuth proxy failed' }, 500);
  }
};
