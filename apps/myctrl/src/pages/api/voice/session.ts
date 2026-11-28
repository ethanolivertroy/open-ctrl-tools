import type { APIRoute } from 'astro';
import { z } from 'zod';
import {
  GEMINI_EPHEMERAL_URL,
  GEMINI_LIVE_MODEL,
  GROK_CLIENT_SECRET_URL,
  GROK_REALTIME_WS_URL,
  OPENAI_CLIENT_SECRET_URL,
  OPENAI_LEGACY_SESSION_URL,
  OPENAI_REALTIME_MODEL,
  getDefaultVoice,
} from '@/lib/voice/protocol';

export const prerender = false;

const VoiceSessionSchema = z.object({
  provider: z.enum(['openai', 'grok', 'gemini']),
  apiKey: z.string().max(500).optional(),
  voice: z.string().max(64).optional(),
});

function resolveServerOrByokKey(
  provider: 'openai' | 'grok' | 'gemini',
  userApiKey?: string,
): { key: string | null; isServerManaged: boolean } {
  const trimmed = userApiKey?.trim();
  if (trimmed) {
    return { key: trimmed, isServerManaged: false };
  }

  switch (provider) {
    case 'openai':
      return { key: import.meta.env.OPENAI_API_KEY || null, isServerManaged: true };
    case 'grok':
      return { key: import.meta.env.XAI_API_KEY || null, isServerManaged: true };
    case 'gemini':
      return { key: import.meta.env.GOOGLE_API_KEY || null, isServerManaged: true };
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const raw = await request.json();
    const parsed = VoiceSessionSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonResponse({ error: 'Invalid voice session request', details: parsed.error.issues }, 400);
    }

    const { provider, apiKey: userApiKey, voice: requestedVoice } = parsed.data;
    const { key, isServerManaged } = resolveServerOrByokKey(provider, userApiKey);
    if (!key) {
      return jsonResponse({ error: `Missing API key for ${provider}` }, 400);
    }

    const voice = getDefaultVoice(provider, requestedVoice);

    if (provider === 'openai') {
      let resp = await fetch(OPENAI_CLIENT_SECRET_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expires_after: { anchor: 'created_at', seconds: 300 },
          session: {
            type: 'realtime',
            model: OPENAI_REALTIME_MODEL,
            audio: { output: { voice } },
          },
        }),
      });

      if (resp.status === 404 || resp.status === 400) {
        resp = await fetch(OPENAI_LEGACY_SESSION_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: OPENAI_REALTIME_MODEL,
            voice,
          }),
        });
      }

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        return jsonResponse(
          { error: `OpenAI client secret request failed (${resp.status})`, details: text.slice(0, 300) },
          502,
        );
      }

      const data = (await resp.json()) as {
        value?: string;
        expires_at?: number;
        client_secret?: { value?: string; expires_at?: number };
      };
      const ephemeralToken = data.value ?? data.client_secret?.value;
      if (!ephemeralToken) {
        return jsonResponse({ error: 'OpenAI returned no ephemeral client secret' }, 502);
      }

      return jsonResponse({
        provider: 'openai',
        transport: 'webrtc',
        model: OPENAI_REALTIME_MODEL,
        voice,
        ephemeralToken,
        expiresAt: data.expires_at ?? data.client_secret?.expires_at,
      });
    }

    if (provider === 'grok') {
      const resp = await fetch(GROK_CLIENT_SECRET_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expires_after: { seconds: 300 },
        }),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        return jsonResponse(
          { error: `xAI client secret request failed (${resp.status})`, details: text.slice(0, 300) },
          502,
        );
      }

      const data = (await resp.json()) as {
        value?: string;
        expires_at?: number;
        client_secret?: { value?: string; expires_at?: number };
      };
      const ephemeralToken = data.value ?? data.client_secret?.value;
      if (!ephemeralToken) {
        return jsonResponse({ error: 'xAI returned no ephemeral client secret' }, 502);
      }

      return jsonResponse({
        provider: 'grok',
        transport: 'websocket',
        model: 'grok-voice-agent',
        voice,
        wsUrl: GROK_REALTIME_WS_URL,
        ephemeralToken,
        expiresAt: data.expires_at ?? data.client_secret?.expires_at,
      });
    }

    // Gemini Live: mint ephemeral auth token; fall back to direct client BYOK only when key wasn't server-managed.
    const geminiResp = await fetch(`${GEMINI_EPHEMERAL_URL}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uses: 1 }),
    });

    if (geminiResp.ok) {
      const data = (await geminiResp.json()) as { name?: string };
      if (data.name) {
        return jsonResponse({
          provider: 'gemini',
          transport: 'websocket',
          model: GEMINI_LIVE_MODEL,
          voice,
          wsUrl: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(data.name)}`,
          ephemeralToken: data.name,
        });
      }
    }

    if (!isServerManaged) {
      return jsonResponse({
        provider: 'gemini',
        transport: 'websocket',
        model: GEMINI_LIVE_MODEL,
        voice,
        wsUrl: undefined,
      });
    }

    const geminiError = await geminiResp.text().catch(() => '');
    return jsonResponse(
      { error: `Gemini Live token request failed (${geminiResp.status})`, details: geminiError.slice(0, 300) },
      502,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    return jsonResponse({ error: message }, 500);
  }
};
