import * as React from 'react';
import { applyTheme, normalizeTheme, type Theme } from '@/lib/theme';

type SkyMode = 'drift' | 'still' | 'off';

const SKY_STORAGE_KEY = 'myctrl-sky-mode';

interface Star {
  x: number;
  y: number;
  z: number;
  radius: number;
  alpha: number;
  twinklePhase: number;
  twinkleSpeed: number;
  hueIndex: 0 | 1 | 2;
}

interface Palette {
  colors: [string, string, string];
  orbitColor: string;
  alphaScale: number;
}

function getThemePalette(theme: string): Palette {
  if (theme === 'latte') {
    return {
      colors: ['rgba(76, 79, 105, ', 'rgba(136, 57, 239, ', 'rgba(114, 135, 253, '],
      orbitColor: 'rgba(136, 57, 239, 0.14)',
      alphaScale: 0.45,
    };
  }
  if (theme === 'dracula') {
    return {
      colors: ['rgba(248, 248, 242, ', 'rgba(189, 147, 249, ', 'rgba(139, 233, 253, '],
      orbitColor: 'rgba(189, 147, 249, 0.13)',
      alphaScale: 0.85,
    };
  }
  return {
    colors: ['rgba(205, 214, 244, ', 'rgba(203, 166, 247, ', 'rgba(180, 190, 254, '],
    orbitColor: 'rgba(203, 166, 247, 0.12)',
    alphaScale: 0.85,
  };
}

function createStars(count: number, width: number, height: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i += 1) {
    const z = 0.25 + Math.random() * 0.95;
    const isBright = i % 11 === 0;
    stars.push({
      x: Math.random() * Math.max(width, 1),
      y: Math.random() * Math.max(height, 1),
      z,
      radius: isBright ? 1.5 + Math.random() * 0.9 : 0.65 + Math.random() * 1.15,
      alpha: isBright ? 0.45 + Math.random() * 0.4 : 0.16 + Math.random() * 0.45,
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.004 + Math.random() * 0.012,
      hueIndex: isBright ? 1 : i % 5 === 0 ? 2 : 0,
    });
  }
  return stars;
}

const THEMES: { id: Theme; label: string }[] = [
  { id: 'mocha', label: 'mocha' },
  { id: 'dracula', label: 'dracula' },
  { id: 'latte', label: 'latte' },
];

const SKY_MODES: SkyMode[] = ['drift', 'still', 'off'];

