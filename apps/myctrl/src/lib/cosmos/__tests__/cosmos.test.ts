import { describe, expect, it } from 'vitest';
import {
  buildGalaxy,
  buildRing,
  buildSphere,
  buildStars,
  resolveColors,
  resolveGalaxyColors,
  SPHERE_RADIUS,
  TINT_RUNNER,
  TINT_WHITE,
  TRACK_COUNT,
  type CosmosPalette,
} from '../geometry';
import {
  createRng,
  mat4,
  multiply,
  parseColor,
  perspective,
  rotationXYZ,
  transformPoint,
  translation,
  type Mat4,
  type Rgb,
} from '../math';
import { isSkyMode, resolveSkyMode } from '../sky-mode';

const length3 = (a: Float32Array, i: number) => Math.hypot(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]);

describe('cosmos math', () => {
  it('projects a point on the view axis to the centre of the screen', () => {
    const projection = perspective(mat4(), (55 * Math.PI) / 180, 16 / 9, 0.1, 100);
    const view = translation(mat4(), 0, 0, -8);
    const viewProjection = multiply(mat4(), projection, view);

    const centre = transformPoint(viewProjection, [0, 0, 0]);
    expect(centre[0]).toBeCloseTo(0, 6);
    expect(centre[1]).toBeCloseTo(0, 6);

    // One unit up at distance 8 lands at 1 / (8 · tan(fov / 2)) of the half-height.
    const up = transformPoint(viewProjection, [0, 1, 0]);
    expect(up[1]).toBeCloseTo(1 / (8 * Math.tan((55 * Math.PI) / 360)), 5);
    expect(up[0]).toBeCloseTo(0, 6);
  });

  it('composes Euler rotations as Rx · Ry · Rz', () => {
    const combined = rotationXYZ(mat4(), 0.4, -0.7, 1.1);
    const rx = rotationXYZ(mat4(), 0.4, 0, 0);
    const ry = rotationXYZ(mat4(), 0, -0.7, 0);
    const rz = rotationXYZ(mat4(), 0, 0, 1.1);
    const expected = multiply(mat4(), rx, multiply(mat4(), ry, rz));
    for (let i = 0; i < 16; i += 1) expect(combined[i]).toBeCloseTo(expected[i], 6);

    // Rotating +x a quarter turn about +z gives +y.
    const quarter = rotationXYZ(mat4(), 0, 0, Math.PI / 2);
    const [x, y, z] = transformPoint(quarter, [1, 0, 0]);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(1, 6);
    expect(z).toBeCloseTo(0, 6);
  });

  it('multiplies safely when the output aliases an input', () => {
    const a: Mat4 = rotationXYZ(mat4(), 0.3, 0.2, 0.1);
    const b: Mat4 = translation(mat4(), 1, 2, 3);
    const expected = Array.from(multiply(mat4(), a, b));
    multiply(a, a, b);
    expect(Array.from(a)).toEqual(expected);
  });

  it('gives the same sequence for the same seed, in [0, 1)', () => {
    const one = createRng(42);
    const two = createRng(42);
    const other = createRng(43);
    const first = Array.from({ length: 200 }, () => one());
    expect(Array.from({ length: 200 }, () => two())).toEqual(first);
    expect(Array.from({ length: 200 }, () => other())).not.toEqual(first);
    expect(Math.min(...first)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...first)).toBeLessThan(1);
  });

  it('parses the colour formats themes use', () => {
    expect(parseColor('#fff')).toEqual([1, 1, 1]);
    expect(parseColor(' #94e2d5 ')).toEqual([0x94 / 255, 0xe2 / 255, 0xd5 / 255]);
    expect(parseColor('rgb(255, 0, 51)')).toEqual([1, 0, 0.2]);
    expect(parseColor('rgb(0 128 255)')[2]).toBe(1);
    expect(parseColor('nonsense', [0.1, 0.2, 0.3])).toEqual([0.1, 0.2, 0.3]);
  });
});

