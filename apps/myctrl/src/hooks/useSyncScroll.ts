import { useEffect, useRef } from 'react';

/**
 * Synchronizes scroll position between two scrollable containers.
 * Uses proportional scroll position to handle different content heights.
 * Follows useRef pattern for callbacks to avoid re-registering listeners.
 */
export function useSyncScroll() {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    const left = leftRef.current;
    const right = rightRef.current;
    if (!left || !right) return;

    const handleScroll = (source: HTMLDivElement, target: HTMLDivElement) => {
      if (syncingRef.current) return;
      syncingRef.current = true;

      const maxScroll = source.scrollHeight - source.clientHeight;
      if (maxScroll > 0) {
        const ratio = source.scrollTop / maxScroll;
        const targetMax = target.scrollHeight - target.clientHeight;
        target.scrollTop = ratio * targetMax;
      }

      // Use rAF to release the lock after paint
      requestAnimationFrame(() => {
        syncingRef.current = false;
      });
    };

    const onLeftScroll = () => handleScroll(left, right);
    const onRightScroll = () => handleScroll(right, left);

    left.addEventListener('scroll', onLeftScroll, { passive: true });
    right.addEventListener('scroll', onRightScroll, { passive: true });

    return () => {
      left.removeEventListener('scroll', onLeftScroll);
      right.removeEventListener('scroll', onRightScroll);
    };
  }, []);

  return { leftRef, rightRef };
}
