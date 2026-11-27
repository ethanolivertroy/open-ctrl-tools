import type { AIContext, AIUserData } from '@/lib/ai-data-context';
import type { ConversationTurn } from '@/lib/ai/conversation';
import { clipConversationHistory } from '@/lib/ai/conversation';
import { PROVIDERS, type ProviderId } from '@/lib/ai/providers';
import {
  createAbortError,
  ServerProviderTimeoutError,
} from './provider-runtime';

export interface StreamServerProviderOptions {
  prompt: string;
  context?: AIContext;
  includeUserData?: boolean;
  userData?: AIUserData;
  apiKey?: string;
  provider: ProviderId;
  model?: string;
  baseUrl?: string;
  maxOutputTokens?: number;
  systemPromptOverride?: string;
  conversation?: ConversationTurn[];
  reasoningEffort?: 'low' | 'medium' | 'high';
  signal?: AbortSignal;
  timeoutMs?: number;
  timeoutMessage?: string;
  onChunk?: (content: string, chunk: string) => void;
}

export async function streamServerProviderResponse({
  prompt,
  context,
  includeUserData = false,
  userData,
  apiKey,
  provider,
  model,
  baseUrl,
  maxOutputTokens,
  systemPromptOverride,
  conversation,
  reasoningEffort,
  signal,
  timeoutMs,
  timeoutMessage,
  onChunk,
}: StreamServerProviderOptions): Promise<string> {
  const controller = new AbortController();
  const abortSignal = controller.signal;
  const providerName = PROVIDERS[provider]?.name || provider;
  const resolvedTimeoutMessage = timeoutMessage
    || `${providerName} took too long to respond. Try a shorter request or switch providers.`;
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const abortFromParent = () => {
    controller.abort(createAbortError());
  };

  if (signal?.aborted) {
    throw createAbortError();
  }

  signal?.addEventListener('abort', abortFromParent, { once: true });

  if (timeoutMs && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort(new ServerProviderTimeoutError(resolvedTimeoutMessage));
    }, timeoutMs);
  }

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        context,
        includeUserData,
        userData,
        apiKey,
        provider,
        model,
        baseUrl,
        maxOutputTokens,
        systemPromptOverride,
        conversation: conversation ? clipConversationHistory(conversation) : undefined,
        reasoningEffort,
      }),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      fullContent += chunk;
      onChunk?.(fullContent, chunk);
    }

    // Upstream errors arrive as non-200 responses (handled above); a 200
    // stream is always model output, so no error sniffing is needed here.
    if (!fullContent.trim()) {
      throw new Error('Provider returned an empty response. Check the model ID and API key.');
    }

    return fullContent;
  } catch (error) {
    if (timedOut) {
      throw new ServerProviderTimeoutError(resolvedTimeoutMessage);
    }
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    signal?.removeEventListener('abort', abortFromParent);
  }
}
