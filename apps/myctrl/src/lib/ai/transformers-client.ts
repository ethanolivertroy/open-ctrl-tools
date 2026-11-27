/**
 * Transformers.js Browser Client — Powered by @browser-ai/transformers-js
 *
 * Runs small language models entirely in the browser via WebGPU/WASM.
 * No server, no API key, fully private.
 *
 * Uses @browser-ai/transformers-js which provides:
 * - AI SDK v6 compatible provider (streamText/generateText)
 * - Web Worker offloading (non-blocking UI)
 * - WebGPU acceleration
 * - Download progress tracking
 * - Browser cache for model weights
 */

import type { View } from '@/lib/json-render/catalog';
import { TRANSFORMERS_SYSTEM_PROMPT } from './prompt-adapters';

// ============================================================================
// Types (kept for backwards compat with AIViewBuilder/AskAISection)
// ============================================================================

export interface TransformersProgress {
  status: 'loading' | 'downloading' | 'ready' | 'generating' | 'error';
  /** Download progress 0-1 (during model download) */
  progress?: number;
  /** Human-readable status message */
  message: string;
}

export type TransformersProgressCallback = (progress: TransformersProgress) => void;

// ============================================================================
// Module-level state
// ============================================================================

let currentModelId: string | null = null;
let model: any = null;

// ============================================================================
// Public API
// ============================================================================

/**
 * Initialize (download + load) a Transformers.js model.
 * Uses @browser-ai/transformers-js for Web Worker + WebGPU support.
 * Shows download progress via callback. No-ops if already loaded.
 */
export async function initTransformers(
  modelId: string,
  onProgress: TransformersProgressCallback,
): Promise<void> {
  // Already loaded
  if (model && currentModelId === modelId) {
    onProgress({ status: 'ready', message: 'Model ready' });
    return;
  }

  // Unload previous
  if (model) {
    model = null;
    currentModelId = null;
  }

  onProgress({ status: 'loading', message: 'Loading Transformers.js runtime...' });

  try {
    const { transformersJS } = await import('@browser-ai/transformers-js');

    // Create model with Web Worker + WebGPU
    model = transformersJS(modelId, {
      device: 'webgpu',
      worker: new Worker(
        new URL('./transformers-worker.ts', import.meta.url),
        { type: 'module' },
      ),
    });

    // Check availability and download if needed
    const availability = await model.availability();

    if (availability === 'unavailable') {
      throw new Error('Browser does not support Transformers.js (WebGPU/WASM required)');
    }

    if (availability === 'downloadable') {
      onProgress({ status: 'downloading', progress: 0, message: `Downloading ${modelId}...` });

      await model.createSessionWithProgress(({ progress }: { progress: number }) => {
        const pct = Math.round(progress * 100);
        if (pct >= 100) {
          onProgress({ status: 'ready', progress: 1, message: 'Model ready!' });
        } else {
          onProgress({
            status: 'downloading',
            progress: progress,
            message: `Downloading... ${pct}%`,
          });
        }
      });
    }

    currentModelId = modelId;
    onProgress({ status: 'ready', message: 'Model ready' });
  } catch (err) {
    model = null;
    currentModelId = null;
    const message = err instanceof Error ? err.message : 'Failed to load model';
    onProgress({ status: 'error', message });
    throw err;
  }
}

/**
 * Generate text using the loaded model via AI SDK's generateText.
 * Runs in a Web Worker — does NOT block the main thread.
 */
export async function generateText(
  userPrompt: string,
  onProgress: TransformersProgressCallback,
): Promise<string> {
  if (!model) {
    throw new Error('Model not loaded. Call initTransformers() first.');
  }

  onProgress({ status: 'generating', message: 'Generating response...' });

  try {
    const { generateText: aiGenerateText } = await import('ai');

    const result = await aiGenerateText({
      model,
      system: TRANSFORMERS_SYSTEM_PROMPT,
      prompt: userPrompt,
      maxOutputTokens: 1024,
    });

    onProgress({ status: 'ready', message: 'Done' });
    return result.text;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    onProgress({ status: 'error', message });
    throw err;
  }
}

/**
 * Stream text token-by-token using the loaded model via AI SDK's streamText.
 * Calls onToken for each chunk so the UI can update progressively.
 * Pass a custom systemPrompt to override the default (e.g., JSON schema for larger models).
 */
export async function streamGenerateText(
  userPrompt: string,
  onToken: (accumulated: string) => void,
  onProgress: TransformersProgressCallback,
  systemPrompt?: string,
  maxTokens?: number,
): Promise<string> {
  if (!model) {
    throw new Error('Model not loaded. Call initTransformers() first.');
  }

  onProgress({ status: 'generating', message: 'Generating response...' });

  try {
    const { streamText: aiStreamText } = await import('ai');

    const result = aiStreamText({
      model,
      system: systemPrompt || TRANSFORMERS_SYSTEM_PROMPT,
      prompt: userPrompt,
      maxOutputTokens: maxTokens || 1024,
    });

    let fullText = '';
    for await (const chunk of result.textStream) {
      fullText += chunk;
      onToken(fullText);
    }

    onProgress({ status: 'ready', message: 'Done' });
    return fullText;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    onProgress({ status: 'error', message });
    throw err;
  }
}

/**
 * Wrap a plain text response in a View with a single TextBlock.
 */
export function wrapTextInView(text: string): View {
  return {
    title: 'AI Response',
    components: [
      {
        type: 'TextBlock',
        content: text || 'No response generated.',
        variant: 'default',
      },
    ],
  };
}

/**
 * Check if a model is currently loaded and ready.
 */
export function isModelReady(): boolean {
  return model !== null;
}

/**
 * Get the currently loaded model ID, or null.
 */
export function getLoadedModel(): string | null {
  return currentModelId;
}

/**
 * Get the underlying @browser-ai/transformers-js model instance.
 * Used by ProviderSetup for download progress in the dialog.
 */
export function getModel(): any {
  return model;
}
