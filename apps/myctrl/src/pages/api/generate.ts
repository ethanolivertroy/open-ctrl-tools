export const prerender = false; // Mark as serverless function

import type { APIRoute } from 'astro';
import { streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createXai } from '@ai-sdk/xai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { adaptPromptForProvider } from '@/lib/ai/prompt-adapters';
import {
  clipConversationHistory,
  DEFAULT_CONVERSATION_TURN_CAP,
  MAX_CONVERSATION_TURN_CHARS,
} from '@/lib/ai/conversation';
import {
  getDefaultBaseUrl,
  getDefaultModelId,
  getGenerationDefaults,
  type ProviderId,
} from '@/lib/ai/providers';
import { resolveSafeBaseUrl } from '@/lib/ai/base-url-guard';

// Request validation schema — expanded for multi-provider support
const RequestSchema = z.object({
  prompt: z.string().min(1).max(5000),
  context: z.object({
    frameworkId: z.string().optional(),
    controlId: z.string().optional(),
    family: z.string().optional(),
    assessmentId: z.string().optional(),
    baseline: z.string().optional(),
    systemName: z.string().optional(),
  }).optional(),
  includeUserData: z.boolean().default(false),
  userData: z.object({
    favorites: z.array(z.string()).optional(),
    noteCount: z.number().optional(),
    recentlyViewed: z.array(z.string()).optional(),
  }).optional(),
  // User-provided API key (BYOK)
  apiKey: z.string().optional(),
  // Multi-provider fields
  provider: z.enum(['anthropic', 'openai', 'grok', 'gemini', 'openrouter']).default('anthropic'),
  model: z.string().optional(),
  baseUrl: z.string().url().optional(),
  maxOutputTokens: z.number().int().min(1).max(32768).optional(),
  // Optional custom system prompt (for GRCLanker/assessment mode — skips ViewSchema catalog prompt)
  systemPromptOverride: z.string().max(16000).optional(),
  conversation: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(MAX_CONVERSATION_TURN_CHARS),
  })).max(DEFAULT_CONVERSATION_TURN_CAP).optional(),
  reasoningEffort: z.enum(['low', 'medium', 'high']).optional(),
});

/**
 * Create an AI SDK LanguageModel from provider + model + apiKey.
 * Falls back to environment variables if no user key is provided.
 */
function createProviderModel(
  provider: ProviderId,
  apiKey: string,
  model?: string,
  baseUrl?: string,
) {
  switch (provider) {
    case 'openai': {
      const openai = createOpenAI({ apiKey });
      return openai(model || getDefaultModelId('openai'));
    }

    case 'grok': {
      // Native xAI SDK (reasoning-aware) instead of the OpenAI-compatible shim
      const xai = createXai({
        apiKey,
        ...(baseUrl ? { baseURL: baseUrl } : {}),
      });
      return xai(model || getDefaultModelId('grok'));
    }

    case 'gemini': {
      const google = createGoogleGenerativeAI({ apiKey });
      return google(model || getDefaultModelId('gemini'));
    }

    case 'openrouter': {
      // OpenRouter uses the OpenAI-compatible API with a custom base URL
      const openrouter = createOpenAI({
        apiKey,
        baseURL: baseUrl || getDefaultBaseUrl('openrouter'),
      });
      return openrouter(model || getDefaultModelId('openrouter'));
    }

    case 'anthropic':
    default: {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(model || getDefaultModelId('anthropic'));
    }
  }
}

/**
 * Resolve the API key: user-provided > environment variable per provider.
 */
