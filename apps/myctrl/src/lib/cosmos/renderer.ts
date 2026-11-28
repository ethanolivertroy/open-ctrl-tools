/**
 * Cosmos — the homepage's deep-space background, in dependency-free WebGL2.
 *
 * A planet made of dust sits beside the hero. Scrolling scatters it into a
 * drifting field, winds that field into a spiral, and finally lays it out in
 * horizontal tracks. Around it: a deep star field, a debris ring, comets
 * riding the planet's surface, a distant galaxy, nebula haze, and the
 * occasional meteor, satellite and supernova.
 *
 * The dust is painted into a floating-point buffer that is never cleared,
 * only dimmed a little each frame — a long exposure, so anything that moves
 * leaves light behind it. Stars and other pinpoint lights are drawn crisp on
 * top. On light themes the same buffer is read as ink density instead of glow.
 */

import {
  buildGalaxy,
  buildRing,
  buildSphere,
  buildStars,
  resolveColors,
  resolveGalaxyColors,
  SPHERE_RADIUS,
  type CosmosPalette,
  type PointGeometry,
} from './geometry';
import { clamp01, mat4, multiply, parseColor, perspective, rotationXYZ, scaling, translation, upper3x3, type Rgb } from './math';
import {
  BLUR_FRAG,
  COMPOSITE_FRAG,
  DOWNSAMPLE_FRAG,
  FADE_FRAG,
  FULLSCREEN_VERT,
  NEBULA_FRAG,
  POINTS_FRAG,
  POINTS_VERT,
  SPHERE_VERT,
} from './shaders';

export type CosmosMode = 'drift' | 'still';

export interface CosmosOptions {
  /** Element the planet composes itself beside (the hero). */
  anchor?: Element | null;
  /** The hero's text column; on wide screens the planet keeps clear of it. */
  copy?: Element | null;
  mode?: CosmosMode;
  /** Lower the render resolution when frames run long. Default true. */
  adaptive?: boolean;
  onFirstFrame?: () => void;
}

export interface CosmosDebugInfo {
  frames: number;
  fps: number;
  pixelScale: number;
  floatTrail: boolean;
  width: number;
  height: number;
  dust: number;
  light: boolean;
  mode: CosmosMode;
  scatter: number;
}

export interface CosmosHandle {
  setMode(mode: CosmosMode): void;
  debug(): CosmosDebugInfo;
  destroy(): void;
}

const FOV = (55 * Math.PI) / 180;
const TAN_HALF_FOV = Math.tan(FOV / 2);
const BASE_CAMERA_Z = 8;
const BIRTH_SECONDS = 2.4;
const TRAIL_SECONDS = 0.13; // e-folding time of the long exposure
const SCROLL_RESPONSE = 4.5;
const METEOR_POINTS = 96;
const MAX_PIXELS = 3_400_000;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('cosmos: could not create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`cosmos: shader compile failed: ${log}`);
  }
  return shader;
}

interface Program {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

function link(gl: WebGL2RenderingContext, vert: string, frag: string, uniformNames: string[]): Program {
  const program = gl.createProgram();
  if (!program) throw new Error('cosmos: could not create program');
  const vs = compile(gl, gl.VERTEX_SHADER, vert);
  const fs = compile(gl, gl.FRAGMENT_SHADER, frag);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`cosmos: program link failed: ${log}`);
  }
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  for (const name of uniformNames) uniforms[name] = gl.getUniformLocation(program, name);
  return { program, uniforms };
}

interface PointLayer {
  vao: WebGLVertexArrayObject;
  count: number;
  positionBuffer: WebGLBuffer;
  colorBuffer: WebGLBuffer;
  paramBuffer: WebGLBuffer;
  position: Float32Array;
  colors: Float32Array;
  params: Float32Array;
  tint: Float32Array | null;
}

function readThemeColor(style: CSSStyleDeclaration, token: string, fallback: string): Rgb {
  return parseColor(style.getPropertyValue(token).trim() || fallback, parseColor(fallback));
}

interface ThemeState {
  light: boolean;
  palette: CosmosPalette;
  /** Colour the planet's night side leans toward. */
  shadow: Rgb;
  nebula: { coolA: Rgb; coolB: Rgb; warmA: Rgb; warmB: Rgb };
}

function readTheme(): ThemeState {
  const root = document.documentElement;
  const style = getComputedStyle(root);
  const light = !root.classList.contains('dark');
  const teal = readThemeColor(style, '--ctp-teal', '#94e2d5');
  const sapphire = readThemeColor(style, '--ctp-sapphire', '#74c7ec');
  const sky = readThemeColor(style, '--ctp-sky', '#89dceb');
  const green = readThemeColor(style, '--ctp-green', '#a6e3a1');
  const mauve = readThemeColor(style, '--ctp-mauve', '#cba6f7');
  const lavender = readThemeColor(style, '--ctp-lavender', '#b4befe');
  const blue = readThemeColor(style, '--ctp-blue', '#89b4fa');
  const pink = readThemeColor(style, '--ctp-pink', '#f5c2e7');

  const whites: [Rgb, Rgb, Rgb] = [parseColor('#fff3e0'), parseColor('#eaf2ff'), parseColor('#f5f5f0')];

  if (light) {
    // Cosmic ink: purples, blues, magenta. Teal and green turn to moss on paper.
    return {
      light,
      palette: {
        dust: [mauve, lavender, blue, pink],
        dustWeights: [0.45, 0.7, 0.88, 1],
        cometTail: pink,
        cometHead: mauve,
        whites,
        starWhites: false,
        galaxy: { core: mauve, arms: lavender, rim: blue },
      },
      shadow: lavender,
      nebula: { coolA: blue, coolB: lavender, warmA: mauve, warmB: pink },
    };
  }

  return {
    light,
    palette: {
      // Cyan-dominant night palette with a thread of mauve.
      dust: [teal, sapphire, green, mauve],
      dustWeights: [0.65, 0.9, 0.97, 1],
      cometTail: mauve,
      cometHead: parseColor('#fff6ea'),
      whites,
      starWhites: true,
      galaxy: { core: whites[0], arms: lavender, rim: sky },
    },
    shadow: mauve,
    nebula: { coolA: teal, coolB: sapphire, warmA: mauve, warmB: lavender },
  };
}

