import { base64ToPcm16, pcm16ToBase64, PcmAudioDuplex } from './audio-io';
import {
  buildGrokSessionUpdate,
  buildVoiceInstructions,
  getDefaultVoice,
  GROK_REALTIME_WS_URL,
  parseRealtimeServerEvent,
} from './protocol';
import { executeVoiceTool, VOICE_TOOL_DESCRIPTORS } from './voice-tools';
import type { ActiveVoiceTransport, VoiceSessionStartOptions } from './types';

export async function startGrokWebSocketSession(
  ephemeralToken: string,
  wsUrl: string | undefined,
  options: VoiceSessionStartOptions,
): Promise<ActiveVoiceTransport> {
  options.onStateChange('connecting');

  const duplex = new PcmAudioDuplex();
  const socketUrl = wsUrl || GROK_REALTIME_WS_URL;
  const ws = new WebSocket(socketUrl, [`xai-client-secret.${ephemeralToken}`]);

  const voice = getDefaultVoice('grok', options.voice);
  const instructions = buildVoiceInstructions({
    mode: options.mode,
    frameworkId: options.frameworkId,
    controlSlug: options.controlSlug,
    controlTitle: options.controlTitle,
    assessmentQuestions: options.assessmentQuestions,
  });

  let closed = false;
  let currentAssistantId = '';
  let currentAssistantText = '';

  const sendJson = (payload: unknown) => {
    if (!closed && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  };

  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error('Timed out connecting to xAI Grok Voice socket.'));
    }, 10000);

    ws.onopen = async () => {
      window.clearTimeout(timer);
      try {
        await duplex.startCapture({
          targetSampleRate: 24000,
          onChunk: (pcm, rms) => {
            options.onInputLevel?.(rms);
            if (pcm.length > 0 && ws.readyState === WebSocket.OPEN) {
              sendJson({
                type: 'input_audio_buffer.append',
                audio: pcm16ToBase64(pcm),
              });
            }
          },
        });

        sendJson(
          buildGrokSessionUpdate({
            instructions,
            voice,
            tools: VOICE_TOOL_DESCRIPTORS,
          }),
        );

        if (options.mode === 'audit-interview') {
          sendJson({
            type: 'response.create',
            response: {
              modalities: ['audio', 'text'],
            },
          });
        }

        options.onStateChange('listening');
        resolve();
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to start microphone capture'));
      }
    };

    ws.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('Could not open xAI Grok Voice WebSocket connection.'));
    };
  });

  ws.onmessage = (event) => {
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
          sendJson({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: evt.callId,
              output: JSON.stringify(result),
            },
          });
          sendJson({ type: 'response.create' });
        });
      } else if (evt.kind === 'error') {
        options.onError(evt.message);
      }
    }
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
    provider: 'grok',
    setMuted: (muted: boolean) => duplex.setMuted(muted),
    interrupt: () => {
      duplex.stopPlayback();
      sendJson({ type: 'response.cancel' });
      options.onOutputLevel?.(0);
      options.onStateChange('listening');
    },
    sendTextTurn: (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      sendJson({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: trimmed }],
        },
      });
      sendJson({ type: 'response.create' });
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