function resolveApiKey(provider: ProviderId, userApiKey?: string): string | null {
  const trimmed = userApiKey?.trim();
  if (trimmed) return trimmed;

  // Check environment variables by provider
  switch (provider) {
    case 'anthropic':
      return import.meta.env.ANTHROPIC_API_KEY || null;
    case 'openai':
      return import.meta.env.OPENAI_API_KEY || null;
    case 'grok':
      return import.meta.env.XAI_API_KEY || null;
    case 'gemini':
      return import.meta.env.GOOGLE_API_KEY || null;
    case 'openrouter':
      return import.meta.env.OPENROUTER_API_KEY || null;
    default:
      return null;
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Parse and validate request
    const body = await request.json();
    const parseResult = RequestSchema.safeParse(body);

    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request', details: parseResult.error.issues }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const {
      prompt,
      context,
      includeUserData,
      userData,
      apiKey: userApiKey,
      provider,
      model,
      baseUrl,
      maxOutputTokens,
      systemPromptOverride,
      conversation,
      reasoningEffort,
    } = parseResult.data;

    // Resolve the API key for this provider
    const apiKey = resolveApiKey(provider, userApiKey);
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: `No credential configured for ${provider}. Connect Grok or add an API key in provider settings.`,
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const baseUrlCheck = resolveSafeBaseUrl(provider, userApiKey, baseUrl);
    if (!baseUrlCheck.ok) {
      return jsonError(baseUrlCheck.error, 400);
    }

    // Build the user message with context
    const userMessage = systemPromptOverride
      ? prompt
      : buildUserMessage(prompt, context, includeUserData ? userData : undefined);

    // Use custom system prompt if provided (GRCLanker mode), otherwise use a compact
    // server prompt. The full JSON-render catalog is kept client-side to avoid
    // bundling the framework dataset into the Cloudflare Worker.
    const systemPrompt = systemPromptOverride
      ? systemPromptOverride
      : adaptPromptForProvider(generateLightweightSystemPrompt(context), provider);

    // Create the appropriate model
    const aiModel = createProviderModel(provider, apiKey, model, baseUrlCheck.baseUrl);
    const resolvedMaxOutputTokens = maxOutputTokens
      || getGenerationDefaults(provider, model).maxOutputTokens;
    const history = clipConversationHistory(conversation ?? []);
    const useGrokReasoning = provider === 'grok' && !model?.includes('non-reasoning');

    // Await the first token so upstream auth/model errors become 401/502
    // instead of an empty HTTP 200 (toTextStreamResponse swallows them).
    const result = streamText({
      model: aiModel,
      system: systemPrompt,
      messages: [
        ...history,
        { role: 'user' as const, content: userMessage },
      ],
      maxOutputTokens: resolvedMaxOutputTokens,
      ...(useGrokReasoning
        ? { providerOptions: { xai: { reasoningEffort: reasoningEffort ?? 'low' } } }
        : {}),
    });

    try {
      const iterator = result.textStream[Symbol.asyncIterator]();
      let first = await iterator.next();
      let firstChunk = first.done ? '' : String(first.value ?? '');

      while (!first.done && !firstChunk.trim()) {
        first = await iterator.next();
        firstChunk = first.done ? '' : String(first.value ?? '');
      }

      if (!firstChunk.trim()) {
        return jsonError(
          'Provider returned an empty response. Check the model ID and API key, then test again.',
          502,
        );
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode(firstChunk));
            while (true) {
              const next = await iterator.next();
              if (next.done) break;
              if (next.value) controller.enqueue(encoder.encode(String(next.value)));
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
        cancel() {
          void iterator.return?.();
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    } catch (error) {
      console.error('Generate upstream error:', error);
      return jsonError(formatProviderError(error), statusForProviderError(error));
    }
  } catch (error) {
    console.error('Generate API error:', error);
    return jsonError('Internal server error', 500);
  }
};

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function formatProviderError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || 'Provider request failed');
  return message.slice(0, 500) || 'Provider request failed';
}

function statusForProviderError(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/incorrect api key|invalid.*api key|unauthorized|401/i.test(message)) {
    return 401;
  }
  if (/404|not found|unknown model|model.?not/i.test(message)) {
    return 400;
  }
  return 502;
}

function buildUserMessage(
  prompt: string,
  context?: {
    frameworkId?: string;
    controlId?: string;
    family?: string;
    assessmentId?: string;
    baseline?: string;
    systemName?: string;
  },
  userData?: { favorites?: string[]; noteCount?: number; recentlyViewed?: string[] }
): string {
  const parts: string[] = [];

  // Add context if provided
  if (context) {
    const contextParts: string[] = [];
    if (context.frameworkId) {
      contextParts.push(`Current framework: ${context.frameworkId}`);
    }
    if (context.controlId) {
      contextParts.push(`Current control: ${context.controlId}`);
    }
    if (context.family) {
      contextParts.push(`Current family: ${context.family}`);
    }
    if (context.assessmentId) {
      contextParts.push(`Current assessment: ${context.assessmentId}`);
    }
    if (context.baseline) {
      contextParts.push(`Current baseline: ${context.baseline}`);
    }
    if (context.systemName) {
      contextParts.push(`Current system: ${context.systemName}`);
    }
    if (contextParts.length > 0) {
      parts.push(`<context>\n${contextParts.join('\n')}\n</context>`);
    }
  }

  // Add user data if provided and opted-in
  if (userData) {
    const userParts: string[] = [];
    if (userData.favorites && userData.favorites.length > 0) {
      userParts.push(`User's favorite frameworks: ${userData.favorites.join(', ')}`);
    }
    if (userData.noteCount && userData.noteCount > 0) {
      userParts.push(`User has ${userData.noteCount} control notes saved`);
    }
    if (userData.recentlyViewed && userData.recentlyViewed.length > 0) {
      userParts.push(`Recently viewed: ${userData.recentlyViewed.slice(0, 5).join(', ')}`);
    }
    if (userParts.length > 0) {
      parts.push(`<user_preferences>\n${userParts.join('\n')}\n</user_preferences>`);
    }
  }

  // Add the main prompt
  parts.push(prompt);

  return parts.join('\n\n');
}

function generateLightweightSystemPrompt(context?: {
  frameworkId?: string;
  controlId?: string;
  family?: string;
  assessmentId?: string;
  baseline?: string;
  systemName?: string;
}): string {
  const contextLines = [
    context?.frameworkId ? `Framework: ${context.frameworkId}` : null,
    context?.controlId ? `Control: ${context.controlId}` : null,
    context?.family ? `Family: ${context.family}` : null,
    context?.baseline ? `Baseline: ${context.baseline}` : null,
    context?.systemName ? `System: ${context.systemName}` : null,
  ].filter(Boolean);

  return `You are a security compliance assistant for myctrl.tools.

Answer questions about security controls, regulatory requirements, assessment evidence, and implementation guidance. Be concise, factual, and practical.

When returning a UI view, respond with ONLY a JSON object. Every component MUST include "type". TextBlock MUST include "content" and SHOULD include "variant" ("default", "callout", "warning", "info", or "success").

Allowed types: TextBlock, Section, StatCard, ControlCard, ControlList, FrameworkCard.

Example:
{"title":"Brief title","components":[{"type":"TextBlock","content":"Markdown content","variant":"default"}]}
${contextLines.length > 0 ? `\nCurrent context:\n${contextLines.join('\n')}` : ''}`;
}
