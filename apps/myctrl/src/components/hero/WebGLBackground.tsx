/**
 * WebGLBackground - Full-page Three.js particle sphere inspired by mazehq.com
 *
 * The sphere is formed from thousands of particles on its surface. As the user
 * scrolls, particles disassemble outward, creating an ambient scattered field
 * across the page. Each particle has a staggered delay for organic dissolve.
 *
 * Features:
 * - Fibonacci-distributed particles forming a sphere
 * - Scroll-driven disassembly: sphere → scattered particles
 * - Per-particle scatter delay for cascading dissolve
 * - GPU-side noise displacement for organic "breathing" when formed
 * - Theme-aware colors, time-based easing, 30fps cap
 * - prefers-reduced-motion: static scene, no animation
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// ─── GLSL 3D Simplex Noise (Ashima Arts, MIT) ───────────────────────────────
const NOISE_GLSL = /* glsl */ `
vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 1.0 / 7.0;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

// ─── Sphere Particle Shaders ─────────────────────────────────────────────────
const sphereVertexShader = /* glsl */ `
${NOISE_GLSL}

attribute float aSize;
attribute float aOpacity;
attribute float aNoisePhase;
attribute vec3 aScatterTarget;
attribute vec3 aVortexTarget;
attribute vec3 aTracksTarget;
attribute float aScatterDelay;

uniform float uTime;
uniform float uDisplacement;
uniform float uScatter; // 0→1: sphere → scattered
uniform float uVortex;  // 0→1: scattered → vortex spiral
uniform float uTracks;  // 0→1: vortex → horizontal tracks
uniform float uBirth;   // 0→1 over first ~1.6s (particle materialization)
uniform float uKeepFraction; // light themes draw a sparse subset (1.0 = all)
uniform float uSizeScale;    // light themes: fewer but bigger ink dots

varying vec3 vColor;
varying float vOpacity;
varying float vDepth; // Export depth to fragment shader

void main() {
  vColor = color;

  // Light-mode thinning: cull a deterministic subset (aNoisePhase is a
  // per-particle random in 0–100, so this keeps an even spatial spread)
  if (aNoisePhase * 0.01 > uKeepFraction) {
    vOpacity = 0.0;
    gl_PointSize = 0.0;
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // outside clip space
    return;
  }

  // Per-particle staggered transitions (cascading dissolve/reform)
  float scatterT = smoothstep(0.0, 1.0, clamp((uScatter - aScatterDelay) / (1.0 - aScatterDelay), 0.0, 1.0));
  // Reverse stagger for vortex reform — last scattered = first reformed
  float reversedDelay = 0.4 - aScatterDelay;
  float vortexT = smoothstep(0.0, 1.0, clamp((uVortex - reversedDelay) / (1.0 - reversedDelay), 0.0, 1.0));
  float tracksT = smoothstep(0.0, 1.0, clamp((uTracks - aScatterDelay) / (1.0 - aScatterDelay), 0.0, 1.0));

  // Sphere position with noise displacement (fades as particles leave sphere)
  vec3 dir = normalize(position);
  float birthNoise = mix(1.8, 1.0, uBirth); // start with 1.8x noise, settle to 1x
  float noise = snoise(dir * 2.0 + uTime * 0.08 + aNoisePhase) * uDisplacement * birthNoise * (1.0 - scatterT);
  vec3 spherePos = position + dir * noise;

  // Birth: the sphere assembles from dust. Each particle flies in from its
  // scatter position with a per-particle stagger, so the form coalesces in
  // a cascading wave instead of fading in as a finished object.
  float birthT = smoothstep(0.0, 1.0, clamp((uBirth - aScatterDelay * 0.5) / (1.0 - aScatterDelay * 0.5), 0.0, 1.0));
  spherePos = mix(aScatterTarget * 1.7, spherePos, birthT);

  // Each transition relinquishes its motion as the next formation takes over.
  float explosionArc = sin(scatterT * 3.14159265) * (1.0 - vortexT);
  float vortexArc = sin(vortexT * 3.14159265) * (1.0 - tracksT);
  float tracksArc = sin(tracksT * 3.14159265);
  
  vec3 fluidNoise = vec3(
    snoise(dir * 2.5 + uTime * 0.2),
    snoise(dir.yzx * 2.5 + uTime * 0.2),
    snoise(dir.zxy * 2.5 + uTime * 0.2)
  );

  // Four-way chained lerp: sphere → scatter → vortex → tracks
  vec3 scattered = mix(spherePos, aScatterTarget, scatterT);
  vec3 vortexed = mix(scattered, aVortexTarget, vortexT);
  vec3 finalPos = mix(vortexed, aTracksTarget, tracksT);
  
  // Tangential flow bends the journey into ribbons, without moving endpoints.
  vec3 tangent = vec3(-dir.y, dir.x, 0.0);
  finalPos += tangent * (explosionArc * 1.1 + vortexArc * 0.8);
  finalPos += fluidNoise * (explosionArc * 1.6 + vortexArc * 1.1 + tracksArc * 0.35);

  // A dispersed field should still feel alive between scroll transitions.
  float driftWeight = scatterT * (1.0 - vortexT);
  finalPos += vec3(
    sin(uTime * 0.16 + aNoisePhase),
    cos(uTime * 0.13 + aNoisePhase * 1.3),
    sin(uTime * 0.11 + aNoisePhase * 0.7)
  ) * 0.12 * driftWeight;
  
  // Add tiny high-frequency jitter for "sand" texture
  float gritJitter = (aNoisePhase - 50.0) * 0.002;
  finalPos += dir * gritJitter;

  vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);

  // Depth-based opacity fade
  float depth = -mvPosition.z;
  vDepth = depth; // Pass depth to fragment for blurring
  float depthFade = 1.0 - smoothstep(3.0, 20.0, depth);

  // Bright explosion flash for the solid Maze.co dust look
  float dispersed = max(scatterT, max(vortexT, tracksT));
  float opacityScale = mix(1.0, 1.5, dispersed);
  opacityScale += explosionArc * 0.2; // A soft lift as the sphere opens
  // Opacity ramps up much faster than the assembly finishes, so incoming
  // dust is visible mid-flight rather than popping in already formed
  vOpacity = aOpacity * depthFade * opacityScale * min(uBirth * 3.0, 1.0);

  // Maintain consistent particle size across all shapes
  // We only swell slightly during the explosion morph for impact
  float sizeScale = 1.0 + explosionArc * 0.4;
  
  // Balanced point size multiplier
  gl_PointSize = max(aSize * sizeScale * (60.0 / depth), 1.2) * uSizeScale;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const sphereFragmentShader = /* glsl */ `
uniform float uAlphaScale; // global dimmer: 1.0 dark themes, lower on light

varying vec3 vColor;
varying float vOpacity;

void main() {
  float dist = distance(gl_PointCoord, vec2(0.5));
  
  // High-intensity star glow math: intensely bright center, smooth fade
  float strength = 0.05 / max(dist, 0.001) - 0.1;
  strength = clamp(strength, 0.0, 1.0);
  
  if (strength <= 0.0) discard;

  // Combine vertex-side opacity with the glowing alpha curve
  gl_FragColor = vec4(vColor, strength * vOpacity * 0.7 * uAlphaScale);
}
`;

