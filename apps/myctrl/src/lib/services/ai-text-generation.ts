import type { AIContext } from '@/lib/ai-data-context';
import type { ConversationTurn } from '@/lib/ai/conversation';
import type { ProviderId } from '@/lib/ai/providers';
import type { ProviderConfigRecord } from '@/lib/storage-types';
import {
  generateLocalProviderText,
  isLocalProvider,
  resolveProviderExecution,
} from './provider-runtime';
import {
  streamServerProviderResponse,
} from './server-provider-client';

interface GenerateProviderTextOptions {
  provider: ProviderId;
  providerConfig?: ProviderConfigRecord | null;
  prompt: string;
  systemPrompt: string;
  context?: AIContext;
  signal?: AbortSignal;
  defaultModel?: string;
  defaultBaseUrl?: string;
  maxOutputTokens?: number;
  conversation?: ConversationTurn[];
  reasoningEffort?: 'low' | 'medium' | 'high';
  timeoutMs?: number;
  timeoutMessage?: string;
  onChunk?: (content: string, chunk?: string) => void;
  onStatusMessage?: (message: string | null) => void;
}

export async function generateTextWithProvider({
  provider,
  providerConfig,
  prompt,
  systemPrompt,
  context,
  signal,
  defaultModel,
  defaultBaseUrl,
  maxOutputTokens,
  conversation,
  reasoningEffort,
  timeoutMs,
  timeoutMessage,
  onChunk,
  onStatusMessage,
}: GenerateProviderTextOptions): Promise<string> {
  const execution = await resolveProviderExecution({
    providerId: provider,
    providerConfig,
    modelOverride: defaultModel,
    baseUrlOverride: defaultBaseUrl,
    includeApiKey: !isLocalProvider(provider) || provider === 'cursor',
  });

  if (isLocalProvider(provider)) {
    return generateLocalProviderText({
      provider,
      prompt,
      systemPrompt,
      signal,
      model: execution.model,
      baseUrl: execution.baseUrl,
      apiKey: execution.apiKey,
      maxOutputTokens,
      timeoutMs,
      timeoutMessage,
      onChunk,
      onStatusMessage,
    });
  }

  return streamServerProviderResponse({
    prompt,
    context,
    apiKey: execution.apiKey,
    provider,
    model: execution.model,
    baseUrl: execution.baseUrl,
    maxOutputTokens,
    systemPromptOverride: systemPrompt,
    conversation,
    reasoningEffort,
    signal,
    timeoutMs,
    timeoutMessage: timeoutMessage
      || `${execution.providerName} took too long to respond. Try a shorter request or switch providers.`,
    onChunk: (content, chunk) => {
      onStatusMessage?.(null);
      onChunk?.(content, chunk);
    },
  });
}
