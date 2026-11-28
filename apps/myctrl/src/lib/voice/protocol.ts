export type VoiceProviderId = 'openai' | 'grok' | 'gemini' | 'browser';
export type VoiceMode = 'copilot' | 'audit-interview';

export const OPENAI_REALTIME_MODEL = 'gpt-realtime';
export const OPENAI_CLIENT_SECRET_URL = 'https://api.openai.com/v1/realtime/client_secrets';
export const OPENAI_LEGACY_SESSION_URL = 'https://api.openai.com/v1/realtime/sessions';
export const OPENAI_REALTIME_CALLS_URL = 'https://api.openai.com/v1/realtime/calls';

export const GROK_REALTIME_WS_URL = 'wss://api.x.ai/v1/realtime';
export const GROK_CLIENT_SECRET_URL = 'https://api.x.ai/v1/realtime/client_secrets';

export const GEMINI_LIVE_MODEL = 'models/gemini-2.5-flash-native-audio-preview-12-2025';
export const GEMINI_EPHEMERAL_URL = 'https://generativelanguage.googleapis.com/v1beta/auth_tokens';
export const GEMINI_LIVE_WS_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

export const VOICE_PRESETS: Record<Exclude<VoiceProviderId, 'browser'>, readonly string[]> = {
  openai: ['marin', 'cedar', 'alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'],
  grok: ['eve', 'ara', 'rex', 'sal', 'leo'],
  gemini: ['Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede', 'Zephyr'],
};

export interface VoiceInstructionContext {
  mode: VoiceMode;
  frameworkId?: string;
  controlSlug?: string;
  controlTitle?: string;
  assessmentQuestions?: string[];
}

export function getDefaultVoice(provider: VoiceProviderId, requested?: string): string {
  if (provider === 'browser') return 'default';
  const list = VOICE_PRESETS[provider];
  if (requested && list.includes(requested)) return requested;
  return list[0];
}

