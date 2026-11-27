import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { markdownCodeComponents } from '@/components/ui/markdown-code';
import { normalizeGrcLankerMarkdown } from '@/lib/ai/normalize-grclanker-markdown';

interface GrcLankerMarkdownProps {
  content: string;
  className?: string;
}

const markdownComponents = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h2 className="mt-4 mb-2 border-b border-border/60 pb-1 text-sm font-semibold tracking-tight first:mt-0">
      {children}
    </h2>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mt-4 mb-2 border-b border-border/60 pb-1 text-sm font-semibold tracking-tight first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mt-3 mb-1.5 text-[13px] font-semibold text-foreground/90 first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }: { children?: ReactNode }) => (
    <h4 className="mt-2.5 mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h4>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mb-2 text-[13px] leading-relaxed text-foreground/90 last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="mb-2.5 ml-4 list-disc space-y-1 text-[13px] leading-relaxed marker:text-muted-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="mb-2.5 ml-4 list-decimal space-y-1 text-[13px] leading-relaxed marker:text-muted-foreground">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="pl-0.5 leading-relaxed">{children}</li>
  ),
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a
      href={href}
      className="text-primary underline-offset-2 hover:underline"
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  ),
  ...markdownCodeComponents({
    inline: 'rounded bg-muted px-1 py-0.5 font-mono text-[12px] text-primary',
    blockWrapper: 'mb-2 overflow-hidden rounded-md border border-border/60 text-[12px]',
  }),
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="mb-2 border-l-2 border-primary/40 pl-3 text-[13px] text-muted-foreground">
      {children}
    </blockquote>
  ),
  table: ({ children }: { children?: ReactNode }) => (
    <div className="mb-2.5 overflow-x-auto rounded-md border border-border/70">
      <table className="w-full min-w-[280px] border-collapse text-left text-[12px]">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: { children?: ReactNode }) => (
    <thead className="bg-muted/60">{children}</thead>
  ),
  th: ({ children }: { children?: ReactNode }) => (
    <th className="border-b border-border px-2 py-1.5 font-semibold">{children}</th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="border-b border-border/50 px-2 py-1.5 align-top">{children}</td>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }: { children?: ReactNode }) => (
    <em className="italic">{children}</em>
  ),
  hr: () => <hr className="my-3 border-border/70" />,
};

export function GrcLankerMarkdown({ content, className = '' }: GrcLankerMarkdownProps) {
  const markdown = normalizeGrcLankerMarkdown(content);
  if (!markdown) return null;

  return (
    <div className={`grclanker-md text-foreground ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
