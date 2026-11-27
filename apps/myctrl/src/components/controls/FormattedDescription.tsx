import * as React from 'react';
import {
  parseDescription,
  hasStructuredContent,
  type DescriptionNode,
  type ContentSegment,
  type AssignmentPlaceholder,
  type FedRAMPSubstitution,
} from '@/lib/description-parser';

interface FormattedDescriptionProps {
  description: string;
}

/**
 * Render content segments with placeholder highlighting
 */
function renderContent(segments: ContentSegment[]): React.ReactNode {
  return segments.map((segment, i) => {
    if (typeof segment === 'string') {
      return <span key={i}>{segment}</span>;
    }

    // Render FedRAMP substitution with emerald styling
    if (segment.type === 'fedramp-substitution') {
      const sub = segment as FedRAMPSubstitution;
      return (
        <span
          key={i}
          className="inline-flex items-baseline gap-1 px-1.5 py-0.5 mx-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[0.9em]"
          title="FedRAMP parameter value"
        >
          <span className="opacity-70 text-[0.85em]">&#9654;</span>
          <span className="font-medium">{sub.text}</span>
        </span>
      );
    }

    // Render assignment/selection placeholder with highlighting
    const placeholder = segment as AssignmentPlaceholder;
    return (
      <span
        key={i}
        className="inline-flex items-baseline gap-1 px-1.5 py-0.5 mx-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[0.9em]"
        title={`${placeholder.type === 'assignment' ? 'Assignment' : 'Selection'}: Organization-defined parameter`}
      >
        <span className="opacity-60 text-[0.85em]">
          {placeholder.type === 'assignment' ? '\u2699' : '\u2611'}
        </span>
        <span className="font-medium">{placeholder.text}</span>
      </span>
    );
  });
}

/**
 * Render a single description node
 */
function renderNode(node: DescriptionNode, index: number): React.ReactNode {
  if (node.type === 'text') {
    return (
      <p key={index} className="text-foreground/90 leading-relaxed">
        {renderContent(node.content)}
      </p>
    );
  }

  if (node.type === 'letter-item') {
    return (
      <div
        key={index}
        className="relative pl-4 border-l-2 border-primary/30 hover:border-primary/60 transition-colors"
      >
        <div className="flex items-start gap-3">
          <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded bg-primary/10 text-primary text-sm font-mono font-semibold border border-primary/20">
            {node.marker}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-foreground/90 leading-relaxed">
              {renderContent(node.content)}
            </p>
            {node.children && node.children.length > 0 && (
              <div className="mt-2 ml-2 space-y-1.5">
                {node.children.map((child, childIndex) => (
                  <div key={childIndex} className="flex items-start gap-2">
                    <span className="shrink-0 w-5 h-5 flex items-center justify-center text-xs font-mono text-muted-foreground">
                      {child.marker}.
                    </span>
                    <p className="text-foreground/80 text-sm leading-relaxed">
                      {renderContent(child.content)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // number-item (standalone, shouldn't happen but handle it)
  if (node.type === 'number-item') {
    return (
      <div key={index} className="flex items-start gap-2 ml-4">
        <span className="shrink-0 w-5 h-5 flex items-center justify-center text-xs font-mono text-muted-foreground">
          {node.marker}.
        </span>
        <p className="text-foreground/80 text-sm leading-relaxed">
          {renderContent(node.content)}
        </p>
      </div>
    );
  }

  return null;
}

/**
 * Render segments for unstructured (plain-text) descriptions.
 * Handles [Assignment: ...], [Selection: ...], and {{FEDRAMP:...}} markers.
 */
function renderPlainTextSegments(description: string): React.ReactNode {
  // Split on placeholders and FedRAMP markers
  const segments = description.split(/(\[(?:Assignment|Selection)(?:\s*\([^)]*\))?:\s*[^\]]+\]|\{\{FEDRAMP:[^}]+\}\})/g);
  return segments.map((segment, i) => {
    // Check for FedRAMP substitution marker
    const fedrampMatch = segment.match(/^\{\{FEDRAMP:([^}]+)\}\}$/);
    if (fedrampMatch) {
      return (
        <span
          key={i}
          className="inline-flex items-baseline gap-1 px-1.5 py-0.5 mx-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[0.9em]"
          title="FedRAMP parameter value"
        >
          <span className="opacity-70 text-[0.85em]">&#9654;</span>
          <span className="font-medium">{fedrampMatch[1].trim()}</span>
        </span>
      );
    }

    // Check for placeholder
    const placeholderMatch = segment.match(/\[(Assignment|Selection)(?:\s*\([^)]*\))?:\s*([^\]]+)\]/);
    if (placeholderMatch) {
      return (
        <span
          key={i}
          className="inline-flex items-baseline gap-1 px-1.5 py-0.5 mx-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[0.9em]"
        >
          <span className="opacity-60 text-[0.85em]">
            {placeholderMatch[1] === 'Assignment' ? '\u2699' : '\u2611'}
          </span>
          <span className="font-medium">{placeholderMatch[2].trim()}</span>
        </span>
      );
    }
    return <span key={i}>{segment}</span>;
  });
}

/**
 * Formatted description component with visual hierarchy
 */
export function FormattedDescription({ description }: FormattedDescriptionProps) {
  // Check if description has structured content
  if (!hasStructuredContent(description)) {
    return (
      <div className="text-foreground/90 leading-relaxed whitespace-pre-wrap">
        {renderPlainTextSegments(description)}
      </div>
    );
  }

  // Parse and render structured content
  const nodes = parseDescription(description);

  return (
    <div className="space-y-3">
      {nodes.map((node, index) => renderNode(node, index))}
    </div>
  );
}