// ─── Ambient Particle Shaders (always scattered, simpler) ────────────────────
const ambientVertexShader = /* glsl */ `
attribute float aSize;
attribute float aOpacity;
attribute float aTwinklePhase;

uniform float uTime;

varying vec3 vColor;
varying float vOpacity;
varying float vDepth; // Export depth to fragment shader

void main() {
  vColor = color;

  // Atmospheric scintillation: two incommensurate frequencies summed so the
  // flicker never visibly repeats or beats in unison across the field.
  // Brighter/larger stars twinkle less — in real skies scintillation is most
  // pronounced on faint point sources. uTime stays 0 under
  // prefers-reduced-motion, freezing this at a static per-star brightness.
  float rate = 0.9 + fract(aTwinklePhase * 0.37) * 2.2;
  float s1 = sin(uTime * rate + aTwinklePhase);
  float s2 = sin(uTime * rate * 2.718 + aTwinklePhase * 1.618);
  float scint = 0.5 + 0.5 * (0.65 * s1 + 0.35 * s2);
  float amp = mix(0.5, 0.1, smoothstep(0.4, 1.4, aSize));
  float twinkle = (1.0 - amp) + amp * scint;
  vOpacity = aOpacity * twinkle;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mvPosition.z; // Pass depth for blurring
  gl_PointSize = max(aSize * (50.0 / vDepth), 1.2); // Balanced size for stardust effect
  gl_Position = projectionMatrix * mvPosition;
}
`;

const ambientFragmentShader = /* glsl */ `
varying vec3 vColor;
varying float vOpacity;

void main() {
  float dist = distance(gl_PointCoord, vec2(0.5));
  
  // High-intensity star glow math: intensely bright center, smooth fade
  float strength = 0.05 / dist - 0.1;
  strength = clamp(strength, 0.0, 1.0);
  
  if (strength <= 0.0) discard;

  gl_FragColor = vec4(vColor, strength * vOpacity * 0.7);
}
`;

// ─── Shooting Star Shaders (CPU-positioned trail, no twinkle) ────────────────
const shootingVertexShader = /* glsl */ `
attribute float aSize;
attribute float aOpacity;

varying vec3 vColor;
varying float vOpacity;

void main() {
  vColor = color;
  vOpacity = aOpacity;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = max(aSize * (50.0 / -mvPosition.z), 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const shootingFragmentShader = /* glsl */ `
varying vec3 vColor;
varying float vOpacity;

void main() {
  float dist = distance(gl_PointCoord, vec2(0.5));
  float strength = 0.05 / dist - 0.1;
  strength = clamp(strength, 0.0, 1.0);

  if (strength <= 0.0) discard;

  gl_FragColor = vec4(vColor, strength * vOpacity);
}
`;

// ─── Orbit Ring Shaders (fades out as the sphere scatters) ───────────────────
const ringVertexShader = /* glsl */ `
attribute float aSize;
attribute float aOpacity;

uniform float uFade;
uniform float uSizeScale;

varying vec3 vColor;
varying float vOpacity;

void main() {
  vColor = color;
  vOpacity = aOpacity * uFade;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = max(aSize * (50.0 / -mvPosition.z), 1.0) * uSizeScale;
  gl_Position = projectionMatrix * mvPosition;
}
`;

// ─── Nebula Haze Shaders (fbm-noise billboards, desktop only) ────────────────
const nebulaVertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const nebulaFragmentShader = /* glsl */ `
${NOISE_GLSL}

uniform float uTime;
uniform float uSeed;
uniform float uScale;
uniform float uOpacity;
uniform vec3 uColorA;
uniform vec3 uColorB;

varying vec2 vUv;

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * snoise(p);
    p *= 2.1;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 centered = vUv - 0.5;
  float d = length(centered);
  // Soft radial mask so the billboard edge never shows
  float mask = smoothstep(0.5, 0.12, d);

  // Two fbm fields: one shapes density, one mixes the two theme colors.
  // Very slow time term makes the cloud churn almost imperceptibly.
  float density = fbm(vec3(vUv * uScale + uSeed, uTime * 0.03 + uSeed));
  float mixer = fbm(vec3(vUv * uScale * 2.3 - uSeed, uTime * 0.05 - uSeed));

  float alpha = smoothstep(-0.15, 0.85, density) * mask * uOpacity;
  if (alpha <= 0.003) discard;

  vec3 col = mix(uColorA, uColorB, clamp(0.5 + 0.5 * mixer, 0.0, 1.0));
  gl_FragColor = vec4(col, alpha);
}
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getThemeColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    teal: style.getPropertyValue('--ctp-teal').trim() || '#94e2d5',
    sapphire: style.getPropertyValue('--ctp-sapphire').trim() || '#74c7ec',
    sky: style.getPropertyValue('--ctp-sky').trim() || '#89dceb',
    green: style.getPropertyValue('--ctp-green').trim() || '#a6e3a1',
    mauve: style.getPropertyValue('--ctp-mauve').trim() || '#cba6f7',
    lavender: style.getPropertyValue('--ctp-lavender').trim() || '#b4befe',
    blue: style.getPropertyValue('--ctp-blue').trim() || '#89b4fa',
    pink: style.getPropertyValue('--ctp-pink').trim() || '#f5c2e7',
  };
}

