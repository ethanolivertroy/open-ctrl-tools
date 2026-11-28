/**
 * Small column-major 4x4 matrix helpers and a seeded RNG for the cosmos
 * background. Only what the scene needs — no general-purpose math library.
 */

export type Mat4 = Float32Array;
export type Vec3 = [number, number, number];

export function mat4(): Mat4 {
  const m = new Float32Array(16);
  m[0] = 1;
  m[5] = 1;
  m[10] = 1;
  m[15] = 1;
  return m;
}

export function perspective(out: Mat4, fovYRad: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovYRad / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

const MULTIPLY_SCRATCH = new Float32Array(16);

/** out = a · b (apply b first, then a). Safe when out aliases a or b. */
export function multiply(out: Mat4, a: Mat4, b: Mat4): Mat4 {
  const r = MULTIPLY_SCRATCH;
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      r[col * 4 + row] =
        a[row] * b[col * 4] +
        a[4 + row] * b[col * 4 + 1] +
        a[8 + row] * b[col * 4 + 2] +
        a[12 + row] * b[col * 4 + 3];
    }
  }
  out.set(r);
  return out;
}

export function translation(out: Mat4, x: number, y: number, z: number): Mat4 {
  out.fill(0);
  out[0] = 1;
  out[5] = 1;
  out[10] = 1;
  out[15] = 1;
  out[12] = x;
  out[13] = y;
  out[14] = z;
  return out;
}

export function scaling(out: Mat4, s: number): Mat4 {
  out.fill(0);
  out[0] = s;
  out[5] = s;
  out[10] = s;
  out[15] = 1;
  return out;
}

/** Intrinsic XYZ Euler rotation: R = Rx · Ry · Rz. */
export function rotationXYZ(out: Mat4, x: number, y: number, z: number): Mat4 {
  const a = Math.cos(x);
  const b = Math.sin(x);
  const c = Math.cos(y);
  const d = Math.sin(y);
  const e = Math.cos(z);
  const f = Math.sin(z);
  const ae = a * e;
  const af = a * f;
  const be = b * e;
  const bf = b * f;

  out[0] = c * e;
  out[4] = -c * f;
  out[8] = d;
  out[12] = 0;

  out[1] = af + be * d;
  out[5] = ae - bf * d;
  out[9] = -b * c;
  out[13] = 0;

  out[2] = bf - ae * d;
  out[6] = be + af * d;
  out[10] = a * c;
  out[14] = 0;

  out[3] = 0;
  out[7] = 0;
  out[11] = 0;
  out[15] = 1;
  return out;
}

/** Upper-left 3x3 of a 4x4, column-major, for a mat3 uniform. */
export function upper3x3(out: Float32Array, m: Mat4): Float32Array {
  out[0] = m[0];
  out[1] = m[1];
  out[2] = m[2];
  out[3] = m[4];
  out[4] = m[5];
  out[5] = m[6];
  out[6] = m[8];
  out[7] = m[9];
  out[8] = m[10];
  return out;
}

export function transformPoint(m: Mat4, p: Vec3): Vec3 {
  const [x, y, z] = p;
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
  ];
}

/** mulberry32 — tiny, fast, good enough for scattering dust. */
export function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rgb = [number, number, number];

/** Parse `#rgb`, `#rrggbb` or `rgb(r g b)` / `rgb(r, g, b)` into 0–1 floats. */
export function parseColor(value: string, fallback: Rgb = [1, 1, 1]): Rgb {
  const v = value.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (ch) => ch + ch) : hex[1];
    const n = parseInt(h, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(v);
  if (rgb) {
    return [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255];
  }
  return fallback;
}

export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
