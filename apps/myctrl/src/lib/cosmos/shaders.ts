/**
 * GLSL ES 3.00 sources for the cosmos background.
 *
 * Every particle is a point sprite. Their positions are pure functions of
 * per-particle attributes and a handful of uniforms, so the CPU does no
 * per-particle work per frame — formations, comets and the cursor wake are
 * all resolved in the vertex stage.
 */

// 3D simplex noise — Ian McEwan, Ashima Arts (MIT licence).
const NOISE = /* glsl */ `
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

// ─── Planet dust + comets ────────────────────────────────────────────────────

export const SPHERE_VERT = /* glsl */ `#version 300 es
precision highp float;
${NOISE}

layout(location = 0) in vec3 position;
layout(location = 1) in vec3 aColor;
layout(location = 2) in vec4 aParams;        // size, opacity, noisePhase, scatterDelay
layout(location = 3) in vec3 aScatterTarget;
layout(location = 4) in vec3 aVortexTarget;
layout(location = 5) in vec3 aTracksTarget;
layout(location = 6) in vec4 aRunner;        // orbit axis, angular speed (0 = dust)

uniform mat4 uView;
uniform mat4 uProjection;
uniform mat3 uSphereRot;
uniform vec3 uSpherePos;
uniform float uSphereScale;
uniform float uScatterScale;   // how far the scattered field spreads
uniform vec2 uFormation;       // spiral scale, tracks horizontal stretch
uniform float uVortexSpin;

uniform float uTime;
uniform float uDisplacement;
uniform float uScatter;        // 0→1: planet → scattered dust
uniform float uVortex;         // 0→1: scattered → spiral
uniform float uTracks;         // 0→1: spiral → horizontal tracks
uniform float uBirth;          // 0→1 while the planet assembles
uniform float uKeepFraction;   // light themes draw a sparse subset
uniform float uSizeScale;
uniform float uPx;             // device pixel scale for point sizes
uniform float uRunnerGain;     // comets brighten once trails are running
uniform vec3 uPointer;         // cursor in NDC + wake strength
uniform float uAspect;
uniform vec3 uLightDir;        // toward the unseen star lighting the planet
uniform vec3 uShadowTint;      // colour the night side leans toward
uniform vec3 uDispersedGain;   // dust brightness when scattered, spiralled, in tracks

out vec3 vColor;
out float vOpacity;
out float vSpike;

vec3 rotateAbout(vec3 p, vec3 axis, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return p * c + cross(axis, p) * s + axis * dot(axis, p) * (1.0 - c);
}

