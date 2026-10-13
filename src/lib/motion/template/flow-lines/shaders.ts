export const STRAND = { grow: 0.42, fade: 0.2, points: 56 };

const glsl = (x: number) => x.toFixed(4);

const SIMPLEX_4D = `
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
float mod289(float x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
float permute(float x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float taylorInvSqrt(float r) { return 1.79284291400159 - 0.85373472095314 * r; }

vec4 grad4(float j, vec4 ip) {
  const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
  vec4 p;
  p.xyz = floor(fract(vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
  p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
  vec4 s = vec4(lessThan(p, vec4(0.0)));
  p.xyz = p.xyz + (s.xyz * 2.0 - 1.0) * s.www;
  return p;
}

float snoise(vec4 v) {
  const vec4 C = vec4(0.138196601125011, 0.276393202250021, 0.414589803375032, -0.447213595499958);
  const float F4 = 0.309016994374947451;
  vec4 i = floor(v + dot(v, vec4(F4)));
  vec4 x0 = v - i + dot(i, C.xxxx);
  vec4 i0;
  vec3 isX = step(x0.yzw, x0.xxx);
  vec3 isYZ = step(x0.zww, x0.yyz);
  i0.x = isX.x + isX.y + isX.z;
  i0.yzw = 1.0 - isX;
  i0.y += isYZ.x + isYZ.y;
  i0.zw += 1.0 - isYZ.xy;
  i0.z += isYZ.z;
  i0.w += 1.0 - isYZ.z;
  vec4 i3 = clamp(i0, 0.0, 1.0);
  vec4 i2 = clamp(i0 - 1.0, 0.0, 1.0);
  vec4 i1 = clamp(i0 - 2.0, 0.0, 1.0);
  vec4 x1 = x0 - i1 + C.xxxx;
  vec4 x2 = x0 - i2 + C.yyyy;
  vec4 x3 = x0 - i3 + C.zzzz;
  vec4 x4 = x0 + C.wwww;
  i = mod289(i);
  float j0 = permute(permute(permute(permute(i.w) + i.z) + i.y) + i.x);
  vec4 j1 = permute(permute(permute(permute(i.w + vec4(i1.w, i2.w, i3.w, 1.0)) + i.z + vec4(i1.z, i2.z, i3.z, 1.0)) + i.y + vec4(i1.y, i2.y, i3.y, 1.0)) + i.x + vec4(i1.x, i2.x, i3.x, 1.0));
  vec4 ip = vec4(1.0 / 294.0, 1.0 / 49.0, 1.0 / 7.0, 0.0);
  vec4 p0 = grad4(j0, ip);
  vec4 p1 = grad4(j1.x, ip);
  vec4 p2 = grad4(j1.y, ip);
  vec4 p3 = grad4(j1.z, ip);
  vec4 p4 = grad4(j1.w, ip);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  p4 *= taylorInvSqrt(dot(p4, p4));
  vec3 m0 = max(0.6 - vec3(dot(x0, x0), dot(x1, x1), dot(x2, x2)), 0.0);
  vec2 m1 = max(0.6 - vec2(dot(x3, x3), dot(x4, x4)), 0.0);
  m0 = m0 * m0;
  m1 = m1 * m1;
  return 49.0 * (dot(m0 * m0, vec3(dot(p0, x0), dot(p1, x1), dot(p2, x2))) + dot(m1 * m1, vec2(dot(p3, x3), dot(p4, x4))));
}
`;

export const QUAD_VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const FIELD_FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform vec2 uSpan;
uniform vec2 uOrbit;
uniform float uFrequency;
uniform float uOctave;
uniform float uRadius;
${SIMPLEX_4D}

float potential(vec2 p) {
  vec2 q = p / uRadius;
  vec4 a = vec4(q * uFrequency, uOrbit * 0.24);
  vec4 b = vec4(q * uFrequency * 2.3 + 7.1, uOrbit.yx * 0.32 + 3.3);
  float hold = 0.12 * dot(q, q);
  return snoise(a) + uOctave * 0.5 * snoise(b) + hold;
}

void main() {
  vec2 p = (vUv - 0.5) * uSpan;
  float e = 0.004;
  float dx = potential(p + vec2(e, 0.0)) - potential(p - vec2(e, 0.0));
  float dy = potential(p + vec2(0.0, e)) - potential(p - vec2(0.0, e));
  vec2 v = vec2(dy, -dx) / (2.0 * e);
  gl_FragColor = vec4(normalize(v + 1e-6) * 0.5 + 0.5, 0.0, 1.0);
}
`;

export const STRAND_VERTEX = `
precision highp float;
uniform sampler2D uField;
uniform vec2 uSpan;
uniform vec2 uPixels;
uniform float uRadius;
uniform float uStepLength;
uniform float uPhase;
uniform float uWidth;
attribute vec2 corner;
attribute vec3 seed;
varying float vAlpha;
varying float vSide;

const int POINTS = ${STRAND.points};
const float GROW = ${glsl(STRAND.grow)};
const float FADE = ${glsl(STRAND.fade)};

float smoothish(float x) {
  x = clamp(x, 0.0, 1.0);
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

vec2 heading(vec2 p) {
  vec2 v = textureLod(uField, p / uSpan + 0.5, 0.0).xy * 2.0 - 1.0;
  return v / max(length(v), 1e-5);
}

void main() {
  float life = fract(seed.z + uPhase);
  float head = smoothish(life / GROW);
  float tail = min(head, smoothish((life - 1.0 + GROW) / GROW));
  float fade = smoothish(life / FADE) * (1.0 - smoothish((life - 1.0 + FADE) / FADE));
  float along = corner.x / float(POINTS - 1);
  float steps = mix(tail, head, along) * float(POINTS);
  vec2 p = seed.xy * uRadius;
  vec2 d = heading(p);
  for (int i = 0; i < POINTS; i++) {
    float h = clamp(steps - float(i), 0.0, 1.0);
    vec2 mid = p + d * uStepLength * h * 0.5;
    vec2 turn = heading(mid);
    p += turn * uStepLength * h;
    d = mix(d, heading(p), step(1e-4, h));
  }
  vec2 ndc = 2.0 * p / uSpan + vec2(-d.y, d.x) * corner.y * uWidth * 2.0 / uPixels;
  vAlpha = fade * sqrt(sin(3.14159265 * along)) * step(1e-4, head - tail);
  vSide = corner.y;
  gl_Position = vec4(ndc, 0.0, 1.0);
}
`;

export const STRAND_FRAGMENT = `
precision highp float;
uniform vec3 uLine;
uniform float uStrength;
uniform float uVeil;
varying float vAlpha;
varying float vSide;

void main() {
  float edge = 1.0 - abs(vSide);
  float a = vAlpha * edge * edge * uStrength * (1.0 - uVeil);
  gl_FragColor = vec4(uLine, a);
}
`;
