import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/services/provider-runtime', () => ({
  resolveProviderExecution: vi.fn(async () => ({ apiKey: 'test-key' })),
}));
vi.mock('@/lib/storage/provider-store', () => ({
  getDefaultProvider: vi.fn(async () => null),
  getEnabledProviders: vi.fn(async () => []),
}));
vi.mock('../browser-speech', () => ({ startBrowserSpeechSession: vi.fn() }));
vi.mock('../openai-webrtc', () => ({ startOpenAIWebRtcSession: vi.fn() }));
vi.mock('../grok-ws', () => ({ startGrokWebSocketSession: vi.fn() }));
vi.mock('../gemini-live-ws', () => ({ startGeminiLiveSession: vi.fn() }));

import { startBrowserSpeechSession } from '../browser-speech';
import { raceAbort } from '../cancellation';
import { startOpenAIWebRtcSession } from '../openai-webrtc';
import { startVoiceSession } from '../session-manager';
import type { ActiveVoiceTransport, VoiceSessionStartOptions } from '../types';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fakeTransport(provider: ActiveVoiceTransport['provider'] = 'browser') {
  return {
    provider,
    setMuted: vi.fn(),
    interrupt: vi.fn(),
    stop: vi.fn(async () => {}),
  } satisfies ActiveVoiceTransport;
}

function options(overrides: Partial<VoiceSessionStartOptions> = {}): VoiceSessionStartOptions {
  return {
    provider: 'browser',
    mode: 'copilot',
    onStateChange: vi.fn(),
    onTranscript: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('raceAbort', () => {
  it('passes the result through when nothing is aborted', async () => {
    await expect(raceAbort(Promise.resolve('ready'))).resolves.toBe('ready');
    await expect(raceAbort(Promise.resolve('ready'), new AbortController().signal)).resolves.toBe('ready');
    await expect(raceAbort(Promise.reject(new Error('boom')), new AbortController().signal)).rejects.toThrow('boom');
  });

  it('rejects as soon as the signal aborts, without waiting for the work', async () => {
    const work = deferred<string>();
    const controller = new AbortController();
    const raced = raceAbort(work.promise, controller.signal);
    controller.abort();
    await expect(raced).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects immediately for a signal that is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(raceAbort(Promise.resolve('late'), controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('startVoiceSession cancellation', () => {
  it('stops a transport that finishes connecting after the session was cancelled', async () => {
    const connecting = deferred<ActiveVoiceTransport>();
    vi.mocked(startBrowserSpeechSession).mockReturnValue(connecting.promise);
    const controller = new AbortController();

    const started = startVoiceSession(options({ signal: controller.signal }));
    controller.abort(); // the user pressed End while it was still connecting
    const transport = fakeTransport();
    connecting.resolve(transport);

    await expect(started).rejects.toMatchObject({ name: 'AbortError' });
    expect(transport.stop).toHaveBeenCalledTimes(1);
  });

  it('hands back a transport untouched when nothing was cancelled', async () => {
    const transport = fakeTransport();
    vi.mocked(startBrowserSpeechSession).mockResolvedValue(transport);

    await expect(startVoiceSession(options({ signal: new AbortController().signal }))).resolves.toBe(transport);
    expect(transport.stop).not.toHaveBeenCalled();
  });

  it('does not start anything for a session cancelled before it began', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(startVoiceSession(options({ signal: controller.signal }))).rejects.toMatchObject({ name: 'AbortError' });
    expect(startBrowserSpeechSession).not.toHaveBeenCalled();
  });

  it('abandons the token exchange for a hosted provider and never opens a transport', async () => {
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    const started = startVoiceSession(options({ provider: 'openai', signal: controller.signal }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
    controller.abort();

    await expect(started).rejects.toMatchObject({ name: 'AbortError' });
    expect(startOpenAIWebRtcSession).not.toHaveBeenCalled();
  });
});
