import { afterEach, describe, expect, it, vi } from 'vitest';
import { streamServerProviderResponse } from '../server-provider-client';

describe('streamServerProviderResponse conversation forwarding', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards and caps conversation history on /api/generate', async () => {
    const fetchMock = vi.fn(async () => new Response('ok from grok', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await streamServerProviderResponse({
      prompt: 'follow up on AC-2 evidence',
      provider: 'grok',
      apiKey: 'xai-test',
      systemPromptOverride: 'You are GRCLanker.',
      reasoningEffort: 'medium',
      conversation: Array.from({ length: 16 }, (_, index) => ({
        role: index % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `turn ${index + 1}`,
      })),
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(call[1].body)) as {
      conversation: Array<{ role: string; content: string }>;
      reasoningEffort?: string;
      prompt: string;
    };
    expect(body.prompt).toBe('follow up on AC-2 evidence');
    expect(body.reasoningEffort).toBe('medium');
    expect(body.conversation).toHaveLength(12);
    expect(body.conversation[0]?.content).toBe('turn 5');
    expect(body.conversation.at(-1)?.content).toBe('turn 16');
  });
});
