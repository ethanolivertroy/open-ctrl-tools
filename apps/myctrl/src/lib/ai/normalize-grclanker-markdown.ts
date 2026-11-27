/**
 * Clean model output so GRCLanker markdown renders as workpaper text.
 * Grok often over-escapes *, |, and _, which breaks headings, lists, and tables.
 */

const THINK_BLOCK = /<think>[\s\S]*?<\/think>\s*/gi;
const ESCAPED_MARKDOWN = /\\([\\`*_{}\[\]()#+\-.!|>])/g;

export function normalizeGrcLankerMarkdown(raw: string): string {
  if (!raw) return '';

  let text = raw.replace(THINK_BLOCK, '');
  text = text.replace(/\u2217|\u204e|\uff0a/g, '*');
  text = text.replace(ESCAPED_MARKDOWN, '$1');
  text = text.replace(/[ \t]+\n/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}
