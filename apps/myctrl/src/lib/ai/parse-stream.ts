/**
 * Shared Streaming Response Parser
 *
 * Extracts JSON from AI SDK streamed responses. Used by both
 * AIViewBuilder and AskAISection to parse ViewSchema JSON from
 * the data stream protocol (0:"..." text chunks).
 */

/**
 * Parse an AI SDK data stream response into a View object.
 *
 * The AI SDK streams text in its data stream protocol format:
 * - Lines starting with `0:` contain JSON-encoded text chunks
 * - We concatenate all text chunks, strip markdown fences, and parse JSON
 */
export function parseStreamedResponse(content: string): unknown | null {
  try {
    const lines = content.split('\n');
    let jsonContent = '';

    for (const line of lines) {
      if (line.startsWith('0:')) {
        // Extract the JSON string value after "0:"
        const jsonStringPart = line.slice(2);
        try {
          // Use JSON.parse to properly unescape the string
          const unescaped = JSON.parse(jsonStringPart);
          jsonContent += unescaped;
        } catch {
          // Fallback: manual extraction if JSON.parse fails
          const textMatch = line.match(/^0:"(.*)"/);
          if (textMatch) {
            jsonContent += textMatch[1]
              .replace(/\\n/g, '\n')
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\');
          }
        }
      }
    }

    // If no 0: lines found, the response is plain text (AI SDK v6 toTextStreamResponse)
    if (!jsonContent) {
      jsonContent = content;
    }

    // Strip markdown code blocks if present (```json ... ```)
    let cleanedContent = jsonContent;
    const codeBlockMatch = cleanedContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      cleanedContent = codeBlockMatch[1].trim();
    }

    // Prefer the last complete JSON object so reasoning preambles do not steal the match.
    const extracted = extractLastJsonObject(cleanedContent);
    if (extracted) {
      return JSON.parse(extracted);
    }

    // Last resort: try parsing the cleaned content directly
    return JSON.parse(cleanedContent);
  } catch (err) {
    console.error('Failed to parse streamed response:', err);
    console.error('Content preview:', content.substring(0, 500));
    return null;
  }
}

function extractLastJsonObject(content: string): string | null {
  let last: string | null = null;
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }

    if (char === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        last = content.slice(start, i + 1);
        start = -1;
      }
    }
  }

  return last;
}
