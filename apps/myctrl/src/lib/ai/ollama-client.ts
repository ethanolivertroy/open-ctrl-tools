/**
 * Ollama Browser Client
 *
 * Streams responses directly from a local Ollama instance.
 * Bypasses the serverless endpoint because Ollama runs on localhost
 * (unreachable from Vercel's servers).
 *
 * CORS: User must set OLLAMA_ORIGINS=* or OLLAMA_ORIGINS=https://myctrl.tools
 */

import type { View } from '@/lib/json-render/catalog';
import { parseStructuredViewResponse } from './structured-view';

export interface OllamaStreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

/**
 * Stream a chat response from a local Ollama instance.
 * Returns an AbortController so the caller can cancel.
 */
export function streamOllamaResponse(
  baseUrl: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  callbacks: OllamaStreamCallbacks,
): AbortController {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body from Ollama');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // Ollama streams JSON objects, one per line
        const lines = chunk.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              fullText += data.message.content;
              callbacks.onToken(data.message.content);
            }
          } catch {
            // Partial line — will be completed in next chunk
          }
        }
      }

      callbacks.onComplete(fullText);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  return controller;
}

/**
 * Parse an Ollama text response into a View.
 * If the model produced valid JSON, parse it.
 * Otherwise, wrap the raw text in a TextBlock component.
 */
export function parseOllamaResponse(text: string): View {
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

/**
 * Discover available models from a local Ollama instance.
 * Returns model names, or throws if Ollama isn't reachable.
 */
/**
 * Check if an Ollama URL points to a cloud instance (not localhost).
 */
export function isOllamaCloud(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl);
    const host = url.hostname.toLowerCase();
    return host !== 'localhost' && host !== '127.0.0.1' && host !== '::1';
  } catch {
    return false;
  }
}

export async function listOllamaModels(
  baseUrl: string = 'http://localhost:11434',
): Promise<{ name: string; size: number; modified: string }[]> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/tags`);
  } catch {
    // fetch throws TypeError on network/CORS errors (no response at all)
    throw new Error(
      `Can't reach Ollama at ${baseUrl} — if Ollama is running, your browser may be blocking the request. ` +
      `Run Ollama with: OLLAMA_ORIGINS=${window.location.origin} ollama serve`
    );
  }
  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status} at ${baseUrl}`);
  }
  const data = await response.json();
  return (data.models || []).map((m: any) => ({
    name: m.name,
    size: m.size || 0,
    modified: m.modified_at || '',
  }));
}
