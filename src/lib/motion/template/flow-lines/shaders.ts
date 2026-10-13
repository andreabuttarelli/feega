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
  vec4 a = vec4(p * uFrequency, uOrbit * 0.38);
  vec4 b = vec4(p * uFrequency * 2.3 + 7.1, uOrbit.yx * 0.55 + 3.3);
  float r = length(p) / uRadius;
  float hold = 0.2 * r * r;
  return snoise(a) + uOctave * 0.5 * snoise(b) + hold;
}

void main() {
  vec2 p = (vUv - 0.5) * uSpan;
  float e = 0.004;
  float dx = potential(p + vec2(e, 0.0)) - potential(p - vec2(e, 0.0));
  float dy = potential(p + vec2(0.0, e)) - potential(p - vec2(0.0, e));
  vec2 v = vec2(dy, -dx) / (2.0 * e);
  gl_FragColor = vec4(v, potential(p), 1.0);
}
`;

export const LINES_FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uField;
uniform sampler2D uNoise;
uniform vec2 uSpan;
uniform vec2 uPixels;
uniform float uNoiseSize;
uniform float uStep;
uniform float uPhase;
uniform float uSparsity;
uniform float uRadius;
uniform float uVeil;
uniform float uGain;
uniform vec3 uLine;
uniform vec3 uBackground;

const int STEPS = 26;
const float TAU = 6.28318530718;
const float PI = 3.14159265;
const float RIBBONS = 17.0;

float roundMass(vec2 uv, float wobble) {
  float r = length((uv - 0.5) * uSpan) / uRadius + wobble;
  return 1.0 - smoothstep(0.7, 1.12, r);
}

float strand(vec2 uv) {
  return pow(texture2D(uNoise, uv * uPixels / uNoiseSize).r, uSparsity);
}

void main() {
  vec2 toUv = uStep / uPixels;
  float total = 0.0;
  float weight = 0.0;
  for (int side = 0; side < 2; side++) {
    vec2 uv = vUv;
    float heading = side == 0 ? 1.0 : -1.0;
    for (int i = 0; i < STEPS; i++) {
      float s = float(i) / float(STEPS);
      float w = (0.5 + 0.5 * cos(PI * s)) * (0.6 + 0.4 * cos(TAU * (heading * s * 0.5 - uPhase)));
      total += strand(uv) * roundMass(uv, 0.0) * w;
      weight += w;
      vec2 v = texture2D(uField, uv).xy;
      uv += heading * v / max(length(v), 1e-5) * toUv;
    }
  }
  float lic = total / max(weight, 1e-5) * (uSparsity + 1.0);
  vec4 f = texture2D(uField, vUv);
  float speed = smoothstep(0.1, 2.6, length(f.xy));
  float ribbon = pow(0.5 + 0.5 * cos(f.z * RIBBONS), 6.0);
  float glow = (0.12 + 2.2 * ribbon * (0.55 + 0.45 * speed) + 0.45 * speed * speed) * roundMass(vUv, 0.1 * f.z);
  float ink = (1.0 - exp(-lic * glow * uGain)) * (1.0 - uVeil);
  gl_FragColor = vec4(mix(uBackground, uLine, ink), 1.0);
}
`;
