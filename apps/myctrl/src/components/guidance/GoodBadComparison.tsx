import { CodeBlock } from '@/components/ui/CodeBlock';
import {
  isComparableGoodBadCode,
  parseGoodBadCode,
} from './good-bad-parser';

interface GoodBadComparisonProps {
  code: string;
  language: string;
  title?: string;
}

/**
 * Renders GOOD and BAD code examples side by side for easy comparison.
 */
export function GoodBadComparison({ code, language, title }: GoodBadComparisonProps) {
  const parsed = parseGoodBadCode(code);

  // If we couldn't parse into good/bad sections, fall back to regular display
  if (!isComparableGoodBadCode(parsed)) {
    return <CodeBlock code={code} language={language} />;
  }

  const sectionCount = [parsed.bad, parsed.good, parsed.better].filter(Boolean).length;
  const gridClassName = sectionCount === 3
    ? 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3'
    : 'grid grid-cols-1 gap-3 md:grid-cols-2';

  return (
    <div className="space-y-2">
      {title && (
        <div className="text-xs text-muted-foreground font-medium mb-2">
          {title}
        </div>
      )}

      {parsed.sharedPrelude && (
        <div className="flex flex-col gap-1.5">
          <div className="text-xs font-medium text-muted-foreground">
            Shared setup
          </div>
          <div className="rounded-md border border-border overflow-hidden">
            <CodeBlock code={parsed.sharedPrelude} language={language} />
          </div>
        </div>
      )}

      <div className={gridClassName}>
        {/* BAD Example */}
        {parsed.bad && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded bg-red-500/10 text-red-500 border border-red-500/20">
                <XIcon className="w-3 h-3" />
                BAD
              </span>
              <span className="text-xs text-muted-foreground">(Avoid)</span>
            </div>
            <div className="rounded-md border border-red-500/20 overflow-hidden">
              <CodeBlock code={parsed.bad} language={language} />
            </div>
          </div>
        )}

        {/* GOOD Example */}
        {parsed.good && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded bg-green-500/10 text-green-500 border border-green-500/20">
                <CheckIcon className="w-3 h-3" />
                GOOD
              </span>
              {parsed.better && (
                <span className="text-xs text-muted-foreground">(Basic)</span>
              )}
            </div>
            <div className="rounded-md border border-green-500/20 overflow-hidden">
              <CodeBlock code={parsed.good} language={language} />
            </div>
          </div>
        )}

        {/* BETTER Example */}
        {parsed.better && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                <StarIcon className="w-3 h-3" />
                BETTER
              </span>
              <span className="text-xs text-muted-foreground">(Recommended)</span>
            </div>
            <div className="rounded-md border border-blue-500/20 overflow-hidden">
              <CodeBlock code={parsed.better} language={language} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  );
}