void main() {
  vColor = aColor;
  vSpike = 0.0;

  float aSize = aParams.x;
  float aOpacity = aParams.y;
  float aNoisePhase = aParams.z;
  float aScatterDelay = aParams.w;
  bool isRunner = aRunner.w != 0.0;

  // Light-mode thinning: cull a deterministic, evenly spread subset.
  if (aNoisePhase * 0.01 > uKeepFraction) {
    vOpacity = 0.0;
    gl_PointSize = 0.0;
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  // Staggered per-particle transitions so each change cascades through the dust.
  float scatterT = smoothstep(0.0, 1.0, clamp((uScatter - aScatterDelay) / (1.0 - aScatterDelay), 0.0, 1.0));
  float reversedDelay = 0.4 - aScatterDelay;
  float vortexT = smoothstep(0.0, 1.0, clamp((uVortex - reversedDelay) / (1.0 - reversedDelay), 0.0, 1.0));
  float tracksT = smoothstep(0.0, 1.0, clamp((uTracks - aScatterDelay) / (1.0 - aScatterDelay), 0.0, 1.0));

  // Comets ride their great circle; dust stays where the shell put it.
  vec3 base = isRunner ? rotateAbout(position, aRunner.xyz, uTime * aRunner.w) : position;
  vec3 dir = normalize(base);

  // Breathing shell: noise displacement, stronger while the planet is forming.
  float birthNoise = mix(1.8, 1.0, uBirth);
  float breathe = isRunner ? 0.22 : 1.0;
  float noise = snoise(dir * 2.0 + uTime * 0.08 + aNoisePhase) * uDisplacement * birthNoise * breathe * (1.0 - scatterT);
  vec3 spherePos = base + dir * noise;

  // Birth: the planet coalesces out of scattered dust in a cascading wave.
  float birthT = smoothstep(0.0, 1.0, clamp((uBirth - aScatterDelay * 0.5) / (1.0 - aScatterDelay * 0.5), 0.0, 1.0));
  spherePos = mix(aScatterTarget * 1.7, spherePos, birthT);

  float explosionArc = sin(scatterT * 3.14159265) * (1.0 - vortexT);
  float vortexArc = sin(vortexT * 3.14159265) * (1.0 - tracksT);
  float tracksArc = sin(tracksT * 3.14159265);
  float arcs = explosionArc + vortexArc + tracksArc;

  // Fluid turbulence only matters mid-transition; skip three noise taps otherwise.
  vec3 fluid = vec3(0.0);
  if (arcs > 0.002) {
    fluid = vec3(
      snoise(dir * 2.5 + uTime * 0.2),
      snoise(dir.yzx * 2.5 + uTime * 0.2),
      snoise(dir.zxy * 2.5 + uTime * 0.2)
    );
  }
  vec3 tangent = vec3(-dir.y, dir.x, 0.0);

  // Planet and its explosion live in the planet's rotating frame...
  vec3 planet = uSphereRot * spherePos * uSphereScale + uSpherePos;
  vec3 scattered = uSphereRot * aScatterTarget * uScatterScale + uSpherePos * 0.3;
  vec3 world = mix(planet, scattered, scatterT);

  // ...while the spiral and the tracks are composed for the viewport.
  float spinS = sin(uVortexSpin);
  float spinC = cos(uVortexSpin);
  vec3 spiral = vec3(
    aVortexTarget.x * spinC - aVortexTarget.y * spinS,
    aVortexTarget.x * spinS + aVortexTarget.y * spinC,
    aVortexTarget.z
  ) * vec3(uFormation.x, uFormation.x, 1.0);
  world = mix(world, spiral, vortexT);

  vec3 tracks = aTracksTarget * vec3(uFormation.y, 1.0, 1.0);
  world = mix(world, tracks, tracksT);

  // Tangential flow bends each journey into ribbons without moving endpoints.
  world += tangent * (explosionArc * 1.1 + vortexArc * 0.8);
  world += fluid * (explosionArc * 1.6 + vortexArc * 1.1 + tracksArc * 0.35);

  // A dispersed field should still feel alive between scroll transitions.
  float driftWeight = scatterT * (1.0 - vortexT);
  world += vec3(
    sin(uTime * 0.16 + aNoisePhase),
    cos(uTime * 0.13 + aNoisePhase * 1.3),
    sin(uTime * 0.11 + aNoisePhase * 0.7)
  ) * 0.12 * driftWeight;

  // Fine grit so the shell reads as sand rather than a lattice.
  world += (uSphereRot * dir) * ((aNoisePhase - 50.0) * 0.002) * uSphereScale * (1.0 - scatterT);

  vec4 mvPosition = uView * vec4(world, 1.0);
  float depth = max(-mvPosition.z, 0.05);
  float depthFade = 1.0 - smoothstep(3.0, 20.0, depth);

  float dispersed = max(scatterT, max(vortexT, tracksT));
  // The scattered field sits behind page copy, so it runs dimmer than the
  // spiral and the tracks, which mostly show between cards.
  float opacityScale = mix(1.0, uDispersedGain.x, scatterT);
  opacityScale = mix(opacityScale, uDispersedGain.y, vortexT);
  opacityScale = mix(opacityScale, uDispersedGain.z, tracksT);
  opacityScale += explosionArc * 0.25;
  float runnerGain = isRunner ? mix(uRunnerGain, 1.0, dispersed) : 1.0;
  vOpacity = aOpacity * depthFade * opacityScale * runnerGain * min(uBirth * 3.0, 1.0);

  // The formed planet has a day side and a night side. Comets carry their
  // own light, and scattered dust is lit evenly.
  if (!isRunner) {
    float lit = dot(uSphereRot * dir, uLightDir);
    float formed = (1.0 - dispersed) * birthT;
    float shade = mix(0.17, 1.65, smoothstep(-0.55, 0.8, lit));
    vOpacity *= mix(1.0, shade, formed);
    float night = (1.0 - smoothstep(-0.65, 0.3, lit)) * formed;
    vColor = mix(aColor, uShadowTint, night * 0.8);
  }

  float sizeScale = 1.0 + explosionArc * 0.4;

  // Glitter: a sparse subset of grains catches the light now and then.
  float glitterSeed = fract(aNoisePhase * 0.618034);
  if (!isRunner && glitterSeed < 0.06) {
    float beat = sin(uTime * (0.7 + glitterSeed * 30.0) + aNoisePhase * 6.2831853);
    float sparkle = pow(max(beat, 0.0), 22.0);
    vOpacity *= 1.0 + sparkle * 2.6;
    sizeScale *= 1.0 + sparkle * 0.8;
    vColor = mix(vColor, vec3(1.0), sparkle * 0.35);
  }
  if (isRunner) sizeScale *= 1.3;

  gl_PointSize = clamp(aSize * sizeScale * (60.0 / depth), 1.2, 72.0) * uSizeScale * uPx;

  vec4 clip = uProjection * mvPosition;

  // Cursor wake: moving the pointer parts the dust and leaves a small eddy.
  if (uPointer.z > 0.001 && clip.w > 0.0) {
    vec2 ndc = clip.xy / clip.w;
    vec2 delta = (ndc - uPointer.xy) * vec2(uAspect, 1.0);
    float r2 = dot(delta, delta);
    float influence = uPointer.z * exp(-r2 / 0.03);
    vec2 away = delta / max(sqrt(r2), 0.0001);
    // More swirl than push: the dust eddies around the cursor rather than
    // opening a hole under it.
    vec2 push = (away * 0.03 + vec2(-away.y, away.x) * 0.04) * influence;
    ndc += push / vec2(uAspect, 1.0);
    clip.xy = ndc * clip.w;
    vOpacity *= 1.0 + influence * 1.1;
  }

  gl_Position = clip;
}
`;

// ─── Stars, ring, galaxy, meteors, satellite, flare ──────────────────────────

export const POINTS_VERT = /* glsl */ `#version 300 es
precision highp float;

layout(location = 0) in vec3 position;
layout(location = 1) in vec3 aColor;
layout(location = 2) in vec4 aParams;   // size, opacity, twinklePhase, spike

uniform mat4 uModelView;
uniform mat4 uProjection;
uniform float uTime;
uniform float uTwinkle;     // 1 = atmospheric scintillation
uniform float uFade;
uniform float uSizeScale;
uniform float uPx;

out vec3 vColor;
out float vOpacity;
out float vSpike;

void main() {
  vColor = aColor;
  float aSize = aParams.x;
  float opacity = aParams.y;
  float phase = aParams.z;
  vSpike = aParams.w;

  // Two incommensurate frequencies so the flicker never visibly repeats.
  // Brighter stars twinkle less, as in a real sky.
  if (uTwinkle > 0.5) {
    float rate = 0.9 + fract(phase * 0.37) * 2.2;
    float s1 = sin(uTime * rate + phase);
    float s2 = sin(uTime * rate * 2.718 + phase * 1.618);
    float scint = 0.5 + 0.5 * (0.65 * s1 + 0.35 * s2);
    float amp = mix(0.5, 0.1, smoothstep(0.4, 1.4, aSize));
    opacity *= (1.0 - amp) + amp * scint;
  }
  vOpacity = opacity * uFade;

  vec4 mvPosition = uModelView * vec4(position, 1.0);
  float depth = max(-mvPosition.z, 0.05);
  // Spiked stars get a larger sprite so the glint has room to draw.
  float spikeRoom = 1.0 + vSpike * 3.0;
  gl_PointSize = clamp(aSize * (50.0 / depth) * spikeRoom, 1.2, 96.0) * uSizeScale * uPx;
  gl_Position = uProjection * mvPosition;
}
`;

export const POINTS_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec3 vColor;
in float vOpacity;
in float vSpike;

uniform float uGain;

out vec4 fragColor;

void main() {
  vec2 pc = gl_PointCoord - 0.5;
  float spikeRoom = 1.0 + vSpike * 3.0;
  float dist = length(pc) * spikeRoom;

  // Star glow: white-hot core, long soft falloff.
  float strength = clamp(0.05 / max(dist, 0.001) - 0.1, 0.0, 1.0);

  if (vSpike > 0.5) {
    // Four-point diffraction glint, fading toward the sprite edge.
    vec2 a = abs(pc);
    float reach = smoothstep(0.5, 0.0, max(a.x, a.y));
    float glint = exp(-min(a.x, a.y) * 60.0) * reach * reach * reach;
    strength = max(strength, glint * 0.4);
  }

  float alpha = strength * vOpacity * uGain;
  if (alpha <= 0.0004) discard;
  fragColor = vec4(vColor * alpha, alpha);
}
`;

// ─── Full-screen passes ──────────────────────────────────────────────────────

export const FULLSCREEN_VERT = /* glsl */ `#version 300 es
precision highp float;

out vec2 vUv;

void main() {
  // One oversized triangle covering the viewport.
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

/** Multiplies the trail buffer by a constant so old light fades away. */
export const FADE_FRAG = /* glsl */ `#version 300 es
precision highp float;

uniform float uDecay;
out vec4 fragColor;

void main() {
  fragColor = vec4(uDecay);
}
`;

/** 4-tap box downsample: the first step of the bloom chain. */
export const DOWNSAMPLE_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;
uniform sampler2D uSource;
uniform vec2 uTexel;
out vec4 fragColor;

void main() {
  vec4 c = texture(uSource, vUv + uTexel * vec2(-1.0, -1.0))
    + texture(uSource, vUv + uTexel * vec2(1.0, -1.0))
    + texture(uSource, vUv + uTexel * vec2(-1.0, 1.0))
    + texture(uSource, vUv + uTexel * vec2(1.0, 1.0));
  fragColor = c * 0.25;
}
`;

/** Separable 9-tap Gaussian using bilinear taps. */
export const BLUR_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;
uniform sampler2D uSource;
uniform vec2 uStep;
out vec4 fragColor;

void main() {
  vec4 c = texture(uSource, vUv) * 0.227027;
  c += (texture(uSource, vUv + uStep * 1.384615) + texture(uSource, vUv - uStep * 1.384615)) * 0.316216;
  c += (texture(uSource, vUv + uStep * 3.230769) + texture(uSource, vUv - uStep * 3.230769)) * 0.070270;
  fragColor = c;
}
`;

/** Slow fbm clouds in two colour families, rendered small and upscaled. */
export const NEBULA_FRAG = /* glsl */ `#version 300 es
precision highp float;
${NOISE}

in vec2 vUv;

uniform float uTime;
uniform float uAspect;
uniform vec2 uDrift;       // parallax from scroll + pointer
uniform vec3 uCoolA;
uniform vec3 uCoolB;
uniform vec3 uWarmA;
uniform vec3 uWarmB;
uniform float uOpacity;
uniform float uDetail;     // 0 on phones: fewer octaves
uniform float uSaturation;

out vec4 fragColor;

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * snoise(p);
    p *= 2.1;
    a *= 0.5;
    if (uDetail < 0.5 && i == 1) break;
  }
  return v;
}

