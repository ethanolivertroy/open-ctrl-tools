/**
 * WebLLM Browser Client
 *
 * Runs 3-8B models in the browser via WebGPU using MLC compilation.
 * Larger models than Transformers.js — can handle structured JSON output.
 */

import type { View } from '@/lib/json-render/catalog';

// ============================================================================
// Types
// ============================================================================

export interface WebLLMProgress {
  status: 'loading' | 'downloading' | 'ready' | 'generating' | 'error';
  progress?: number;
  message: string;
}

export type WebLLMProgressCallback = (progress: WebLLMProgress) => void;

// ============================================================================
// Module-level state
// ============================================================================

let engine: any = null;
let currentModelId: string | null = null;

// ============================================================================
// Public API
// ============================================================================

/**
 * Initialize (download + load) a WebLLM model.
 * Downloads MLC-compiled model weights on first use. Cached in browser.
 */
export async function initWebLLM(
  modelId: string,
  onProgress: WebLLMProgressCallback,
): Promise<void> {
  if (engine && currentModelId === modelId) {
    onProgress({ status: 'ready', message: 'Model ready' });
    return;
  }

  // Unload previous
  if (engine) {
    engine = null;
    currentModelId = null;
  }

  onProgress({ status: 'loading', message: 'Loading WebLLM runtime...' });

  try {
    const { CreateMLCEngine } = await import('@mlc-ai/web-llm');

    onProgress({ status: 'downloading', progress: 0, message: `Downloading ${modelId}...` });

    engine = await CreateMLCEngine(modelId, {
      initProgressCallback: (info: { progress: number; text: string }) => {
        if (info.progress >= 1) {
          onProgress({ status: 'ready', progress: 1, message: 'Model ready!' });
        } else {
          onProgress({
            status: 'downloading',
            progress: info.progress,
            message: info.text || `Downloading... ${Math.round(info.progress * 100)}%`,
          });
        }
      },
    });

    currentModelId = modelId;
    onProgress({ status: 'ready', message: 'Model ready' });
  } catch (err) {
    engine = null;
    currentModelId = null;
    const message = err instanceof Error ? err.message : 'Failed to load model';
    onProgress({ status: 'error', message });
    throw err;
  }
}

/**
 * Stream text token-by-token using the loaded WebLLM engine.
 * Uses the OpenAI-compatible chat completions API.
 */
export async function streamGenerateWebLLM(
  systemPrompt: string,
  userPrompt: string,
  onToken: (accumulated: string) => void,
  onProgress: WebLLMProgressCallback,
): Promise<string> {
  if (!engine) {
    throw new Error('WebLLM engine not loaded. Call initWebLLM() first.');
  }

  onProgress({ status: 'generating', message: 'Generating response...' });

  try {
    const chunks = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: true,
    });

    let fullText = '';
    for await (const chunk of chunks) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        fullText += delta;
        onToken(fullText);
      }
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
 * Check if the WebLLM engine is loaded and ready.
 */
export function isWebLLMReady(): boolean {
  return engine !== null;
}
