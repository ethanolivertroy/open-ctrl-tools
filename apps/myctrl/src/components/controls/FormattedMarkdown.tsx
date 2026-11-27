import * as React from 'react';

interface FormattedMarkdownProps {
  text: string;
  className?: string;
}

/**
 * Parse markdown links [text](url) and render as anchor tags
 * If link text is "URL", render as external link icon instead
 */
function parseLinks(text: string): React.ReactNode[] {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(text)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      segments.push(text.slice(lastIndex, match.index));
    }

    const linkText = match[1];
    const linkUrl = match[2];
    const isUrlPlaceholder = linkText.toLowerCase() === 'url';

    // Add the link
    segments.push(
      <a
        key={match.index}
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={isUrlPlaceholder
          ? "inline-flex items-center text-primary hover:text-primary/80 transition-colors"
          : "text-primary hover:underline"
        }
        title={isUrlPlaceholder ? linkUrl : undefined}
      >
        {isUrlPlaceholder ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        ) : linkText}
      </a>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push(text.slice(lastIndex));
  }

  return segments.length > 0 ? segments : [text];
}

/**
 * Parse bold text **text** and render as strong tags
 */
function parseBold(content: React.ReactNode[]): React.ReactNode[] {
  return content.flatMap((node, nodeIndex) => {
    if (typeof node !== 'string') return [node];

    const boldRegex = /\*\*([^*]+)\*\*/g;
    const segments: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = boldRegex.exec(node)) !== null) {
      if (match.index > lastIndex) {
        segments.push(node.slice(lastIndex, match.index));
      }
      segments.push(
        <strong key={`bold-${nodeIndex}-${match.index}`} className="font-semibold text-foreground">
          {match[1]}
        </strong>
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < node.length) {
      segments.push(node.slice(lastIndex));
    }

    return segments.length > 0 ? segments : [node];
  });
}

/**
 * Render inline content with links and bold
 */
function renderInline(text: string): React.ReactNode {
  const withLinks = parseLinks(text);
  const withBold = parseBold(withLinks);
  return <>{withBold}</>;
}

/**
 * Parse a block of markdown and return structured elements
 */
function parseMarkdownBlocks(text: string): React.ReactNode[] {
  // Split by newlines, preserving empty lines for paragraph breaks
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: string[] = [];
  let currentParagraph: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const text = currentParagraph.join(' ').trim();
      if (text) {
        elements.push(
          <p key={key++} className="text-sm text-muted-foreground leading-relaxed">
            {renderInline(text)}
          </p>
        );
      }
      currentParagraph = [];
    }
  };

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={key++} className="list-disc list-outside ml-5 space-y-1.5 text-sm text-muted-foreground">
          {currentList.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Empty line - flush current content
    if (!trimmed) {
      flushList();
      flushParagraph();
      continue;
    }

    // Header (### or ####)
    if (trimmed.startsWith('###')) {
      flushList();
      flushParagraph();

      const headerMatch = trimmed.match(/^(#{3,4})\s+(.+)$/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const headerText = headerMatch[2];

        if (level === 3) {
          elements.push(
            <h4 key={key++} className="text-sm font-semibold text-foreground mt-4 mb-2">
              {renderInline(headerText)}
            </h4>
          );
        } else {
          elements.push(
            <h5 key={key++} className="text-sm font-medium text-foreground/80 mt-3 mb-1">
              {renderInline(headerText)}
            </h5>
          );
        }
      }
      continue;
    }

    // List item (- or *)
    if (trimmed.match(/^[-*]\s+/)) {
      flushParagraph();
      const itemText = trimmed.replace(/^[-*]\s+/, '');
      currentList.push(itemText);
      continue;
    }

    // Regular text - add to current paragraph
    flushList();
    currentParagraph.push(trimmed);
  }

  // Flush remaining content
  flushList();
  flushParagraph();

  return elements;
}

/**
 * Formatted markdown component for rendering markdown content
 * Supports headers, lists, links, and bold text
 */
export function FormattedMarkdown({ text, className }: FormattedMarkdownProps) {
  const elements = React.useMemo(() => parseMarkdownBlocks(text), [text]);

  return (
    <div className={`space-y-3 ${className || ''}`}>
      {elements}
    </div>
  );
}
