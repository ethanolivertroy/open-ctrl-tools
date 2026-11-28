import { describe, expect, it } from 'vitest';
import {
  buildGeminiSetupMessage,
  buildGrokSessionUpdate,
  buildOpenAISessionUpdate,
  buildVoiceInstructions,
  getDefaultVoice,
  parseGeminiServerMessage,
  parseRealtimeServerEvent,
} from '../protocol';

describe('voice protocol builders', () => {
  it('picks valid defaults and respects requested voice presets', () => {
    expect(getDefaultVoice('openai')).toBe('marin');
    expect(getDefaultVoice('openai', 'cedar')).toBe('cedar');
    expect(getDefaultVoice('openai', 'unknown')).toBe('marin');
    expect(getDefaultVoice('grok')).toBe('eve');
    expect(getDefaultVoice('gemini')).toBe('Kore');
    expect(getDefaultVoice('browser')).toBe('default');
  });

  it('builds scoped copilot and mock audit interview instructions', () => {
    const copilot = buildVoiceInstructions({
      mode: 'copilot',
      frameworkId: 'nist-800-53-r5',
      controlSlug: 'ac-2',
      controlTitle: 'Account Management',
    });
    expect(copilot).toContain('nist-800-53-r5');
    expect(copilot).toContain('Account Management');
    expect(copilot).toContain('inspect_ui');

    const audit = buildVoiceInstructions({
      mode: 'audit-interview',
      frameworkId: 'fedramp-rev5',
      controlSlug: 'ia-2',
      controlTitle: 'Identification and Authentication',
      assessmentQuestions: ['How is phishing-resistant MFA enforced for privileged access?'],
    });
    expect(audit).toContain('Mock Audit Interview');
    expect(audit).toContain('How is phishing-resistant MFA enforced');
  });

  it('places Grok voice top-level in session.update with 24kHz PCM format', () => {
    const payload = buildGrokSessionUpdate({
      instructions: 'Be concise.',
      voice: 'rex',
      tools: [
        {
          name: 'search_controls',
          description: 'Search controls',
          parameters: { type: 'object', properties: {} },
        },
      ],
    });
    expect(payload.type).toBe('session.update');
    expect(payload.session.voice).toBe('rex');
    expect(payload.session.audio.input.format.rate).toBe(24000);
    expect(payload.session.tools).toHaveLength(1);
  });

  it('builds OpenAI realtime session.update and Gemini setup message', () => {
    const oai = buildOpenAISessionUpdate({
      instructions: 'Be concise.',
      voice: 'cedar',
      tools: [],
    });
    expect(oai.session.type).toBe('realtime');
    expect(oai.session.audio.output.voice).toBe('cedar');

    const gemini = buildGeminiSetupMessage({
      instructions: 'Be concise.',
      voice: 'Aoede',
      tools: [
        {
          name: 'inspect_ui',
          description: 'Inspect components',
          parameters: { type: 'object', properties: {} },
        },
      ],
    });
    expect(gemini.setup.generationConfig.responseModalities).toEqual(['AUDIO']);
    expect(gemini.setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe('Aoede');
    expect(gemini.setup.tools?.[0].functionDeclarations[0].name).toBe('inspect_ui');
  });
});

describe('realtime server event normalizers', () => {
  it('handles both output_audio.delta and audio.delta on OpenAI / Grok', () => {
    expect(
      parseRealtimeServerEvent({ type: 'response.output_audio.delta', delta: 'AQID' }),
    ).toEqual([{ kind: 'audio_delta', base64Pcm: 'AQID', sampleRate: 24000 }]);

    expect(
      parseRealtimeServerEvent({ type: 'response.audio.delta', delta: 'BAUG' }),
    ).toEqual([{ kind: 'audio_delta', base64Pcm: 'BAUG', sampleRate: 24000 }]);
  });

  it('normalizes tool calls and interruptions across OpenAI/Grok and Gemini', () => {
    const oaiTool = parseRealtimeServerEvent({
      type: 'response.function_call_arguments.done',
      call_id: 'call_1',
      name: 'search_controls',
      arguments: '{"query":"AC-2"}',
    });
    expect(oaiTool).toEqual([
      { kind: 'tool_call', callId: 'call_1', name: 'search_controls', args: { query: 'AC-2' } },
    ]);

    const geminiInterrupt = parseGeminiServerMessage({
      serverContent: {
        interrupted: true,
        outputTranscription: { text: 'Sure — ' },
      },
    });
    expect(geminiInterrupt).toEqual([
      { kind: 'interrupted' },
      { kind: 'transcript_delta', role: 'assistant', text: 'Sure — ', final: false },
    ]);

    const geminiTool = parseGeminiServerMessage({
      toolCall: {
        functionCalls: [{ id: 'g1', name: 'get_crosswalks', args: { frameworkId: 'nist-csf-v2', controlId: 'PR.AA-01' } }],
      },
    });
    expect(geminiTool).toEqual([
      {
        kind: 'tool_call',
        callId: 'g1',
        name: 'get_crosswalks',
        args: { frameworkId: 'nist-csf-v2', controlId: 'PR.AA-01' },
      },
    ]);
  });
});