describe('cosmos geometry', () => {
  const sphere = buildSphere({ dustCount: 4000, runnerCount: 300, mobile: false });

  it('is deterministic', () => {
    const again = buildSphere({ dustCount: 4000, runnerCount: 300, mobile: false });
    expect(Array.from(again.position)).toEqual(Array.from(sphere.position));
    expect(Array.from(again.runner)).toEqual(Array.from(sphere.runner));
  });

  it('lays dust on a shell with a sparse interior', () => {
    expect(sphere.count).toBe(4300);
    expect(sphere.dustCount).toBe(4000);
    const surfaceCount = Math.floor(4000 * 0.82);

    for (let i = 0; i < surfaceCount; i += 1) {
      expect(length3(sphere.position, i)).toBeCloseTo(SPHERE_RADIUS, 4);
    }
    for (let i = surfaceCount; i < 4000; i += 1) {
      expect(length3(sphere.position, i)).toBeLessThanOrEqual(SPHERE_RADIUS * 0.85 + 1e-4);
    }
    // Phones keep more of the dust on the shell, away from the copy.
    const mobile = buildSphere({ dustCount: 1000, runnerCount: 0, mobile: true });
    let onShell = 0;
    for (let i = 0; i < 1000; i += 1) {
      if (Math.abs(length3(mobile.position, i) - SPHERE_RADIUS) < 1e-3) onShell += 1;
    }
    expect(onShell).toBeGreaterThanOrEqual(930);
  });

  it('gives only comets an orbit, around a unit axis, just above the surface', () => {
    for (let i = 0; i < sphere.dustCount; i += 1) {
      expect(sphere.runner[i * 4 + 3]).toBe(0);
      expect(sphere.tint[i]).toBeLessThan(TINT_RUNNER);
    }
    for (let i = sphere.dustCount; i < sphere.count; i += 1) {
      const ax = sphere.runner[i * 4];
      const ay = sphere.runner[i * 4 + 1];
      const az = sphere.runner[i * 4 + 2];
      expect(Math.hypot(ax, ay, az)).toBeCloseTo(1, 4);
      expect(Math.abs(sphere.runner[i * 4 + 3])).toBeGreaterThan(0.09);

      const radius = length3(sphere.position, i);
      expect(radius).toBeGreaterThan(SPHERE_RADIUS);
      expect(radius).toBeLessThan(SPHERE_RADIUS * 1.11);

      // Rotating about the axis must keep the comet on its great circle:
      // it starts within a thin band around the plane normal to the axis.
      const offPlane =
        (sphere.position[i * 3] * ax + sphere.position[i * 3 + 1] * ay + sphere.position[i * 3 + 2] * az) / radius;
      expect(Math.abs(offPlane)).toBeLessThan(0.03);

      expect(sphere.tint[i]).toBeGreaterThanOrEqual(TINT_RUNNER);
      expect(sphere.tint[i]).toBeLessThan(TINT_WHITE);
    }
  });

  it('scatters outward and settles onto the track rows', () => {
    const rows = Array.from({ length: TRACK_COUNT }, (_, i) => -3 + (6 / (TRACK_COUNT - 1)) * i);
    for (let i = 0; i < sphere.count; i += 1) {
      const y = sphere.tracksTarget[i * 3 + 1];
      const nearest = Math.min(...rows.map((row) => Math.abs(row - y)));
      expect(nearest).toBeLessThanOrEqual(0.2 + 1e-5);
      expect(Math.abs(sphere.tracksTarget[i * 3])).toBeLessThanOrEqual(10);
      // Staggered delays must stay below 1 or the shader divides by zero.
      expect(sphere.params[i * 4 + 3]).toBeGreaterThanOrEqual(0);
      expect(sphere.params[i * 4 + 3]).toBeLessThan(0.41);
    }
    let further = 0;
    for (let i = 0; i < sphere.dustCount; i += 1) {
      if (length3(sphere.scatterTarget, i) > length3(sphere.position, i)) further += 1;
    }
    expect(further / sphere.dustCount).toBeGreaterThan(0.85);
  });

  it('builds the surrounding sky', () => {
    const stars = buildStars(2000);
    let spiked = 0;
    for (let i = 0; i < stars.count; i += 1) {
      const r = length3(stars.position, i);
      expect(r).toBeGreaterThanOrEqual(5 - 1e-4);
      expect(r).toBeLessThanOrEqual(17 + 1e-4);
      spiked += stars.params[i * 4 + 3];
    }
    // Diffraction glints are for the brightest few, not the whole field.
    expect(spiked).toBeGreaterThan(0);
    expect(spiked / stars.count).toBeLessThan(0.04);

    const ring = buildRing(800);
    for (let i = 0; i < ring.count; i += 1) {
      const radial = Math.hypot(ring.position[i * 3], ring.position[i * 3 + 2]);
      expect(radial).toBeGreaterThan(SPHERE_RADIUS * 1.2);
      expect(radial).toBeLessThan(5.4);
      expect(Math.abs(ring.position[i * 3 + 1])).toBeLessThanOrEqual(0.05 + 1e-6);
    }

    const galaxy = buildGalaxy(300);
    for (let i = 0; i < galaxy.count; i += 1) {
      expect(galaxy.tint[i]).toBeGreaterThanOrEqual(0);
      expect(galaxy.tint[i]).toBeLessThanOrEqual(1);
    }
  });
});

