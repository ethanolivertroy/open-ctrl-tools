/**
 * Particle geometry for the cosmos background. Pure functions over a seeded
 * RNG so the sky is identical on every load (and testable without a GPU).
 *
 * The cast, all drawn as point sprites:
 *   - sphere:  a planet of dust (Fibonacci shell + sparse interior) that can
 *              scatter, wind into a spiral, and settle into horizontal tracks
 *   - runners: comets riding great circles just above the planet's surface
 *   - stars:   the surrounding deep field, power-law magnitudes
 *   - ring:    a thin tilted debris ring
 *   - galaxy:  a small three-arm spiral far in the background
 */

import { createRng, mixRgb, type Rgb } from './math';

export const SPHERE_RADIUS = 3.5;
export const TRACK_COUNT = 8;

const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;

/** `tint` values at or above this mark a comet particle; the fraction is its head-ness. */
export const TINT_RUNNER = 1;
/** `tint` values at or above this pick one of the fixed star whites. */
export const TINT_WHITE = 2;

export interface SphereGeometry {
  count: number;
  /** Particles before this index are planet dust; the rest are comets. */
  dustCount: number;
  position: Float32Array;
  /** size, opacity, noisePhase, scatterDelay */
  params: Float32Array;
  scatterTarget: Float32Array;
  vortexTarget: Float32Array;
  tracksTarget: Float32Array;
  /** orbit axis xyz + angular speed in rad/s (0 for dust) */
  runner: Float32Array;
  /** palette selector, see resolveDustColors */
  tint: Float32Array;
}

export interface SphereOptions {
  dustCount: number;
  runnerCount: number;
  /** Phones centre the planet behind the hero copy, so keep its interior sparse. */
  mobile: boolean;
  seed?: number;
}

