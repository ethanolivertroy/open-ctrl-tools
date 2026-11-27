import { useEffect, useState } from 'react';

const EXIT_MS = 200;

/**
 * Bottom-right toast for the knowledge graph. Enters with the shared
 * fade-in-up utility and leaves the same edge it came from (fade + downward
 * drift) instead of teleporting away when the message clears.
 */
export function GraphToast({ message }: { message: string | null }) {
  const [rendered, setRendered] = useState<string | null>(message);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (message) {
      setRendered(message);
      setLeaving(false);
      return;
    }
    if (!rendered) return;

    setLeaving(true);
    const timeout = window.setTimeout(() => {
      setRendered(null);
      setLeaving(false);
    }, EXIT_MS);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  if (!rendered) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 px-4 py-2.5 bg-background/90 backdrop-blur-xl border border-border/30 rounded-lg shadow-2xl text-[0.7rem] text-foreground max-w-sm transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${
        leaving
          ? 'opacity-0 translate-y-2 motion-reduce:translate-y-0'
          : 'animate-fade-in-up'
      }`}
    >
      <div className="flex items-center gap-2">
        <svg className="w-3.5 h-3.5 text-moderate shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{rendered}</span>
      </div>
    </div>
  );
}