// ─── Component ───────────────────────────────────────────────────────────────
export function WebGLBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // WebGL feature detection
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      if (!gl) return;
    } catch {
      return;
    }

    // ── Settings ──
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let prefersReducedMotion = motionQuery.matches;

    // Light themes get a different scene: the point-glow layers (additive
    // blending, designed for a dark sky) hide entirely — on light they render
    // as dark speckle — and the nebula switches to normal blending at higher
    // opacity, reading as soft watercolor washes. Set by applyThemeMode().
    let isLightTheme = false;
    const isMobile = window.innerWidth < 768;
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);

    const sphereParticleCount = isMobile ? 8000 : 40000; // Even higher density for 'sand' look
    const ambientParticleCount = isMobile ? 400 : 1200;

    // ── Scene ──
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );
    camera.position.set(0, 0, 8);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isMobile,
      alpha: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 0);

    // ── Theme Colors ──
    let themeColors = getThemeColors();

    function buildPalette() {
      // Light themes get a cosmic-ink palette: purples, blues, magenta.
      // The dark-theme teal/green mix turns muddy on a light background —
      // green pigment on paper reads as dirt, not space.
      if (!document.documentElement.classList.contains('dark')) {
        return {
          // 45% mauve, 25% lavender, 18% blue, 12% pink
          colors: [
            new THREE.Color(themeColors.mauve),
            new THREE.Color(themeColors.lavender),
            new THREE.Color(themeColors.blue),
            new THREE.Color(themeColors.pink),
          ],
          weights: [0.45, 0.70, 0.88, 1.0],
        };
      }
      return {
        // 65% teal, 25% sapphire, 7% green, 3% mauve — cohesive cyan-dominant
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

    // Star color temperatures for the ambient field: warm white, cool white,
    // neutral. Mixed with the theme palette so the backdrop reads as a night
    // sky instead of confetti, while staying cohesive with the theme accents.
    const starWhites = [
      new THREE.Color('#fff3e0'), // warm (K-type)
      new THREE.Color('#eaf2ff'), // cool (A-type)
      new THREE.Color('#f5f5f0'), // neutral
    ];

    function pickAmbientColor(p: ReturnType<typeof buildPalette>): THREE.Color {
      // Star whites are invisible on light backgrounds — palette colors only
      const isDark = document.documentElement.classList.contains('dark');
      // Slight majority of "real" star whites, weighted like an actual sky:
      // cool and neutral whites dominate, warm K-type stars are the minority.
      if (isDark && Math.random() < 0.55) {
        const roll = Math.random();
        if (roll < 0.4) return starWhites[1]; // cool
        if (roll < 0.75) return starWhites[2]; // neutral
        return starWhites[0]; // warm
      }
      return pickColor(p);
    }

    // ════════════════════════════════════════════════════════════════════════
    // SPHERE PARTICLES
    // ════════════════════════════════════════════════════════════════════════
    const sphereRadius = 3.5;
    // Mobile centers the sphere behind the hero text, so keep the interior
    // sparse there — interior particles are the ones that sit directly
    // behind copy and hurt legibility
    const surfaceCount = Math.floor(sphereParticleCount * (isMobile ? 0.93 : 0.82));
    const interiorCount = sphereParticleCount - surfaceCount;
    const goldenRatio = (1 + Math.sqrt(5)) / 2;

    const sphereGeometry = new THREE.BufferGeometry();
    const sPositions = new Float32Array(sphereParticleCount * 3);
    const sColors = new Float32Array(sphereParticleCount * 3);
    const sSizes = new Float32Array(sphereParticleCount);
    const sOpacities = new Float32Array(sphereParticleCount);
    const sNoisePhases = new Float32Array(sphereParticleCount);
    const sScatterTargets = new Float32Array(sphereParticleCount * 3);
    const sVortexTargets = new Float32Array(sphereParticleCount * 3);
    const sTracksTargets = new Float32Array(sphereParticleCount * 3);
    const sScatterDelays = new Float32Array(sphereParticleCount);

    // Pre-compute horizontal track Y positions (8 bands across the viewport)
    const NUM_TRACKS = 8;
    const trackYs = Array.from({ length: NUM_TRACKS }, (_, i) => -3 + (6 / (NUM_TRACKS - 1)) * i);

    // Surface particles — fibonacci distribution
    for (let i = 0; i < surfaceCount; i++) {
      const theta = (2 * Math.PI * i) / goldenRatio;
      const phi = Math.acos(1 - (2 * (i + 0.5)) / surfaceCount);

      const x = sphereRadius * Math.cos(theta) * Math.sin(phi);
      const y = sphereRadius * Math.cos(phi);
      const z = sphereRadius * Math.sin(theta) * Math.sin(phi);

      sPositions[i * 3] = x;
      sPositions[i * 3 + 1] = y;
      sPositions[i * 3 + 2] = z;

      const c = pickColor(palette);
      sColors[i * 3] = c.r;
      sColors[i * 3 + 1] = c.g;
      sColors[i * 3 + 2] = c.b;

      sSizes[i] = Math.random() * 0.8 + 0.4; // Slightly larger base for visibility
      sOpacities[i] = Math.random() * 0.3 + 0.7; // Higher opacity for solid look
      sNoisePhases[i] = Math.random() * 100;
      sScatterDelays[i] = Math.random() * 0.4;

      // Scatter target: radial explosion + randomness
      const len = Math.sqrt(x * x + y * y + z * z) || 1;
      const nx = x / len;
      const ny = y / len;
      const nz = z / len;
      const scatterDist = 3 + Math.random() * 7;

      sScatterTargets[i * 3] = nx * scatterDist + (Math.random() - 0.5) * 4;
      sScatterTargets[i * 3 + 1] = ny * scatterDist + (Math.random() - 0.5) * 4;
      sScatterTargets[i * 3 + 2] = nz * scatterDist + (Math.random() - 0.5) * 4;

      // Vortex target: 3-arm spiral galaxy (face-on to camera, in XY plane)
      const vortexArm = i % 3;
      const vortexT = i / surfaceCount;
      const vortexRadius = 0.3 + vortexT * 4.5;
      const vortexAngle = vortexT * Math.PI * 5 + (vortexArm / 3) * Math.PI * 2;
      sVortexTargets[i * 3] = Math.cos(vortexAngle) * vortexRadius - 1.5;
      sVortexTargets[i * 3 + 1] = Math.sin(vortexAngle) * vortexRadius - 0.2;
      sVortexTargets[i * 3 + 2] = (Math.random() - 0.5) * 1.2;

      // Track target: horizontal band position (accounts for group offset at 1.5, 0.2)
      const trackIdx = Math.floor(Math.random() * NUM_TRACKS);
      const trackX = (Math.random() - 0.5) * 20 - 1.5;
      const trackWave = Math.sin(trackX * 0.3 + trackIdx * 1.5) * 0.2;
      sTracksTargets[i * 3] = trackX;
      sTracksTargets[i * 3 + 1] = trackYs[trackIdx] + trackWave - 0.2;
      sTracksTargets[i * 3 + 2] = (Math.random() - 0.5) * 2;
    }

    // Interior particles — random volume fill
    for (let i = surfaceCount; i < sphereParticleCount; i++) {
      const r = Math.random() * sphereRadius * 0.85;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);

      sPositions[i * 3] = x;
      sPositions[i * 3 + 1] = y;
      sPositions[i * 3 + 2] = z;

      const c = pickColor(palette);
      sColors[i * 3] = c.r;
      sColors[i * 3 + 1] = c.g;
      sColors[i * 3 + 2] = c.b;

      sSizes[i] = Math.random() * 0.5 + 0.3; // Slightly larger base for visibility
      sOpacities[i] = Math.random() * 0.3 + 0.5; // Higher opacity for solid look
      sNoisePhases[i] = Math.random() * 100;
      sScatterDelays[i] = Math.random() * 0.3;

      // Interior particles scatter outward too
      const len = Math.sqrt(x * x + y * y + z * z) || 1;
      const scatterDist = 4 + Math.random() * 8;

      sScatterTargets[i * 3] = (x / len) * scatterDist + (Math.random() - 0.5) * 5;
      sScatterTargets[i * 3 + 1] = (y / len) * scatterDist + (Math.random() - 0.5) * 5;
      sScatterTargets[i * 3 + 2] = (z / len) * scatterDist + (Math.random() - 0.5) * 5;

      // Vortex target for interior particles (inner spiral)
      const vortexArm = i % 3;
      const vortexT = (i - surfaceCount) / interiorCount;
      const vortexRadius = 0.1 + vortexT * 2.5;
      const vortexAngle = vortexT * Math.PI * 4 + (vortexArm / 3) * Math.PI * 2;
      sVortexTargets[i * 3] = Math.cos(vortexAngle) * vortexRadius - 1.5;
      sVortexTargets[i * 3 + 1] = Math.sin(vortexAngle) * vortexRadius - 0.2;
      sVortexTargets[i * 3 + 2] = (Math.random() - 0.5) * 0.8;

      // Track target for interior particles too
      const trackIdx = Math.floor(Math.random() * NUM_TRACKS);
      const trackX = (Math.random() - 0.5) * 20 - 1.5;
      const trackWave = Math.sin(trackX * 0.3 + trackIdx * 1.5) * 0.2;
      sTracksTargets[i * 3] = trackX;
      sTracksTargets[i * 3 + 1] = trackYs[trackIdx] + trackWave - 0.2;
      sTracksTargets[i * 3 + 2] = (Math.random() - 0.5) * 2;
    }

    sphereGeometry.setAttribute('position', new THREE.BufferAttribute(sPositions, 3));
    sphereGeometry.setAttribute('color', new THREE.BufferAttribute(sColors, 3));
    sphereGeometry.setAttribute('aSize', new THREE.BufferAttribute(sSizes, 1));
    sphereGeometry.setAttribute('aOpacity', new THREE.BufferAttribute(sOpacities, 1));
    sphereGeometry.setAttribute('aNoisePhase', new THREE.BufferAttribute(sNoisePhases, 1));
    sphereGeometry.setAttribute('aScatterTarget', new THREE.BufferAttribute(sScatterTargets, 3));
    sphereGeometry.setAttribute('aVortexTarget', new THREE.BufferAttribute(sVortexTargets, 3));
    sphereGeometry.setAttribute('aTracksTarget', new THREE.BufferAttribute(sTracksTargets, 3));
    sphereGeometry.setAttribute('aScatterDelay', new THREE.BufferAttribute(sScatterDelays, 1));

    const sphereMaterial = new THREE.ShaderMaterial({
      vertexShader: sphereVertexShader,
      fragmentShader: sphereFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uDisplacement: { value: 0.35 },
        uScatter: { value: 0 },
        uVortex: { value: 0 },
        uTracks: { value: 0 },
        uBirth: { value: 0 },
        uAlphaScale: { value: 1 },
        uKeepFraction: { value: 1 },
        uSizeScale: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    });

    const spherePoints = new THREE.Points(sphereGeometry, sphereMaterial);

    const sphereGroup = new THREE.Group();
    // ── Responsive sizing ──
    // Scale sphere + position based on viewport (like mazehq)
    let baseCameraZ = 8;

    function applyResponsiveLayout(w: number) {
      if (w < 768) {
        // Mobile: centered, smaller
        sphereGroup.scale.setScalar(0.55);
        sphereGroup.position.set(0, 0, 0);
        baseCameraZ = 5.5;
      } else if (w < 1024) {
        // Tablet: slightly offset, medium
        sphereGroup.scale.setScalar(0.75);
        sphereGroup.position.set(0.6, 0.1, 0);
        baseCameraZ = 6.5;
      } else {
        // Desktop: offset right, full size
        sphereGroup.scale.setScalar(1.0);
        sphereGroup.position.set(1.5, 0.2, 0);
        baseCameraZ = 8;
      }
    }

    applyResponsiveLayout(window.innerWidth);
    sphereGroup.add(spherePoints);
    scene.add(sphereGroup);

    // ════════════════════════════════════════════════════════════════════════
    // AMBIENT PARTICLES — always scattered, sparse atmosphere
    // ════════════════════════════════════════════════════════════════════════
    const ambientGeometry = new THREE.BufferGeometry();
    const aPositions = new Float32Array(ambientParticleCount * 3);
    const aColors = new Float32Array(ambientParticleCount * 3);
    const aSizes = new Float32Array(ambientParticleCount);
    const aOpacities = new Float32Array(ambientParticleCount);
    const aTwinklePhases = new Float32Array(ambientParticleCount);

    for (let i = 0; i < ambientParticleCount; i++) {
      const r = 5 + Math.random() * 12;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      aPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      aPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      aPositions[i * 3 + 2] = r * Math.cos(phi);

      const c = pickAmbientColor(palette);
      aColors[i * 3] = c.r;
      aColors[i * 3 + 1] = c.g;
      aColors[i * 3 + 2] = c.b;

      // Stellar magnitude distribution: power law keeps most stars faint with
      // the occasional bright one, instead of a uniform (artificial) spread.
      const magnitude = Math.pow(Math.random(), 2.6);
      aSizes[i] = 0.3 + magnitude * 1.4;
      aOpacities[i] = 0.45 + magnitude * 0.5;
      aTwinklePhases[i] = Math.random() * 100;
    }

    ambientGeometry.setAttribute('position', new THREE.BufferAttribute(aPositions, 3));
    ambientGeometry.setAttribute('color', new THREE.BufferAttribute(aColors, 3));
    ambientGeometry.setAttribute('aSize', new THREE.BufferAttribute(aSizes, 1));
    ambientGeometry.setAttribute('aOpacity', new THREE.BufferAttribute(aOpacities, 1));
    ambientGeometry.setAttribute('aTwinklePhase', new THREE.BufferAttribute(aTwinklePhases, 1));

    const ambientMaterial = new THREE.ShaderMaterial({
      vertexShader: ambientVertexShader,
      fragmentShader: ambientFragmentShader,
      uniforms: {
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    });

    const ambientPoints = new THREE.Points(ambientGeometry, ambientMaterial);
    scene.add(ambientPoints);

    // ════════════════════════════════════════════════════════════════════════
    // SHOOTING STARS — one pooled streak, fired every ~8–20s
    // ════════════════════════════════════════════════════════════════════════
    const TRAIL_COUNT = 32;
    const TRAIL_SPACING = 0.16;

    const shootingGeometry = new THREE.BufferGeometry();
    const shPositions = new Float32Array(TRAIL_COUNT * 3);
    const shColors = new Float32Array(TRAIL_COUNT * 3);
    const shSizes = new Float32Array(TRAIL_COUNT);
    const shOpacities = new Float32Array(TRAIL_COUNT);

    // Real meteor color: incandescent white-hot head, cooling through pale
    // blue-green (magnesium/plasma) along the tail. Head size falls off
    // steeply — the luminous point is small, the train is thin.
    const headColor = new THREE.Color('#ffffff');
    const midColor = new THREE.Color('#dceeff');
    const tailColor = new THREE.Color('#9fd8cf');
    for (let i = 0; i < TRAIL_COUNT; i++) {
      const f = i / (TRAIL_COUNT - 1);
      const c = f < 0.3
        ? headColor.clone().lerp(midColor, f / 0.3)
        : midColor.clone().lerp(tailColor, (f - 0.3) / 0.7);
      shColors[i * 3] = c.r;
      shColors[i * 3 + 1] = c.g;
      shColors[i * 3 + 2] = c.b;
      shSizes[i] = 2.6 * Math.exp(-f * 2.2) + 0.35;
      shOpacities[i] = 0;
    }

    const shPositionAttr = new THREE.BufferAttribute(shPositions, 3);
    shPositionAttr.setUsage(THREE.DynamicDrawUsage);
    const shOpacityAttr = new THREE.BufferAttribute(shOpacities, 1);
    shOpacityAttr.setUsage(THREE.DynamicDrawUsage);
    shootingGeometry.setAttribute('position', shPositionAttr);
    shootingGeometry.setAttribute('color', new THREE.BufferAttribute(shColors, 3));
    shootingGeometry.setAttribute('aSize', new THREE.BufferAttribute(shSizes, 1));
    shootingGeometry.setAttribute('aOpacity', shOpacityAttr);

    const shootingMaterial = new THREE.ShaderMaterial({
      vertexShader: shootingVertexShader,
      fragmentShader: shootingFragmentShader,
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    });

    const shootingPoints = new THREE.Points(shootingGeometry, shootingMaterial);
    shootingPoints.visible = false;
    shootingPoints.frustumCulled = false; // positions update on CPU each frame
    scene.add(shootingPoints);

    const shootingStar = {
      active: false,
      nextAt: 5 + Math.random() * 7, // first streak lands within ~12s of load
      startedAt: 0,
      travel: 0.6, // seconds of flight — real meteors cross the sky fast
      decay: 0.4, // afterglow: the train lingers briefly after the head burns out
      speed: 24,
      peak: 1, // brightness scale; >1 for the occasional fireball
      trailSpacing: TRAIL_SPACING,
      origin: new THREE.Vector3(),
      dir: new THREE.Vector3(),
    };

    // Portrait frustums are far narrower than landscape: spawn events close
    // enough to center that they actually cross the visible sky on phones
    const skyEdgeX = isMobile ? 4 : 11;

    function spawnShootingStar(t: number) {
      const fromLeft = Math.random() < 0.5;
      // Roughly 1 in 7 is a fireball: slower, brighter, longer afterglow
      const isFireball = Math.random() < 0.15;

      // Upper sky, behind the sphere, shallow diagonal dive
      shootingStar.origin.set(
        fromLeft ? -skyEdgeX - Math.random() * 3 : skyEdgeX + Math.random() * 3,
        2.5 + Math.random() * 3.5,
        -3 - Math.random() * 4,
      );
      const dive = 0.3 + Math.random() * 0.4; // radians below horizontal
      shootingStar.dir
        .set((fromLeft ? 1 : -1) * Math.cos(dive), -Math.sin(dive), 0)
        .normalize();

      shootingStar.speed = isFireball ? 15 + Math.random() * 4 : 22 + Math.random() * 10;
      shootingStar.travel = isFireball ? 0.9 + Math.random() * 0.3 : 0.45 + Math.random() * 0.3;
      shootingStar.decay = isFireball ? 0.7 : 0.35;
      shootingStar.peak = isFireball ? 1.35 : 0.85 + Math.random() * 0.25;
      // Streak length scales with velocity, like a real exposure
      shootingStar.trailSpacing = shootingStar.speed * 0.011;
      shootingStar.startedAt = t;
      shootingStar.active = true;
      shootingPoints.visible = true;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ORBIT RING — thin tilted annulus of dust orbiting the sphere.
    // Lives inside sphereGroup so it scales/positions with the sphere, and
    // fades out as the sphere scatters (a ring around dust looks wrong).
    // ════════════════════════════════════════════════════════════════════════
    const ringParticleCount = isMobile ? 150 : 420;
    const ringInnerRadius = 4.4;
    const ringOuterRadius = 5.1;

    const ringGeometry = new THREE.BufferGeometry();
    const rPositions = new Float32Array(ringParticleCount * 3);
    const rColors = new Float32Array(ringParticleCount * 3);
    const rSizes = new Float32Array(ringParticleCount);
    const rOpacities = new Float32Array(ringParticleCount);

    for (let i = 0; i < ringParticleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      // Density falls off toward the outer edge, like a real debris ring
      const radial = ringInnerRadius + Math.pow(Math.random(), 1.6) * (ringOuterRadius - ringInnerRadius);

      rPositions[i * 3] = Math.cos(angle) * radial;
      rPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.14; // thin band
      rPositions[i * 3 + 2] = Math.sin(angle) * radial;

      const c = pickAmbientColor(palette);
      rColors[i * 3] = c.r;
      rColors[i * 3 + 1] = c.g;
      rColors[i * 3 + 2] = c.b;

      rSizes[i] = 0.2 + Math.pow(Math.random(), 2) * 0.5;
      rOpacities[i] = 0.25 + Math.random() * 0.45;
    }

    ringGeometry.setAttribute('position', new THREE.BufferAttribute(rPositions, 3));
    ringGeometry.setAttribute('color', new THREE.BufferAttribute(rColors, 3));
    ringGeometry.setAttribute('aSize', new THREE.BufferAttribute(rSizes, 1));
    ringGeometry.setAttribute('aOpacity', new THREE.BufferAttribute(rOpacities, 1));

    const ringMaterial = new THREE.ShaderMaterial({
      vertexShader: ringVertexShader,
      fragmentShader: shootingFragmentShader, // same soft star-glow point
      uniforms: {
        uFade: { value: 1 },
        uSizeScale: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    });

    const ringPoints = new THREE.Points(ringGeometry, ringMaterial);
    const ringTilt = new THREE.Group();
    ringTilt.rotation.x = 0.42; // slanted ellipse, Saturn-at-an-angle
    ringTilt.rotation.z = -0.18;
    ringTilt.add(ringPoints);
    sphereGroup.add(ringTilt);

    // ════════════════════════════════════════════════════════════════════════
    // NEBULA HAZE — a few large fbm-noise billboards far behind the sphere.
    // Adds depth without geometry. Skipped on mobile: large transparent
    // overdraw is the one genuinely expensive part of this scene.
    // ════════════════════════════════════════════════════════════════════════
    const nebulaMaterials: THREE.ShaderMaterial[] = [];
    const nebulaMeshes: THREE.Mesh[] = [];
    const nebulaGeometry = new THREE.PlaneGeometry(1, 1);

    // Cloud color pairs per mode. Dark keeps the teal/mauve night palette;
    // light swaps to blue/lavender and mauve/pink — teal washes on a warm
    // paper background read as sage/moss, not sky.
    function nebulaColorsFor(mix: number): [string, string] {
      const isDark = document.documentElement.classList.contains('dark');
      if (!isDark) {
        return mix === 0
          ? [themeColors.blue, themeColors.lavender]
          : [themeColors.mauve, themeColors.pink];
      }
      return mix === 0
        ? [themeColors.teal, themeColors.sapphire]
        : [themeColors.mauve, themeColors.lavender];
    }

    if (!isMobile) {
      const nebulaSpecs = [
        // Deep backdrop wash — two huge, very faint clouds spanning the view
        { x: 0, y: 0.5, z: -11, size: 24, scale: 1.6, opacity: 0.06, mix: 0 },
        { x: -3, y: -1.5, z: -10.5, size: 20, scale: 1.8, opacity: 0.055, mix: 1 },
        // Mid-field structure
        { x: 3.5, y: 1.5, z: -8, size: 14, scale: 2.2, opacity: 0.1, mix: 0 },
        { x: -4.5, y: -1.0, z: -7, size: 11, scale: 2.8, opacity: 0.085, mix: 1 },
        { x: 0.5, y: 3.0, z: -9, size: 12, scale: 2.0, opacity: 0.075, mix: 0 },
        { x: -1.5, y: -3.0, z: -6.5, size: 9, scale: 3.2, opacity: 0.07, mix: 1 },
        { x: 6.5, y: -2.0, z: -8.5, size: 10, scale: 2.5, opacity: 0.08, mix: 0 },
        { x: -7.0, y: 2.5, z: -9.5, size: 13, scale: 2.1, opacity: 0.08, mix: 1 },
        { x: 5.0, y: 4.0, z: -7.5, size: 8, scale: 3.0, opacity: 0.09, mix: 1 },
        // Foreground wisps — small, denser knots for parallax depth
        { x: -5.5, y: -3.5, z: -5.5, size: 6, scale: 3.8, opacity: 0.075, mix: 0 },
        { x: 7.5, y: 1.0, z: -6, size: 7, scale: 3.5, opacity: 0.07, mix: 0 },
      ];

      for (const spec of nebulaSpecs) {
        const [colorA, colorB] = nebulaColorsFor(spec.mix);
        const material = new THREE.ShaderMaterial({
          vertexShader: nebulaVertexShader,
          fragmentShader: nebulaFragmentShader,
          uniforms: {
            uTime: { value: 0 },
            uSeed: { value: Math.random() * 40 },
            uScale: { value: spec.scale },
            uOpacity: { value: spec.opacity },
            uColorA: { value: new THREE.Color(colorA) },
            uColorB: { value: new THREE.Color(colorB) },
          },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });

        const mesh = new THREE.Mesh(nebulaGeometry, material);
        mesh.position.set(spec.x, spec.y, spec.z);
        mesh.scale.setScalar(spec.size);
        mesh.userData.baseRot = Math.random() * Math.PI * 2;
        mesh.userData.driftSpeed = (Math.random() - 0.5) * 0.008; // rad/s, ±
        mesh.rotation.z = mesh.userData.baseRot;
        mesh.userData.mix = spec.mix;
        mesh.userData.baseOpacity = spec.opacity;
        scene.add(mesh);

        nebulaMaterials.push(material);
        nebulaMeshes.push(mesh);
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // DISTANT GALAXY — small tilted 3-arm spiral in the upper-left deep field
    // ════════════════════════════════════════════════════════════════════════
    const galaxyParticleCount = isMobile ? 250 : 650;
    const galaxyGeometry = new THREE.BufferGeometry();
    const gPositions = new Float32Array(galaxyParticleCount * 3);
    const gColors = new Float32Array(galaxyParticleCount * 3);
    const gSizes = new Float32Array(galaxyParticleCount);
    const gOpacities = new Float32Array(galaxyParticleCount);

    function fillGalaxyColors() {
      const core = new THREE.Color('#fff3e0');
      const arms = new THREE.Color(themeColors.lavender);
      const rim = new THREE.Color(themeColors.sky);
      for (let i = 0; i < galaxyParticleCount; i++) {
        const radial = Math.sqrt(gPositions[i * 3] ** 2 + gPositions[i * 3 + 1] ** 2) / 2.2;
        // Warm core → theme arms → cool rim, like a real disk galaxy
        const c = radial < 0.3
          ? core.clone().lerp(arms, radial / 0.3)
          : arms.clone().lerp(rim, (radial - 0.3) / 0.7);
        gColors[i * 3] = c.r;
        gColors[i * 3 + 1] = c.g;
        gColors[i * 3 + 2] = c.b;
      }
    }

    for (let i = 0; i < galaxyParticleCount; i++) {
      const arm = i % 3;
      const along = Math.pow(Math.random(), 0.7); // denser toward the core
      const radial = 0.12 + along * 2.1;
      const angle = along * Math.PI * 4.2 + (arm / 3) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;

      gPositions[i * 3] = Math.cos(angle) * radial;
      gPositions[i * 3 + 1] = Math.sin(angle) * radial;
      gPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.18;

      gSizes[i] = 0.12 + Math.pow(Math.random(), 2) * 0.4 + (along < 0.25 ? 0.15 : 0);
      gOpacities[i] = 0.35 + Math.random() * 0.4;
    }
    fillGalaxyColors();

    galaxyGeometry.setAttribute('position', new THREE.BufferAttribute(gPositions, 3));
    galaxyGeometry.setAttribute('color', new THREE.BufferAttribute(gColors, 3));
    galaxyGeometry.setAttribute('aSize', new THREE.BufferAttribute(gSizes, 1));
    galaxyGeometry.setAttribute('aOpacity', new THREE.BufferAttribute(gOpacities, 1));

    const galaxyMaterial = new THREE.ShaderMaterial({
      vertexShader: ringVertexShader,
      fragmentShader: shootingFragmentShader,
      uniforms: {
        uFade: { value: 0.8 },
        uSizeScale: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    });

    const galaxyPoints = new THREE.Points(galaxyGeometry, galaxyMaterial);
    const galaxyTilt = new THREE.Group();
    // Portrait frustums are narrow: x ±8.5 is off-screen on phones, so pull
    // the galaxy toward center and shrink it on mobile
    if (isMobile) {
      galaxyTilt.position.set(-2.4, 5.2, -13);
      galaxyTilt.scale.setScalar(0.75);
    } else {
      galaxyTilt.position.set(-8.5, 4.5, -13);
    }
    galaxyTilt.rotation.set(0.9, 0.35, 0);
    galaxyTilt.add(galaxyPoints);
    scene.add(galaxyTilt);

    // ════════════════════════════════════════════════════════════════════════
    // SATELLITE — a single steady dot crossing the sky over ~20s. No trail,
    // constant speed: the thing that distinguishes a satellite from a meteor.
    // ════════════════════════════════════════════════════════════════════════
    const satelliteGeometry = new THREE.BufferGeometry();
    const satPosition = new Float32Array(3);
    const satPositionAttr = new THREE.BufferAttribute(satPosition, 3);
    satPositionAttr.setUsage(THREE.DynamicDrawUsage);
    const satOpacity = new Float32Array([0]);
    const satOpacityAttr = new THREE.BufferAttribute(satOpacity, 1);
    satOpacityAttr.setUsage(THREE.DynamicDrawUsage);
    satelliteGeometry.setAttribute('position', satPositionAttr);
    satelliteGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array([0.95, 0.97, 1.0]), 3));
    satelliteGeometry.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array([0.55]), 1));
    satelliteGeometry.setAttribute('aOpacity', satOpacityAttr);

    const satelliteMaterial = new THREE.ShaderMaterial({
      vertexShader: shootingVertexShader,
      fragmentShader: shootingFragmentShader,
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    });

    const satellitePoints = new THREE.Points(satelliteGeometry, satelliteMaterial);
    satellitePoints.visible = false;
    satellitePoints.frustumCulled = false;
    scene.add(satellitePoints);

    const satellite = {
      active: false,
      nextAt: 12 + Math.random() * 15,
      startedAt: 0,
      duration: 20,
      flareAt: -1, // progress point of an Iridium-style glint, or -1 for none
      from: new THREE.Vector3(),
      to: new THREE.Vector3(),
    };

    function updateSatellite(t: number) {
      if (!satellite.active) {
        if (t >= satellite.nextAt) {
          const leftToRight = Math.random() < 0.5;
          const satEdge = isMobile ? 5 : 14;
          const y0 = -1 + Math.random() * 6;
          const y1 = y0 + (Math.random() - 0.5) * 3;
          satellite.from.set(leftToRight ? -satEdge : satEdge, y0, -5);
          satellite.to.set(leftToRight ? satEdge : -satEdge, y1, -5);
          // Same angular speed on both form factors: shorter crossing, shorter pass
          satellite.duration = (isMobile ? 7 : 18) + Math.random() * (isMobile ? 3 : 8);
          // ~1 in 3 passes catches the sun mid-crossing (Iridium flare)
          satellite.flareAt = Math.random() < 0.35 ? 0.35 + Math.random() * 0.3 : -1;
          satellite.startedAt = t;
          satellite.active = true;
          satellitePoints.visible = true;
        }
        return;
      }

      const progress = (t - satellite.startedAt) / satellite.duration;
      if (progress >= 1) {
        satellite.active = false;
        satellitePoints.visible = false;
        satellite.nextAt = t + 40 + Math.random() * 50;
        return;
      }

      satPosition[0] = satellite.from.x + (satellite.to.x - satellite.from.x) * progress;
      satPosition[1] = satellite.from.y + (satellite.to.y - satellite.from.y) * progress;
      satPosition[2] = satellite.from.z;
      // Steady brightness with soft edges at horizon entry/exit
      const edge = Math.min(progress / 0.08, (1 - progress) / 0.08, 1);
      let brightness = 0.75 * edge;
      // Iridium flare: a smooth gaussian glint as the panels catch the sun
      if (satellite.flareAt > 0) {
        const d = (progress - satellite.flareAt) / 0.03;
        brightness += Math.exp(-d * d) * 1.4;
      }
      satOpacity[0] = Math.min(brightness, 2);
      satPositionAttr.needsUpdate = true;
      satOpacityAttr.needsUpdate = true;
    }

    // ════════════════════════════════════════════════════════════════════════
    // SUPERNOVA FLARE — every ~40–80s a random deep-field point ignites,
    // spikes bright, and decays over a few seconds
    // ════════════════════════════════════════════════════════════════════════
    const flareGeometry = new THREE.BufferGeometry();
    const flarePosition = new Float32Array(3);
    const flarePositionAttr = new THREE.BufferAttribute(flarePosition, 3);
    flarePositionAttr.setUsage(THREE.DynamicDrawUsage);
    const flareSize = new Float32Array([1]);
    const flareSizeAttr = new THREE.BufferAttribute(flareSize, 1);
    flareSizeAttr.setUsage(THREE.DynamicDrawUsage);
    const flareOpacity = new Float32Array([0]);
    const flareOpacityAttr = new THREE.BufferAttribute(flareOpacity, 1);
    flareOpacityAttr.setUsage(THREE.DynamicDrawUsage);
    flareGeometry.setAttribute('position', flarePositionAttr);
    flareGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array([1.0, 0.98, 0.92]), 3));
    flareGeometry.setAttribute('aSize', flareSizeAttr);
    flareGeometry.setAttribute('aOpacity', flareOpacityAttr);

    const flareMaterial = new THREE.ShaderMaterial({
      vertexShader: shootingVertexShader,
      fragmentShader: shootingFragmentShader,
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    });

    const flarePoints = new THREE.Points(flareGeometry, flareMaterial);
    flarePoints.visible = false;
    flarePoints.frustumCulled = false;
    scene.add(flarePoints);

    const flare = {
      active: false,
      nextAt: 20 + Math.random() * 25,
      startedAt: 0,
      duration: 3.2,
    };

    function updateFlare(t: number) {
      if (!flare.active) {
        if (t >= flare.nextAt) {
          const flareSpanX = isMobile ? 3 : 8;
          flarePosition[0] = -flareSpanX + Math.random() * flareSpanX * 2;
          flarePosition[1] = -3 + Math.random() * 8;
          flarePosition[2] = -7 - Math.random() * 5;
          flarePositionAttr.needsUpdate = true;
          flare.startedAt = t;
          flare.active = true;
          flarePoints.visible = true;
        }
        return;
      }

      const elapsed = t - flare.startedAt;
      if (elapsed >= flare.duration) {
        flare.active = false;
        flarePoints.visible = false;
        flare.nextAt = t + 40 + Math.random() * 40;
        return;
      }

      // Fast ignition, long exponential decay — the classic light curve
      const attack = 0.35;
      const envelope = elapsed < attack
        ? elapsed / attack
        : Math.exp(-(elapsed - attack) / 0.9);
      flareSize[0] = 1.2 + envelope * 2.2;
      flareOpacity[0] = envelope;
      flareSizeAttr.needsUpdate = true;
      flareOpacityAttr.needsUpdate = true;
    }

    function updateShootingStar(t: number) {
      if (!shootingStar.active) {
        if (t >= shootingStar.nextAt) spawnShootingStar(t);
        return;
      }

      const { travel, decay, speed, peak, trailSpacing, origin, dir } = shootingStar;
      const elapsed = t - shootingStar.startedAt;

      if (elapsed >= travel + decay) {
        shootingStar.active = false;
        shootingPoints.visible = false;
        shootingStar.nextAt = t + 8 + Math.random() * 12;
        return;
      }

      // Asymmetric brightness: fast attack as the meteor ignites, slight
      // dimming through flight, then exponential afterglow once it burns out.
      const attack = 0.12 * travel;
      let envelope: number;
      if (elapsed < attack) {
        envelope = elapsed / attack;
      } else if (elapsed < travel) {
        envelope = 1 - 0.35 * ((elapsed - attack) / (travel - attack));
      } else {
        envelope = 0.65 * Math.exp(-(elapsed - travel) / (decay * 0.3));
      }
      envelope *= peak;

      // Head stops advancing once burned out; the train fades in place
      const headDist = speed * Math.min(elapsed, travel);

      for (let i = 0; i < TRAIL_COUNT; i++) {
        const d = Math.max(headDist - i * trailSpacing, 0);
        shPositions[i * 3] = origin.x + dir.x * d;
        shPositions[i * 3 + 1] = origin.y + dir.y * d;
        shPositions[i * 3 + 2] = origin.z;
        // Exponential tail falloff — bright point, whisper-thin train
        shOpacities[i] = Math.min(envelope * Math.exp(-i * 0.13), 1);
      }
      shPositionAttr.needsUpdate = true;
      shOpacityAttr.needsUpdate = true;
    }

    // ── Interaction State ──
    let scrollY = window.scrollY;
    let isTabVisible = !document.hidden;
    // Pause when the window loses focus too — visibilitychange only fires
    // for hidden tabs, so a visible-but-background window would otherwise
    // keep burning a core forever.
    let isWindowFocused = document.hasFocus();

    // Cache the scrollable height — reading document.documentElement.scrollHeight
    // inside the animation loop forces a layout pass every frame.
    let maxScroll = document.documentElement.scrollHeight - window.innerHeight;

    // ── Event Handlers ──
    const onScroll = () => {
      scrollY = window.scrollY;
    };

    const onResize = () => {
      const w = window.innerWidth;
      camera.aspect = w / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(w, window.innerHeight);
      applyResponsiveLayout(w);
      maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      camera.position.z = baseCameraZ + smoothScatter * 1.5 + smoothTracks;
      if (prefersReducedMotion) renderFrame();
    };

    const onVisibilityChange = () => {
      isTabVisible = !document.hidden;
      syncAnimation();
    };

    const onFocus = () => {
      isWindowFocused = true;
      syncAnimation();
    };
    const onBlur = () => {
      isWindowFocused = false;
      syncAnimation();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);

    // Late-loading content (fonts, images) changes page height after mount.
    window.addEventListener('load', onResize, { once: true });

    // ── Theme Change Observer ──
    function updateAllColors() {
      palette = buildPalette();

      const sColorAttr = sphereGeometry.getAttribute('color') as THREE.BufferAttribute;
      for (let i = 0; i < sphereParticleCount; i++) {
        const c = pickColor(palette);
        sColorAttr.setXYZ(i, c.r, c.g, c.b);
      }
      sColorAttr.needsUpdate = true;

      const aColorAttr = ambientGeometry.getAttribute('color') as THREE.BufferAttribute;
      for (let i = 0; i < ambientParticleCount; i++) {
        const c = pickAmbientColor(palette);
        aColorAttr.setXYZ(i, c.r, c.g, c.b);
      }
      aColorAttr.needsUpdate = true;

      const rColorAttr = ringGeometry.getAttribute('color') as THREE.BufferAttribute;
      for (let i = 0; i < ringParticleCount; i++) {
        const c = pickAmbientColor(palette);
        rColorAttr.setXYZ(i, c.r, c.g, c.b);
      }
      rColorAttr.needsUpdate = true;

      for (let i = 0; i < nebulaMaterials.length; i++) {
        const mix = nebulaMeshes[i].userData.mix as number;
        const [colorA, colorB] = nebulaColorsFor(mix);
        (nebulaMaterials[i].uniforms.uColorA.value as THREE.Color).set(colorA);
        (nebulaMaterials[i].uniforms.uColorB.value as THREE.Color).set(colorB);
      }

      fillGalaxyColors();
      (galaxyGeometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }

    const themeObserver = new MutationObserver(() => {
      themeColors = getThemeColors();
      updateAllColors();

      applyThemeMode();
      if (prefersReducedMotion) renderFrame();
    });

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });

    // ── Theme mode ──
    // Dark: full additive night sky. Light: the orb + ring render as
    // pointillist ink dots (normal blending, dimmed alpha, the theme's vivid
    // accent colors), the nebula becomes watercolor washes, and the glow-only
    // layers (star field, galaxy, meteors, satellite, flares) hide — those
    // depend on additive blending against a dark background.
    function applyThemeMode() {
      isLightTheme = !document.documentElement.classList.contains('dark');

      ambientPoints.visible = !isLightTheme;
      galaxyPoints.visible = !isLightTheme;

      sphereMaterial.blending = isLightTheme ? THREE.NormalBlending : THREE.AdditiveBlending;
      sphereMaterial.uniforms.uAlphaScale.value = isLightTheme ? 0.6 : 1;
      // Light mode: ~a tenth of the particles at ~3.8x size — bold,
      // deliberate ink dots instead of dense speckle (and less GPU fill)
      sphereMaterial.uniforms.uKeepFraction.value = isLightTheme ? 0.1 : 1;
      sphereMaterial.uniforms.uSizeScale.value = isLightTheme ? 3.8 : 1;
      sphereMaterial.needsUpdate = true;

      ringMaterial.blending = isLightTheme ? THREE.NormalBlending : THREE.AdditiveBlending;
      ringMaterial.uniforms.uSizeScale.value = isLightTheme ? 2.6 : 1;
      ringMaterial.needsUpdate = true;

      if (isLightTheme) {
        // Cancel any in-flight sky events (their spawn code re-shows them)
        shootingStar.active = false;
        shootingPoints.visible = false;
        satellite.active = false;
        satellitePoints.visible = false;
        flare.active = false;
        flarePoints.visible = false;
      }

      for (let i = 0; i < nebulaMaterials.length; i++) {
        const material = nebulaMaterials[i];
        material.blending = isLightTheme ? THREE.NormalBlending : THREE.AdditiveBlending;
        material.uniforms.uOpacity.value =
          (nebulaMeshes[i].userData.baseOpacity as number) * (isLightTheme ? 3.2 : 1);
        material.needsUpdate = true;
      }
    }
    applyThemeMode();

    // ── Animation Loop (30fps throttle) ──
    let animId = 0;
    let lastTime: number | null = null;
    let lastRenderedTime: number | null = null;
    let activeTime = 0;
    const FPS_INTERVAL = 1000 / 30;
    let hasFadedIn = false;
    const BIRTH_DURATION = 2.2; // seconds — long enough for the assembly to read

    // Smoothed scroll state: formations chase the raw scroll fraction instead
    // of binding 1:1, which would inherit every scroll-wheel notch as a jolt.
    // Exponential damping takes the same time to settle at any frame rate.
    const SCROLL_RESPONSE = 4.5;
    let smoothScatter = 0;
    let smoothVortex = 0;
    let smoothTracks = 0;
    let rotationY = 0;
    let rotationZ = 0;

    function renderFrame() {
      renderer.render(scene, camera);
      if (!hasFadedIn) {
        hasFadedIn = true;
        canvas!.style.opacity = '1';
      }
    }

    function syncAnimation() {
      cancelAnimationFrame(animId);
      animId = 0;
      lastTime = null;
      lastRenderedTime = null;
      if (prefersReducedMotion) {
        // Finish assembly once; freeze all subsequent motion until opted in.
        sphereMaterial.uniforms.uBirth.value = 1;
        renderFrame();
      } else if (isTabVisible && isWindowFocused) {
        animId = requestAnimationFrame(animate);
      }
    }

    const onMotionChange = () => {
      prefersReducedMotion = motionQuery.matches;
      // Re-enabling motion resumes the scene without replaying the entrance.
      activeTime = Math.max(activeTime, BIRTH_DURATION);
      syncAnimation();
    };
    motionQuery.addEventListener('change', onMotionChange);

    const animate = (time: number) => {
      animId = 0;
      if (!isTabVisible || !isWindowFocused || prefersReducedMotion) return;
      animId = requestAnimationFrame(animate);

      if (lastTime === null) lastTime = time - FPS_INTERVAL;
      const delta = time - lastTime;
      if (delta < FPS_INTERVAL) return;
      lastTime = time - (delta % FPS_INTERVAL);

      // Paused time never advances the simulation; cap long main-thread stalls.
      const dt = lastRenderedTime === null ? 0 : Math.min((time - lastRenderedTime) / 1000, 0.1);
      lastRenderedTime = time;
      activeTime += dt;
      const t = activeTime;

      // Birth animation: ramp uBirth 0→1 over BIRTH_DURATION
      const birthRaw = Math.min(t / BIRTH_DURATION, 1);
      // Ease-out cubic for organic settle
      const birthEased = 1 - Math.pow(1 - birthRaw, 3);
      sphereMaterial.uniforms.uBirth.value = birthEased;

      if (!prefersReducedMotion) {
        // Scroll-driven formations: sphere → scatter → vortex → tracks
        const ns = maxScroll > 0 ? scrollY / maxScroll : 0; // normalized scroll 0→1

        // Phase 1: Scatter (0–12%)
        const scatterTarget = Math.min(Math.max(ns / 0.12, 0), 1);
        // Phase 2: Vortex (35–55%)
        const vortexTarget = Math.min(Math.max((ns - 0.35) / 0.20, 0), 1);
        // Phase 3: Tracks (75–95%)
        const tracksTarget = Math.min(Math.max((ns - 0.75) / 0.20, 0), 1);

        // Chase the targets: gives the formations inertia and makes fast
        // scrolling feel fluid instead of frame-stepped
        const smoothing = 1 - Math.exp(-SCROLL_RESPONSE * dt);
        smoothScatter += (scatterTarget - smoothScatter) * smoothing;
        smoothVortex += (vortexTarget - smoothVortex) * smoothing;
        smoothTracks += (tracksTarget - smoothTracks) * smoothing;

        sphereMaterial.uniforms.uScatter.value = smoothScatter;
        sphereMaterial.uniforms.uVortex.value = smoothVortex;
        sphereMaterial.uniforms.uTracks.value = smoothTracks;
        sphereMaterial.uniforms.uTime.value = t;

        // Rotation: normal in sphere, dampened in scatter, slow spin in vortex, stop in tracks
        const sphereRot = (1 - smoothScatter) * 0.8;
        rotationY += dt * 0.03 * (sphereRot + 0.1) * (1 - smoothTracks);
        rotationY = Math.atan2(Math.sin(rotationY), Math.cos(rotationY));
        rotationY *= Math.exp(-4 * smoothTracks * dt);
        sphereGroup.rotation.y = rotationY;
        sphereGroup.rotation.x = Math.sin(t * 0.02) * 0.05 * (1 - smoothScatter);
        // Vortex spins on Z axis (face-on to camera)
        rotationZ += dt * smoothVortex * (1 - smoothTracks) * 0.015;
        rotationZ = Math.atan2(Math.sin(rotationZ), Math.cos(rotationZ));
        rotationZ *= Math.exp(-4 * Math.max(1 - smoothVortex, smoothTracks) * dt);
        sphereGroup.rotation.z = rotationZ;

        // Ambient drift + twinkle (always)
        ambientPoints.rotation.y = t * 0.008;
        ambientPoints.rotation.x = t * 0.004;
        ambientMaterial.uniforms.uTime.value = t;

        // Distant galaxy: barely-perceptible disk rotation
        galaxyPoints.rotation.z = t * 0.02;

        // Rare-event layer: dark themes only (their spawns re-show the points)
        if (!isLightTheme) {
          updateSatellite(t);
          updateFlare(t);
        }

        // Orbit ring: slow Keplerian drift with a gentle precession wobble,
        // fades as the sphere scatters
        ringPoints.rotation.y = t * 0.06;
        ringTilt.rotation.z = -0.18 + Math.sin(t * 0.045) * 0.06;
        ringTilt.rotation.x = 0.42 + Math.sin(t * 0.03 + 1.7) * 0.04;
        // Ring dims further on light themes (ink dots, not glow)
        ringMaterial.uniforms.uFade.value = (1 - smoothScatter) * (isLightTheme ? 0.55 : 1);

        // Nebula churn + slow drift rotation, each cloud on its own rate
        for (let i = 0; i < nebulaMaterials.length; i++) {
          nebulaMaterials[i].uniforms.uTime.value = t;
          nebulaMeshes[i].rotation.z = (nebulaMeshes[i].userData.baseRot as number)
            + t * (nebulaMeshes[i].userData.driftSpeed as number);
        }

        // Occasional shooting star across the upper sky (dark themes only)
        if (!isLightTheme) {
          updateShootingStar(t);
        }

        // Camera zoom-out when scattered, pull back more for tracks view
        // (rides the smoothed values, so the dolly has the same inertia)
        camera.position.z = baseCameraZ + smoothScatter * 1.5 + smoothTracks * 1;

        camera.lookAt(0, 0, 0);
      }

      renderFrame();
    };

    // Static frame for reduced-motion
    if (prefersReducedMotion) {
      activeTime = BIRTH_DURATION;
      sphereMaterial.uniforms.uTime.value = 1.0;
      sphereMaterial.uniforms.uBirth.value = 1.0;
    }
    camera.position.z = baseCameraZ;
    syncAnimation();

    // ── Cleanup ──
    return () => {
      cancelAnimationFrame(animId);
      motionQuery.removeEventListener('change', onMotionChange);

      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('load', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      themeObserver.disconnect();

      sphereGeometry.dispose();
      sphereMaterial.dispose();
      ambientGeometry.dispose();
      ambientMaterial.dispose();
      shootingGeometry.dispose();
      shootingMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      nebulaGeometry.dispose();
      for (const material of nebulaMaterials) material.dispose();
      galaxyGeometry.dispose();
      galaxyMaterial.dispose();
      satelliteGeometry.dispose();
      satelliteMaterial.dispose();
      flareGeometry.dispose();
      flareMaterial.dispose();
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
        transition: 'opacity 0.6s ease-out',
      }}
      aria-hidden="true"
    />
  );
}

export default WebGLBackground;
