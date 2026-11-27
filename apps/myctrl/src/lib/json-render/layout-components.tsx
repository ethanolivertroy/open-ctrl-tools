import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { markdownCodeComponents } from '@/components/ui/markdown-code';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { Component } from './catalog';
import { ErrorMessage, type ComponentProps } from './primitives';

type RenderableChildrenProps<T extends 'Section' | 'ExpandableSection' | 'TabPanel'> =
  ComponentProps<T> & { renderComponent: (component: Component) => React.ReactNode };

// Module scope so component identities stay stable across renders;
// an inline object would remount every code block on each re-render.
const textBlockMarkdownComponents: Components = {
  h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-semibold mt-3 mb-2">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-semibold mt-2 mb-1">{children}</h3>,
  p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="list-disc ml-4 mb-2 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal ml-4 mb-2 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-primary hover:underline"
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  ),
  ...markdownCodeComponents({
    inline: 'bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-primary',
    blockWrapper: 'rounded-lg overflow-hidden border border-border/60 text-xs mb-2',
  }),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/50 pl-3 italic text-muted-foreground mb-2">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-2">
      <table className="w-full border-collapse text-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-border">{children}</thead>,
  th: ({ children }) => <th className="text-left p-2 font-semibold">{children}</th>,
  td: ({ children }) => <td className="p-2 border-b border-border/50">{children}</td>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  hr: () => <hr className="border-border my-4" />,
};

export function AITextBlock({ config }: ComponentProps<'TextBlock'>) {
  const { content, variant = 'default' } = config;
  const [showReasoning, setShowReasoning] = React.useState(false);

  const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
  const reasoning = thinkMatch?.[1]?.trim() || null;
  const visibleContent = content.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();

  const variantClasses: Record<string, string> = {
    default: 'text-foreground',
    callout: 'p-4 rounded-lg border border-primary/30 bg-primary/5 text-foreground',
    warning: 'p-4 rounded-lg border border-yellow-600/30 dark:border-yellow-400/30 bg-yellow-400/5 text-foreground',
    info: 'p-4 rounded-lg border border-blue-600/30 dark:border-blue-400/30 bg-blue-400/5 text-foreground',
    success: 'p-4 rounded-lg border border-green-600/30 dark:border-green-400/30 bg-green-400/5 text-foreground',
  };

  return (
    <div className={`text-sm prose prose-sm dark:prose-invert max-w-none ${variantClasses[variant]}`}>
      {reasoning && (
        <div className="mb-3 rounded-lg border border-border/50 bg-muted/20 overflow-hidden">
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className={`transition-transform ${showReasoning ? 'rotate-90' : ''}`}>&#9654;</span>
            <span>Show reasoning</span>
          </button>
          {showReasoning && (
            <div className="px-3 pb-3 text-xs text-muted-foreground border-t border-border/30 pt-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {reasoning}
              </ReactMarkdown>
            </div>
          )}
        </div>
      )}
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={textBlockMarkdownComponents}>
        {visibleContent || content}
      </ReactMarkdown>
    </div>
  );
}

export function AISection({ config, renderComponent }: RenderableChildrenProps<'Section'>) {
  const { title, description, children } = config;

  return (
    <div className="space-y-4">
      {title && (
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{title}</h3>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      <div className="space-y-4">
        {children?.map((child: Component, i: number) => (
          <div key={i}>{renderComponent(child)}</div>
        ))}
      </div>
    </div>
  );
}

export function AIExpandableSection({ config, renderComponent }: RenderableChildrenProps<'ExpandableSection'>) {
  const { title, subtitle, defaultExpanded = false, children } = config;
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-card hover:bg-muted/50 transition-colors text-left"
      >
        <div>
          <h4 className="text-sm font-semibold">{title}</h4>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <svg
          className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isExpanded && (
        <div className="p-4 border-t border-border bg-card/50 space-y-4">
          {children?.map((child: Component, i: number) => (
            <div key={i}>{renderComponent(child)}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AITabPanel({ config, renderComponent }: RenderableChildrenProps<'TabPanel'>) {
  const { tabs, defaultTab } = config;

  if (!tabs || tabs.length === 0) {
    return <ErrorMessage message="TabPanel requires at least one tab" />;
  }

  const initialTab = defaultTab || tabs[0].id;

  return (
    <Tabs defaultValue={initialTab} className="w-full">
      <TabsList className="w-full justify-start border-b border-border bg-transparent rounded-none p-0 overflow-x-auto flex-nowrap">
        {tabs.map(tab => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map(tab => (
        <TabsContent key={tab.id} value={tab.id} className="mt-4 space-y-4">
          {tab.children?.map((child: Component, i: number) => (
            <div key={i}>{renderComponent(child)}</div>
          ))}
        </TabsContent>
      ))}
    </Tabs>
  );
}
