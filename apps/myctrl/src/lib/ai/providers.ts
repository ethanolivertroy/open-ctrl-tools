/**
 * AI Provider Registry
 *
 * Static registry of all supported AI providers with model configurations,
 * capabilities, and metadata. Used by the API endpoint to instantiate the
 * correct AI SDK provider and by the UI to display provider options.
 */

import { GENERATED_MODEL_CATALOG } from './model-catalog.generated';

// ============================================================================
// Types
// ============================================================================

export interface ModelConfig {
  id: string;
  name: string;
  /** Whether this model reliably generates structured JSON output */
  supportsStructuredOutput: boolean;
  /** Context window size in tokens */
  contextWindow: number;
  /** Max output tokens */
  maxOutputTokens: number;
  /** Whether this model runs on a cloud service (e.g., Ollama Cloud) */
  isCloud?: boolean;
}

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  /** Short description for the UI */
  description: string;
  /** Where to get an API key */
  docsUrl: string;
  /** Expected API key prefix for validation hints (e.g., "sk-") */
  keyPrefix?: string;
  /** Placeholder text for the API key input */
  keyPlaceholder?: string;
  /** Available models for this provider */
  models: ModelConfig[];
  /** Default model ID */
  defaultModel: string;
  /** Whether this provider runs locally (no API key needed) */
  isLocal?: boolean;
  /** Whether the API key is optional (e.g. proxy handles auth) */
  keyOptional?: boolean;
  /** Whether this provider runs in the browser (bypasses serverless endpoint) */
  isBrowserOnly?: boolean;
  /** Custom base URL support (for OpenRouter, self-hosted, etc.) */
  supportsBaseUrl?: boolean;
  /** Default base URL when the provider has a canonical endpoint */
  defaultBaseUrl?: string;
  /** Placeholder text for the optional base URL input */
  baseUrlPlaceholder?: string;
  /** Icon name from lucide-react */
  icon: string;
}

export type ProviderId =
  | 'anthropic'
  | 'openai'
  | 'grok'
  | 'gemini'
  | 'openrouter'
  | 'cursor'
  | 'ollama'
  | 'transformers'
  | 'webllm'
  | 'chrome-ai';

// Server-side provider model lists are generated from models.dev and the
// OpenRouter live API — regenerate with `npm run models:generate`. Browser
// providers (ollama, transformers, webllm, chrome-ai, cursor) stay
// hand-maintained below because their catalogs aren't covered by models.dev.