float blob(vec2 p, vec2 c, float r) {
  vec2 d = (p - c) / r;
  return exp(-dot(d, d));
}

void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) + uDrift;

  // Warp the domain with a slower field so the clouds pull into filaments
  // instead of sitting as round puffs.
  vec2 warp = vec2(
    snoise(vec3(p * 0.9 + vec2(1.7, 9.2), uTime * 0.02)),
    snoise(vec3(p * 0.9 + vec2(8.3, 2.8), uTime * 0.017 + 4.0))
  );

  // Density fields at two scales, each drifting on its own slow clock.
  float cool = fbm(vec3(p * 0.95 + warp * 0.6 + vec2(3.1, 7.7), uTime * 0.03));
  float warm = fbm(vec3(p * 1.3 - warp * 0.55 + vec2(-5.2, 1.3), uTime * 0.035 + 11.0));
  float mixer = snoise(vec3(p * 1.1 + warp * 0.3 + vec2(9.4, -2.8), uTime * 0.05 + 23.0));

  float coolDensity = pow(smoothstep(-0.35, 0.75, cool), 1.5);
  float warmDensity = pow(smoothstep(-0.3, 0.8, warm), 1.5);

  // Where the clouds gather: broad soft regions, never a hard edge.
  vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
  float coolMask = blob(q, vec2(0.52, 0.12), 0.72) + 0.75 * blob(q, vec2(-0.78, -0.34), 0.62)
    + 0.5 * blob(q, vec2(0.1, 0.46), 0.5);
  float warmMask = blob(q, vec2(-0.3, 0.24), 0.66) + 0.9 * blob(q, vec2(0.74, -0.3), 0.52)
    + 0.45 * blob(q, vec2(-0.05, -0.5), 0.45);

  vec3 coolColor = mix(uCoolA, uCoolB, clamp(0.5 + 0.9 * mixer, 0.0, 1.0));
  vec3 warmColor = mix(uWarmA, uWarmB, clamp(0.5 - 0.9 * mixer, 0.0, 1.0));

  float coolAlpha = coolDensity * coolMask * 0.5;
  float warmAlpha = warmDensity * warmMask * 0.46;

  float alpha = (coolAlpha + warmAlpha) * uOpacity;
  vec3 color = (coolColor * coolAlpha + warmColor * warmAlpha) * uOpacity;
  // Pastel theme colours go grey at low intensity; push them back toward hue.
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color = max(mix(vec3(luma), color, uSaturation), 0.0);
  fragColor = vec4(color, alpha);
}
`;

/** Trail buffer + nebula → the page, as glow on dark themes or ink on light. */
export const COMPOSITE_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;

uniform sampler2D uTrail;
uniform sampler2D uNebula;
uniform sampler2D uBloom;
uniform float uBloomGain;
uniform float uLight;      // 1 on light themes
uniform float uExposure;
uniform float uSeed;

out vec4 fragColor;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec4 trail = texture(uTrail, vUv);
  vec4 nebula = texture(uNebula, vUv);
  float grain = hash(gl_FragCoord.xy + uSeed) - 0.5;

  if (uLight > 0.5) {
    // Ink: accumulated density becomes opacity, washed over watercolour clouds.
    float density = trail.a * uExposure;
    vec3 pigment = trail.rgb / max(trail.a, 0.0001);
    float inkAlpha = 1.0 - exp(-density * 1.6);
    vec4 ink = vec4(pigment * inkAlpha, inkAlpha);
    float washAlpha = clamp(nebula.a, 0.0, 0.5);
    vec3 washColor = nebula.rgb / max(nebula.a, 0.0001);
    vec4 wash = vec4(washColor * washAlpha, washAlpha);
    vec4 result = ink + wash * (1.0 - ink.a);
    result.rgb += grain * (1.5 / 255.0) * result.a;
    fragColor = result;
    return;
  }

  // Glow: soft shoulder so dense dust blooms toward white instead of clipping.
  vec3 bloom = texture(uBloom, vUv).rgb;
  vec3 glow = (trail.rgb + bloom * uBloomGain) * uExposure + nebula.rgb;
  // Compress brightness, not each channel, so dense dust keeps its hue and
  // only the very brightest cores bleed toward white.
  float energy = max(glow.r, max(glow.g, glow.b));
  float mapped = 1.0 - exp(-energy * 1.25);
  glow *= mapped / max(energy, 0.0001);
  glow = mix(glow, vec3(mapped), smoothstep(1.2, 4.0, energy) * 0.55);
  float peak = mapped;
  glow += grain * (1.6 / 255.0) * smoothstep(0.0, 0.02, peak);
  // Mostly additive, with a touch of cover so colours hold on the base tone.
  fragColor = vec4(max(glow, 0.0), clamp(peak * 0.55, 0.0, 1.0));
}
`;
