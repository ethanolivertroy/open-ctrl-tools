import { useCallback, useRef, useState } from 'react';
import type { AIContext } from '@/lib/ai-data-context';
import type { ConversationTurn } from '@/lib/ai/conversation';
import { PROVIDERS, type ProviderId } from '@/lib/ai/providers';
import { generateTextWithProvider } from '@/lib/services/ai-text-generation';
import { getProviderConfig } from '@/lib/storage/provider-store';

export type AITextStreamStatus = 'idle' | 'streaming' | 'complete' | 'error';

interface UseAITextGenerationOptions {
  activeProvider: ProviderId;
  systemPrompt: string;
  context?: AIContext;
  defaultModel?: string;
  maxOutputTokens?: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
  timeoutMs?: number;
  getInitialStatusMessage?: (providerId: ProviderId, providerName: string) => string | null;
  getTimeoutMessage?: (providerName: string) => string;
}

export function useAITextGeneration({
  activeProvider,
  systemPrompt,
  context,
  defaultModel,
  maxOutputTokens,
  reasoningEffort,
  timeoutMs,
  getInitialStatusMessage,
  getTimeoutMessage,
}: UseAITextGenerationOptions) {
  const [streamStatus, setStreamStatus] = useState<AITextStreamStatus>('idle');
  const [response, setResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearOutput = useCallback(() => {
    abortRef.current?.abort();
    setResponse('');
    setError(null);
    setStatusMessage(null);
    setStreamStatus('idle');
  }, []);

  const hydrateResponse = useCallback((content: string) => {
    setResponse(content);
    setError(null);
    setStatusMessage(null);
    setStreamStatus(content ? 'complete' : 'idle');
  }, []);

  const requestText = useCallback(async (
    prompt: string,
    options?: { conversation?: ConversationTurn[] },
  ): Promise<string | null> => {
    if (!prompt.trim() || streamStatus === 'streaming') {
      return null;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const providerName = PROVIDERS[activeProvider]?.name || activeProvider;
    setResponse('');
    setError(null);
    setStatusMessage(getInitialStatusMessage?.(activeProvider, providerName) ?? null);
    setStreamStatus('streaming');

    const providerConfig = await getProviderConfig(activeProvider);

    try {
      const text = await generateTextWithProvider({
        provider: activeProvider,
        providerConfig,
        prompt,
        systemPrompt,
        context,
        signal: abortRef.current.signal,
        defaultModel,
        maxOutputTokens,
        conversation: options?.conversation,
        reasoningEffort,
        timeoutMs,
        timeoutMessage: getTimeoutMessage?.(providerName),
        onStatusMessage: setStatusMessage,
        onChunk: (content) => {
          setResponse(content);
        },
      });

      setStatusMessage(null);
      setResponse(text);
      setStreamStatus('complete');
      return text;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setStatusMessage(null);
        setStreamStatus('idle');
        return null;
      }

      setStatusMessage(null);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStreamStatus('error');
      return null;
    }
  }, [
    activeProvider,
    context,
    defaultModel,
    reasoningEffort,
    getInitialStatusMessage,
    getTimeoutMessage,
    maxOutputTokens,
    streamStatus,
    systemPrompt,
    timeoutMs,
  ]);

  return {
    streamStatus,
    response,
    error,
    statusMessage,
    requestText,
    stopStreaming,
    clearOutput,
    hydrateResponse,
  };
}
