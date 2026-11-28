import { base64ToPcm16, pcm16ToBase64, PcmAudioDuplex } from './audio-io';
import {
  buildGeminiSetupMessage,
  buildVoiceInstructions,
  GEMINI_LIVE_MODEL,
  GEMINI_LIVE_WS_URL,
  getDefaultVoice,
  parseGeminiServerMessage,
} from './protocol';
import { executeVoiceTool, VOICE_TOOL_DESCRIPTORS } from './voice-tools';
import type { ActiveVoiceTransport, VoiceSessionStartOptions } from './types';

async function decodeWsData(data: unknown): Promise<string> {
  if (typeof data === 'string') return data;
  if (data instanceof Blob) return data.text();
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  return '';
}

export async function startGeminiLiveSession(
  session: { wsUrl?: string; model?: string; directApiKey?: string },
  options: VoiceSessionStartOptions,
): Promise<ActiveVoiceTransport> {
  options.onStateChange('connecting');

  const url =
    session.wsUrl ||
    (session.directApiKey
      ? `${GEMINI_LIVE_WS_URL}?key=${encodeURIComponent(session.directApiKey)}`
      : '');
  if (!url) {
    throw new Error('Missing Gemini Live WebSocket URL or BYOK API key.');
  }

  const duplex = new PcmAudioDuplex();
  const ws = new WebSocket(url);

  const voice = getDefaultVoice('gemini', options.voice);
  const instructions = buildVoiceInstructions({
    mode: options.mode,
    frameworkId: options.frameworkId,
    controlSlug: options.controlSlug,
    controlTitle: options.controlTitle,
    assessmentQuestions: options.assessmentQuestions,
  });

  let closed = false;
  let currentUserId = '';
  let currentUserText = '';
  let currentAssistantId = '';
  let currentAssistantText = '';

  const sendJson = (payload: unknown) => {
    if (!closed && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  };

  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error('Timed out connecting to Gemini Live socket.'));
    }, 10000);

    ws.onopen = async () => {
      window.clearTimeout(timer);
      try {
        await duplex.startCapture({
          targetSampleRate: 16000,
          onChunk: (pcm, rms) => {
            options.onInputLevel?.(rms);
            if (pcm.length > 0 && ws.readyState === WebSocket.OPEN) {
              sendJson({
                realtimeInput: {
                  mediaChunks: [
                    {
                      mimeType: 'audio/pcm;rate=16000',
                      data: pcm16ToBase64(pcm),
                    },
                  ],
                },
              });
            }
          },
        });

        sendJson(
          buildGeminiSetupMessage({
            model: session.model || GEMINI_LIVE_MODEL,
            instructions,
            voice,
            tools: VOICE_TOOL_DESCRIPTORS,
          }),
        );

        options.onStateChange('listening');
        resolve();
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to start microphone capture'));
      }
    };

    ws.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('Could not open Gemini Live WebSocket connection.'));
    };
  });

  ws.onmessage = (event) => {
    void decodeWsData(event.data).then((text) => {
      if (!text) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return;
      }

      const events = parseGeminiServerMessage(parsed);
      for (const evt of events) {
        if (evt.kind === 'session_ready') {
          if (options.mode === 'audit-interview') {
            sendJson({
              clientContent: {
                turns: [
                  {
                    role: 'user',
                    parts: [{ text: 'Please begin the mock audit interview with your first question.' }],
                  },
                ],
                turnComplete: true,
              },
            });
          } else {
            options.onStateChange('listening');
          }
        } else if (evt.kind === 'audio_delta') {
          options.onStateChange('speaking');
          duplex.enqueuePcm16(
            base64ToPcm16(evt.base64Pcm),
            evt.sampleRate,
            options.onOutputLevel,
          );
        } else if (evt.kind === 'interrupted') {
          duplex.stopPlayback();
          currentAssistantId = '';
          currentAssistantText = '';
          options.onOutputLevel?.(0);
          options.onStateChange('listening');
        } else if (evt.kind === 'transcript_delta') {
          if (evt.role === 'user') {
            if (!currentUserId) {
              currentUserId = `user-${Date.now()}`;
              currentUserText = '';
            }
            currentUserText += evt.text;
            options.onTranscript({
              id: currentUserId,
              role: 'user',
              text: currentUserText,
              final: evt.final,
              timestamp: Date.now(),
            });
          } else {
            if (currentUserId) {
              currentUserId = '';
              currentUserText = '';
            }
            if (!currentAssistantId) {
              currentAssistantId = `asst-${Date.now()}`;
              currentAssistantText = '';
            }
            currentAssistantText += evt.text;
            options.onTranscript({
              id: currentAssistantId,
              role: 'assistant',
              text: currentAssistantText,
              final: evt.final,
              timestamp: Date.now(),
            });
          }
        } else if (evt.kind === 'turn_complete') {
          currentUserId = '';
          currentUserText = '';
          currentAssistantId = '';
          currentAssistantText = '';
          options.onStateChange('listening');
        } else if (evt.kind === 'tool_call') {
          options.onToolActivity?.(evt.name);
          options.onStateChange('thinking');
          void executeVoiceTool(evt.name, evt.args, {
            frameworkId: options.frameworkId,
            controlSlug: options.controlSlug,
          }).then((result) => {
            sendJson({
              toolResponse: {
                functionResponses: [
                  {
                    id: evt.callId,
                    name: evt.name,
                    response: { output: result },
                  },
                ],
              },
            });
          });
        } else if (evt.kind === 'error') {
          options.onError(evt.message);
        }
      }
    });
  };

  ws.onclose = () => {
    if (!closed) {
      closed = true;
      void duplex.stop();
      options.onInputLevel?.(0);
      options.onOutputLevel?.(0);
      options.onStateChange('idle');
    }
  };

  return {
    provider: 'gemini',
    setMuted: (muted: boolean) => duplex.setMuted(muted),
    interrupt: () => {
      duplex.stopPlayback();
      options.onOutputLevel?.(0);
      options.onStateChange('listening');
    },
    sendTextTurn: (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      sendJson({
        clientContent: {
          turns: [{ role: 'user', parts: [{ text: trimmed }] }],
          turnComplete: true,
        },
      });
      options.onTranscript({
        id: `user-${Date.now()}`,
        role: 'user',
        text: trimmed,
        final: true,
        timestamp: Date.now(),
      });
    },
    stop: async () => {
      closed = true;
      ws.close();
      await duplex.stop();
      options.onInputLevel?.(0);
      options.onOutputLevel?.(0);
      options.onStateChange('idle');
    },
  };
}