export function buildSphere(options: SphereOptions): SphereGeometry {
  const { dustCount, runnerCount, mobile } = options;
  const rand = createRng(options.seed ?? 0x5eed);
  const count = dustCount + runnerCount;

  const position = new Float32Array(count * 3);
  const params = new Float32Array(count * 4);
  const scatterTarget = new Float32Array(count * 3);
  const vortexTarget = new Float32Array(count * 3);
  const tracksTarget = new Float32Array(count * 3);
  const runner = new Float32Array(count * 4);
  const tint = new Float32Array(count);

  const trackYs = Array.from({ length: TRACK_COUNT }, (_, i) => -3 + (6 / (TRACK_COUNT - 1)) * i);

  const writeTargets = (
    i: number,
    x: number,
    y: number,
    z: number,
    scatterMin: number,
    scatterSpan: number,
    scatterJitter: number,
    spiral: { t: number; inner: number; span: number; turns: number; depth: number },
  ) => {
    const len = Math.hypot(x, y, z) || 1;
    const dist = scatterMin + rand() * scatterSpan;
    scatterTarget[i * 3] = (x / len) * dist + (rand() - 0.5) * scatterJitter;
    scatterTarget[i * 3 + 1] = (y / len) * dist + (rand() - 0.5) * scatterJitter;
    scatterTarget[i * 3 + 2] = (z / len) * dist + (rand() - 0.5) * scatterJitter;

    // Three-arm spiral, face-on to the camera, centred on the origin.
    const arm = i % 3;
    const radius = spiral.inner + spiral.t * spiral.span;
    const angle = spiral.t * Math.PI * spiral.turns + (arm / 3) * Math.PI * 2;
    vortexTarget[i * 3] = Math.cos(angle) * radius;
    vortexTarget[i * 3 + 1] = Math.sin(angle) * radius;
    vortexTarget[i * 3 + 2] = (rand() - 0.5) * spiral.depth;

    // Horizontal bands with a slow wave so they read as currents, not rules.
    const track = Math.floor(rand() * TRACK_COUNT);
    const trackX = (rand() - 0.5) * 20;
    tracksTarget[i * 3] = trackX;
    tracksTarget[i * 3 + 1] = trackYs[track] + Math.sin(trackX * 0.3 + track * 1.5) * 0.2;
    tracksTarget[i * 3 + 2] = (rand() - 0.5) * 2;
  };

  // ── Dust: Fibonacci shell + random interior ──
  const surfaceCount = Math.floor(dustCount * (mobile ? 0.93 : 0.82));
  const interiorCount = dustCount - surfaceCount;

  for (let i = 0; i < surfaceCount; i += 1) {
    const theta = (2 * Math.PI * i) / GOLDEN_RATIO;
    const phi = Math.acos(1 - (2 * (i + 0.5)) / surfaceCount);
    const x = SPHERE_RADIUS * Math.cos(theta) * Math.sin(phi);
    const y = SPHERE_RADIUS * Math.cos(phi);
    const z = SPHERE_RADIUS * Math.sin(theta) * Math.sin(phi);

    position[i * 3] = x;
    position[i * 3 + 1] = y;
    position[i * 3 + 2] = z;
    params[i * 4] = rand() * 0.8 + 0.4;
    params[i * 4 + 1] = rand() * 0.3 + 0.7;
    params[i * 4 + 2] = rand() * 100;
    params[i * 4 + 3] = rand() * 0.4;
    tint[i] = rand() * 0.999;
    writeTargets(i, x, y, z, 3, 7, 4, {
      t: i / surfaceCount,
      inner: 0.3,
      span: 4.5,
      turns: 5,
      depth: 1.2,
    });
  }

  for (let i = surfaceCount; i < dustCount; i += 1) {
    // Biased toward the centre: a soft glowing heart rather than an even fill.
    const r = Math.pow(rand(), 0.75) * SPHERE_RADIUS * 0.85;
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.cos(phi);
    const z = r * Math.sin(phi) * Math.sin(theta);

    position[i * 3] = x;
    position[i * 3 + 1] = y;
    position[i * 3 + 2] = z;
    params[i * 4] = rand() * 0.5 + 0.3;
    params[i * 4 + 1] = rand() * 0.3 + 0.5;
    params[i * 4 + 2] = rand() * 100;
    params[i * 4 + 3] = rand() * 0.3;
    tint[i] = rand() * 0.999;
    writeTargets(i, x, y, z, 4, 8, 5, {
      t: interiorCount > 0 ? (i - surfaceCount) / interiorCount : 0,
      inner: 0.1,
      span: 2.5,
      turns: 4,
      depth: 0.8,
    });
  }

  // ── Comets: a few currents, each a great circle with one to three comets ──
  if (runnerCount > 0) {
    const currentCount = mobile ? 3 : 5;
    const currents = Array.from({ length: currentCount }, () => {
      // Random axis, kept away from the view direction so every orbit
      // crosses the visible disc instead of hugging the limb.
      let ax = rand() * 2 - 1;
      let ay = rand() * 2 - 1;
      let az = (rand() * 2 - 1) * 0.55;
      const len = Math.hypot(ax, ay, az) || 1;
      ax /= len;
      ay /= len;
      az /= len;

      // Orthonormal basis for the orbit plane.
      const up: [number, number, number] = Math.abs(ay) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      let e1x = ay * up[2] - az * up[1];
      let e1y = az * up[0] - ax * up[2];
      let e1z = ax * up[1] - ay * up[0];
      const e1len = Math.hypot(e1x, e1y, e1z) || 1;
      e1x /= e1len;
      e1y /= e1len;
      e1z /= e1len;
      const e2x = ay * e1z - az * e1y;
      const e2y = az * e1x - ax * e1z;
      const e2z = ax * e1y - ay * e1x;

      const direction = rand() < 0.5 ? -1 : 1;
      const cometCount = 1 + Math.floor(rand() * 2);
      return {
        axis: [ax, ay, az] as const,
        e1: [e1x, e1y, e1z] as const,
        e2: [e2x, e2y, e2z] as const,
        speed: direction * (0.1 + rand() * 0.2),
        radius: SPHERE_RADIUS * (1.02 + rand() * 0.08),
        comets: Array.from({ length: cometCount }, (_, c) => ({
          head: ((c + rand() * 0.6) / cometCount) * Math.PI * 2,
          length: 0.8 + rand() * 1.4,
        })),
      };
    });

    for (let n = 0; n < runnerCount; n += 1) {
      const i = dustCount + n;
      const current = currents[n % currentCount];
      const comet = current.comets[Math.floor(rand() * current.comets.length)];

      // Density piles up at the head and thins along the tail.
      const tail = Math.pow(rand(), 1.35);
      const headness = 1 - tail;
      const phase = comet.head - Math.sign(current.speed) * comet.length * tail;
      const lateral = (rand() - 0.5) * (0.004 + 0.034 * tail);

      const cp = Math.cos(phase) * Math.cos(lateral);
      const sp = Math.sin(phase) * Math.cos(lateral);
      const sl = Math.sin(lateral);
      const x = current.radius * (cp * current.e1[0] + sp * current.e2[0] + sl * current.axis[0]);
      const y = current.radius * (cp * current.e1[1] + sp * current.e2[1] + sl * current.axis[1]);
      const z = current.radius * (cp * current.e1[2] + sp * current.e2[2] + sl * current.axis[2]);

      position[i * 3] = x;
      position[i * 3 + 1] = y;
      position[i * 3 + 2] = z;
      params[i * 4] = 0.28 + headness * headness * 0.62;
      params[i * 4 + 1] = 0.22 + headness * headness * 0.85;
      params[i * 4 + 2] = rand() * 100;
      params[i * 4 + 3] = rand() * 0.4;
      runner[i * 4] = current.axis[0];
      runner[i * 4 + 1] = current.axis[1];
      runner[i * 4 + 2] = current.axis[2];
      runner[i * 4 + 3] = current.speed;
      tint[i] = TINT_RUNNER + headness * 0.999;
      writeTargets(i, x, y, z, 3, 7, 4, {
        t: rand(),
        inner: 0.3,
        span: 4.5,
        turns: 5,
        depth: 1.2,
      });
    }
  }

  return { count, dustCount, position, params, scatterTarget, vortexTarget, tracksTarget, runner, tint };
}

