import {
  getAIUserData,
  type AIContext,
  type AIUserData,
} from '@/lib/ai-data-context';
import { parseStructuredViewOrWrap, parseStructuredViewResponse } from '@/lib/ai/structured-view';
import { adaptPromptForProvider } from '@/lib/ai/prompt-adapters';
import { getClassifierPrompt, parseIntent } from '@/lib/ai/intent-classifier';
import { buildFromIntent } from '@/lib/ai/view-templates';
import { wrapTextInView } from '@/lib/ai/view-utils';
import { getGenerationDefaults, type ProviderId } from '@/lib/ai/providers';
import { generateSystemPrompt, type View } from '@/lib/json-render/catalog';
import { streamServerProviderResponse } from '@/lib/services/server-provider-client';
import {
  createAbortError,
  generateLocalProviderText,
  getProviderSupportsStructuredOutput,
  isLocalProvider,
  resolveProviderExecution,
  throwIfAborted,
} from './provider-runtime';

export type AIViewGenerationStatus = 'generating' | 'streaming';

export interface GenerateAIViewOptions {
  prompt: string;
  context?: AIContext;
  includeUserData: boolean;
  providerId: ProviderId;
  activeModel?: string;
  signal: AbortSignal;
  onStatusChange?: (status: AIViewGenerationStatus) => void;
  onStream?: (content: string) => void;
}

export async function generateAIView({
  prompt,
  context,
  includeUserData,
  providerId,
  activeModel,
  signal,
  onStatusChange,
  onStream,
}: GenerateAIViewOptions): Promise<View> {
  throwIfAborted(signal);

  const execution = await resolveProviderExecution({
    providerId,
    modelOverride: activeModel,
    includeApiKey: !isLocalProvider(providerId) || providerId === 'cursor',
  });

  if (providerId === 'cursor') {
    return generateCursorView({
      prompt,
      context,
      includeUserData,
      signal,
      onStatusChange,
      onStream,
      baseUrl: execution.baseUrl || 'http://localhost:4646/v1',
      model: execution.model,
      apiKey: execution.apiKey,
    });
  }

  if (providerId === 'ollama') {
    return generateOllamaView({
      prompt,
      context,
      includeUserData,
      signal,
      onStatusChange,
      onStream,
      baseUrl: execution.baseUrl || 'http://localhost:11434',
      model: execution.model,
    });
  }

  if (providerId === 'transformers') {
    return generateTransformersView({
      prompt,
      context,
      includeUserData,
      signal,
      onStatusChange,
      onStream,
      model: execution.model,
    });
  }

  if (providerId === 'webllm') {
    return generateWebLLMView({
      prompt,
      context,
      includeUserData,
      signal,
      onStatusChange,
      onStream,
      model: execution.model,
    });
  }

  if (providerId === 'chrome-ai') {
    return generateChromeAIView({
      prompt,
      context,
      signal,
      onStatusChange,
      onStream,
    });
  }

  return generateServerProviderView({
    prompt,
    context,
    includeUserData,
    signal,
    onStatusChange,
    onStream,
    providerId,
    model: execution.model,
    baseUrl: execution.baseUrl,
    apiKey: execution.apiKey,
  });
}

interface BaseGenerationOptions {
  prompt: string;
  context?: AIContext;
  includeUserData: boolean;
  signal: AbortSignal;
  onStatusChange?: (status: AIViewGenerationStatus) => void;
  onStream?: (content: string) => void;
}

async function generateCursorView(
  options: BaseGenerationOptions & {
    baseUrl: string;
    model: string;
    apiKey?: string;
  },
): Promise<View> {
  options.onStatusChange?.('generating');
  const systemPrompt = adaptPromptForProvider(generateSystemPrompt(options.context), 'cursor');
  const userData = await getOptionalUserData(options.includeUserData);
  const userMessage = buildUserMessage(options.prompt, options.context, userData);
  const text = await generateLocalProviderText({
    provider: 'cursor',
    baseUrl: options.baseUrl,
    model: options.model,
    apiKey: options.apiKey,
    prompt: userMessage,
    systemPrompt,
    signal: options.signal,
    onChunk: (content) => {
      options.onStream?.(content);
      options.onStatusChange?.('streaming');
    },
  });
  const { parseStructuredViewResponse } = await import('@/lib/ai/structured-view');
  const result = parseStructuredViewResponse(text);
  if (result.view) {
    return result.view;
  }

  // Wrap plain text in a TextBlock
  return {
    title: 'AI Response',
    components: [
      {
        type: 'TextBlock',
        content: text,
        variant: 'default',
      },
    ],
  };
}

