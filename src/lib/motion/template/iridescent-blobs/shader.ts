const MAX_BLOBS = 10;
const MAX_BUBBLES = 176;

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
uniform vec4 uBlobs[${MAX_BLOBS}];
uniform vec4 uBubbles[${MAX_BUBBLES}];
uniform int uBubbleCount;
uniform float uPhase;
uniform float uYaw;
uniform float uPitch;
uniform float uSeed;
uniform float uGlitter;
uniform float uDim;
uniform vec3 uBg;
uniform vec3 uBody;
uniform vec3 uSheen;
uniform vec3 uRim;
uniform vec3 uGlow;

const float CAMERA_DISTANCE = 3.0;
const float FOCAL = 3.0;
const float BLEND = 0.13;
const int STEPS = 72;
const vec3 LIGHT = vec3(-0.45, 0.62, 0.64);

float hash31(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973) + uSeed);
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}

vec3 hash33(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dot(hash33(i), f), dot(hash33(i + vec3(1, 0, 0)), f - vec3(1, 0, 0)), u.x),
                 mix(dot(hash33(i + vec3(0, 1, 0)), f - vec3(0, 1, 0)), dot(hash33(i + vec3(1, 1, 0)), f - vec3(1, 1, 0)), u.x), u.y),
             mix(mix(dot(hash33(i + vec3(0, 0, 1)), f - vec3(0, 0, 1)), dot(hash33(i + vec3(1, 0, 1)), f - vec3(1, 0, 1)), u.x),
                 mix(dot(hash33(i + vec3(0, 1, 1)), f - vec3(0, 1, 1)), dot(hash33(i + vec3(1, 1, 1)), f - vec3(1, 1, 1)), u.x), u.y), u.z);
}