export function createCosmos(canvas: HTMLCanvasElement, options: CosmosOptions = {}): CosmosHandle | null {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
  });
  if (!gl) return null;

  const adaptive = options.adaptive ?? true;
  const anchor = options.anchor ?? null;
  const copy = options.copy ?? null;
  const isMobile = window.innerWidth < 768;
  const dustCount = isMobile ? 9000 : 40000;
  const runnerCount = isMobile ? 450 : 1800;
  const starCount = isMobile ? 500 : 1500;
  const ringCount = isMobile ? 500 : 1600;
  const galaxyCount = isMobile ? 250 : 650;

  // Rendering into a half-float target is what makes the long exposure
  // possible: 8 bits cannot hold the faint per-frame deposits.
  const floatTrail = Boolean(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));

  // ── Programs ──
  let sphereProgram: Program;
  let pointsProgram: Program;
  let fadeProgram: Program;
  let nebulaProgram: Program;
  let compositeProgram: Program;
  let downsampleProgram: Program;
  let blurProgram: Program;
  try {
    sphereProgram = link(gl, SPHERE_VERT, POINTS_FRAG, [
      'uView', 'uProjection', 'uSphereRot', 'uSpherePos', 'uSphereScale', 'uScatterScale', 'uFormation',
      'uVortexSpin', 'uTime', 'uDisplacement', 'uScatter', 'uVortex', 'uTracks', 'uBirth', 'uKeepFraction',
      'uSizeScale', 'uPx', 'uRunnerGain', 'uPointer', 'uAspect', 'uGain', 'uLightDir', 'uShadowTint',
      'uDispersedGain',
    ]);
    pointsProgram = link(gl, POINTS_VERT, POINTS_FRAG, [
      'uModelView', 'uProjection', 'uTime', 'uTwinkle', 'uFade', 'uSizeScale', 'uPx', 'uGain',
    ]);
    fadeProgram = link(gl, FULLSCREEN_VERT, FADE_FRAG, ['uDecay']);
    nebulaProgram = link(gl, FULLSCREEN_VERT, NEBULA_FRAG, [
      'uTime', 'uAspect', 'uDrift', 'uCoolA', 'uCoolB', 'uWarmA', 'uWarmB', 'uOpacity', 'uDetail', 'uSaturation',
    ]);
    compositeProgram = link(gl, FULLSCREEN_VERT, COMPOSITE_FRAG, [
      'uTrail', 'uNebula', 'uBloom', 'uBloomGain', 'uLight', 'uExposure', 'uSeed',
    ]);
    downsampleProgram = link(gl, FULLSCREEN_VERT, DOWNSAMPLE_FRAG, ['uSource', 'uTexel']);
    blurProgram = link(gl, FULLSCREEN_VERT, BLUR_FRAG, ['uSource', 'uStep']);
  } catch (error) {
    console.warn(error);
    return null;
  }

  // ── Geometry ──
  const sphere = buildSphere({ dustCount, runnerCount, mobile: isMobile });
  const sphereColors = new Float32Array(sphere.count * 3);

  const buffers: WebGLBuffer[] = [];
  const vaos: WebGLVertexArrayObject[] = [];

  const makeBuffer = (data: Float32Array, usage: number): WebGLBuffer => {
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('cosmos: could not create buffer');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, usage);
    buffers.push(buffer);
    return buffer;
  };

  const attribute = (location: number, buffer: WebGLBuffer, size: number) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  };

  const makeVao = (): WebGLVertexArrayObject => {
    const vao = gl.createVertexArray();
    if (!vao) throw new Error('cosmos: could not create vertex array');
    vaos.push(vao);
    return vao;
  };

  const sphereVao = makeVao();
  gl.bindVertexArray(sphereVao);
  attribute(0, makeBuffer(sphere.position, gl.STATIC_DRAW), 3);
  const sphereColorBuffer = makeBuffer(sphereColors, gl.DYNAMIC_DRAW);
  attribute(1, sphereColorBuffer, 3);
  attribute(2, makeBuffer(sphere.params, gl.STATIC_DRAW), 4);
  attribute(3, makeBuffer(sphere.scatterTarget, gl.STATIC_DRAW), 3);
  attribute(4, makeBuffer(sphere.vortexTarget, gl.STATIC_DRAW), 3);
  attribute(5, makeBuffer(sphere.tracksTarget, gl.STATIC_DRAW), 3);
  attribute(6, makeBuffer(sphere.runner, gl.STATIC_DRAW), 4);

  const makeLayer = (geometry: PointGeometry | null, count: number, dynamic: boolean): PointLayer => {
    const position = geometry?.position ?? new Float32Array(count * 3);
    const params = geometry?.params ?? new Float32Array(count * 4);
    const colors = new Float32Array(count * 3);
    const usage = dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW;
    const vao = makeVao();
    gl.bindVertexArray(vao);
    const positionBuffer = makeBuffer(position, usage);
    attribute(0, positionBuffer, 3);
    const colorBuffer = makeBuffer(colors, gl.DYNAMIC_DRAW);
    attribute(1, colorBuffer, 3);
    const paramBuffer = makeBuffer(params, usage);
    attribute(2, paramBuffer, 4);
    return { vao, count, positionBuffer, colorBuffer, paramBuffer, position, colors, params, tint: geometry?.tint ?? null };
  };

  const stars = makeLayer(buildStars(starCount), starCount, false);
  const ring = makeLayer(buildRing(ringCount), ringCount, false);
  const galaxy = makeLayer(buildGalaxy(galaxyCount), galaxyCount, false);
  const meteor = makeLayer(null, METEOR_POINTS, true);
  const satellite = makeLayer(null, 1, true);
  const flare = makeLayer(null, 1, true);
  gl.bindVertexArray(null);

  const upload = (buffer: WebGLBuffer, data: Float32Array) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
  };

  // Meteor: incandescent head cooling through pale blue-green along the train.
  {
    const head = parseColor('#ffffff');
    const mid = parseColor('#dceeff');
    const tail = parseColor('#9fd8cf');
    for (let i = 0; i < METEOR_POINTS; i += 1) {
      const f = i / (METEOR_POINTS - 1);
      const t = f < 0.3 ? f / 0.3 : (f - 0.3) / 0.7;
      const from = f < 0.3 ? head : mid;
      const to = f < 0.3 ? mid : tail;
      meteor.colors[i * 3] = from[0] + (to[0] - from[0]) * t;
      meteor.colors[i * 3 + 1] = from[1] + (to[1] - from[1]) * t;
      meteor.colors[i * 3 + 2] = from[2] + (to[2] - from[2]) * t;
      meteor.params[i * 4] = 2.2 * Math.exp(-f * 3.2) + 0.4;
    }
    upload(meteor.colorBuffer, meteor.colors);
    satellite.colors.set([0.95, 0.97, 1.0]);
    satellite.params[0] = 0.55;
    upload(satellite.colorBuffer, satellite.colors);
    flare.colors.set([1.0, 0.98, 0.92]);
    upload(flare.colorBuffer, flare.colors);
  }

  // ── Render targets ──
  let trailTexture: WebGLTexture | null = null;
  let trailFbo: WebGLFramebuffer | null = null;
  let nebulaTexture: WebGLTexture | null = null;
  let nebulaFbo: WebGLFramebuffer | null = null;
  let nebulaWidth = 1;
  let nebulaHeight = 1;
  let trailIsFloat = floatTrail;
  let bloomA: { texture: WebGLTexture | null; fbo: WebGLFramebuffer | null } = { texture: null, fbo: null };
  let bloomB: { texture: WebGLTexture | null; fbo: WebGLFramebuffer | null } = { texture: null, fbo: null };
  let bloomWidth = 1;
  let bloomHeight = 1;

  const makeTarget = (width: number, height: number, float: boolean, linear: boolean) => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    if (float) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    const filter = linear ? gl.LINEAR : gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { texture, fbo, complete };
  };

  // ── State ──
  let mode: CosmosMode = options.mode ?? 'drift';
  let theme = readTheme();
  let destroyed = false;
  let contextLost = false;

  let cssWidth = 1;
  let cssHeight = 1;
  let pixelScale = 1;
  let qualityScale = 1;
  let aspect = 1;

  const projection = mat4();
  const view = mat4();
  const model = mat4();
  const scratchA = mat4();
  const scratchB = mat4();
  const modelView = mat4();
  const sphereRot3 = new Float32Array(9);

  // Planet placement in world units, derived from the hero's box.
  let spherePos: [number, number, number] = [1.5, 0.2, 0];
  let sphereScale = 1;
  let heroHeight = 600;
  let maxScroll = 1;
  let sphereDim = 1;

  let scrollY = window.scrollY;
  let smoothScatter = 0;
  let smoothVortex = 0;
  let smoothTracks = 0;
  let rotationY = 0.6;
  let vortexSpin = 0;

  let activeTime = 0;
  let frames = 0;
  let fps = 60;
  let rafId = 0;
  let lastFrameAt: number | null = null;
  let firstFrameDone = false;
  let trailPrimed = false;
  let slowFrames = 0;
  let measuredFrames = 0;
  let focused = document.hasFocus();

  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, wake: 0, lastMoveAt: 0, lastX: 0, lastY: 0, seen: false };

  // Rare events: meteors, a satellite pass, a distant supernova.
  const meteorState = {
    active: false, nextAt: 4 + Math.random() * 6, startedAt: 0, travel: 0.6, decay: 0.4, speed: 24, peak: 1,
    spacing: 0.16, origin: [0, 0, 0] as [number, number, number], dir: [1, 0] as [number, number],
  };
  const satelliteState = {
    active: false, nextAt: 12 + Math.random() * 15, startedAt: 0, duration: 20, flareAt: -1,
    from: [0, 0, 0] as [number, number, number], to: [0, 0, 0] as [number, number, number],
  };
  const flareState = { active: false, nextAt: 20 + Math.random() * 25, startedAt: 0, duration: 3.2 };

  const applyColors = () => {
    resolveColors(sphere.tint, theme.palette, sphereColors);
    upload(sphereColorBuffer, sphereColors);
    if (stars.tint) upload(stars.colorBuffer, resolveColors(stars.tint, theme.palette, stars.colors));
    if (ring.tint) upload(ring.colorBuffer, resolveColors(ring.tint, theme.palette, ring.colors));
    if (galaxy.tint) upload(galaxy.colorBuffer, resolveGalaxyColors(galaxy.tint, theme.palette, galaxy.colors));
  };
  applyColors();

  const layout = () => {
    const width = cssWidth;
    const height = cssHeight;
    // CSS pixels per world unit on the z = 0 plane at the resting camera.
    const ppu = height / 2 / (BASE_CAMERA_Z * TAN_HALF_FOV);

    let heroTop = 64;
    heroHeight = Math.min(height * 0.8, 640);
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      heroTop = rect.top + window.scrollY;
      heroHeight = rect.height;
    }

    // `radius` is the planet's apparent size on screen, breathing shell included.
    let centerX: number;
    let centerY: number;
    let radius: number;
    if (width >= 1024) {
      // Desktop: a large planet rising beside the copy. It may run off the
      // right edge of the viewport, but its limb stays clear of the text.
      const copyEnd = copy ? copy.getBoundingClientRect().right : width * 0.64;
      const free = Math.max(width - copyEnd, 0);
      radius = Math.min(height * 0.36, heroHeight * 0.46, Math.max(free * 0.62, Math.min(height * 0.27, 230)));
      centerX = Math.max(copyEnd + 28 + radius, width - radius * 0.9);
      centerY = heroTop + heroHeight * 0.5;
      sphereDim = 1;
    } else if (width >= 768) {
      // Tablets: no free column, so it rises from the top-right corner behind
      // the copy, dimmed enough that the text stays readable.
      radius = Math.min(width * 0.34, height * 0.3);
      centerX = width * 0.9;
      centerY = heroTop + Math.min(heroHeight * 0.3, radius * 0.9);
      sphereDim = 0.5;
    } else {
      // Phones: centred behind the copy, dimmer still.
      radius = Math.min(width * 0.56, height * 0.32);
      centerX = width * 0.5;
      centerY = heroTop + Math.min(heroHeight * 0.4, radius + 56);
      sphereDim = 0.42;
    }
    centerY = Math.max(radius * 0.85, Math.min(centerY, height - radius * 0.5));

    // The shell swells ~10% with noise and perspective adds ~5% at the limb.
    const shellRadius = radius / 1.15;
    sphereScale = shellRadius / (SPHERE_RADIUS * ppu);
    spherePos = [(centerX - width / 2) / ppu, (height / 2 - centerY) / ppu, 0];
    maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    cssWidth = Math.max(1, Math.round(rect.width || window.innerWidth));
    cssHeight = Math.max(1, Math.round(rect.height || window.innerHeight));
    aspect = cssWidth / cssHeight;

    const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
    pixelScale = dpr * qualityScale;
    const pixels = cssWidth * cssHeight * pixelScale * pixelScale;
    if (pixels > MAX_PIXELS) pixelScale *= Math.sqrt(MAX_PIXELS / pixels);

    const width = Math.max(1, Math.round(cssWidth * pixelScale));
    const height = Math.max(1, Math.round(cssHeight * pixelScale));
    if (trailTexture && canvas.width === width && canvas.height === height) {
      // Same backing size (the observer also fires once on attach): keep the exposure.
      layout();
      return;
    }
    canvas.width = width;
    canvas.height = height;

    if (trailTexture) gl.deleteTexture(trailTexture);
    if (trailFbo) gl.deleteFramebuffer(trailFbo);
    let trail = makeTarget(width, height, floatTrail, floatTrail);
    trailIsFloat = floatTrail;
    if (!trail.complete && floatTrail) {
      gl.deleteTexture(trail.texture);
      gl.deleteFramebuffer(trail.fbo);
      trail = makeTarget(width, height, false, false);
      trailIsFloat = false;
    }
    trailTexture = trail.texture;
    trailFbo = trail.fbo;
    trailPrimed = false;

    if (nebulaTexture) gl.deleteTexture(nebulaTexture);
    if (nebulaFbo) gl.deleteFramebuffer(nebulaFbo);
    nebulaWidth = Math.max(64, Math.round(cssWidth / 4));
    nebulaHeight = Math.max(64, Math.round(cssHeight / 4));
    const nebula = makeTarget(nebulaWidth, nebulaHeight, false, true);
    nebulaTexture = nebula.texture;
    nebulaFbo = nebula.fbo;

    for (const target of [bloomA, bloomB]) {
      if (target.texture) gl.deleteTexture(target.texture);
      if (target.fbo) gl.deleteFramebuffer(target.fbo);
    }
    bloomWidth = Math.max(32, Math.round(width / 4));
    bloomHeight = Math.max(32, Math.round(height / 4));
    bloomA = makeTarget(bloomWidth, bloomHeight, trailIsFloat, true);
    bloomB = makeTarget(bloomWidth, bloomHeight, trailIsFloat, true);

    layout();
  };

  // ── Rare events ──
  const spawnMeteor = (t: number) => {
    const fromLeft = Math.random() < 0.5;
    const fireball = Math.random() < 0.15;
    const edge = 6.8 * aspect + 0.5;
    meteorState.origin = [
      fromLeft ? -edge - Math.random() * 3 : edge + Math.random() * 3,
      2.5 + Math.random() * 3.5,
      -3 - Math.random() * 4,
    ];
    const dive = 0.3 + Math.random() * 0.4;
    meteorState.dir = [(fromLeft ? 1 : -1) * Math.cos(dive), -Math.sin(dive)];
    meteorState.speed = fireball ? 15 + Math.random() * 4 : 22 + Math.random() * 10;
    meteorState.travel = fireball ? 0.9 + Math.random() * 0.3 : 0.45 + Math.random() * 0.3;
    meteorState.decay = fireball ? 0.7 : 0.35;
    meteorState.peak = fireball ? 1.35 : 0.85 + Math.random() * 0.25;
    // Points sit a few pixels apart so the train reads as one stroke of light.
    meteorState.spacing = meteorState.speed * 0.0022;
    meteorState.startedAt = t;
    meteorState.active = true;
  };

  const updateMeteor = (t: number) => {
    if (!meteorState.active) {
      if (t >= meteorState.nextAt) spawnMeteor(t);
      return;
    }
    const { travel, decay, speed, peak, spacing, origin, dir } = meteorState;
    const elapsed = t - meteorState.startedAt;
    if (elapsed >= travel + decay) {
      meteorState.active = false;
      meteorState.nextAt = t + 8 + Math.random() * 12;
      return;
    }

    // Fast ignition, slight dimming in flight, exponential afterglow.
    const attack = 0.12 * travel;
    let envelope: number;
    if (elapsed < attack) envelope = elapsed / attack;
    else if (elapsed < travel) envelope = 1 - 0.35 * ((elapsed - attack) / (travel - attack));
    else envelope = 0.65 * Math.exp(-(elapsed - travel) / (decay * 0.3));
    envelope *= peak;

    const headDistance = speed * Math.min(elapsed, travel);
    for (let i = 0; i < METEOR_POINTS; i += 1) {
      const d = Math.max(headDistance - i * spacing, 0);
      meteor.position[i * 3] = origin[0] + dir[0] * d;
      meteor.position[i * 3 + 1] = origin[1] + dir[1] * d;
      meteor.position[i * 3 + 2] = origin[2];
      meteor.params[i * 4 + 1] = Math.min(envelope * Math.exp(-i * 0.045), 1) * (d > 0 ? 1 : 0);
    }
    upload(meteor.positionBuffer, meteor.position);
    upload(meteor.paramBuffer, meteor.params);
  };

  const updateSatellite = (t: number) => {
    if (!satelliteState.active) {
      if (t >= satelliteState.nextAt) {
        const leftToRight = Math.random() < 0.5;
        const edge = 8.2 * aspect + 1;
        const y0 = -1 + Math.random() * 6;
        const y1 = y0 + (Math.random() - 0.5) * 3;
        satelliteState.from = [leftToRight ? -edge : edge, y0, -5];
        satelliteState.to = [leftToRight ? edge : -edge, y1, -5];
        // Same angular speed on every screen: narrower sky, shorter pass.
        satelliteState.duration = Math.max(6, edge * 1.35) + Math.random() * Math.max(3, edge * 0.5);
        satelliteState.flareAt = Math.random() < 0.35 ? 0.35 + Math.random() * 0.3 : -1;
        satelliteState.startedAt = t;
        satelliteState.active = true;
      }
      return;
    }
    const progress = (t - satelliteState.startedAt) / satelliteState.duration;
    if (progress >= 1) {
      satelliteState.active = false;
      satelliteState.nextAt = t + 40 + Math.random() * 50;
      return;
    }
    const { from, to } = satelliteState;
    satellite.position[0] = from[0] + (to[0] - from[0]) * progress;
    satellite.position[1] = from[1] + (to[1] - from[1]) * progress;
    satellite.position[2] = from[2];
    const edge = Math.min(progress / 0.08, (1 - progress) / 0.08, 1);
    let brightness = 0.75 * edge;
    // Iridium-style glint as the panels catch the sun.
    if (satelliteState.flareAt > 0) {
      const d = (progress - satelliteState.flareAt) / 0.03;
      brightness += Math.exp(-d * d) * 1.4;
    }
    satellite.params[1] = Math.min(brightness, 2);
    upload(satellite.positionBuffer, satellite.position);
    upload(satellite.paramBuffer, satellite.params);
  };

  const updateFlare = (t: number) => {
    if (!flareState.active) {
      if (t >= flareState.nextAt) {
        const span = 5.2 * aspect;
        flare.position[0] = -span + Math.random() * span * 2;
        flare.position[1] = -3 + Math.random() * 8;
        flare.position[2] = -7 - Math.random() * 5;
        upload(flare.positionBuffer, flare.position);
        flareState.startedAt = t;
        flareState.active = true;
      }
      return;
    }
    const elapsed = t - flareState.startedAt;
    if (elapsed >= flareState.duration) {
      flareState.active = false;
      flareState.nextAt = t + 40 + Math.random() * 40;
      return;
    }
    // Fast ignition, long exponential decay — the classic light curve.
    const attack = 0.35;
    const envelope = elapsed < attack ? elapsed / attack : Math.exp(-(elapsed - attack) / 0.9);
    flare.params[0] = 1.2 + envelope * 2.2;
    flare.params[1] = envelope;
    flare.params[3] = 1;
    upload(flare.paramBuffer, flare.params);
  };

  // ── Drawing ──
  const drawFullscreen = () => {
    gl.bindVertexArray(null);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const drawLayer = (
    layer: PointLayer,
    matrix: Float32Array,
    settings: { twinkle?: boolean; fade?: number; sizeScale?: number; gain: number; time: number },
  ) => {
    const u = pointsProgram.uniforms;
    multiply(modelView, view, matrix);
    gl.uniformMatrix4fv(u.uModelView, false, modelView);
    gl.uniform1f(u.uTime, settings.time);
    gl.uniform1f(u.uTwinkle, settings.twinkle ? 1 : 0);
    gl.uniform1f(u.uFade, settings.fade ?? 1);
    gl.uniform1f(u.uSizeScale, settings.sizeScale ?? 1);
    gl.uniform1f(u.uGain, settings.gain);
    gl.bindVertexArray(layer.vao);
    gl.drawArrays(gl.POINTS, 0, layer.count);
  };

  /**
   * Render one frame. `dt` is the time since the previous frame in seconds;
   * a static frame (still mode) passes 0 and gets a fully settled exposure.
   */
  const render = (dt: number, animated: boolean) => {
    if (contextLost || !trailFbo || !nebulaFbo) return;
    const t = activeTime;
    const light = theme.light;
    const width = canvas.width;
    const height = canvas.height;
    // Grains stay close to a pixel across so the planet reads as sand, not fog.
    const pointPx = pixelScale * (0.36 + 0.2 / Math.max(pixelScale, 0.5));

    // Camera: dolly back as the dust disperses; the pointer slides it a little
    // so near dust and far stars separate in depth.
    const cameraZ = BASE_CAMERA_Z + smoothScatter * 1.5 + smoothTracks;
    perspective(projection, FOV, aspect, 0.1, 100);
    translation(view, -pointer.x * 0.24, pointer.y * 0.15, -cameraZ);

    // Planet: tilted axis, slow spin, a barely perceptible nod.
    rotationXYZ(scratchA, 0.16 + Math.sin(t * 0.02) * 0.05 * (1 - smoothScatter), 0, -0.2);
    rotationXYZ(scratchB, 0, rotationY, 0);
    multiply(model, scratchA, scratchB);
    upper3x3(sphereRot3, model);

    // The long exposure: old light decays, new light is deposited in proportion,
    // so resting dust keeps its brightness while moving dust draws a streak.
    const exposing = animated && trailIsFloat;
    const decay = exposing ? Math.exp(-dt / TRAIL_SECONDS) : 0;
    const deposit = exposing ? 1 - decay : 1;

    // ── Nebula (quarter resolution) ──
    gl.bindFramebuffer(gl.FRAMEBUFFER, nebulaFbo);
    gl.viewport(0, 0, nebulaWidth, nebulaHeight);
    gl.disable(gl.BLEND);
    gl.useProgram(nebulaProgram.program);
    {
      const u = nebulaProgram.uniforms;
      gl.uniform1f(u.uTime, t);
      gl.uniform1f(u.uAspect, aspect);
      gl.uniform2f(u.uDrift, pointer.x * 0.02, -pointer.y * 0.014 - (scrollY / Math.max(cssHeight, 1)) * 0.12);
      gl.uniform3fv(u.uCoolA, theme.nebula.coolA);
      gl.uniform3fv(u.uCoolB, theme.nebula.coolB);
      gl.uniform3fv(u.uWarmA, theme.nebula.warmA);
      gl.uniform3fv(u.uWarmB, theme.nebula.warmB);
      // Phones show the clouds behind body copy, so they run fainter there.
      gl.uniform1f(u.uOpacity, (light ? 0.5 : 0.4) * (isMobile ? 0.7 : 1));
      gl.uniform1f(u.uDetail, isMobile ? 0 : 1);
      gl.uniform1f(u.uSaturation, light ? 1 : 1.7);
    }
    drawFullscreen();

    // ── Trail buffer ──
    gl.bindFramebuffer(gl.FRAMEBUFFER, trailFbo);
    gl.viewport(0, 0, width, height);
    gl.enable(gl.BLEND);
    if (exposing && trailPrimed) {
      gl.blendFunc(gl.ZERO, gl.SRC_ALPHA);
      gl.useProgram(fadeProgram.program);
      gl.uniform1f(fadeProgram.uniforms.uDecay, decay);
      drawFullscreen();
    } else {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    // The first exposed frame lands at full strength so nothing fades in from black.
    const gain = exposing && trailPrimed ? deposit : 1;
    trailPrimed = exposing;

    gl.blendFunc(gl.ONE, gl.ONE);

    gl.useProgram(sphereProgram.program);
    {
      const u = sphereProgram.uniforms;
      gl.uniformMatrix4fv(u.uView, false, view);
      gl.uniformMatrix4fv(u.uProjection, false, projection);
      gl.uniformMatrix3fv(u.uSphereRot, false, sphereRot3);
      gl.uniform3f(u.uSpherePos, spherePos[0], spherePos[1], spherePos[2]);
      gl.uniform1f(u.uSphereScale, sphereScale);
      gl.uniform1f(u.uScatterScale, isMobile ? 0.62 : Math.max(0.85, Math.min(aspect / 1.6, 1.5)));
      gl.uniform2f(u.uFormation, Math.max(0.42, Math.min(aspect / 1.55, 1.15)), Math.max(1, aspect / 1.6));
      gl.uniform1f(u.uVortexSpin, vortexSpin);
      gl.uniform1f(u.uTime, t);
      gl.uniform1f(u.uDisplacement, 0.35);
      gl.uniform1f(u.uScatter, smoothScatter);
      gl.uniform1f(u.uVortex, smoothVortex);
      gl.uniform1f(u.uTracks, smoothTracks);
      const birth = animated ? Math.min(t / BIRTH_SECONDS, 1) : 1;
      gl.uniform1f(u.uBirth, 1 - Math.pow(1 - birth, 3));
      // Light themes: about a tenth of the dust at several times the size —
      // deliberate ink dots instead of speckle.
      gl.uniform1f(u.uKeepFraction, light ? 0.12 : 1);
      gl.uniform1f(u.uSizeScale, light ? 3.4 : 1);
      gl.uniform1f(u.uPx, pointPx);
      // Comets are only bright because their light is spread along a trail.
      gl.uniform1f(u.uRunnerGain, exposing ? 3.4 : 0.6);
      gl.uniform3f(u.uPointer, pointer.x, pointer.y, pointer.wake);
      gl.uniform1f(u.uAspect, aspect);
      gl.uniform3f(u.uLightDir, -0.72, 0.44, 0.53);
      gl.uniform3fv(u.uShadowTint, theme.shadow);
      if (light) gl.uniform3f(u.uDispersedGain, 0.9, 1.1, 1.0);
      else gl.uniform3f(u.uDispersedGain, 0.4, 0.8, 0.62);
      gl.uniform1f(u.uGain, 0.7 * (light ? 0.6 : 1) * sphereDim * gain);
    }
    gl.bindVertexArray(sphereVao);
    gl.drawArrays(gl.POINTS, 0, sphere.count);

    // Stars and other pinpoint lights keep a steadier size than the dust.
    const starPx = 0.25 + pixelScale * 0.75;
    gl.useProgram(pointsProgram.program);
    gl.uniformMatrix4fv(pointsProgram.uniforms.uProjection, false, projection);
    gl.uniform1f(pointsProgram.uniforms.uPx, starPx);

    // Debris ring: fixed tilt toward the viewer, slow Keplerian drift, and it
    // dissolves with the planet (a ring around loose dust looks wrong).
    {
      translation(model, spherePos[0], spherePos[1], spherePos[2]);
      scaling(scratchA, sphereScale);
      multiply(model, model, scratchA);
      rotationXYZ(scratchA, 0.42 + Math.sin(t * 0.03 + 1.7) * 0.04, 0, -0.18 + Math.sin(t * 0.045) * 0.06);
      multiply(model, model, scratchA);
      rotationXYZ(scratchA, 0, t * 0.06, 0);
      multiply(model, model, scratchA);
      drawLayer(ring, model, {
        fade: (1 - smoothScatter) * (light ? 0.55 : 1) * sphereDim,
        sizeScale: light ? 2.6 : 1,
        gain,
        time: t,
      });
    }

    // Meteors deposit at full strength — they are bright because they are
    // brief. Once the head burns out the exposure itself is the afterglow, so
    // the train is only redrawn in place when there is no trail buffer.
    const meteorInFlight = t - meteorState.startedAt < meteorState.travel;
    if (!light && animated && meteorState.active && (!exposing || meteorInFlight)) {
      translation(model, 0, 0, 0);
      drawLayer(meteor, model, { gain: exposing ? 0.9 : 1, time: t });
    }

    // ── Bloom: quarter-resolution blur of the exposure (glow themes only) ──
    gl.disable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0);
    const blooming = !light && trailIsFloat && bloomA.fbo !== null && bloomB.fbo !== null;
    if (blooming) {
      gl.viewport(0, 0, bloomWidth, bloomHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, bloomA.fbo);
      gl.useProgram(downsampleProgram.program);
      gl.bindTexture(gl.TEXTURE_2D, trailTexture);
      gl.uniform1i(downsampleProgram.uniforms.uSource, 0);
      gl.uniform2f(downsampleProgram.uniforms.uTexel, 1 / width, 1 / height);
      drawFullscreen();

      gl.useProgram(blurProgram.program);
      gl.uniform1i(blurProgram.uniforms.uSource, 0);
      for (const spread of [1, 2.2, 4.5]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, bloomB.fbo);
        gl.bindTexture(gl.TEXTURE_2D, bloomA.texture);
        gl.uniform2f(blurProgram.uniforms.uStep, spread / bloomWidth, 0);
        drawFullscreen();
        gl.bindFramebuffer(gl.FRAMEBUFFER, bloomA.fbo);
        gl.bindTexture(gl.TEXTURE_2D, bloomB.texture);
        gl.uniform2f(blurProgram.uniforms.uStep, 0, spread / bloomHeight);
        drawFullscreen();
      }
    }

    // ── Composite to the page ──
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.useProgram(compositeProgram.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, trailTexture);
    gl.uniform1i(compositeProgram.uniforms.uTrail, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, nebulaTexture);
    gl.uniform1i(compositeProgram.uniforms.uNebula, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, blooming ? bloomA.texture : nebulaTexture);
    gl.uniform1i(compositeProgram.uniforms.uBloom, 2);
    // Bloom flatters the formed planet; over a page of scattered dust it is just fog.
    gl.uniform1f(compositeProgram.uniforms.uBloomGain, blooming ? 0.85 * (1 - 0.65 * smoothScatter) : 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1f(compositeProgram.uniforms.uLight, light ? 1 : 0);
    gl.uniform1f(compositeProgram.uniforms.uExposure, light ? 1 : 2.1);
    gl.uniform1f(compositeProgram.uniforms.uSeed, animated ? (frames % 61) * 1.37 : 0);
    drawFullscreen();

    // ── Crisp lights on top (dark themes only: they are pure glow) ──
    if (!light) {
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
      gl.useProgram(pointsProgram.program);

      rotationXYZ(model, t * 0.004, t * 0.008, 0);
      drawLayer(stars, model, { twinkle: animated, gain: 0.7, time: t });

      // Distant galaxy, tucked into the upper sky between the copy and the planet.
      {
        const depth = 13;
        const halfHeight = (BASE_CAMERA_Z + depth) * TAN_HALF_FOV;
        const gx = isMobile ? -0.2 * halfHeight * aspect : 0.1 * halfHeight * aspect;
        const gy = isMobile ? 0.72 * halfHeight : 0.7 * halfHeight;
        translation(model, gx, gy, -depth);
        rotationXYZ(scratchA, 0.9, 0.35, t * 0.02);
        multiply(model, model, scratchA);
        scaling(scratchA, isMobile ? 0.7 : 1);
        multiply(model, model, scratchA);
        drawLayer(galaxy, model, { fade: 0.8, gain: 1, time: t });
      }

      if (animated) {
        translation(model, 0, 0, 0);
        if (satelliteState.active) drawLayer(satellite, model, { gain: 1, time: t });
        if (flareState.active) drawLayer(flare, model, { gain: 1, time: t });
      }
    }

    gl.bindVertexArray(null);
    frames += 1;
    if (!firstFrameDone) {
      firstFrameDone = true;
      options.onFirstFrame?.();
    }
  };

  // ── Loop ──
  const step = (now: number) => {
    rafId = 0;
    if (destroyed || contextLost || mode !== 'drift' || document.hidden) return;
    rafId = requestAnimationFrame(step);

    // Every frame on 60–90Hz displays, every other on 120Hz+; a quieter 24fps
    // while the window is in the background.
    const minInterval = focused ? 10 : 1000 / 24;
    if (lastFrameAt !== null && now - lastFrameAt < minInterval) return;
    const rawDt = lastFrameAt === null ? 1 / 60 : (now - lastFrameAt) / 1000;
    lastFrameAt = now;
    const dt = Math.min(rawDt, 0.1);
    activeTime += dt;
    fps += (1 / Math.max(rawDt, 0.001) - fps) * 0.05;

    // Formations chase the scroll position rather than binding to it 1:1, which
    // would pass every wheel notch straight through as a jolt.
    const ns = scrollY / maxScroll;
    const scatterTarget = clamp01(scrollY / Math.max(heroHeight * 0.5, 220));
    const vortexTarget = clamp01((ns - 0.36) / 0.2);
    const tracksTarget = clamp01((ns - 0.76) / 0.2);
    const smoothing = 1 - Math.exp(-SCROLL_RESPONSE * dt);
    smoothScatter += (scatterTarget - smoothScatter) * smoothing;
    smoothVortex += (vortexTarget - smoothVortex) * smoothing;
    smoothTracks += (tracksTarget - smoothTracks) * smoothing;

    rotationY += dt * 0.036 * ((1 - smoothScatter) * 0.85 + 0.15);
    vortexSpin += dt * 0.05 * smoothVortex * (1 - smoothTracks);

    // Pointer: eased position; the wake rises with movement and settles after.
    const pointerEase = 1 - Math.exp(-6 * dt);
    pointer.x += (pointer.targetX - pointer.x) * pointerEase;
    pointer.y += (pointer.targetY - pointer.y) * pointerEase;
    const sinceMove = (now - pointer.lastMoveAt) / 1000;
    const wakeTarget = pointer.seen && sinceMove < 0.12 ? 1 : 0;
    pointer.wake += (wakeTarget - pointer.wake) * (1 - Math.exp(-(wakeTarget > pointer.wake ? 5 : 1.1) * dt));

    if (!theme.light) {
      updateMeteor(activeTime);
      updateSatellite(activeTime);
      updateFlare(activeTime);
    }

    render(dt, true);

    // Adaptive quality: if frames keep running long once the page has settled,
    // trade resolution for smoothness. One-way, so it cannot oscillate. The
    // threshold sits below 30fps so a display or battery saver that caps the
    // frame rate there is not mistaken for a struggling GPU.
    if (adaptive && focused && activeTime > 2.5 && qualityScale > 0.5) {
      measuredFrames += 1;
      if (rawDt > 1 / 26) slowFrames += 1;
      if (measuredFrames >= 90) {
        if (slowFrames > 50) {
          qualityScale = Math.max(0.5, qualityScale * 0.78);
          resize();
        }
        measuredFrames = 0;
        slowFrames = 0;
      }
    }
  };

  const renderStill = () => {
    // A settled portrait: formed planet, frozen clock.
    smoothScatter = 0;
    smoothVortex = 0;
    smoothTracks = 0;
    activeTime = Math.max(activeTime, BIRTH_SECONDS);
    render(0, false);
  };

  const sync = () => {
    cancelAnimationFrame(rafId);
    rafId = 0;
    lastFrameAt = null;
    if (destroyed || contextLost) return;
    if (mode === 'still') renderStill();
    else if (!document.hidden) rafId = requestAnimationFrame(step);
  };

  // ── Events ──
  const onScroll = () => {
    scrollY = window.scrollY;
  };
  const onResize = () => {
    resize();
    if (mode === 'still') renderStill();
  };
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return;
    const x = (event.clientX / Math.max(cssWidth, 1)) * 2 - 1;
    const y = 1 - (event.clientY / Math.max(cssHeight, 1)) * 2;
    const moved = Math.hypot(event.clientX - pointer.lastX, event.clientY - pointer.lastY);
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    pointer.targetX = x;
    pointer.targetY = y;
    if (!pointer.seen) {
      // First sighting: start at the cursor instead of sweeping in from centre.
      pointer.x = x;
      pointer.y = y;
      pointer.seen = true;
    } else if (moved > 1.5) {
      pointer.lastMoveAt = performance.now();
    }
  };
  const onVisibility = () => sync();
  const onFocus = () => {
    focused = true;
  };
  const onBlur = () => {
    focused = false;
  };
  const onContextLost = (event: Event) => {
    event.preventDefault();
    contextLost = true;
    cancelAnimationFrame(rafId);
    rafId = 0;
  };

  const themeObserver = new MutationObserver(() => {
    theme = readTheme();
    applyColors();
    trailPrimed = false;
    if (mode === 'still') renderStill();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

  const resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(canvas);
  // The page grows as fonts and islands settle; keep the scroll range current.
  const pageObserver = new ResizeObserver(() => layout());
  pageObserver.observe(document.body);

  window.addEventListener('scroll', onScroll, { passive: true });
  // Also catches device-pixel-ratio changes, which do not resize the canvas box.
  window.addEventListener('resize', onResize);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('focus', onFocus);
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', onContextLost);

  resize();
  sync();

  return {
    setMode(next) {
      if (next === mode) return;
      mode = next;
      trailPrimed = false;
      sync();
    },
    debug() {
      return {
        frames,
        fps: Math.round(fps),
        pixelScale: Number(pixelScale.toFixed(2)),
        floatTrail: trailIsFloat,
        width: canvas.width,
        height: canvas.height,
        dust: sphere.count,
        light: theme.light,
        mode,
        scatter: Number(smoothScatter.toFixed(3)),
      };
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      themeObserver.disconnect();
      resizeObserver.disconnect();
      pageObserver.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      for (const buffer of buffers) gl.deleteBuffer(buffer);
      for (const vao of vaos) gl.deleteVertexArray(vao);
      for (const p of [sphereProgram, pointsProgram, fadeProgram, nebulaProgram, compositeProgram, downsampleProgram, blurProgram]) {
        gl.deleteProgram(p.program);
      }
      if (trailTexture) gl.deleteTexture(trailTexture);
      if (trailFbo) gl.deleteFramebuffer(trailFbo);
      if (nebulaTexture) gl.deleteTexture(nebulaTexture);
      if (nebulaFbo) gl.deleteFramebuffer(nebulaFbo);
      for (const target of [bloomA, bloomB]) {
        if (target.texture) gl.deleteTexture(target.texture);
        if (target.fbo) gl.deleteFramebuffer(target.fbo);
      }
    },
  };
}
