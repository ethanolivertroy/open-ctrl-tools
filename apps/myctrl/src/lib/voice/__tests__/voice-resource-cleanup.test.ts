import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../voice-tools', () => ({ executeVoiceTool: vi.fn(), VOICE_TOOL_DESCRIPTORS: [] }));

import { PcmAudioDuplex } from '../audio-io';
import { startOpenAIWebRtcSession } from '../openai-webrtc';
import type { VoiceSessionStartOptions } from '../types';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function fakeStream() {
  const track = { stop: vi.fn(), enabled: true };
  return { track, stream: { getTracks: () => [track], getAudioTracks: () => [track] } };
}

class FakePeerConnection {
  static instances: FakePeerConnection[] = [];
  channel = { readyState: 'connecting', close: vi.fn(), send: vi.fn() };
  close = vi.fn();
  addTrack = vi.fn();
  setRemoteDescription = vi.fn(async () => {});
  constructor() {
    FakePeerConnection.instances.push(this);
  }
  createDataChannel() {
    return this.channel;
  }
  async createOffer() {
    return { type: 'offer', sdp: 'v=0' };
  }
  async setLocalDescription() {}
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state = 'running';
  close = vi.fn(async () => {});
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createMediaStreamSource() {
    return { connect: vi.fn() };
  }
  createAnalyser() {
    return { fftSize: 0, frequencyBinCount: 8, getByteTimeDomainData: vi.fn() };
  }
}

const METER_FRAME = 7;

function installBrowser(getUserMedia: () => Promise<unknown>) {
  const remoteAudio = { autoplay: false, srcObject: {} as unknown, setAttribute: vi.fn(), pause: vi.fn(), play: vi.fn(async () => {}) };
  const cancelAnimationFrame = vi.fn();
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(getUserMedia) } });
  vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
  vi.stubGlobal('document', { createElement: () => remoteAudio });
  vi.stubGlobal('window', {
    AudioContext: FakeAudioContext,
    requestAnimationFrame: vi.fn(() => METER_FRAME),
    cancelAnimationFrame,
  });
  return { remoteAudio, cancelAnimationFrame };
}

function options(overrides: Partial<VoiceSessionStartOptions> = {}): VoiceSessionStartOptions {
  return {
    provider: 'openai',
    mode: 'copilot',
    onStateChange: vi.fn(),
    onTranscript: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  };
}

/** Everything the session acquired has been let go of. */
function expectReleased(
  track: { stop: ReturnType<typeof vi.fn> },
  browser: ReturnType<typeof installBrowser>,
) {
  const [pc] = FakePeerConnection.instances;
  const [audioContext] = FakeAudioContext.instances;
  expect(track.stop).toHaveBeenCalledTimes(1);
  expect(pc.close).toHaveBeenCalledTimes(1);
  expect(pc.channel.close).toHaveBeenCalledTimes(1);
  expect(browser.cancelAnimationFrame).toHaveBeenCalledWith(METER_FRAME);
  expect(audioContext.close).toHaveBeenCalledTimes(1);
  expect(browser.remoteAudio.pause).toHaveBeenCalledTimes(1);
  expect(browser.remoteAudio.srcObject).toBeNull();
}

beforeEach(() => {
  vi.unstubAllGlobals();
  FakePeerConnection.instances = [];
  FakeAudioContext.instances = [];
});

describe('OpenAI WebRTC session cleanup', () => {
  it('releases the microphone, peer connection and meter when the SDP exchange rejects', async () => {
    const { track, stream } = fakeStream();
    const browser = installBrowser(async () => stream);
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('network down'))));

    await expect(startOpenAIWebRtcSession('token', options())).rejects.toThrow('network down');
    expectReleased(track, browser);
  });

  it('releases everything when the SDP exchange is refused', async () => {
    const { track, stream } = fakeStream();
    const browser = installBrowser(async () => stream);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 502, json: async () => ({ error: 'upstream refused' }) })),
    );

    await expect(startOpenAIWebRtcSession('token', options())).rejects.toThrow('upstream refused');
    expectReleased(track, browser);
  });

  it('releases the microphone if the session was cancelled during the permission prompt', async () => {
    const { track, stream } = fakeStream();
    const prompt = deferred<unknown>();
    installBrowser(() => prompt.promise);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    const started = startOpenAIWebRtcSession('token', options({ signal: controller.signal }));
    controller.abort();
    prompt.resolve(stream); // permission granted after the user already pressed End

    await expect(started).rejects.toMatchObject({ name: 'AbortError' });
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(FakePeerConnection.instances).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes the cancel signal to the SDP exchange and releases once on stop', async () => {
    const { track, stream } = fakeStream();
    const browser = installBrowser(async () => stream);
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => 'v=0 answer' }));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    const sessionOptions = options({ signal: controller.signal });

    const transport = await startOpenAIWebRtcSession('token', sessionOptions);
    expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].signal).toBe(controller.signal);
    expect(track.stop).not.toHaveBeenCalled();

    await transport.stop();
    await transport.stop();
    expectReleased(track, browser);
    expect(sessionOptions.onStateChange).toHaveBeenLastCalledWith('idle');
  });
});

describe('PcmAudioDuplex', () => {
  it('releases a microphone that is granted after capture was already stopped', async () => {
    const { track, stream } = fakeStream();
    const prompt = deferred<unknown>();
    installBrowser(() => prompt.promise);
    const duplex = new PcmAudioDuplex();

    const capturing = duplex.startCapture({ targetSampleRate: 24000, onChunk: vi.fn() });
    await duplex.stop(); // connect failed or was cancelled while the prompt was open
    prompt.resolve(stream);

    await expect(capturing).rejects.toThrow(/cancelled/);
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(FakeAudioContext.instances).toHaveLength(0);
  });
});
