import type { ReactNode } from 'react';
import type { ExtraProps } from 'react-markdown';
import { CodeBlock } from '@/components/ui/CodeBlock';

/**
 * Shared react-markdown `code`/`pre` overrides that route ALL fenced code
 * blocks through CodeBlock (@pierre/diffs), including language-less fences
 * (common in LLM output), which fall back to plain-text highlighting.
 *
 * Block handling lives in the `pre` override because that is where
 * block-ness is unambiguous: react-markdown always wraps block code in
 * `pre > code`, but only adds a `language-*` class when the fence declares
 * a language, so dispatching on the class inside `code` misclassifies
 * language-less blocks as inline. The `code` override here only ever
 * *renders* true inline code; its output for block code is discarded by
 * `pre`, which re-reads the raw text from the hast node instead.
 */

type HastElement = NonNullable<ExtraProps['node']>;

interface MarkdownCodeClasses {
  /** Classes for true inline `code` spans. */
  inline: string;
  /** Classes for the wrapper around fenced/indented code blocks. */
  blockWrapper: string;
}

function hastText(node: HastElement['children'][number]): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'element') return node.children.map(hastText).join('');
  return '';
}

export function markdownCodeComponents({ inline, blockWrapper }: MarkdownCodeClasses) {
  return {
    pre: ({ children, node }: { children?: ReactNode } & ExtraProps) => {
      const codeNode = node?.children.find(
        (child): child is HastElement => child.type === 'element' && child.tagName === 'code',
      );
      if (!codeNode) {
        // Only reachable for a `pre` without a `code` child, which markdown
        // itself never produces; keep the frame around whatever is inside.
        return <div className={blockWrapper}>{children}</div>;
      }

      const classNames = codeNode.properties.className;
      const languageClass = Array.isArray(classNames)
        ? classNames.find(
            (cls): cls is string => typeof cls === 'string' && cls.startsWith('language-'),
          )
        : undefined;

      return (
        <div className={blockWrapper}>
          <CodeBlock
            code={hastText(codeNode).replace(/\n$/, '')}
            language={languageClass?.slice('language-'.length) ?? 'text'}
            lineNumbers={false}
          />
        </div>
      );
    },
    code: ({ children }: { children?: ReactNode }) => (
      <code className={inline}>{children}</code>
    ),
  };
}
