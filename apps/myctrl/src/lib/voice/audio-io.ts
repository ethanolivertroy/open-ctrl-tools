/**
 * Low-latency browser audio capture + queued PCM16 playback with instant barge-in.
 */

export function pcm16ToBase64(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function base64ToPcm16(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
}

export function downsampleFloat32ToInt16(
  input: Float32Array,
  inputSampleRate: number,
  targetSampleRate: number,
): Int16Array {
  if (inputSampleRate === targetSampleRate) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i += 1) {
      const clamped = Math.max(-1, Math.min(1, input[i]));
      out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }
    return out;
  }

  const ratio = inputSampleRate / targetSampleRate;
  const outputLength = Math.max(1, Math.floor(input.length / ratio));
  const out = new Int16Array(outputLength);

  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < outputLength) {
    const nextOffsetBuffer = Math.min(input.length, Math.round((offsetResult + 1) * ratio));
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer; i += 1) {
      accum += input[i];
      count += 1;
    }
    const sample = count > 0 ? accum / count : 0;
    const clamped = Math.max(-1, Math.min(1, sample));
    out[offsetResult] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    offsetResult += 1;
    offsetBuffer = nextOffsetBuffer;
  }

  return out;
}

export function computeRms(input: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < input.length; i += 1) {
    sum += input[i] * input[i];
  }
  return Math.min(1, Math.sqrt(sum / Math.max(1, input.length)) * 3.5);
}

export class PcmAudioDuplex {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private silenceGain: GainNode | null = null;
  private nextPlaybackTime = 0;
  private activeSources = new Set<AudioBufferSourceNode>();
  private muted = false;

  async startCapture(options: {
    targetSampleRate: number;
    onChunk: (pcm: Int16Array, rms: number) => void;
    onOutputActivity?: (active: boolean) => void;
  }): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone capture is not available in this browser context.');
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.context = new AudioCtx();
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    this.sourceNode = this.context.createMediaStreamSource(this.stream);
    // ScriptProcessorNode keeps Vite/Worker bundling dependency-free without extra worklet assets.
    this.processorNode = this.context.createScriptProcessor(2048, 1, 1);
    this.silenceGain = this.context.createGain();
    this.silenceGain.gain.value = 0;

    this.processorNode.onaudioprocess = (event) => {
      if (this.muted || !this.context) {
        options.onChunk(new Int16Array(0), 0);
        return;
      }
      const input = event.inputBuffer.getChannelData(0);
      const rms = computeRms(input);
      const pcm = downsampleFloat32ToInt16(input, this.context.sampleRate, options.targetSampleRate);
      options.onChunk(pcm, rms);
    };

    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.silenceGain);
    this.silenceGain.connect(this.context.destination);
    this.nextPlaybackTime = this.context.currentTime;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  enqueuePcm16(pcm: Int16Array, sampleRate = 24000, onLevel?: (level: number) => void): void {
    if (!this.context || pcm.length === 0) return;

    const float32 = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i += 1) {
      float32[i] = pcm[i] / 0x8000;
    }

    if (onLevel) {
      onLevel(computeRms(float32));
    }

    const buffer = this.context.createBuffer(1, float32.length, sampleRate);
    buffer.copyToChannel(float32, 0);

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);

    const now = this.context.currentTime;
    const startAt = Math.max(now + 0.01, this.nextPlaybackTime);
    this.nextPlaybackTime = startAt + buffer.duration;

    this.activeSources.add(source);
    source.onended = () => {
      this.activeSources.delete(source);
      if (this.activeSources.size === 0 && onLevel) {
        onLevel(0);
      }
    };
    source.start(startAt);
  }

  stopPlayback(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        // Ignore already-ended nodes
      }
    }
    this.activeSources.clear();
    if (this.context) {
      this.nextPlaybackTime = this.context.currentTime;
    }
  }

  async stop(): Promise<void> {
    this.stopPlayback();
    if (this.processorNode) {
      this.processorNode.onaudioprocess = null;
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.silenceGain) {
      this.silenceGain.disconnect();
      this.silenceGain = null;
    }
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
  }
}
