import {
  detectProviderFromKey,
  getDefaultBaseUrl,
  getDefaultModelId,
  getModelConfig,
  PROVIDERS,
  resolveStoredModelId,
  type ProviderId,
} from '@/lib/ai/providers';
import { getLegacyStoredApiKey, getProviderConfig } from '@/lib/storage/provider-store';
import type { ProviderConfigRecord } from '@/lib/storage-types';
import { resolveStoredGrokCredential } from './xai-oauth-session';

export type LocalProviderId = Extract<ProviderId, 'ollama' | 'transformers' | 'webllm' | 'chrome-ai' | 'cursor'>;

export interface ResolvedProviderExecution {
  providerId: ProviderId;
  providerName: string;
  providerConfig: ProviderConfigRecord | null;
  model: string;
  baseUrl?: string;
  apiKey?: string;
}

interface ResolveProviderExecutionOptions {
  providerId: ProviderId;
  providerConfig?: ProviderConfigRecord | null;
  modelOverride?: string;
  baseUrlOverride?: string;
  includeApiKey?: boolean;
}

interface GenerateLocalProviderTextOptions {
  provider: LocalProviderId;
  prompt: string;
  systemPrompt?: string;
  signal?: AbortSignal;
  model?: string;
  baseUrl?: string;
  /** Bearer token for browser-executed providers that accept one (Cursor proxy) */
  apiKey?: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
  timeoutMessage?: string;
  onChunk?: (content: string, chunk?: string) => void;
  onStatusMessage?: (message: string | null) => void;
}

export class ServerProviderTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export function isLocalProvider(providerId: ProviderId): providerId is LocalProviderId {
  // Browser-executed providers are the ones flagged isBrowserOnly in the
  // registry; keep that flag as the single source of truth.
  return Boolean(PROVIDERS[providerId]?.isBrowserOnly);
}

export async function resolveProviderExecution({
  providerId,
  providerConfig,
  modelOverride,
  baseUrlOverride,
  includeApiKey = false,
}: ResolveProviderExecutionOptions): Promise<ResolvedProviderExecution> {
  const resolvedProviderConfig = providerConfig ?? await getProviderConfig(providerId);
  const legacyApiKey = includeApiKey && !resolvedProviderConfig?.apiKey && !resolvedProviderConfig?.oauth
    ? await getCompatibleLegacyApiKey(providerId)
    : undefined;

  let apiKey: string | undefined;
  if (includeApiKey) {
    if (providerId === 'grok' && resolvedProviderConfig?.oauth?.refreshToken) {
      apiKey = await resolveStoredGrokCredential(resolvedProviderConfig, legacyApiKey);
    } else {
      apiKey = resolvedProviderConfig?.apiKey || legacyApiKey || undefined;
    }
  }

  return {
    providerId,
    providerName: PROVIDERS[providerId]?.name || providerId,
    providerConfig: resolvedProviderConfig,
    model: resolveStoredModelId(providerId, modelOverride || resolvedProviderConfig?.model),
    baseUrl: resolvedProviderConfig?.baseUrl || baseUrlOverride || getDefaultBaseUrl(providerId),
    apiKey,
  };
}

async function getCompatibleLegacyApiKey(providerId: ProviderId): Promise<string | undefined> {
  const legacyApiKey = await getLegacyStoredApiKey();
  if (!legacyApiKey) return undefined;

  const detectedProvider = detectProviderFromKey(legacyApiKey);
  return detectedProvider === providerId ? legacyApiKey : undefined;
}

export function getProviderSupportsStructuredOutput(
  providerId: ProviderId,
  modelId?: string | null,
): boolean {
  return getModelConfig(providerId, modelId)?.supportsStructuredOutput ?? false;
}

export async function generateLocalProviderText({
  provider,
  prompt,
  systemPrompt = '',
  signal,
  model,
  baseUrl,
  apiKey,
  maxOutputTokens,
  timeoutMs,
  timeoutMessage,
  onChunk,
  onStatusMessage,
}: GenerateLocalProviderTextOptions): Promise<string> {
  switch (provider) {
    case 'cursor': {
      const { generateCursorText } = await import('@/lib/ai/cursor-client');
      return generateCursorText({
        baseUrl: baseUrl || getDefaultBaseUrl('cursor') || 'http://localhost:4646/v1',
        model: model || getDefaultModelId('cursor'),
        prompt,
        systemPrompt,
        apiKey,
        signal,
        onChunk,
      });
    }
    case 'ollama':
      return generateOllamaText({
        baseUrl: baseUrl || getDefaultBaseUrl('ollama') || 'http://localhost:11434',
        model: model || getDefaultModelId('ollama'),
        prompt,
        systemPrompt,
        signal,
        timeoutMs,
        timeoutMessage,
        onChunk,
        onStatusMessage,
      });
    case 'transformers':
      return generateTransformersText({
        model: model || getDefaultModelId('transformers'),
        prompt,
        systemPrompt,
        signal,
        maxOutputTokens,
        onChunk,
        onStatusMessage,
      });
    case 'webllm':
      return generateWebllmText({
        model: model || getDefaultModelId('webllm'),
        prompt,
        systemPrompt,
        signal,
        onChunk,
        onStatusMessage,
      });
    case 'chrome-ai':
      return generateChromeAiText({
        prompt,
        systemPrompt,
        signal,
        onChunk,
        onStatusMessage,
      });
  }
}

