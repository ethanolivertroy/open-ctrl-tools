import { useEffect, useRef } from 'react';
import { ACTIVE_PROJECT_CHANGED_EVENT } from '@/lib/storage/project-store';

/**
 * Subscribe a callback to one or more window events. Replaces the
 * copy-pasted `window.addEventListener(...) / removeEventListener(...)`
 * blocks scattered across components.
 *
 * The callback is kept in a ref so consumers can pass inline closures without
 * re-registering listeners on every render (see useEdgeSwipe.ts pattern).
 */
export function useWindowEvents(events: readonly string[], handler: () => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  // Key on the joined names so a stable inline array doesn't re-subscribe.
  const eventsKey = events.join('\u0000');

  useEffect(() => {
    const names = eventsKey.split('\u0000');
    const listener = () => handlerRef.current();
    for (const name of names) window.addEventListener(name, listener);
    return () => {
      for (const name of names) window.removeEventListener(name, listener);
    };
  }, [eventsKey]);
}

/** Run a callback whenever the active project changes. */
export function useProjectChange(onChange: () => void): void {
  useWindowEvents([ACTIVE_PROJECT_CHANGED_EVENT], onChange);
}
