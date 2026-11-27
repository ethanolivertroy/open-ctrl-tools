/**
 * Chrome Built-in AI Client
 *
 * Uses Gemini Nano built into Chrome — zero download, instant inference.
 * Chrome 127+ with experimental flags enabled.
 */

import type { View } from '@/lib/json-render/catalog';

// ============================================================================
// Public API
// ============================================================================

/**
 * Check if Chrome's built-in AI (Gemini Nano) is available.
 * Returns true if the browser supports the Prompt API.
 */
export async function isChromeAIAvailable(): Promise<boolean> {
  try {
    // Chrome's built-in AI uses the LanguageModel API
    // @ts-expect-error — experimental browser API, not in TypeScript lib yet
    if (typeof LanguageModel !== 'undefined') {
      // @ts-expect-error
      const availability = await LanguageModel.availability();
      return availability !== 'unavailable';
    }
    // Older API shape (window.ai)
    // @ts-expect-error
    if (typeof window !== 'undefined' && window.ai?.languageModel) {
      // @ts-expect-error
      const availability = await window.ai.languageModel.capabilities();
      return availability.available !== 'no';
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Get Chrome AI availability status for UI display.
 */
export async function getChromeAIStatus(): Promise<'available' | 'downloadable' | 'unavailable'> {
  try {
    // @ts-expect-error
    if (typeof LanguageModel !== 'undefined') {
      // @ts-expect-error
      return await LanguageModel.availability();
    }
    // @ts-expect-error
    if (typeof window !== 'undefined' && window.ai?.languageModel) {
      // @ts-expect-error
      const caps = await window.ai.languageModel.capabilities();
      if (caps.available === 'readily') return 'available';
      if (caps.available === 'after-download') return 'downloadable';
    }
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

/**
 * Stream text from Chrome's built-in AI (Gemini Nano).
 * Uses the Prompt API directly — no npm packages needed at runtime.
 */
export async function streamGenerateChromeAI(
  systemPrompt: string,
  userPrompt: string,
  onToken: (accumulated: string) => void,
): Promise<string> {
  // Try the newer LanguageModel API first
  // @ts-expect-error
  if (typeof LanguageModel !== 'undefined') {
    // create() may trigger a download (~1.5GB) on first use — can be slow
    // @ts-expect-error
    const session = await LanguageModel.create({
      systemPrompt,
      // Listen for download progress if model is being fetched
      monitor: (m: any) => {
        m.addEventListener?.('downloadprogress', (e: any) => {
          const pct = e.loaded && e.total ? Math.round((e.loaded / e.total) * 100) : 0;
          onToken(`Downloading Gemini Nano... ${pct}%`);
        });
      },
    });
    let fullText = '';
    const stream = session.promptStreaming(userPrompt);
    for await (const chunk of stream) {
      fullText += chunk; // Chrome 131+: promptStreaming yields deltas, not accumulated text
      onToken(fullText);
    }
    session.destroy();
    return fullText;
  }

  // Fallback to older window.ai API
  // @ts-expect-error
  if (typeof window !== 'undefined' && window.ai?.languageModel) {
    // @ts-expect-error
    const session = await window.ai.languageModel.create({
      systemPrompt,
      monitor: (m: any) => {
        m.addEventListener?.('downloadprogress', (e: any) => {
          const pct = e.loaded && e.total ? Math.round((e.loaded / e.total) * 100) : 0;
          onToken(`Downloading Gemini Nano... ${pct}%`);
        });
      },
    });
    let fullText = '';
    const stream = session.promptStreaming(userPrompt);
    for await (const chunk of stream) {
      fullText += chunk;
      onToken(fullText);
    }
    session.destroy();
    return fullText;
  }

  throw new Error('Chrome Built-in AI is not available in this browser');
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