export function SpaceCanvas() {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const [skyMode, setSkyMode] = React.useState<SkyMode>('drift');
  const [activeTheme, setActiveTheme] = React.useState<Theme>('mocha');
  const [reducedMotion, setReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setReducedMotion(mq.matches);
    syncMotion();
    mq.addEventListener('change', syncMotion);

    const saved = localStorage.getItem(SKY_STORAGE_KEY);
    if (saved === 'drift' || saved === 'still' || saved === 'off') {
      setSkyMode(saved);
    } else if (mq.matches) {
      setSkyMode('still');
    }

    const currentAttr = document.documentElement.getAttribute('data-theme');
    if (currentAttr === 'mocha' || currentAttr === 'dracula' || currentAttr === 'latte') {
      setActiveTheme(currentAttr);
    } else {
      setActiveTheme(normalizeTheme(localStorage.getItem('theme')));
    }

    const themeObserver = new MutationObserver(() => {
      const next = document.documentElement.getAttribute('data-theme');
      if (next === 'mocha' || next === 'dracula' || next === 'latte') {
        setActiveTheme(next);
      }
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => {
      mq.removeEventListener('change', syncMotion);
      themeObserver.disconnect();
    };
  }, []);

  const updateSkyMode = (mode: SkyMode) => {
    setSkyMode(mode);
    try {
      localStorage.setItem(SKY_STORAGE_KEY, mode);
    } catch {
      // Ignore storage quota / privacy mode errors
    }
  };

  const handleThemeSwitch = (theme: Theme) => {
    applyTheme(theme);
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // Ignore storage quota / privacy mode errors
    }
    setActiveTheme(theme);
  };

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || skyMode === 'off') return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = container.clientWidth;
    let height = container.clientHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let stars = createStars(Math.min(130, Math.max(55, Math.floor((width * height) / 7200))), width, height);

    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    let scrollParallaxY = 0;
    let isVisible = true;
    let rafId = 0;
    let tick = 0;

    const resize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      stars = createStars(Math.min(130, Math.max(55, Math.floor((width * height) / 7200))), width, height);
      drawFrame(false);
    };

    const drawFrame = (animate: boolean) => {
      const palette = getThemePalette(activeTheme);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      if (animate) {
        pointer.x += (pointer.targetX - pointer.x) * 0.05;
        pointer.y += (pointer.targetY - pointer.y) * 0.05;
        tick += 1;
      }

      // Subtle architectural orbital arc (ronacher.eu inspired clean geometry)
      const cx = width * 0.72 + pointer.x * 10;
      const cy = height * 0.36 + pointer.y * 10 - scrollParallaxY * 0.12;
      const rx = Math.max(240, Math.min(width * 0.42, 460));
      const ry = rx * 0.36;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.24 + (animate ? Math.sin(tick * 0.0012) * 0.015 : 0));
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = palette.orbitColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Secondary inner concentric arc segment
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 0.64, ry * 0.64, 0, 0.25, Math.PI * 1.45);
      ctx.strokeStyle = palette.orbitColor;
      ctx.lineWidth = 0.75;
      ctx.stroke();

      // Single crisp orbital node riding the ellipse
      const orbitAngle = animate ? tick * 0.0022 : 0.85;
      const nodeX = Math.cos(orbitAngle) * rx;
      const nodeY = Math.sin(orbitAngle) * ry;
      ctx.beginPath();
      ctx.arc(nodeX, nodeY, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = `${palette.colors[1]}0.65)`;
      ctx.fill();
      ctx.restore();

      for (let i = 0; i < stars.length; i += 1) {
        const s = stars[i];
        if (animate) {
          s.x -= 0.06 * s.z;
          s.y -= 0.025 * s.z;
          if (s.x < -4) s.x = width + 4;
          if (s.y < -4) s.y = height + 4;
          s.twinklePhase += s.twinkleSpeed;
        }

        const sx = s.x + pointer.x * (16 * s.z);
        const sy = s.y + pointer.y * (16 * s.z) - scrollParallaxY * (0.06 * s.z);

        if (sx < -6 || sx > width + 6 || sy < -6 || sy > height + 6) continue;

        const pulse = 0.76 + 0.24 * Math.sin(s.twinklePhase);
        const finalAlpha = Math.min(0.95, s.alpha * pulse * palette.alphaScale);
        ctx.beginPath();
        ctx.arc(sx, sy, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${palette.colors[s.hueIndex]}${finalAlpha.toFixed(3)})`;
        ctx.fill();
      }
    };

    const shouldAnimate = skyMode === 'drift' && !reducedMotion;

    const loop = () => {
      if (!isVisible || document.hidden || !shouldAnimate) {
        rafId = 0;
        return;
      }
      drawFrame(true);
      rafId = window.requestAnimationFrame(loop);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointer.targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      pointer.targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      if (!shouldAnimate) drawFrame(false);
    };

    const onScroll = () => {
      scrollParallaxY = Math.min(240, window.scrollY || 0);
      if (!shouldAnimate) drawFrame(false);
    };

    const onVisibilityChange = () => {
      if (!document.hidden && isVisible && shouldAnimate && !rafId) {
        rafId = window.requestAnimationFrame(loop);
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        isVisible = entries.some((entry) => entry.isIntersecting);
        if (isVisible && shouldAnimate && !rafId) {
          rafId = window.requestAnimationFrame(loop);
        }
      },
      { threshold: 0.01 },
    );
    io.observe(container);

    const ro = new ResizeObserver(() => resize());
    ro.observe(container);

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);

    resize();
    if (shouldAnimate) {
      rafId = window.requestAnimationFrame(loop);
    }

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [skyMode, activeTheme, reducedMotion]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden={false}
    >
      {skyMode !== 'off' && (
        <canvas
          ref={canvasRef}
          className="h-full w-full block"
          aria-hidden="true"
        />
      )}

      {/* Subtle horizon fade so canvas melts cleanly into section background */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background to-transparent"
        aria-hidden="true"
      />

      {/* Minimalist telemetry bar */}
      <div className="pointer-events-auto absolute bottom-4 right-4 z-20 hidden sm:flex items-center gap-3 rounded-lg border border-border/50 bg-background/75 backdrop-blur-md px-2.5 py-1 text-[11px] font-mono text-muted-foreground">
        <div className="flex items-center gap-1" role="group" aria-label="Space field mode">
          <span className="text-muted-foreground/70 mr-1">sky:</span>
          {SKY_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => updateSkyMode(mode)}
              aria-pressed={skyMode === mode}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                skyMode === mode
                  ? 'bg-primary/15 text-primary font-medium'
                  : 'hover:text-foreground'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <span className="h-3 w-px bg-border/60" aria-hidden="true" />

        <div className="flex items-center gap-1" role="group" aria-label="Color theme">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleThemeSwitch(t.id)}
              aria-pressed={activeTheme === t.id}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                activeTheme === t.id
                  ? 'bg-primary/15 text-primary font-medium'
                  : 'hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