// ============================================================================
// Provider Registry
// ============================================================================

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models — best at structured JSON and compliance reasoning',
    docsUrl: 'https://console.anthropic.com/',
    keyPrefix: 'sk-ant-',
    keyPlaceholder: 'sk-ant-api03-...',
    icon: 'Brain',
    ...GENERATED_MODEL_CATALOG.anthropic,
  },

  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT models — fast and widely available',
    docsUrl: 'https://platform.openai.com/api-keys',
    keyPrefix: 'sk-',
    keyPlaceholder: 'sk-proj-...',
    icon: 'Zap',
    ...GENERATED_MODEL_CATALOG.openai,
  },

  grok: {
    id: 'grok',
    name: 'xAI Grok',
    description: 'SuperGrok / X Premium or an API key',
    docsUrl: 'https://console.x.ai/',
    keyPrefix: 'xai-',
    keyPlaceholder: 'xai-...',
    icon: 'Sparkles',
    supportsBaseUrl: true,
    defaultBaseUrl: 'https://api.x.ai/v1',
    baseUrlPlaceholder: 'https://api.x.ai/v1',
    ...GENERATED_MODEL_CATALOG.grok,
  },

  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Free tier available — 15 requests/minute',
    docsUrl: 'https://aistudio.google.com/apikey',
    keyPrefix: 'AI',
    keyPlaceholder: 'AIza...',
    icon: 'Gem',
    ...GENERATED_MODEL_CATALOG.gemini,
  },

  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    description: '100+ models with one API key — aggregate pricing',
    docsUrl: 'https://openrouter.ai/keys',
    keyPrefix: 'sk-or-',
    keyPlaceholder: 'sk-or-v1-...',
    icon: 'Route',
    supportsBaseUrl: true,
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    ...GENERATED_MODEL_CATALOG.openrouter,
  },

  cursor: {
    id: 'cursor',
    name: 'Cursor',
    description: 'Use your Cursor plan via the cursor-bridge (official Cursor SDK)',
    docsUrl: 'https://cursor.com/dashboard',
    keyPrefix: 'crsr_',
    keyPlaceholder: 'crsr_... (optional if your proxy is logged in)',
    icon: 'MousePointer2',
    isBrowserOnly: true,
    keyOptional: true,
    supportsBaseUrl: true,
    defaultBaseUrl: 'http://localhost:4646/v1',
    baseUrlPlaceholder: 'http://localhost:4646/v1',
    defaultModel: 'composer-2.5',
    models: [
      {
        id: 'composer-2.5',
        name: 'Composer 2.5',
        supportsStructuredOutput: true,
        contextWindow: 200000,
        maxOutputTokens: 16384,
      },
      {
        id: 'auto',
        name: 'Auto (Cursor picks)',
        supportsStructuredOutput: false,
        contextWindow: 200000,
        maxOutputTokens: 16384,
      },
    ],
  },

  ollama: {
    id: 'ollama',
    name: 'Ollama',
    description: 'Run models locally — no API key, no cost, full privacy',
    docsUrl: 'https://ollama.ai/download',
    icon: 'HardDrive',
    isLocal: true,
    isBrowserOnly: true,
    defaultBaseUrl: 'http://localhost:11434',
    defaultModel: 'llama3.2:3b',
    models: [
      // Populated dynamically via /api/tags
      {
        id: 'llama3.2:3b',
        name: 'Llama 3.2 (3B)',
        supportsStructuredOutput: false,
        contextWindow: 131072,
        maxOutputTokens: 8192,
      },
    ],
  },

  transformers: {
    id: 'transformers',
    name: 'In-Browser (Transformers.js)',
    description: 'Run models in the browser via WebGPU — no server, fully private',
    docsUrl: 'https://huggingface.co/docs/transformers.js',
    icon: 'Cpu',
    isLocal: true,
    isBrowserOnly: true,
    defaultModel: 'onnx-community/Qwen3.5-0.8B-ONNX',
    models: [
      {
        id: 'onnx-community/Qwen3.5-4B-ONNX',
        name: 'Qwen3.5 4B (best quality)',
        supportsStructuredOutput: true,
        contextWindow: 32768,
        maxOutputTokens: 4096,
      },
      {
        id: 'onnx-community/Qwen3.5-2B-ONNX',
        name: 'Qwen3.5 2B (balanced)',
        supportsStructuredOutput: true,
        contextWindow: 32768,
        maxOutputTokens: 4096,
      },
      {
        id: 'onnx-community/Qwen3.5-0.8B-ONNX',
        name: 'Qwen3.5 0.8B (recommended)',
        supportsStructuredOutput: false,
        contextWindow: 32768,
        maxOutputTokens: 2048,
      },
      {
        id: 'onnx-community/Qwen3-0.6B-ONNX',
        name: 'Qwen3 0.6B (lightweight)',
        supportsStructuredOutput: false,
        contextWindow: 32768,
        maxOutputTokens: 2048,
      },
      {
        id: 'onnx-community/granite-4.0-350m-ONNX-web',
        name: 'Granite 4.0 350M (fastest)',
        supportsStructuredOutput: false,
        contextWindow: 8192,
        maxOutputTokens: 2048,
      },
    ],
  },

  webllm: {
    id: 'webllm',
    name: 'In-Browser (WebLLM)',
    description: 'Run 3-8B models in the browser via WebGPU — structured JSON output capable',
    docsUrl: 'https://webllm.mlc.ai/',
    icon: 'Zap',
    isLocal: true,
    isBrowserOnly: true,
    defaultModel: 'Qwen3-4B-q4f16_1-MLC',
    models: [
      {
        id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
        name: 'Llama 3.2 3B (2.3GB VRAM)',
        supportsStructuredOutput: true,
        contextWindow: 131072,
        maxOutputTokens: 4096,
      },
      {
        id: 'Qwen3-4B-q4f16_1-MLC',
        name: 'Qwen3 4B (3.4GB VRAM)',
        supportsStructuredOutput: true,
        contextWindow: 32768,
        maxOutputTokens: 4096,
      },
      {
        id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
        name: 'Phi-3.5 Mini 3.8B (3.7GB VRAM)',
        supportsStructuredOutput: true,
        contextWindow: 131072,
        maxOutputTokens: 4096,
      },
      {
        id: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC',
        name: 'SmolLM2 1.7B (1.4GB VRAM)',
        supportsStructuredOutput: false,
        contextWindow: 8192,
        maxOutputTokens: 2048,
      },
    ],
  },

  'chrome-ai': {
    id: 'chrome-ai',
    name: 'Chrome Built-in AI',
    description: 'Uses Gemini Nano built into Chrome — zero download, instant',
    docsUrl: 'https://developer.chrome.com/docs/ai/built-in',
    icon: 'Globe',
    isLocal: true,
    isBrowserOnly: true,
    defaultModel: 'gemini-nano',
    models: [
      {
        id: 'gemini-nano',
        name: 'Gemini Nano (~4-6B)',
        supportsStructuredOutput: false,
        contextWindow: 6144,
        maxOutputTokens: 2048,
      },
    ],
  },
};