export function buildVoiceInstructions(ctx: VoiceInstructionContext): string {
  const scopeParts: string[] = [];
  if (ctx.frameworkId) scopeParts.push(`Framework: ${ctx.frameworkId}`);
  if (ctx.controlSlug) {
    scopeParts.push(
      `Control: ${ctx.controlSlug}${ctx.controlTitle ? ` (${ctx.controlTitle})` : ''}`,
    );
  }
  const scopeBlock = scopeParts.length > 0 ? scopeParts.join('\n') : 'Scope: General myctrl.tools workspace';

  if (ctx.mode === 'audit-interview') {
    const questionsBlock =
      ctx.assessmentQuestions && ctx.assessmentQuestions.length > 0
        ? `\nGrounding assessment prompts:\n${ctx.assessmentQuestions.slice(0, 6).map((q, i) => `${i + 1}. ${q}`).join('\n')}`
        : '';

    return [
      'You are GRCLanker running a realistic, constructive Mock Audit Interview over live voice.',
      scopeBlock,
      questionsBlock,
      'Rules:',
      '- Keep spoken turns concise (2-4 sentences). Ask ONE interview question at a time and pause for the practitioner answer.',
      '- Evaluate evidence clarity: probe for concrete technical mechanisms, owners, logging/monitoring, and exceptions.',
      '- Call get_control_context or search_controls before citing specific control parameters.',
      '- Never read raw JSON, markdown tables, or URLs verbatim.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    'You are GRCLanker, the live voice copilot inside myctrl.tools (security controls, baselines, crosswalks, and assessments).',
    scopeBlock,
    'Rules:',
    '- Respond conversationally in 2-4 crisp sentences optimized for listening.',
    '- Use tools (get_control_context, search_controls, get_crosswalks, inspect_ui, ui_act) instead of guessing control details.',
    '- Ask brief confirmation before executing destructive or page-changing UI steps.',
    '- Never recite markdown tables, raw JSON, or punctuation syntax aloud.',
  ].join('\n');
}

export interface VoiceToolDescriptor {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export function buildGrokSessionUpdate(options: {
  instructions: string;
  voice: string;
  tools: VoiceToolDescriptor[];
}) {
  return {
    type: 'session.update',
    session: {
      voice: getDefaultVoice('grok', options.voice),
      instructions: options.instructions,
      turn_detection: {
        type: 'server_vad',
      },
      audio: {
        input: {
          format: { type: 'audio/pcm', rate: 24000 },
        },
        output: {
          format: { type: 'audio/pcm', rate: 24000 },
        },
      },
      tools: options.tools.map((t) => ({
        type: 'function',
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    },
  };
}

export function buildOpenAISessionUpdate(options: {
  instructions: string;
  voice: string;
  tools: VoiceToolDescriptor[];
}) {
  return {
    type: 'session.update',
    session: {
      type: 'realtime',
      instructions: options.instructions,
      audio: {
        output: {
          voice: getDefaultVoice('openai', options.voice),
        },
      },
      tools: options.tools.map((t) => ({
        type: 'function',
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    },
  };
}

export function buildGeminiSetupMessage(options: {
  model?: string;
  instructions: string;
  voice: string;
  tools: VoiceToolDescriptor[];
}) {
  return {
    setup: {
      model: options.model || GEMINI_LIVE_MODEL,
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: getDefaultVoice('gemini', options.voice),
            },
          },
        },
      },
      systemInstruction: {
        parts: [{ text: options.instructions }],
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      tools:
        options.tools.length > 0
          ? [
              {
                functionDeclarations: options.tools.map((t) => ({
                  name: t.name,
                  description: t.description,
                  parameters: t.parameters,
                })),
              },
            ]
          : undefined,
    },
  };
}

export type NormalizedVoiceEvent =
  | { kind: 'session_ready' }
  | { kind: 'audio_delta'; base64Pcm: string; sampleRate: number }
  | { kind: 'transcript_delta'; role: 'user' | 'assistant'; text: string; final: boolean }
  | { kind: 'interrupted' }
  | { kind: 'turn_complete' }
  | { kind: 'tool_call'; callId: string; name: string; args: Record<string, unknown> }
  | { kind: 'error'; message: string };

function safeJsonParseObject(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

export function parseRealtimeServerEvent(raw: unknown): NormalizedVoiceEvent[] {
  if (!raw || typeof raw !== 'object') return [];
  const evt = raw as Record<string, unknown>;
  const type = typeof evt.type === 'string' ? evt.type : '';
  const events: NormalizedVoiceEvent[] = [];

  if (type === 'session.created' || type === 'session.updated') {
    events.push({ kind: 'session_ready' });
  } else if (type === 'response.output_audio.delta' || type === 'response.audio.delta') {
    if (typeof evt.delta === 'string' && evt.delta.length > 0) {
      events.push({ kind: 'audio_delta', base64Pcm: evt.delta, sampleRate: 24000 });
    }
  } else if (
    type === 'response.output_audio_transcript.delta' ||
    type === 'response.audio_transcript.delta'
  ) {
    if (typeof evt.delta === 'string' && evt.delta.length > 0) {
      events.push({ kind: 'transcript_delta', role: 'assistant', text: evt.delta, final: false });
    }
  } else if (
    type === 'response.output_audio_transcript.done' ||
    type === 'response.audio_transcript.done'
  ) {
    if (typeof evt.transcript === 'string' && evt.transcript.length > 0) {
      events.push({ kind: 'transcript_delta', role: 'assistant', text: evt.transcript, final: true });
    }
  } else if (type === 'conversation.item.input_audio_transcription.completed') {
    if (typeof evt.transcript === 'string' && evt.transcript.length > 0) {
      events.push({ kind: 'transcript_delta', role: 'user', text: evt.transcript, final: true });
    }
  } else if (type === 'input_audio_buffer.speech_started') {
    events.push({ kind: 'interrupted' });
  } else if (type === 'response.done') {
    events.push({ kind: 'turn_complete' });
  } else if (type === 'response.function_call_arguments.done') {
    const callId = String(evt.call_id || evt.item_id || '');
    const name = String(evt.name || '');
    if (name) {
      events.push({
        kind: 'tool_call',
        callId,
        name,
        args: safeJsonParseObject(evt.arguments),
      });
    }
  } else if (type === 'error') {
    const err = evt.error as Record<string, unknown> | undefined;
    const msg = typeof err?.message === 'string' ? err.message : 'Realtime session error';
    events.push({ kind: 'error', message: msg });
  }

  return events;
}

export function parseGeminiServerMessage(raw: unknown): NormalizedVoiceEvent[] {
  if (!raw || typeof raw !== 'object') return [];
  const msg = raw as Record<string, unknown>;
  const events: NormalizedVoiceEvent[] = [];

  if ('setupComplete' in msg) {
    events.push({ kind: 'session_ready' });
  }

  const serverContent = msg.serverContent as Record<string, unknown> | undefined;
  if (serverContent) {
    if (serverContent.interrupted) {
      events.push({ kind: 'interrupted' });
    }

    const modelTurn = serverContent.modelTurn as { parts?: Array<Record<string, unknown>> } | undefined;
    if (modelTurn?.parts) {
      for (const part of modelTurn.parts) {
        const inlineData = part.inlineData as { mimeType?: string; data?: string } | undefined;
        if (inlineData?.data && (!inlineData.mimeType || inlineData.mimeType.startsWith('audio/pcm'))) {
          events.push({ kind: 'audio_delta', base64Pcm: inlineData.data, sampleRate: 24000 });
        }
      }
    }

    const inputTx = serverContent.inputTranscription as { text?: string } | undefined;
    if (typeof inputTx?.text === 'string' && inputTx.text.trim()) {
      events.push({ kind: 'transcript_delta', role: 'user', text: inputTx.text, final: false });
    }

    const outputTx = serverContent.outputTranscription as { text?: string } | undefined;
    if (typeof outputTx?.text === 'string' && outputTx.text.trim()) {
      events.push({ kind: 'transcript_delta', role: 'assistant', text: outputTx.text, final: false });
    }

    if (serverContent.turnComplete) {
      events.push({ kind: 'turn_complete' });
    }
  }

  const toolCall = msg.toolCall as
    | { functionCalls?: Array<{ id?: string; name?: string; args?: Record<string, unknown> }> }
    | undefined;
  if (toolCall?.functionCalls) {
    for (const call of toolCall.functionCalls) {
      if (!call.name) continue;
      events.push({
        kind: 'tool_call',
        callId: String(call.id || call.name),
        name: call.name,
        args: safeJsonParseObject(call.args),
      });
    }
  }

  return events;
}
