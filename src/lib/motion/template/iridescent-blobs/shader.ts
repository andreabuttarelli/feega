const MAX_BLOBS = 10;
const MAX_BUBBLES = 64;

const VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uPortrait;
uniform vec3 uBlobs[${MAX_BLOBS}];
uniform vec3 uBubbles[${MAX_BUBBLES}];
uniform int uBubbleCount;
uniform float uPhase;
uniform float uSeed;
uniform float uGlitter;
uniform float uDim;
uniform vec3 uBg;
uniform vec3 uBody;
uniform vec3 uSheen;
uniform vec3 uRim;
uniform vec3 uGlow;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32 + uSeed);
  return fract(p.x * p.y);
}

vec3 hash33(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(mix(dot(hash33(i), f), dot(hash33(i + vec3(1, 0, 0)), f - vec3(1, 0, 0)), u.x),
                 mix(dot(hash33(i + vec3(0, 1, 0)), f - vec3(0, 1, 0)), dot(hash33(i + vec3(1, 1, 0)), f - vec3(1, 1, 0)), u.x), u.y),
             mix(mix(dot(hash33(i + vec3(0, 0, 1)), f - vec3(0, 0, 1)), dot(hash33(i + vec3(1, 0, 1)), f - vec3(1, 0, 1)), u.x),
                 mix(dot(hash33(i + vec3(0, 1, 1)), f - vec3(0, 1, 1)), dot(hash33(i + vec3(1, 1, 1)), f - vec3(1, 1, 1)), u.x), u.y), u.z);
}

vec3 loopNoise(vec2 p, float radius, float seed) {
  vec2 ring = vec2(cos(uPhase), sin(uPhase)) * radius;
  return vec3(p + ring, seed);
}

vec2 warp(vec2 m) {
  vec2 a = vec2(noise3(loopNoise(m * 2.1, 0.55, 1.7 + uSeed)), noise3(loopNoise(m * 2.1 + 9.0, 0.55, 4.3 + uSeed)));
  return m + a * 0.055;
}

float field(vec2 m) {
  vec2 w = warp(m);
  float f = 0.0;
  for (int i = 0; i < ${MAX_BLOBS}; i++) {
    vec3 b = uBlobs[i];
    vec2 d = w - b.xy;
    float k = (b.z * b.z) / (dot(d, d) + 0.0004);
    f += k * k;
  }
  return f;
}

float lumps(vec2 m) {
  return noise3(loopNoise(m * 5.5, 0.9, 11.0 + uSeed)) * 0.55 + noise3(loopNoise(m * 11.0, 1.3, 23.0 + uSeed)) * 0.2;
}

float height(vec2 m) {
  float f = field(m);
  float dome = sqrt(1.0 - exp(-max(f - 1.0, 0.0) * 0.9));
  return dome + lumps(m) * 0.22 * smoothstep(1.0, 3.0, f);
}

