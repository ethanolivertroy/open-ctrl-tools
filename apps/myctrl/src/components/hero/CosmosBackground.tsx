import * as React from 'react';
import { createCosmos, type CosmosHandle } from '@/lib/cosmos/renderer';
import { useSkyMode } from './useSkyMode';

/**
 * Full-viewport deep-space backdrop for the homepage: a planet of dust beside
 * the hero that scatters, spirals and settles as the page scrolls.
 *
 * Mount it in the layout's `background` slot so it sits behind every section.
 * It looks for `[data-cosmos-anchor]` (the hero) and `[data-cosmos-copy]`
 * (the hero's text column) to compose the planet around the page.
 */
export function CosmosBackground() {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const handleRef = React.useRef<CosmosHandle | null>(null);
  const mode = useSkyMode();
  const modeRef = React.useRef(mode);
  modeRef.current = mode;

  const [visible, setVisible] = React.useState(false);
  const [unsupported, setUnsupported] = React.useState(false);
  const enabled = mode !== 'off';

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!enabled || !canvas) return;

    const start = () => {
      let handle: CosmosHandle | null = null;
      try {
        handle = createCosmos(canvas, {
          anchor: document.querySelector('[data-cosmos-anchor]'),
          copy: document.querySelector('[data-cosmos-copy]'),
          mode: modeRef.current === 'still' ? 'still' : 'drift',
          onFirstFrame: () => setVisible(true),
        });
      } catch (error) {
        // A decorative backdrop must never take the page down with it.
        console.warn('cosmos: falling back to a static backdrop', error);
      }
      handleRef.current = handle;
      if (!handle) setUnsupported(true);
    };

    // A lost context (GPU reset, tab eviction) comes back empty: rebuild.
    const onRestored = () => {
      handleRef.current?.destroy();
      start();
    };

    start();
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextrestored', onRestored);
      handleRef.current?.destroy();
      handleRef.current = null;
      setVisible(false);
    };
  }, [enabled]);

  React.useEffect(() => {
    if (mode !== 'off') handleRef.current?.setMode(mode);
  }, [mode]);

  if (!enabled) return null;

  if (unsupported) {
    // No WebGL2: a still wash of the same colours instead of an empty page.
    return <div className="cosmos-fallback pointer-events-none fixed inset-0 z-0" aria-hidden="true" />;
  }

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed left-0 top-0 z-0 block h-screen w-full transition-opacity duration-1000 ease-out"
      // The large viewport height keeps the canvas a constant size while
      // mobile browser chrome slides in and out.
      style={{ height: '100lvh', opacity: visible ? 1 : 0 }}
      data-cosmos={mode}
      aria-hidden="true"
    />
  );
}
