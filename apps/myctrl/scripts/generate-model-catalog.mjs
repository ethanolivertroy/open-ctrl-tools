#!/usr/bin/env node
/**
 * Model catalog generator
 *
 * Regenerates src/lib/ai/model-catalog.generated.ts from live sources:
 *   - https://models.dev/api.json  (community-maintained model metadata)
 *   - https://openrouter.ai/api/v1/models  (OpenRouter slugs + limits)
 *
 * Approach borrowed from earendil-works/pi (packages/ai/scripts/generate-models.ts),
 * scaled down: we keep a small curated allowlist of model IDs per provider so the
 * UI dropdowns stay short, but every ID is validated against the live source and
 * all metadata (display name, context window, output limit, structured output
 * support) is pulled fresh. If a provider retires a model, this script fails
 * loudly instead of letting the registry go stale.
 *
 * Usage: npm run models:generate
 */

import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const OUTPUT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src/lib/ai/model-catalog.generated.ts',
);

/**
 * Curated model selection per provider.
 * - `modelsDevProvider`: key in the models.dev catalog ('openrouter' means the
 *   OpenRouter live API is used instead).
 * - `models`: ordered list of model IDs to expose in the UI (first is shown first).
 * - `defaultModel`: must be present in `models`.
 *
 * To add or swap a model: edit the list, run `npm run models:generate`, commit.
 */
const SELECTION = {
  anthropic: {
    modelsDevProvider: 'anthropic',
    defaultModel: 'claude-sonnet-5',
    models: ['claude-sonnet-5', 'claude-haiku-4-5', 'claude-opus-5', 'claude-fable-5'],
  },
  openai: {
    modelsDevProvider: 'openai',
    defaultModel: 'gpt-5.6-terra',
    models: ['gpt-5.6-terra', 'gpt-5.6-sol', 'gpt-5.6-luna'],
  },
  grok: {
    modelsDevProvider: 'xai',
    defaultModel: 'grok-4.5',
    models: [
      'grok-4.5',
      'grok-4.3',
      'grok-4.20-0309-non-reasoning',
      'grok-4.20-0309-reasoning',
    ],
  },
  gemini: {
    modelsDevProvider: 'google',
    defaultModel: 'gemini-3.6-flash',
    models: ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview'],
  },
  openrouter: {
    modelsDevProvider: 'openrouter-live-api',
    defaultModel: 'anthropic/claude-sonnet-5',
    models: [
      'anthropic/claude-sonnet-5',
      'openai/gpt-5.6-terra',
      'google/gemini-3.6-flash',
      'meta-llama/llama-3.3-70b-instruct',
      'deepseek/deepseek-v3.2',
    ],
  },
};

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.json();
}

function fromModelsDev(providerData, providerLabel, modelId) {
  const model = providerData.models?.[modelId];
  if (!model) {
    throw new Error(
      `Model "${modelId}" not found in models.dev provider "${providerLabel}". ` +
      'It may have been retired — update SELECTION in scripts/generate-model-catalog.mjs.',
    );
  }
  return {
    id: model.id,
    name: model.name,
    supportsStructuredOutput: model.structured_output === true,
    contextWindow: model.limit?.context ?? 0,
    maxOutputTokens: model.limit?.output ?? 0,
  };
}

function fromOpenRouter(orModelsById, modelId) {
  const model = orModelsById.get(modelId);
  if (!model) {
    throw new Error(
      `Model "${modelId}" not found in the OpenRouter live catalog. ` +
      'It may have been retired — update SELECTION in scripts/generate-model-catalog.mjs.',
    );
  }
  // OpenRouter names look like "Anthropic: Claude Sonnet 5" — keep the model
  // part and tag the route so the UI can disambiguate from direct providers.
  const name = `${model.name.replace(/^[^:]+:\s*/, '')} (via OR)`;
  return {
    id: model.id,
    name,
    supportsStructuredOutput: (model.supported_parameters ?? []).includes('structured_outputs'),
    contextWindow: model.context_length ?? 0,
    maxOutputTokens: model.top_provider?.max_completion_tokens ?? 0,
  };
}

async function main() {
  console.log('Fetching models.dev catalog...');
  const modelsDev = await fetchJson('https://models.dev/api.json');
  console.log('Fetching OpenRouter catalog...');
  const openRouter = await fetchJson('https://openrouter.ai/api/v1/models');
  const orModelsById = new Map(openRouter.data.map((model) => [model.id, model]));

  const catalog = {};

  for (const [providerId, selection] of Object.entries(SELECTION)) {
    const useOpenRouter = selection.modelsDevProvider === 'openrouter-live-api';
    const providerData = useOpenRouter ? null : modelsDev[selection.modelsDevProvider];
    if (!useOpenRouter && !providerData) {
      throw new Error(`Provider "${selection.modelsDevProvider}" not found in models.dev.`);
    }

    if (!selection.models.includes(selection.defaultModel)) {
      throw new Error(`Default model "${selection.defaultModel}" for ${providerId} is not in its model list.`);
    }

    catalog[providerId] = {
      defaultModel: selection.defaultModel,
      models: selection.models.map((modelId) =>
        useOpenRouter
          ? fromOpenRouter(orModelsById, modelId)
          : fromModelsDev(providerData, selection.modelsDevProvider, modelId),
      ),
    };
    console.log(`  ${providerId}: ${catalog[providerId].models.length} models OK`);
  }

  const generatedAt = new Date().toISOString().slice(0, 10);
  const output = `/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Model catalog for server-side AI providers, generated from models.dev and
 * the OpenRouter live API. Regenerate with: npm run models:generate
 * (see scripts/generate-model-catalog.mjs to add/remove models)
 *
 * Generated: ${generatedAt}
 */

import type { ModelConfig } from './providers';

export interface GeneratedProviderModels {
  defaultModel: string;
  models: ModelConfig[];
}

export const GENERATED_MODEL_CATALOG: Record<
  'anthropic' | 'openai' | 'grok' | 'gemini' | 'openrouter',
  GeneratedProviderModels
> = ${JSON.stringify(catalog, null, 2)};
`;

  writeFileSync(OUTPUT_PATH, output);
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
