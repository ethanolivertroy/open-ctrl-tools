/**
 * Parser for NIST 800-53 style control descriptions
 * Handles lettered items (a. b. c.), numbered sub-items (1. 2. 3.),
 * and [Assignment: ...] / [Selection: ...] placeholders
 */

export interface AssignmentPlaceholder {
  type: 'assignment' | 'selection';
  text: string;
}

export interface FedRAMPSubstitution {
  type: 'fedramp-substitution';
  text: string;
}

export type ContentSegment = string | AssignmentPlaceholder | FedRAMPSubstitution;

export interface DescriptionNode {
  type: 'letter-item' | 'number-item' | 'text';
  marker?: string;
  content: ContentSegment[];
  children?: DescriptionNode[];
}

// Regex patterns
const LETTER_ITEM_REGEX = /^([a-z])\.\s{1,2}/;
const NUMBER_ITEM_REGEX = /^(\d+)\.\s{1,2}/;

/**
 * Parse text content to extract [Assignment: ...], [Selection: ...] placeholders
 * and {{FEDRAMP:...}} substitution markers.
 */
export function parseContent(text: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  let lastIndex = 0;

  // Combined regex: match either a placeholder or a FedRAMP substitution marker
  const COMBINED_REGEX = /\[(Assignment|Selection):\s*([^\]]+)\]|\{\{FEDRAMP:([^}]+)\}\}/g;

  let match;
  while ((match = COMBINED_REGEX.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      segments.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      // Assignment/Selection placeholder
      segments.push({
        type: match[1].toLowerCase() as 'assignment' | 'selection',
        text: match[2].trim(),
      });
    } else if (match[3]) {
      // FedRAMP substitution marker
      segments.push({
        type: 'fedramp-substitution',
        text: match[3].trim(),
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push(text.slice(lastIndex));
  }

  return segments.length > 0 ? segments : [text];
}

/**
 * Parse a description string into structured nodes
 */
export function parseDescription(description: string): DescriptionNode[] {
  const lines = description.split('\n');
  const nodes: DescriptionNode[] = [];
  let currentLetterItem: DescriptionNode | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Check for letter item (a. b. c. ...)
    const letterMatch = trimmedLine.match(LETTER_ITEM_REGEX);
    if (letterMatch) {
      const content = trimmedLine.slice(letterMatch[0].length);
      currentLetterItem = {
        type: 'letter-item',
        marker: letterMatch[1],
        content: parseContent(content),
        children: [],
      };
      nodes.push(currentLetterItem);
      continue;
    }

    // Check for number item (1. 2. 3. ...)
    const numberMatch = trimmedLine.match(NUMBER_ITEM_REGEX);
    if (numberMatch && currentLetterItem) {
      const content = trimmedLine.slice(numberMatch[0].length);
      currentLetterItem.children!.push({
        type: 'number-item',
        marker: numberMatch[1],
        content: parseContent(content),
      });
      continue;
    }

    // Plain text (no structure detected)
    // If we have a current letter item, this might be a continuation
    // Otherwise, add as standalone text
    if (currentLetterItem && nodes.length > 0) {
      // Append to the last letter item's content
      const lastNode = nodes[nodes.length - 1];
      if (lastNode.type === 'letter-item') {
        // Add as continuation text
        lastNode.content.push('\n' + trimmedLine);
      }
    } else {
      nodes.push({
        type: 'text',
        content: parseContent(trimmedLine),
      });
    }
  }

  return nodes;
}

/**
 * Check if a description has structured content (letter/number items)
 */
export function hasStructuredContent(description: string): boolean {
  return LETTER_ITEM_REGEX.test(description.split('\n')[0]?.trim() || '');
}
