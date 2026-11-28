import {
  buildOpenAISessionUpdate,
  buildVoiceInstructions,
  getDefaultVoice,
  parseRealtimeServerEvent,
} from './protocol';
import { executeVoiceTool, VOICE_TOOL_DESCRIPTORS } from './voice-tools';
import type { ActiveVoiceTransport, VoiceSessionStartOptions } from './types';

export async function startOpenAIWebRtcSession(
  ephemeralToken: string,
  options: VoiceSessionStartOptions,
): Promise<ActiveVoiceTransport> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone access is unavailable in this browser.');
  }

  options.onStateChange('connecting');

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const pc = new RTCPeerConnection();
  const remoteAudio = document.createElement('audio');
  remoteAudio.autoplay = true;
  remoteAudio.setAttribute('playsinline', 'true');

  // Monitor local microphone RMS level for the waveform indicator.
  let audioCtx: AudioContext | null = null;
  let meterRaf = 0;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioCtx();
    const src = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i += 1) {
        const v = (dataArray[i] - 128) / 128;
        sum += v * v;
      }
      options.onInputLevel?.(Math.min(1, Math.sqrt(sum / dataArray.length) * 3.5));
      meterRaf = window.requestAnimationFrame(tick);
    };
    meterRaf = window.requestAnimationFrame(tick);
  } catch {
    audioCtx = null;
  }

  for (const track of stream.getTracks()) {
    pc.addTrack(track, stream);
  }

  pc.ontrack = (event) => {
    const [remoteStream] = event.streams;
    if (remoteStream) {
      remoteAudio.srcObject = remoteStream;
      void remoteAudio.play().catch(() => {});
    }
  };

  const dc = pc.createDataChannel('oai-events');
  const voice = getDefaultVoice('openai', options.voice);
  const instructions = buildVoiceInstructions({
    mode: options.mode,
    frameworkId: options.frameworkId,
    controlSlug: options.controlSlug,
    controlTitle: options.controlTitle,
    assessmentQuestions: options.assessmentQuestions,
  });

  let currentAssistantId = '';
  let currentAssistantText = '';

  const sendEvent = (payload: unknown) => {
    if (dc.readyState === 'open') {
      dc.send(JSON.stringify(payload));
    }
  };

  dc.onopen = () => {
    sendEvent(
      buildOpenAISessionUpdate({
        instructions,
        voice,
        tools: VOICE_TOOL_DESCRIPTORS,
      }),
    );

    if (options.mode === 'audit-interview') {
      sendEvent({
        type: 'response.create',
        response: {
          instructions: 'Greet the candidate concisely and ask the first assessment interview question.',
        },
      });
    }

    options.onStateChange('listening');
  };

  dc.onmessage = (event) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(event.data));
    } catch {
      return;
    }

    const events = parseRealtimeServerEvent(parsed);
    for (const evt of events) {
      if (evt.kind === 'session_ready') {
        options.onStateChange('listening');
      } else if (evt.kind === 'interrupted') {
        currentAssistantId = '';
        currentAssistantText = '';
        options.onStateChange('listening');
      } else if (evt.kind === 'transcript_delta') {
        if (evt.role === 'user') {
          options.onTranscript({
            id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            role: 'user',
            text: evt.text,
            final: evt.final,
            timestamp: Date.now(),
          });
        } else {
          if (!currentAssistantId) {
            currentAssistantId = `asst-${Date.now()}`;
            currentAssistantText = '';
          }
          currentAssistantText = evt.final ? evt.text : currentAssistantText + evt.text;
          options.onStateChange('speaking');
          options.onTranscript({
            id: currentAssistantId,
            role: 'assistant',
            text: currentAssistantText,
            final: evt.final,
            timestamp: Date.now(),
          });
          if (evt.final) {
            currentAssistantId = '';
            currentAssistantText = '';
          }
        }
      } else if (evt.kind === 'turn_complete') {
        options.onStateChange('listening');
      } else if (evt.kind === 'tool_call') {
        options.onToolActivity?.(evt.name);
        options.onStateChange('thinking');
        void executeVoiceTool(evt.name, evt.args, {
          frameworkId: options.frameworkId,
          controlSlug: options.controlSlug,
        }).then((result) => {
          sendEvent({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: evt.callId,
              output: JSON.stringify(result),
            },
          });
          sendEvent({ type: 'response.create' });
        });
      } else if (evt.kind === 'error') {
        options.onError(evt.message);
      }
    }
  };

  dc.onerror = () => {
    options.onError('OpenAI Realtime data channel closed unexpectedly.');
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const sdpResp = await fetch('/api/voice/openai-sdp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ephemeralToken,
      sdp: offer.sdp,
    }),
  });

  if (!sdpResp.ok) {
    const errJson = (await sdpResp.json().catch(() => ({}))) as { error?: string };
    stream.getTracks().forEach((t) => t.stop());
    pc.close();
    throw new Error(errJson.error || `OpenAI WebRTC exchange failed (${sdpResp.status})`);
  }

  const answerSdp = await sdpResp.text();
  await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

  return {
    provider: 'openai',
    setMuted: (muted: boolean) => {
      for (const track of stream.getAudioTracks()) {
        track.enabled = !muted;
      }
    },
    interrupt: () => {
      sendEvent({ type: 'response.cancel' });
      options.onStateChange('listening');
    },
    sendTextTurn: (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      sendEvent({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: trimmed }],
        },
      });
      sendEvent({ type: 'response.create' });
      options.onTranscript({
        id: `user-${Date.now()}`,
        role: 'user',
        text: trimmed,
        final: true,
        timestamp: Date.now(),
      });
    },
    stop: async () => {
      if (meterRaf) window.cancelAnimationFrame(meterRaf);
      if (audioCtx) await audioCtx.close().catch(() => {});
      remoteAudio.pause();
      remoteAudio.srcObject = null;
      dc.close();
      pc.close();
      stream.getTracks().forEach((t) => t.stop());
      options.onInputLevel?.(0);
      options.onOutputLevel?.(0);
      options.onStateChange('idle');
    },
  };
}
