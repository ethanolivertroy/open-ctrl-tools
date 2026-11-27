/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Model catalog for server-side AI providers, generated from models.dev and
 * the OpenRouter live API. Regenerate with: npm run models:generate
 * (see scripts/generate-model-catalog.mjs to add/remove models)
 *
 * Generated: 2026-07-29
 */

import type { ModelConfig } from './providers';

export interface GeneratedProviderModels {
  defaultModel: string;
  models: ModelConfig[];
}

export const GENERATED_MODEL_CATALOG: Record<
  'anthropic' | 'openai' | 'grok' | 'gemini' | 'openrouter',
  GeneratedProviderModels
> = {
  "anthropic": {
    "defaultModel": "claude-sonnet-5",
    "models": [
      {
        "id": "claude-sonnet-5",
        "name": "Claude Sonnet 5",
        "supportsStructuredOutput": true,
        "contextWindow": 1000000,
        "maxOutputTokens": 128000
      },
      {
        "id": "claude-haiku-4-5",
        "name": "Claude Haiku 4.5 (latest)",
        "supportsStructuredOutput": true,
        "contextWindow": 200000,
        "maxOutputTokens": 64000
      },
      {
        "id": "claude-opus-5",
        "name": "Claude Opus 5",
        "supportsStructuredOutput": true,
        "contextWindow": 1000000,
        "maxOutputTokens": 128000
      },
      {
        "id": "claude-fable-5",
        "name": "Claude Fable 5",
        "supportsStructuredOutput": true,
        "contextWindow": 1000000,
        "maxOutputTokens": 128000
      }
    ]
  },
  "openai": {
    "defaultModel": "gpt-5.6-terra",
    "models": [
      {
        "id": "gpt-5.6-terra",
        "name": "GPT-5.6 Terra",
        "supportsStructuredOutput": true,
        "contextWindow": 1050000,
        "maxOutputTokens": 128000
      },
      {
        "id": "gpt-5.6-sol",
        "name": "GPT-5.6 Sol",
        "supportsStructuredOutput": true,
        "contextWindow": 1050000,
        "maxOutputTokens": 128000
      },
      {
        "id": "gpt-5.6-luna",
        "name": "GPT-5.6 Luna",
        "supportsStructuredOutput": true,
        "contextWindow": 1050000,
        "maxOutputTokens": 128000
      }
    ]
  },
  "grok": {
    "defaultModel": "grok-4.5",
    "models": [
      {
        "id": "grok-4.5",
        "name": "Grok 4.5",
        "supportsStructuredOutput": true,
        "contextWindow": 500000,
        "maxOutputTokens": 500000
      },
      {
        "id": "grok-4.3",
        "name": "Grok 4.3",
        "supportsStructuredOutput": true,
        "contextWindow": 1000000,
        "maxOutputTokens": 30000
      },
      {
        "id": "grok-4.20-0309-non-reasoning",
        "name": "Grok 4.20 (Non-Reasoning)",
        "supportsStructuredOutput": true,
        "contextWindow": 1000000,
        "maxOutputTokens": 30000
      },
      {
        "id": "grok-4.20-0309-reasoning",
        "name": "Grok 4.20 (Reasoning)",
        "supportsStructuredOutput": true,
        "contextWindow": 1000000,
        "maxOutputTokens": 30000
      }
    ]
  },
  "gemini": {
    "defaultModel": "gemini-3.6-flash",
    "models": [
      {
        "id": "gemini-3.6-flash",
        "name": "Gemini 3.6 Flash",
        "supportsStructuredOutput": true,
        "contextWindow": 1048576,
        "maxOutputTokens": 65536
      },
      {
        "id": "gemini-3.5-flash-lite",
        "name": "Gemini 3.5 Flash Lite",
        "supportsStructuredOutput": true,
        "contextWindow": 1048576,
        "maxOutputTokens": 65536
      },
      {
        "id": "gemini-3.1-pro-preview",
        "name": "Gemini 3.1 Pro Preview",
        "supportsStructuredOutput": true,
        "contextWindow": 1048576,
        "maxOutputTokens": 65536
      }
    ]
  },
  "openrouter": {
    "defaultModel": "anthropic/claude-sonnet-5",
    "models": [
      {
        "id": "anthropic/claude-sonnet-5",
        "name": "Claude Sonnet 5 (via OR)",
        "supportsStructuredOutput": true,
        "contextWindow": 1000000,
        "maxOutputTokens": 128000
      },
      {
        "id": "openai/gpt-5.6-terra",
        "name": "GPT-5.6 Terra (via OR)",
        "supportsStructuredOutput": true,
        "contextWindow": 1050000,
        "maxOutputTokens": 128000
      },
      {
        "id": "google/gemini-3.6-flash",
        "name": "Gemini 3.6 Flash (via OR)",
        "supportsStructuredOutput": true,
        "contextWindow": 1048576,
        "maxOutputTokens": 65536
      },
      {
        "id": "meta-llama/llama-3.3-70b-instruct",
        "name": "Llama 3.3 70B Instruct (via OR)",
        "supportsStructuredOutput": true,
        "contextWindow": 131072,
        "maxOutputTokens": 128000
      },
      {
        "id": "deepseek/deepseek-v3.2",
        "name": "DeepSeek V3.2 (via OR)",
        "supportsStructuredOutput": true,
        "contextWindow": 163840,
        "maxOutputTokens": 65536
      }
    ]
  }
};