void main() {
  vec2 px = gl_FragCoord.xy;
  float unit = min(uRes.x, uRes.y);
  vec2 s = (px - 0.5 * uRes) / unit;
  s.y = -s.y;
  vec2 m = uPortrait > 0.5 ? s : s.yx;
  float pixel = 1.0 / unit;

  float f = field(m);
  float aa = max(fwidth(f), 1e-4);
  float inside = smoothstep(1.0 - aa, 1.0 + aa, f);

  float e = 2.5 * pixel;
  float h = height(m);
  vec2 grad = vec2(height(m + vec2(e, 0.0)) - h, height(m + vec2(0.0, e)) - h) / e;
  vec3 n = normalize(vec3(-grad * 0.11, 1.0));
  float facing = clamp(n.z, 0.0, 1.0);
  float fres = pow(1.0 - facing, 1.6);

  vec3 light = normalize(vec3(-0.45, 0.6, 0.66));
  float diff = clamp(dot(n, light) * 0.5 + 0.5, 0.0, 1.0);
  float spec = pow(clamp(dot(reflect(-light, n), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 18.0);

  float hue = 0.5 + 0.5 * sin(n.x * 4.0 + n.y * 3.0 + noise3(loopNoise(m * 1.4, 0.4, 31.0 + uSeed)) * 3.5);
  vec3 cyan = mix(uBody, vec3(uBody.r * 0.6, min(1.0, uBody.g * 1.12), uBody.b), 0.6);
  vec3 pearl = mix(mix(cyan, uBody, smoothstep(0.0, 0.55, hue)), uSheen, smoothstep(0.55, 1.0, hue) * 0.85);
  vec3 col = pearl * (0.42 + 0.7 * diff);
  col += vec3(1.0, 0.97, 1.0) * spec * 0.45;

  float near = 0.0;
  float shadow = 0.0;
  vec4 bubble = vec4(0.0);
  vec2 w = warp(m) * 0.35 + m * 0.65;
  for (int i = 0; i < ${MAX_BUBBLES}; i++) {
    if (i >= uBubbleCount) {
      break;
    }
    vec3 b = uBubbles[i];
    float d = length(w - b.xy);
    near += exp(-pow(max(d - b.z, 0.0) / (b.z * 2.6 + 0.02), 2.0)) * smoothstep(0.0, 0.05, b.z);
    shadow = max(shadow, exp(-max(d - b.z, 0.0) / (b.z * 0.45 + 0.004)));
    float cover = smoothstep(b.z + pixel, b.z - pixel, d);
    if (cover > bubble.a) {
      vec2 q = (w - b.xy) / b.z;
      vec3 bn = normalize(vec3(q, sqrt(max(1.0 - dot(q, q), 0.0))));
      float rim = pow(1.0 - bn.z, 3.0);
      float glint = pow(clamp(dot(reflect(-light, bn), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 40.0);
      vec3 inner = uBg * 0.6 + uGlow * rim * 0.22 + cyan * rim * 0.12 + vec3(glint) * 0.35;
      bubble = vec4(inner, cover);
    }
  }
  near = clamp(near, 0.0, 1.0);

  float edgeGlow = smoothstep(1.2, 2.2, f) * (1.0 - smoothstep(2.5, 6.0, f));
  float drift = smoothstep(-0.1, 0.45, noise3(loopNoise(m * 1.6, 0.5, 47.0 + uSeed)));
  float green = clamp(near * 0.9 + edgeGlow * drift * 0.55, 0.0, 1.0);
  col = mix(col, uGlow * (0.55 + 0.45 * diff), green * 0.55);
  col *= 1.0 - shadow * 0.55;

  float rimBand = smoothstep(1.45, 1.0, f);
  col = mix(col, uRim * (0.85 + 0.4 * diff), clamp(pow(fres, 1.4) * 0.8 + rimBand * 0.7, 0.0, 1.0) * 0.9);
  col += uRim * pow(rimBand, 3.0) * 0.25;

  vec2 cell = m * 260.0;
  vec2 id = floor(cell);
  float pick = hash21(id);
  vec2 dot2 = fract(cell) - (0.2 + 0.6 * vec2(hash21(id + 3.1), hash21(id + 7.7)));
  float twinkle = 0.5 + 0.5 * sin(uPhase * floor(1.0 + pick * 3.0) + pick * 40.0);
  float sparkle = step(1.0 - 0.14 * uGlitter, pick) * smoothstep(0.22, 0.0, length(dot2)) * twinkle;
  vec3 tint = mix(vec3(1.0, 0.98, 0.85), uGlow + 0.35, step(0.5, hash21(id + 1.3)));
  col += tint * sparkle * 1.3 * smoothstep(1.2, 2.0, f);

  col = mix(col, bubble.rgb, bubble.a * smoothstep(0.55, 1.0, f));

  float halo = exp(-max(1.0 - f, 0.0) * 9.0) * (1.0 - inside);
  vec3 bg = uBg + uRim * halo * 0.22;
  vec3 outCol = mix(bg, col, inside);

  float vignette = 1.0 - 0.25 * smoothstep(0.35, 1.1, length(s));
  outCol *= vignette * (1.0 - uDim);
  outCol += (hash21(px + 0.5) - 0.5) / 255.0;
  gl_FragColor = vec4(clamp(outCol, 0.0, 1.0), 1.0);
}
`;

export const BLOBS_SHADER = String.raw`
const MAX_BLOB_UNIFORMS = ${MAX_BLOBS};
const MAX_BUBBLE_UNIFORMS = ${MAX_BUBBLES};
const BLOBS_VERTEX = ${JSON.stringify(VERTEX.trim())};
const BLOBS_FRAGMENT = ${JSON.stringify(FRAGMENT.trim())};
`;
