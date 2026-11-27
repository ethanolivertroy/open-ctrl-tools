import { useEffect, useRef } from 'react';

interface UseEdgeSwipeOptions {
  onSwipe: () => void;
  edgeWidth?: number;
  threshold?: number;
  breakpoint?: number;
}

export function useEdgeSwipe({
  onSwipe,
  edgeWidth = 20,
  threshold = 50,
  breakpoint = 1024,
}: UseEdgeSwipeOptions) {
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.innerWidth >= breakpoint) return;
      const touch = e.touches[0];
      if (!touch) return;
      if (touch.clientX <= edgeWidth) {
        startX = touch.clientX;
        startY = touch.clientY;
        tracking = true;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = Math.abs(touch.clientY - startY);
      if (dx > threshold && dx > dy) {
        onSwipeRef.current();
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [edgeWidth, threshold, breakpoint]);
}