describe('cosmos colours', () => {
  const red: Rgb = [1, 0, 0];
  const green: Rgb = [0, 1, 0];
  const blue: Rgb = [0, 0, 1];
  const grey: Rgb = [0.5, 0.5, 0.5];
  const palette: CosmosPalette = {
    dust: [red, green, blue, grey],
    dustWeights: [0.65, 0.9, 0.97, 1],
    cometTail: [0.2, 0, 0.4],
    cometHead: [1, 1, 1],
    whites: [
      [1, 0.9, 0.8],
      [0.9, 0.95, 1],
      [0.96, 0.96, 0.94],
    ],
    starWhites: true,
    galaxy: { core: red, arms: green, rim: blue },
  };
  const rgbAt = (colors: Float32Array, i: number) => Array.from(colors.slice(i * 3, i * 3 + 3));

  it('maps dust tints through the weighted palette', () => {
    const colors = resolveColors(new Float32Array([0, 0.64, 0.66, 0.91, 0.98]), palette);
    expect(rgbAt(colors, 0)).toEqual(red);
    expect(rgbAt(colors, 1)).toEqual(red);
    expect(rgbAt(colors, 2)).toEqual(green);
    expect(rgbAt(colors, 3)).toEqual(blue);
    expect(rgbAt(colors, 4)).toEqual(grey);
  });

  it('runs comets from tail colour to a white-hot head', () => {
    const colors = resolveColors(new Float32Array([TINT_RUNNER, TINT_RUNNER + 0.5, TINT_RUNNER + 0.999]), palette);
    expect(rgbAt(colors, 0)[0]).toBeCloseTo(0.2, 5);
    expect(rgbAt(colors, 1)[0]).toBeGreaterThan(0.2);
    expect(rgbAt(colors, 1)[0]).toBeLessThan(rgbAt(colors, 2)[0]);
    expect(rgbAt(colors, 2)[0]).toBeGreaterThan(0.99);
  });

  it('uses star whites on dark themes and theme colours on light ones', () => {
    const tints = new Float32Array([TINT_WHITE + 0.5, TINT_WHITE + 1.5, TINT_WHITE + 2.5]);
    const dark = resolveColors(tints, palette);
    expect(rgbAt(dark, 0)).toEqual(Array.from(new Float32Array(palette.whites[0])));
    expect(rgbAt(dark, 1)).toEqual(Array.from(new Float32Array(palette.whites[1])));
    expect(rgbAt(dark, 2)).toEqual(Array.from(new Float32Array(palette.whites[2])));

    const light = resolveColors(tints, { ...palette, starWhites: false });
    const dustColors = palette.dust.map((c) => c.join());
    for (let i = 0; i < 3; i += 1) {
      expect(dustColors).toContain(rgbAt(light, i).join());
    }
  });

  it('grades the galaxy from core to rim', () => {
    // 0.3 is not exact in float32, so the arm colour is compared with tolerance.
    const colors = resolveGalaxyColors(new Float32Array([0, 0.3, 1]), palette);
    const expectRgb = (index: number, expected: Rgb) =>
      rgbAt(colors, index).forEach((channel, c) => expect(channel).toBeCloseTo(expected[c], 5));
    expectRgb(0, red);
    expectRgb(1, green);
    expectRgb(2, blue);
  });
});

describe('sky mode', () => {
  it('recognises only the three modes', () => {
    expect(isSkyMode('drift')).toBe(true);
    expect(isSkyMode('still')).toBe(true);
    expect(isSkyMode('off')).toBe(true);
    expect(isSkyMode('on')).toBe(false);
    expect(isSkyMode(null)).toBe(false);
  });

  it('lets an explicit choice win over the motion preference', () => {
    expect(resolveSkyMode('drift', true)).toBe('drift');
    expect(resolveSkyMode('off', false)).toBe('off');
    expect(resolveSkyMode('still', false)).toBe('still');
  });

  it('defaults to drift, or still when reduced motion is requested', () => {
    expect(resolveSkyMode(null, false)).toBe('drift');
    expect(resolveSkyMode(undefined, true)).toBe('still');
    expect(resolveSkyMode('garbage', true)).toBe('still');
  });
});
