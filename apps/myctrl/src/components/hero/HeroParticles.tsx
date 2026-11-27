/**
 * HeroParticles - Subtle floating particle background for hero section
 *
 * Creates a "constellation" effect with:
 * - Floating particles that drift slowly
 * - Connecting lines between nearby particles
 * - Theme-aware colors from CSS custom properties
 * - Reduced motion support
 * - Visibility-based animation pausing
 */

import { useEffect, useRef, useCallback } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  opacity: number;
}

interface ParticleConfig {
  count: { mobile: number; tablet: number; desktop: number };
  size: { min: number; max: number };
  speed: { min: number; max: number };
  opacity: { base: number; max: number };
  connections: {
    enabled: boolean;
    maxDistance: number;
    opacity: number;
  };
}

const CONFIG: ParticleConfig = {
  count: { mobile: 15, tablet: 25, desktop: 40 },
  size: { min: 1.5, max: 3 },
  speed: { min: 0.15, max: 0.4 },
  opacity: { base: 0.3, max: 0.6 },
  connections: {
    enabled: true,
    maxDistance: 150,
    opacity: 0.15,
  },
};

// Get particle count based on viewport width
function getParticleCount(width: number): number {
  if (width < 640) return CONFIG.count.mobile;
  if (width < 1024) return CONFIG.count.tablet;
  return CONFIG.count.desktop;
}

// Extract colors from CSS custom properties
function getThemeColors(): string[] {
  if (typeof window === 'undefined') {
    // SSR fallback
    return ['#cba6f7', '#b4befe', '#74c7ec', '#94e2d5'];
  }

  const style = getComputedStyle(document.documentElement);
  return [
    style.getPropertyValue('--ctp-mauve').trim() || '#cba6f7',
    style.getPropertyValue('--ctp-lavender').trim() || '#b4befe',
    style.getPropertyValue('--ctp-sapphire').trim() || '#74c7ec',
    style.getPropertyValue('--ctp-teal').trim() || '#94e2d5',
  ];
}

// Random helper
function random(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// Create a single particle
function createParticle(width: number, height: number, colors: string[]): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = random(CONFIG.speed.min, CONFIG.speed.max);

  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: random(CONFIG.size.min, CONFIG.size.max),
    color: colors[Math.floor(Math.random() * colors.length)],
    opacity: random(CONFIG.opacity.base, CONFIG.opacity.max),
  };
}

export interface HeroParticlesProps {
  className?: string;
}

export function HeroParticles({ className = '' }: HeroParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const isVisibleRef = useRef(true);
  const reducedMotionRef = useRef(false);
  const colorsRef = useRef<string[]>([]);
  const dimensionsRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  // Initialize particles
  const initParticles = useCallback(() => {
    const { width, height } = dimensionsRef.current;
    if (width === 0 || height === 0) return;

    const colors = getThemeColors();
    colorsRef.current = colors;

    const count = getParticleCount(width);
    particlesRef.current = Array.from({ length: count }, () =>
      createParticle(width, height, colors)
    );
  }, []);

  // Update particle positions
  const updateParticles = useCallback((width: number, height: number) => {
    if (reducedMotionRef.current) return;

    particlesRef.current.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around edges with a small buffer
      if (p.x < -10) p.x = width + 10;
      if (p.x > width + 10) p.x = -10;
      if (p.y < -10) p.y = height + 10;
      if (p.y > height + 10) p.y = -10;
    });
  }, []);

  // Draw particles and connections
  const draw = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.clearRect(0, 0, width, height);
    const particles = particlesRef.current;

    // Draw connections first (behind particles)
    if (CONFIG.connections.enabled) {
      const maxDist = CONFIG.connections.maxDistance;
      const maxDistSq = maxDist * maxDist;

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distSq = dx * dx + dy * dy;

          if (distSq < maxDistSq) {
            const dist = Math.sqrt(distSq);
            const opacity = (1 - dist / maxDist) * CONFIG.connections.opacity;

            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = particles[i].color;
            ctx.globalAlpha = opacity;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    }

    // Draw particles
    particles.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.opacity;
      ctx.fill();
    });

    ctx.globalAlpha = 1;
  }, []);

  // Animation loop (throttled to ~30fps)
  const animate = useCallback((currentTime: number) => {
    if (!isVisibleRef.current) {
      animationFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      animationFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    // Throttle to ~30fps (33ms between frames)
    const elapsed = currentTime - lastFrameTimeRef.current;
    if (elapsed < 33) {
      animationFrameRef.current = requestAnimationFrame(animate);
      return;
    }
    lastFrameTimeRef.current = currentTime;

    const { width, height } = dimensionsRef.current;

    updateParticles(width, height);
    draw(ctx, width, height);

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [updateParticles, draw]);

  // Handle canvas resize
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Find the containing section element (look for parent with position relative)
    let container = canvas.parentElement;
    while (container && getComputedStyle(container).position !== 'relative') {
      container = container.parentElement;
    }
    if (!container) container = canvas.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();

    // Skip if container has no dimensions yet
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;

    // Store visual dimensions for particle calculations
    dimensionsRef.current = { width: rect.width, height: rect.height };

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    // Reinitialize particles for new size
    initParticles();
  }, [initParticles]);

  // Handle theme changes
  const handleThemeChange = useCallback(() => {
    const newColors = getThemeColors();
    colorsRef.current = newColors;

    // Update existing particles with new colors
    particlesRef.current.forEach((p) => {
      p.color = newColors[Math.floor(Math.random() * newColors.length)];
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check reduced motion preference
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = motionQuery.matches;

    const handleMotionChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };
    motionQuery.addEventListener('change', handleMotionChange);

    // Set up IntersectionObserver for visibility-based pausing
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisibleRef.current = entry.isIntersecting;
        });
      },
      { threshold: 0.1 }
    );
    observer.observe(canvas);

    // Watch for theme changes via data-theme attribute
    const themeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          handleThemeChange();
        }
      });
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    // Initial setup
    handleResize();

    // Start animation
    animationFrameRef.current = requestAnimationFrame(animate);

    // Resize listener
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      window.removeEventListener('resize', handleResize);
      motionQuery.removeEventListener('change', handleMotionChange);
      observer.disconnect();
      themeObserver.disconnect();
    };
  }, [handleResize, animate, handleThemeChange]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none ${className}`}
      aria-hidden="true"
    />
  );
}

export default HeroParticles;