export interface PointGeometry {
  count: number;
  position: Float32Array;
  /** size, opacity, twinklePhase, spike */
  params: Float32Array;
  tint: Float32Array;
}

/** Deep-field stars on a shell around the scene; most faint, a few bright. */
export function buildStars(count: number, seed = 0xa57e): PointGeometry {
  const rand = createRng(seed);
  const position = new Float32Array(count * 3);
  const params = new Float32Array(count * 4);
  const tint = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const r = 5 + rand() * 12;
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    position[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    position[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    position[i * 3 + 2] = r * Math.cos(phi);

    const magnitude = Math.pow(rand(), 2.6);
    params[i * 4] = 0.3 + magnitude * 1.4;
    params[i * 4 + 1] = 0.45 + magnitude * 0.5;
    params[i * 4 + 2] = rand() * 100;
    // The brightest handful get faint diffraction spikes.
    params[i * 4 + 3] = magnitude > 0.965 ? 1 : 0;
    tint[i] = starTint(rand);
  }

  return { count, position, params, tint };
}

/** Thin tilted debris ring: a bright main band and a fainter outer one. */
export function buildRing(count: number, seed = 0x0b17): PointGeometry {
  const rand = createRng(seed);
  const position = new Float32Array(count * 3);
  const params = new Float32Array(count * 4);
  const tint = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const angle = rand() * Math.PI * 2;
    const main = rand() < 0.68;
    // Each band is densest at its inner edge, like real ring material.
    const radial = main ? 4.42 + Math.pow(rand(), 1.5) * 0.4 : 4.98 + Math.pow(rand(), 1.3) * 0.34;
    position[i * 3] = Math.cos(angle) * radial;
    position[i * 3 + 1] = (rand() - 0.5) * 0.1;
    position[i * 3 + 2] = Math.sin(angle) * radial;
    params[i * 4] = (main ? 0.24 : 0.18) + Math.pow(rand(), 2) * 0.5;
    params[i * 4 + 1] = (main ? 0.4 : 0.22) + rand() * 0.45;
    params[i * 4 + 2] = rand() * 100;
    tint[i] = starTint(rand);
  }

  return { count, position, params, tint };
}

export const GALAXY_RADIUS = 2.2;

