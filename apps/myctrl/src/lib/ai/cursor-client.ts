/**
 * Cursor Browser Client
 *
 * Cursor does not expose an official chat-completions API, so this client
 * talks to a local OpenAI-compatible Cursor proxy (e.g. cursor-agent-api-proxy
 * wrapping the Cursor CLI, or equivalent) straight from the browser. The proxy
 * uses the user's Cursor plan; the optional `crsr_...` API key from
 * cursor.com/dashboard -> Integrations is forwarded as a Bearer token for
 * proxies that expect it.
 *
 * Requests bypass the serverless endpoint because the proxy typically runs on
 * localhost (unreachable from Cloudflare). The proxy must allow this site's
 * origin via CORS.
 */

export interface CursorGenerateOptions {
  baseUrl: string;
  model: string;
  prompt: string;
  systemPrompt?: string;
  apiKey?: string;
  signal?: AbortSignal;
  onChunk?: (content: string, chunk?: string) => void;
}

function buildHeaders(apiKey?: string): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '');
}

/**
 * Stream a chat completion from the Cursor proxy (OpenAI SSE format).
 * Resolves with the full response text.
 */
export async function generateCursorText({
  baseUrl,
  model,
  prompt,
  systemPrompt = '',
  apiKey,
  signal,
  onChunk,
}: CursorGenerateOptions): Promise<string> {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt },
      ],
    }),
    signal,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Cursor proxy error: ${response.status} ${response.statusText}${detail ? ` — ${detail.slice(0, 200)}` : ''}`,
    );
  }

  if (!response.body) {
    throw new Error('No response body from the Cursor proxy');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // OpenAI SSE: events separated by double newlines, payload after "data: "
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const event of events) {
      for (const line of event.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const data = JSON.parse(payload);
          const delta: string | undefined = data.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            onChunk?.(fullText, delta);
          }
        } catch {
          // Ignore malformed keep-alive/comment lines
        }
      }
    }
  }

  return fullText;
}

/**
 * Verify the proxy is reachable and list its models.
 * Throws with a descriptive message when unreachable.
 */
export async function testCursorConnection(baseUrl: string, apiKey?: string): Promise<string[]> {
  let response: Response;
  try {
    response = await fetch(`${normalizeBaseUrl(baseUrl)}/models`, {
      headers: buildHeaders(apiKey),
    });
  } catch {
    throw new Error(
      'Could not reach the Cursor proxy. Make sure it is running (e.g. `npx cursor-agent-api-proxy`) and allows this origin via CORS.',
    );
  }

  if (!response.ok) {
    throw new Error(`Cursor proxy responded ${response.status} ${response.statusText}`);
  }

  const data = await response.json().catch(() => null) as { data?: Array<{ id?: string }> } | null;
  return (data?.data ?? [])
    .map((entry) => entry.id)
    .filter((id): id is string => typeof id === 'string');
}
