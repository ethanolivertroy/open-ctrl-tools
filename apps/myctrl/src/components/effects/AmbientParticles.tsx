/**
 * AmbientParticles — Lightweight floating particle atmosphere for inner pages.
 *
 * A stripped-down version of WebGLBackground: no sphere, no scroll formations,
 * just sparse particles drifting slowly. Provides subtle visual depth behind
 * glassmorphic UI elements.
 *
 * - Lower particle count than homepage (60 mobile / 150 desktop)
 * - 20fps throttle (ambient effect doesn't need high framerate)
 * - Slow rotation only, no mouse parallax
 * - Skips entirely if prefers-reduced-motion
 * - Theme-reactive via MutationObserver on data-theme
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// ─── Shaders (simple — no noise function needed) ────────────────────────────
const vertexShader = /* glsl */ `
attribute float aSize;
attribute float aOpacity;

varying vec3 vColor;
varying float vOpacity;

void main() {
  vColor = color;
  vOpacity = aOpacity;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = max(aSize * (60.0 / -mvPosition.z), 0.5);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const fragmentShader = /* glsl */ `
varying vec3 vColor;
varying float vOpacity;

void main() {
  float dist = length(gl_PointCoord - vec2(0.5));
  if (dist > 0.5) discard;

  float alpha = 1.0 - smoothstep(0.1, 0.5, dist);

  gl_FragColor = vec4(vColor, alpha * vOpacity);
}
`;

// ─── Theme Colors ───────────────────────────────────────────────────────────
function getThemeColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    teal: style.getPropertyValue('--ctp-teal').trim() || '#94e2d5',
    sapphire: style.getPropertyValue('--ctp-sapphire').trim() || '#74c7ec',
    green: style.getPropertyValue('--ctp-green').trim() || '#a6e3a1',
    mauve: style.getPropertyValue('--ctp-mauve').trim() || '#cba6f7',
  };
}

// ─── Component ──────────────────────────────────────────────────────────────
export function AmbientParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Skip if reduced motion preferred
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // WebGL feature detection
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      if (!gl) return;
    } catch {
      return;
    }

    // ── Settings ──
    // Light themes: additive particle glow reads as dark speckle on a light
    // background, so hide the effect (scene still builds for live switching)
    let isLightTheme = !document.documentElement.classList.contains('dark');
    const isMobile = window.innerWidth < 768;
    const dpr = Math.min(window.devicePixelRatio, isMobile ? 1 : 1.5);
    const particleCount = isMobile ? 60 : 150;

    // ── Scene ──
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 8);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 0);

    // ── Theme Colors ──
    let themeColors = getThemeColors();

    function buildPalette() {
      return {
        colors: [
          new THREE.Color(themeColors.teal),
          new THREE.Color(themeColors.sapphire),
          new THREE.Color(themeColors.green),
          new THREE.Color(themeColors.mauve),
        ],
        weights: [0.65, 0.90, 0.97, 1.0],
      };
    }

    function pickColor(p: ReturnType<typeof buildPalette>): THREE.Color {
      const roll = Math.random();
      for (let i = 0; i < p.weights.length; i++) {
        if (roll < p.weights[i]) return p.colors[i];
      }
      return p.colors[0];
    }

    let palette = buildPalette();

    // ── Particles ──
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const opacities = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const r = 4 + Math.random() * 14;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const c = pickColor(palette);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      sizes[i] = Math.random() * 1.0 + 0.3;
      opacities[i] = Math.random() * 0.12 + 0.03;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // ── Theme Change Observer ──
    function updateColors() {
      palette = buildPalette();
      const colorAttr = geometry.getAttribute('color') as THREE.BufferAttribute;
      for (let i = 0; i < particleCount; i++) {
        const c = pickColor(palette);
        colorAttr.setXYZ(i, c.r, c.g, c.b);
      }
      colorAttr.needsUpdate = true;
    }

    const themeObserver = new MutationObserver(() => {
      themeColors = getThemeColors();
      updateColors();

      const nowLight = !document.documentElement.classList.contains('dark');
      if (nowLight !== isLightTheme) {
        isLightTheme = nowLight;
        canvas.style.opacity = nowLight ? '0' : '1';
      }
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    // ── Animation Loop (20fps throttle) ──
    let animId: number;
    let lastTime = 0;
    let isTabVisible = true;
    // Also pause on window blur — a visible background window would
    // otherwise keep rendering indefinitely
    let isWindowFocused = document.hasFocus();
    let hasFadedIn = false;
    const FPS_INTERVAL = 1000 / 20;

    const onVisibilityChange = () => { isTabVisible = !document.hidden; };
    document.addEventListener('visibilitychange', onVisibilityChange);
    const onFocus = () => { isWindowFocused = true; };
    const onBlur = () => { isWindowFocused = false; };
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    const animate = (time: number) => {
      animId = requestAnimationFrame(animate);
      if (!isTabVisible || !isWindowFocused || isLightTheme) return;

      const delta = time - lastTime;
      if (delta < FPS_INTERVAL) return;
      lastTime = time - (delta % FPS_INTERVAL);

      const t = time * 0.001;

      // Slow drift rotation
      points.rotation.y = t * 0.006;
      points.rotation.x = t * 0.003;

      renderer.render(scene, camera);

      // Fade in canvas after first frame
      if (!hasFadedIn) {
        hasFadedIn = true;
        requestAnimationFrame(() => {
          canvas.style.opacity = '1';
        });
      }
    };

    animId = requestAnimationFrame(animate);

    // ── Cleanup ──
    return () => {
      cancelAnimationFrame(animId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onResize);
      themeObserver.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        pointerEvents: 'none',
        opacity: 0,
        transition: 'opacity 0.8s ease-out',
      }}
      aria-hidden="true"
    />
  );
}

export default AmbientParticles;