vec3 drifting(vec3 p, float radius) {
  return p + vec3(cos(uPhase), sin(uPhase), 0.0) * radius + uSeed;
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float mass(vec3 p) {
  float d = 10.0;
  for (int i = 0; i < ${MAX_BLOBS}; i++) {
    vec4 b = uBlobs[i];
    d = smin(d, length(p - b.xyz) - b.w, BLEND);
  }
  return d + 0.022 * noise3(drifting(p * 5.0, 0.8));
}

vec3 normalAt(vec3 p) {
  vec2 e = vec2(0.0025, -0.0025);
  return normalize(e.xyy * mass(p + e.xyy) + e.yyx * mass(p + e.yyx) + e.yxy * mass(p + e.yxy) + e.xxx * mass(p + e.xxx));
}

float occlusion(vec3 p, vec3 n) {
  float occ = 0.0;
  float weight = 1.0;
  for (int i = 1; i <= 4; i++) {
    float h = 0.025 * float(i);
    occ += (h - mass(p + n * h)) * weight;
    weight *= 0.7;
  }
  return clamp(1.0 - occ * 7.0, 0.0, 1.0);
}

mat3 orbit() {
  float cy = cos(uYaw), sy = sin(uYaw), cp = cos(uPitch), sp = sin(uPitch);
  mat3 yaw = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
  mat3 pitch = mat3(1.0, 0.0, 0.0, 0.0, cp, sp, 0.0, -sp, cp);
  return yaw * pitch;
}

float sphereHit(vec3 ro, vec3 rd, vec4 s) {
  vec3 oc = ro - s.xyz;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - s.w * s.w;
  float h = b * b - c;
  return h < 0.0 ? -1.0 : -b - sqrt(h);
}

vec3 pearlOf(vec3 n, vec3 p) {
  float hue = 0.5 + 0.5 * sin(n.x * 3.5 + n.y * 2.5 + noise3(drifting(p * 2.2, 0.4) + 31.0) * 3.5);
  vec3 cyan = vec3(uBody.r * 0.6, min(1.0, uBody.g * 1.12), uBody.b);
  return mix(mix(cyan, uBody, smoothstep(0.0, 0.55, hue)), uSheen, smoothstep(0.5, 1.0, hue) * 0.85);
}

void main() {
  vec2 px = gl_FragCoord.xy;
  float unit = min(uRes.x, uRes.y);
  vec2 s = (px - 0.5 * uRes) / unit;
  vec2 m = uPortrait > 0.5 ? s : s.yx;
  mat3 rot = orbit();
  vec3 ro = rot * vec3(0.0, 0.0, CAMERA_DISTANCE);
  vec3 rd = rot * normalize(vec3(m, -FOCAL));

  float t = CAMERA_DISTANCE - 0.7;
  float closest = 10.0;
  float hit = -1.0;
  for (int i = 0; i < STEPS; i++) {
    float d = mass(ro + rd * t);
    closest = min(closest, d);
    if (d < 0.0008) {
      hit = t;
      break;
    }
    t += d * 0.85;
    if (t > CAMERA_DISTANCE + 0.7) {
      break;
    }
  }

  float bubbleT = 1e3;
  vec4 bubble = vec4(0.0);
  for (int i = 0; i < ${MAX_BUBBLES}; i++) {
    if (i >= uBubbleCount) {
      break;
    }
    float tb = sphereHit(ro, rd, uBubbles[i]);
    if (tb > 0.0 && tb < bubbleT) {
      bubbleT = tb;
      bubble = uBubbles[i];
    }
  }

  vec3 light = normalize(LIGHT);
  vec3 col = uBg + uRim * exp(-max(closest, 0.0) * 55.0) * 0.28;

  if (hit > 0.0 && hit < bubbleT) {
    vec3 p = ro + rd * hit;
    vec3 n = normalAt(p);
    vec3 v = -rd;
    float facing = clamp(dot(n, v), 0.0, 1.0);
    float fres = pow(1.0 - facing, 2.2);
    float diff = clamp(dot(n, light) * 0.5 + 0.5, 0.0, 1.0);
    vec3 h = normalize(light + v);
    float spec = pow(clamp(dot(n, h), 0.0, 1.0), 60.0) * 0.55 + pow(clamp(dot(n, h), 0.0, 1.0), 9.0) * 0.12;
    float ao = occlusion(p, n);
    float thick = clamp(-mass(p - n * 0.07) / 0.07, 0.0, 1.0);

    float near = 0.0;
    float shadow = 0.0;
    for (int i = 0; i < ${MAX_BUBBLES}; i++) {
      if (i >= uBubbleCount) {
        break;
      }
      vec4 b = uBubbles[i];
      float gap = max(length(p - b.xyz) - b.w, 0.0);
      near += exp(-gap / (b.w * 1.6 + 0.012)) * smoothstep(0.004, 0.03, b.w);
      shadow = max(shadow, exp(-gap / (b.w * 0.35 + 0.003)));
    }
    near = clamp(near * 0.6, 0.0, 1.0);

    vec3 pearl = pearlOf(n, p);
    col = pearl * (0.38 + 0.62 * diff) * mix(0.42, 1.0, ao);
    col += pearl * (1.0 - thick) * 0.25;
    col = mix(col, uGlow * (0.5 + 0.5 * diff), near * 0.6 * ao);
    col *= 1.0 - shadow * 0.6;
    col = mix(col, uRim * (0.9 + 0.4 * diff), clamp(fres * 1.25, 0.0, 1.0) * 0.9);
    col += vec3(1.0, 0.97, 1.0) * spec * ao;

    vec3 cell = p * 170.0;
    vec3 id = floor(cell);
    float pick = hash31(id);
    float dotSize = length(fract(cell) - 0.5);
    float twinkle = 0.5 + 0.5 * sin(uPhase * floor(1.0 + pick * 3.0) + pick * 40.0);
    float sparkle = step(1.0 - 0.12 * uGlitter, pick) * smoothstep(0.3, 0.05, dotSize) * twinkle * facing;
    vec3 tint = mix(vec3(1.0, 0.97, 0.85), uGlow + 0.35, step(0.5, hash31(id + 1.3)));
    col += tint * sparkle * 1.2;
  } else if (bubbleT < 1e2) {
    vec3 p = ro + rd * bubbleT;
    vec3 n = normalize(p - bubble.xyz);
    vec3 v = -rd;
    float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 3.0);
    float glint = pow(clamp(dot(reflect(-light, n), v), 0.0, 1.0), 90.0);
    float sheen = pow(clamp(dot(reflect(-light, n), v), 0.0, 1.0), 12.0);
    col = uBg * 0.5 + 0.015 + uGlow * fres * 0.16 + uBody * fres * 0.18 + vec3(glint) * 0.9 + vec3(sheen) * 0.05;
  }

  float vignette = 1.0 - 0.25 * smoothstep(0.35, 1.1, length(s));
  col *= vignette * (1.0 - uDim);
  col += (hash31(vec3(px, 0.5)) - 0.5) / 255.0;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export const BLOBS_SHADER = String.raw`
const MAX_BLOB_UNIFORMS = ${MAX_BLOBS};
const MAX_BUBBLE_UNIFORMS = ${MAX_BUBBLES};
const BLOBS_VERTEX = ${JSON.stringify(VERTEX.trim())};
const BLOBS_FRAGMENT = ${JSON.stringify(FRAGMENT.trim())};
`;
