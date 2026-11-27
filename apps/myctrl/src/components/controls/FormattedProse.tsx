import * as React from 'react';

interface FormattedProseProps {
  text: string;
  className?: string;
}

// Regex for [Assignment: ...] and [Selection: ...] placeholders
const PLACEHOLDER_REGEX = /\[(Assignment|Selection):\s*([^\]]+)\]/g;

/**
 * Render text with highlighted placeholders
 */
function renderWithPlaceholders(text: string): React.ReactNode {
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  // Reset regex state
  PLACEHOLDER_REGEX.lastIndex = 0;

  while ((match = PLACEHOLDER_REGEX.exec(text)) !== null) {
    // Add text before the placeholder
    if (match.index > lastIndex) {
      segments.push(
        <span key={`text-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>
      );
    }

    // Add the placeholder with highlighting
    segments.push(
      <span
        key={`placeholder-${match.index}`}
        className="inline-flex items-baseline gap-1 px-1.5 py-0.5 mx-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[0.9em]"
        title={`${match[1]}: Organization-defined parameter`}
      >
        <span className="opacity-60 text-[0.85em]">
          {match[1] === 'Assignment' ? '⚙' : '☑'}
        </span>
        <span className="font-medium">{match[2].trim()}</span>
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
  }

  return segments.length > 0 ? segments : text;
}

/**
 * Split text into paragraphs at logical sentence boundaries
 * Looks for patterns like ". [A-Z]" (period, space, capital letter)
 */
function splitIntoParagraphs(text: string): string[] {
  // First, check if there are existing paragraph breaks
  if (text.includes('\n\n')) {
    return text.split(/\n\n+/).filter(p => p.trim());
  }

  // Split on sentence boundaries that indicate topic changes
  // Pattern: period + space + capital letter (but not common abbreviations)
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/);

  // Group sentences into paragraphs (roughly 3-4 sentences each)
  const paragraphs: string[] = [];
  let currentParagraph: string[] = [];

  for (const sentence of sentences) {
    currentParagraph.push(sentence);

    // Create a new paragraph every 3-4 sentences, or at natural topic breaks
    if (currentParagraph.length >= 3) {
      paragraphs.push(currentParagraph.join(' '));
      currentParagraph = [];
    }
  }

  // Add remaining sentences
  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph.join(' '));
  }

  return paragraphs;
}

/**
 * Formatted prose component for long-form text like Supplemental Guidance
 * Breaks dense text into readable paragraphs and highlights placeholders
 */
export function FormattedProse({ text, className }: FormattedProseProps) {
  const paragraphs = splitIntoParagraphs(text);

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {paragraphs.map((paragraph, index) => (
        <p
          key={index}
          className="text-sm text-muted-foreground leading-relaxed"
        >
          {renderWithPlaceholders(paragraph)}
        </p>
      ))}
    </div>
  );
}
