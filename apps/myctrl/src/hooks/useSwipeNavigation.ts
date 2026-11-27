import { useDrag } from '@use-gesture/react';

interface UseSwipeNavigationOptions {
  prevUrl: string | null;
  nextUrl: string | null;
  threshold?: number;
}

export function useSwipeNavigation({ prevUrl, nextUrl, threshold = 50 }: UseSwipeNavigationOptions) {
  const bind = useDrag(
    ({ direction: [dx], distance: [dist], active }) => {
      if (!active && dist > threshold) {
        if (dx < 0 && nextUrl) {
          window.location.href = nextUrl;
        } else if (dx > 0 && prevUrl) {
          window.location.href = prevUrl;
        }
      }
    },
    {
      axis: 'x',
      filterTaps: true,
      pointer: { touch: true },
    }
  );

  return { bind };
}