/** Small three-arm spiral; `tint` carries each star's normalised radius. */
export function buildGalaxy(count: number, seed = 0x6a1a): PointGeometry {
  const rand = createRng(seed);
  const position = new Float32Array(count * 3);
  const params = new Float32Array(count * 4);
  const tint = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const arm = i % 3;
    const along = Math.pow(rand(), 0.7);
    const radial = 0.12 + along * 2.1;
    const angle = along * Math.PI * 4.2 + (arm / 3) * Math.PI * 2 + (rand() - 0.5) * 0.35;
    const x = Math.cos(angle) * radial;
    const y = Math.sin(angle) * radial;
    position[i * 3] = x;
    position[i * 3 + 1] = y;
    position[i * 3 + 2] = (rand() - 0.5) * 0.18;
    params[i * 4] = 0.12 + Math.pow(rand(), 2) * 0.4 + (along < 0.25 ? 0.15 : 0);
    params[i * 4 + 1] = 0.35 + rand() * 0.4;
    params[i * 4 + 2] = rand() * 100;
    tint[i] = Math.min(Math.hypot(x, y) / GALAXY_RADIUS, 1);
  }

  return { count, position, params, tint };
}

/** A slight majority of real star whites; the rest take theme colours. */
function starTint(rand: () => number): number {
  if (rand() < 0.55) {
    const roll = rand();
    // cool and neutral whites dominate, warm K-type stars are the minority
    return TINT_WHITE + (roll < 0.4 ? 1 : roll < 0.75 ? 2 : 0) + 0.5;
  }
  return rand() * 0.999;
}

// ─── Colour resolution ───────────────────────────────────────────────────────

export interface CosmosPalette {
  /** Dust colours with cumulative weights (last weight is 1). */
  dust: Rgb[];
  dustWeights: number[];
  /** Comet tail and head colours. */
  cometTail: Rgb;
  cometHead: Rgb;
  /** Star whites: warm, cool, neutral. Ignored when `starWhites` is false. */
  whites: [Rgb, Rgb, Rgb];
  /** Light themes cannot show white stars, so they fall back to dust colours. */
  starWhites: boolean;
  galaxy: { core: Rgb; arms: Rgb; rim: Rgb };
}

export function pickDust(palette: CosmosPalette, roll: number): Rgb {
  for (let i = 0; i < palette.dustWeights.length; i += 1) {
    if (roll < palette.dustWeights[i]) return palette.dust[i];
  }
  return palette.dust[palette.dust.length - 1];
}

/** Resolve `tint` selectors into RGB triples for dust, comets, stars and ring. */
export function resolveColors(tint: Float32Array, palette: CosmosPalette, out?: Float32Array): Float32Array {
  const colors = out ?? new Float32Array(tint.length * 3);
  for (let i = 0; i < tint.length; i += 1) {
    const t = tint[i];
    let c: Rgb;
    if (t >= TINT_WHITE) {
      const which = Math.min(2, Math.floor(t - TINT_WHITE));
      // Hash the index back into a roll so light themes still vary.
      c = palette.starWhites ? palette.whites[which] : pickDust(palette, ((i * 0.61803398875) % 1 + 1) % 1);
    } else if (t >= TINT_RUNNER) {
      const headness = t - TINT_RUNNER;
      c = mixRgb(palette.cometTail, palette.cometHead, headness * headness);
    } else {
      c = pickDust(palette, t);
    }
    colors[i * 3] = c[0];
    colors[i * 3 + 1] = c[1];
    colors[i * 3 + 2] = c[2];
  }
  return colors;
}

/** Warm core → theme arms → cool rim, like a real disc galaxy. */
export function resolveGalaxyColors(tint: Float32Array, palette: CosmosPalette, out?: Float32Array): Float32Array {
  const colors = out ?? new Float32Array(tint.length * 3);
  const { core, arms, rim } = palette.galaxy;
  for (let i = 0; i < tint.length; i += 1) {
    const radial = tint[i];
    const c = radial < 0.3 ? mixRgb(core, arms, radial / 0.3) : mixRgb(arms, rim, (radial - 0.3) / 0.7);
    colors[i * 3] = c[0];
    colors[i * 3 + 1] = c[1];
    colors[i * 3 + 2] = c[2];
  }
  return colors;
}