async function generateOllamaView(
  options: BaseGenerationOptions & {
    baseUrl: string;
    model: string;
  },
): Promise<View> {
  options.onStatusChange?.('generating');
  const systemPrompt = adaptPromptForProvider(generateSystemPrompt(options.context), 'ollama');
  const userData = await getOptionalUserData(options.includeUserData);
  const userMessage = buildUserMessage(options.prompt, options.context, userData);
  const text = await generateLocalProviderText({
    provider: 'ollama',
    baseUrl: options.baseUrl,
    model: options.model,
    prompt: userMessage,
    systemPrompt,
    signal: options.signal,
    onChunk: (content) => {
      options.onStream?.(content);
      options.onStatusChange?.('streaming');
    },
  });
  const { parseOllamaResponse } = await import('@/lib/ai/ollama-client');

  return parseOllamaResponse(text);
}

async function generateTransformersView(
  options: BaseGenerationOptions & {
    model: string;
  },
): Promise<View> {
  options.onStatusChange?.('generating');
  const { initTransformers } = await import('@/lib/ai/transformers-client');

  await initTransformers(options.model, (progress) => {
    if (progress.status === 'downloading') {
      options.onStream?.(`Downloading model... ${progress.progress ? Math.round(progress.progress * 100) + '%' : ''}`);
      return;
    }
    if (progress.status === 'loading') {
      options.onStream?.('Loading model runtime...');
    }
  });

  throwIfAborted(options.signal);
  options.onStatusChange?.('streaming');

  const canStructuredOutput = getProviderSupportsStructuredOutput('transformers', options.model);
  const handleStatusMessage = (message: string | null) => {
    if (message) {
      options.onStream?.(message);
    }
  };

  if (canStructuredOutput) {
    const systemPrompt = adaptPromptForProvider(generateSystemPrompt(options.context), 'transformers', options.model);
    const userData = await getOptionalUserData(options.includeUserData);
    const userMessage = buildUserMessage(options.prompt, options.context, userData);

    const text = await generateLocalProviderText({
      provider: 'transformers',
      model: options.model,
      prompt: userMessage,
      systemPrompt,
      signal: options.signal,
      maxOutputTokens: 4096,
      onChunk: (content) => options.onStream?.(content),
      onStatusMessage: handleStatusMessage,
    });

    const result = parseStructuredViewResponse(text);
    return result.view ?? wrapTextInView(text);
  }

  options.onStream?.('Classifying your request...');
  const classifierText = await generateLocalProviderText({
    provider: 'transformers',
    model: options.model,
    prompt: options.prompt,
    systemPrompt: getClassifierPrompt(),
    signal: options.signal,
    maxOutputTokens: 256,
    onChunk: (content) => options.onStream?.(content),
    onStatusMessage: handleStatusMessage,
  });

  const intent = parseIntent(classifierText, options.prompt, options.context);
  if (intent && intent.intent !== 'explain') {
    const dataView = buildFromIntent(intent, options.context);
    if (dataView) {
      return dataView;
    }
  }

  options.onStream?.('Generating response...');
  const text = await generateLocalProviderText({
    provider: 'transformers',
    model: options.model,
    prompt: options.prompt,
    signal: options.signal,
    maxOutputTokens: 1024,
    onChunk: (content) => options.onStream?.(content),
    onStatusMessage: handleStatusMessage,
  });

  return wrapTextInView(text);
}

async function generateWebLLMView(
  options: BaseGenerationOptions & {
    model: string;
  },
): Promise<View> {
  options.onStatusChange?.('generating');
  const { initWebLLM } = await import('@/lib/ai/webllm-client');

  await initWebLLM(options.model, (progress) => {
    if (progress.status === 'downloading') {
      options.onStream?.(progress.message || `Downloading model... ${progress.progress ? Math.round(progress.progress * 100) + '%' : ''}`);
      return;
    }
    if (progress.status === 'loading') {
      options.onStream?.('Loading WebLLM runtime...');
    }
  });

  throwIfAborted(options.signal);
  options.onStatusChange?.('streaming');

  const canStructuredOutput = getProviderSupportsStructuredOutput('webllm', options.model);
  const systemPrompt = adaptPromptForProvider(generateSystemPrompt(options.context), 'webllm');
  const userData = await getOptionalUserData(options.includeUserData);
  const userMessage = buildUserMessage(options.prompt, options.context, userData);

  const text = await generateLocalProviderText({
    provider: 'webllm',
    model: options.model,
    prompt: userMessage,
    systemPrompt,
    signal: options.signal,
    onChunk: (content) => options.onStream?.(content),
    onStatusMessage: (message) => {
      if (message) {
        options.onStream?.(message);
      }
    },
  });

  if (canStructuredOutput) {
    const result = parseStructuredViewResponse(text);
    if (result.view) {
      return result.view;
    }
  }

  return wrapTextInView(text);
}