// ============================================================================
// Helpers
// ============================================================================

/** Get a flat list of all providers */
export function getAllProviders(): ProviderConfig[] {
  return Object.values(PROVIDERS);
}

/** Get providers that require an API key (server-side) */
export function getServerProviders(): ProviderConfig[] {
  return getAllProviders().filter(p => !p.isBrowserOnly);
}

/** Get providers that run in the browser */
export function getBrowserProviders(): ProviderConfig[] {
  return getAllProviders().filter(p => p.isBrowserOnly);
}

/** Get a specific provider by ID */
export function getProvider(id: ProviderId): ProviderConfig {
  return PROVIDERS[id];
}

/** Runtime guard for provider IDs loaded from storage */
export function isSupportedProviderId(value: string): value is ProviderId {
  return value in PROVIDERS;
}

/** Get the default model for a provider */
export function getDefaultModel(providerId: ProviderId): ModelConfig {
  const provider = PROVIDERS[providerId];
  return provider.models.find(m => m.id === provider.defaultModel) || provider.models[0];
}

/** Get a specific model config for a provider */
export function getModelConfig(providerId: ProviderId, modelId?: string | null): ModelConfig | undefined {
  const provider = PROVIDERS[providerId];
  if (!modelId) {
    return getDefaultModel(providerId);
  }

  return provider.models.find(model => model.id === modelId) || provider.models[0];
}

/** Get the default model ID for a provider */
export function getDefaultModelId(providerId: ProviderId): string {
  return getDefaultModel(providerId).id;
}

export interface GenerationDefaults {
  maxOutputTokens: number;
  timeoutMs: number;
}

/**
 * Default generation limits when the caller doesn't specify its own.
 * Conservative caps bounded by the model's catalog limit; Grok models stream
 * reasoning before visible text, so they get more output budget and a longer
 * stream timeout.
 */
export function getGenerationDefaults(
  providerId?: ProviderId | null,
  modelId?: string | null,
): GenerationDefaults {
  const isGrok = providerId === 'grok';
  const cap = isGrok ? 8192 : 4096;
  const modelMax = providerId ? getModelConfig(providerId, modelId)?.maxOutputTokens : undefined;
  return {
    maxOutputTokens: modelMax && modelMax > 0 ? Math.min(modelMax, cap) : cap,
    timeoutMs: isGrok ? 120_000 : 60_000,
  };
}

/** Providers whose model catalog is dynamic (models discovered at runtime) */
const DYNAMIC_MODEL_PROVIDERS: ReadonlySet<ProviderId> = new Set(['ollama']);

/** Check whether a model ID exists in the provider's static catalog */
export function isKnownModelId(providerId: ProviderId, modelId: string): boolean {
  if (DYNAMIC_MODEL_PROVIDERS.has(providerId)) return true;
  return PROVIDERS[providerId].models.some(model => model.id === modelId);
}

/**
 * Resolve a stored model ID against the current catalog. Falls back to the
 * provider default when the stored model has been retired from the registry
 * (e.g. a user saved a config before a provider deprecated the model).
 */
export function resolveStoredModelId(providerId: ProviderId, modelId?: string | null): string {
  if (modelId && isKnownModelId(providerId, modelId)) return modelId;
  return getDefaultModelId(providerId);
}

/** Get the default base URL for a provider, if it has one */
export function getDefaultBaseUrl(providerId: ProviderId): string | undefined {
  return PROVIDERS[providerId].defaultBaseUrl;
}

/** Find which provider an API key belongs to based on prefix */
export function detectProviderFromKey(key: string): ProviderId | null {
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('sk-or-')) return 'openrouter';
  if (key.startsWith('xai-')) return 'grok';
  if (key.startsWith('crsr_')) return 'cursor';
  if (key.startsWith('AIza')) return 'gemini';
  if (key.startsWith('sk-')) return 'openai'; // Must be after sk-ant- and sk-or-
  return null;
}
