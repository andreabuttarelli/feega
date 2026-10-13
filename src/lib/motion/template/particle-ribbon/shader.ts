export const RIBBON_VERTEX = `
attribute vec3 seed;
uniform float uPhase;
uniform float uFold;
uniform float uSway;
uniform float uTwist;
uniform float uDust;
uniform float uSize;
uniform vec3 uStops[4];
varying vec3 vColor;
varying float vAlpha;

const float PI = 3.14159265;

vec3 flow(vec3 p, float ph) {
  return vec3(
    sin(p.y * 1.7 + ph) + sin(p.z * 2.3 - ph),
    sin(p.z * 1.9 + ph) + sin(p.x * 2.1 + ph),
    sin(p.x * 1.5 - ph) + sin(p.y * 2.7 + ph)
  );
}

vec3 sheet(float u, float v) {
  float s = u * 2.0 - 1.0;
  vec3 spine = vec3(0.3 * sin(s * 2.4 + uSway), s * 1.25, 0.3 * cos(s * 1.8 + uPhase));
  float width = 0.9 * (0.1 + 0.9 * pow(sin(PI * u), 0.9)) * (1.0 + 0.22 * sin(s * 3.1 - uPhase));
  float turn = uTwist * s + 0.7 * sin(uPhase + s * 1.4);
  float bend = 0.4 + 2.2 * uFold * (0.6 + 0.4 * sin(s * 2.6 - uPhase));
  vec2 arc = vec2(sin(v * bend) / bend, (1.0 - cos(v * bend)) / bend);
  vec3 across = vec3(arc.x * cos(turn) - arc.y * sin(turn), 0.55 * arc.x * sin(turn + 0.8), arc.x * sin(turn) + arc.y * cos(turn));
  vec3 p = spine + width * across;
  return p + 0.07 * flow(p * 1.3, uPhase);
}

vec3 gradient(float g) {
  float x = clamp(g, 0.0, 1.0) * 3.0;
  if (x < 1.0) { return mix(uStops[0], uStops[1], x); }
  if (x < 2.0) { return mix(uStops[1], uStops[2], x - 1.0); }
  return mix(uStops[2], uStops[3], x - 2.0);
}

void main() {
  float u = position.x;
  float v = position.y * 2.0 - 1.0;
  float e = 0.004;
  vec3 p = sheet(u, v);
  vec3 n = normalize(cross(sheet(u + e, v) - p, sheet(u, v + e) - p));

  float tip = smoothstep(0.7, 1.0, abs(u * 2.0 - 1.0));
  float rim = smoothstep(0.7, 1.0, abs(v));
  float loose = max(tip * tip, 0.5 * rim * rim) * uDust;
  vec3 scatter = normalize(seed - 0.5 + 1e-4) * (0.25 + seed.x);
  p += n * (position.z - 0.5) * 0.035;
  p += loose * (0.16 * scatter + 0.08 * flow(p * 3.0 + seed * 6.0, uPhase + seed.y * 2.0 * PI));

  vec4 view = modelViewMatrix * vec4(p, 1.0);
  vec3 toEye = normalize(-view.xyz);
  float facing = abs(dot(normalize(normalMatrix * n), toEye));

  vec3 color = gradient(1.12 * u - 0.06 + 0.1 * v + 0.08 * (seed.z - 0.5));
  vColor = color * mix(0.5, 1.0, sqrt(facing));
  vAlpha = (0.85 + 0.15 * seed.y) * (1.0 - 0.85 * loose / max(uDust, 1e-3) * step(1e-3, uDust)) * smoothstep(0.0, 0.08, min(u, 1.0 - u) + 0.02);

  gl_Position = projectionMatrix * view;
  gl_PointSize = uSize * (0.75 + 0.5 * seed.x) * (3.2 / -view.z);
}
`;

export const RIBBON_FRAGMENT = `
varying vec3 vColor;
varying float vAlpha;

void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = vAlpha * (1.0 - smoothstep(0.25, 0.5, r));
  if (a < 0.004) { discard; }
  gl_FragColor = vec4(vColor, a);
}
`;