async function generateChromeAIView(
  options: Omit<BaseGenerationOptions, 'includeUserData'>,
): Promise<View> {
  options.onStatusChange?.('generating');
  const { getChromeAIStatus, isChromeAIAvailable } = await import('@/lib/ai/chrome-ai-client');

  const available = await isChromeAIAvailable();
  if (!available) {
    throw new Error('Chrome Built-in AI is not available. Enable both flags: chrome://flags/#optimization-guide-on-device-model AND chrome://flags/#prompt-api-for-gemini-nano-multimodal-input');
  }

  const chromeStatus = await getChromeAIStatus();
  if (chromeStatus === 'downloadable') {
    options.onStream?.('Downloading Gemini Nano (~1.5GB, first time only)...');
  } else {
    options.onStream?.('Creating AI session...');
  }

  throwIfAborted(options.signal);
  options.onStatusChange?.('streaming');

  options.onStream?.('Classifying your request...');
  const classifierText = await generateLocalProviderText({
    provider: 'chrome-ai',
    systemPrompt: getClassifierPrompt(),
    prompt: options.prompt,
    signal: options.signal,
    onChunk: (content) => options.onStream?.(content),
    onStatusMessage: (message) => {
      if (message) {
        options.onStream?.(message);
      }
    },
  });

  const intent = parseIntent(classifierText, options.prompt, options.context);
  if (intent && intent.intent !== 'explain') {
    const dataView = buildFromIntent(intent, options.context);
    if (dataView) {
      return dataView;
    }
  }

  options.onStream?.('Generating response...');
  const text = await generateLocalProviderText({
    provider: 'chrome-ai',
    systemPrompt: adaptPromptForProvider(generateSystemPrompt(options.context), 'chrome-ai'),
    prompt: options.prompt,
    signal: options.signal,
    onChunk: (content) => options.onStream?.(content),
    onStatusMessage: (message) => {
      if (message) {
        options.onStream?.(message);
      }
    },
  });

  return wrapTextInView(text);
}

async function generateServerProviderView(
  options: BaseGenerationOptions & {
    providerId: ProviderId;
    model?: string;
    baseUrl?: string;
    apiKey?: string;
  },
): Promise<View> {
  const userData = options.includeUserData ? (await getAIUserData()) ?? undefined : undefined;

  options.onStatusChange?.('generating');
  options.onStatusChange?.('streaming');
  const systemPrompt = adaptPromptForProvider(
    generateSystemPrompt(options.context),
    options.providerId,
    options.model,
  );
  const compactSystemPrompt = systemPrompt.length > 16000
    ? systemPrompt.slice(0, 16000)
    : systemPrompt;
  const generationDefaults = getGenerationDefaults(options.providerId, options.model);

  const fullContent = await streamServerProviderResponse({
    prompt: options.prompt,
    context: options.context,
    includeUserData: options.includeUserData,
    userData,
    apiKey: options.apiKey,
    provider: options.providerId,
    model: options.model,
    baseUrl: options.baseUrl,
    maxOutputTokens: generationDefaults.maxOutputTokens,
    systemPromptOverride: compactSystemPrompt,
    signal: options.signal,
    timeoutMs: generationDefaults.timeoutMs,
    onChunk: (content) => options.onStream?.(content),
  });

  return parseStructuredViewOrWrap(fullContent);
}

async function getOptionalUserData(includeUserData: boolean): Promise<AIUserData | undefined> {
  return includeUserData ? (await getAIUserData()) ?? undefined : undefined;
}

function buildUserMessage(
  prompt: string,
  context?: AIContext,
  userData?: AIUserData,
): string {
  const parts: string[] = [];

  if (context) {
    const contextParts: string[] = [];
    if (context.frameworkId) contextParts.push(`Current framework: ${context.frameworkId}`);
    if (context.controlId) contextParts.push(`Current control: ${context.controlId}`);
    if (context.family) contextParts.push(`Current family: ${context.family}`);
    if (context.assessmentId) contextParts.push(`Current assessment: ${context.assessmentId}`);
    if (context.baseline) contextParts.push(`Current baseline: ${context.baseline}`);
    if (context.systemName) contextParts.push(`Current system: ${context.systemName}`);
    if (contextParts.length > 0) {
      parts.push(`<context>\n${contextParts.join('\n')}\n</context>`);
    }
  }

  if (userData) {
    const userParts: string[] = [];
    if (userData.favorites?.length) userParts.push(`Favorite frameworks: ${userData.favorites.join(', ')}`);
    if (userData.noteCount) userParts.push(`${userData.noteCount} control notes saved`);
    if (userData.recentlyViewed?.length) userParts.push(`Recently viewed: ${userData.recentlyViewed.slice(0, 5).join(', ')}`);
    if (userParts.length > 0) {
      parts.push(`<user_preferences>\n${userParts.join('\n')}\n</user_preferences>`);
    }
  }

  parts.push(prompt);
  return parts.join('\n\n');
}
