import { resolveProviderExecution } from '@/lib/services/provider-runtime';
import { getDefaultProvider, getEnabledProviders } from '@/lib/storage/provider-store';
import type { VoiceProviderId } from './protocol';
import type {
  ActiveVoiceTransport,
  EphemeralVoiceSessionResponse,
  VoiceSessionStartOptions,
} from './types';
import { startOpenAIWebRtcSession } from './openai-webrtc';
import { startGrokWebSocketSession } from './grok-ws';
import { startGeminiLiveSession } from './gemini-live-ws';
import { startBrowserSpeechSession } from './browser-speech';
import { createAbortError, throwIfAborted } from './cancellation';

export const VOICE_PROVIDER_PRIORITY: VoiceProviderId[] = ['openai', 'grok', 'gemini', 'browser'];

export async function selectPreferredVoiceProvider(): Promise<VoiceProviderId> {
  const defaultProvider = await getDefaultProvider();
  if (defaultProvider === 'openai' || defaultProvider === 'grok' || defaultProvider === 'gemini') {
    return defaultProvider;
  }

  const enabled = await getEnabledProviders();
  for (const id of ['openai', 'grok', 'gemini'] as const) {
    if (enabled.some((p) => p.providerId === id && (p.apiKey || p.oauth?.refreshToken))) {
      return id;
    }
  }

  return 'browser';
}

export async function startVoiceSession(
  options: VoiceSessionStartOptions,
): Promise<ActiveVoiceTransport> {
  const transport = await connectVoiceTransport(options);

  // Cancelled while it was connecting: the caller never received this
  // transport, so nothing else can stop it (or its microphone). Stop it here.
  if (options.signal?.aborted) {
    await transport.stop().catch(() => {});
    throw createAbortError();
  }
  return transport;
}

async function connectVoiceTransport(
  options: VoiceSessionStartOptions,
): Promise<ActiveVoiceTransport> {
  throwIfAborted(options.signal);

  if (options.provider === 'browser') {
    return startBrowserSpeechSession(options);
  }

  let resolvedApiKey = options.apiKey?.trim();
  if (!resolvedApiKey) {
    const execution = await resolveProviderExecution({
      providerId: options.provider,
      includeApiKey: true,
    });
    resolvedApiKey = execution.apiKey;
  }

  throwIfAborted(options.signal);
  const resp = await fetch('/api/voice/session', {
    method: 'POST',
    signal: options.signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: options.provider,
      apiKey: resolvedApiKey,
      voice: options.voice,
    }),
  });

  if (!resp.ok) {
    const errJson = (await resp.json().catch(() => ({}))) as { error?: string; details?: string };
    throw new Error(errJson.error || `Failed to initialize ${options.provider} voice session.`);
  }

  const session = (await resp.json()) as EphemeralVoiceSessionResponse;
  throwIfAborted(options.signal);

  if (session.provider === 'openai') {
    if (!session.ephemeralToken) {
      throw new Error('OpenAI voice session missing ephemeral token.');
    }
    return startOpenAIWebRtcSession(session.ephemeralToken, options);
  }

  if (session.provider === 'grok') {
    if (!session.ephemeralToken) {
      throw new Error('xAI Grok voice session missing ephemeral token.');
    }
    return startGrokWebSocketSession(session.ephemeralToken, session.wsUrl, options);
  }

  return startGeminiLiveSession(
    {
      wsUrl: session.wsUrl,
      model: session.model,
      directApiKey: session.wsUrl ? undefined : resolvedApiKey,
    },
    options,
  );
}