async function generateOllamaText({
  baseUrl,
  model,
  prompt,
  systemPrompt,
  signal,
  timeoutMs,
  timeoutMessage,
  onChunk,
  onStatusMessage,
}: {
  baseUrl: string;
  model: string;
  prompt: string;
  systemPrompt: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  timeoutMessage?: string;
  onChunk?: (content: string, chunk?: string) => void;
  onStatusMessage?: (message: string | null) => void;
}): Promise<string> {
  onStatusMessage?.('Waiting for Ollama to respond...');
  const { streamOllamaResponse } = await import('@/lib/ai/ollama-client');

  return new Promise<string>((resolve, reject) => {
    let fullText = '';
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      signal?.removeEventListener('abort', handleAbort);
    };

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };

    const controller = streamOllamaResponse(baseUrl, model, systemPrompt, prompt, {
      onToken: (token) => {
        fullText += token;
        onStatusMessage?.(null);
        onChunk?.(fullText, token);
      },
      onComplete: () => finish(() => resolve(fullText)),
      onError: (error) => finish(() => reject(error)),
    });

    function handleAbort() {
      finish(() => {
        controller.abort();
        reject(createAbortError());
      });
    }

    if (signal?.aborted) {
      handleAbort();
      return;
    }

    signal?.addEventListener('abort', handleAbort, { once: true });

    if (timeoutMs && timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        finish(() => {
          controller.abort();
          reject(new ServerProviderTimeoutError(
            timeoutMessage || 'Ollama took too long to respond. Try a shorter request or switch providers.',
          ));
        });
      }, timeoutMs);
    }
  });
}

async function generateTransformersText({
  model,
  prompt,
  systemPrompt,
  signal,
  maxOutputTokens,
  onChunk,
  onStatusMessage,
}: {
  model: string;
  prompt: string;
  systemPrompt: string;
  signal?: AbortSignal;
  maxOutputTokens?: number;
  onChunk?: (content: string, chunk?: string) => void;
  onStatusMessage?: (message: string | null) => void;
}): Promise<string> {
  throwIfAborted(signal);
  const { initTransformers, streamGenerateText } = await import('@/lib/ai/transformers-client');

  await initTransformers(model, (progress) => {
    onStatusMessage?.(progress.message);
  });

  throwIfAborted(signal);

  const text = await streamGenerateText(
    prompt,
    (content) => {
      onStatusMessage?.(null);
      onChunk?.(content);
    },
    (progress) => {
      onStatusMessage?.(progress.message);
    },
    systemPrompt,
    maxOutputTokens,
  );

  onStatusMessage?.(null);
  return text;
}

async function generateWebllmText({
  model,
  prompt,
  systemPrompt,
  signal,
  onChunk,
  onStatusMessage,
}: {
  model: string;
  prompt: string;
  systemPrompt: string;
  signal?: AbortSignal;
  onChunk?: (content: string, chunk?: string) => void;
  onStatusMessage?: (message: string | null) => void;
}): Promise<string> {
  throwIfAborted(signal);
  const { initWebLLM, streamGenerateWebLLM } = await import('@/lib/ai/webllm-client');

  await initWebLLM(model, (progress) => {
    onStatusMessage?.(progress.message);
  });

  throwIfAborted(signal);

  const text = await streamGenerateWebLLM(
    systemPrompt,
    prompt,
    (content) => {
      onStatusMessage?.(null);
      onChunk?.(content);
    },
    (progress) => {
      onStatusMessage?.(progress.message);
    },
  );

  onStatusMessage?.(null);
  return text;
}

async function generateChromeAiText({
  prompt,
  systemPrompt,
  signal,
  onChunk,
  onStatusMessage,
}: {
  prompt: string;
  systemPrompt: string;
  signal?: AbortSignal;
  onChunk?: (content: string, chunk?: string) => void;
  onStatusMessage?: (message: string | null) => void;
}): Promise<string> {
  throwIfAborted(signal);
  const { streamGenerateChromeAI } = await import('@/lib/ai/chrome-ai-client');

  const text = await streamGenerateChromeAI(systemPrompt, prompt, (content) => {
    const looksLikeStatus = content.startsWith('Downloading ') || content.startsWith('Loading ');
    if (looksLikeStatus) {
      onStatusMessage?.(content);
      return;
    }
    onStatusMessage?.(null);
    onChunk?.(content);
  });

  throwIfAborted(signal);
  onStatusMessage?.(null);
  return text;
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw createAbortError();
}

export function createAbortError(): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('The operation was aborted.', 'AbortError');
  }

  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}
