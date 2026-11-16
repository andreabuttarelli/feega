import { LibraryGenre, num, type LibraryShader } from './shader';

const frag = `
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float body(vec2 p, float t) {
  float r = u_size;
  vec2 a = vec2(cos(t * 0.61), sin(t * 0.83)) * r * 0.42;
  vec2 b = vec2(cos(t * 0.47 + 2.4), sin(t * 0.37 + 0.9)) * r * 0.5;
  float d = length(p) - r * 0.62;
  d = smin(d, length(p - a) - r * 0.38, r * 0.35);
  d = smin(d, length(p - b) - r * 0.30, r * 0.35);
  return d;
}

vec4 effect(vec2 uv) {
  float ar = u_res.x / u_res.y;
  vec2 aspect = vec2(ar, 1.0);
  vec2 p = (uv - 0.5) * aspect;
  float t = u_time * u_speed;
  float px = 1.0 / u_res.y;

  float d = body(p, t);
  vec2 grad = vec2(body(p + vec2(px * 2.0, 0.0), t) - d, body(p + vec2(0.0, px * 2.0), t) - d) / (px * 2.0);

  grad /= max(length(grad), 1.0);
  float depth = clamp(-d / (u_size * 0.45), 0.0, 1.0);
  float rim = pow(1.0 - depth, 2.2);
  vec2 bend = grad * (1.0 - depth * depth) * u_refraction * 0.045;
  vec2 split = grad * rim * u_dispersion * 0.012;

  vec2 q = uv + bend / aspect;
  vec3 glass = vec3(
    texture2D(u_src, q + split / aspect).r,
    texture2D(u_src, q).g,
    texture2D(u_src, q - split / aspect).b
  );
  glass = glass * 1.04 + 0.015;

  vec3 n = normalize(vec3(-grad * rim * 1.4, 1.0));
  float spec = pow(max(dot(n, normalize(vec3(-0.45, 0.55, 0.7))), 0.0), 60.0) * u_highlight;
  float lip = exp(-abs(d) / (px * 1.6)) * 0.22 * u_highlight;
  glass += spec + lip;

  vec3 under = texture2D(u_src, uv).rgb;
  float shade = smoothstep(0.0, u_size * 0.1, d);
  under *= mix(0.93, 1.0, shade);

  float inside = 1.0 - smoothstep(-px, px, d);
  return vec4(mix(under, glass, inside), 1.0);
}
`;

export const liquidLens: LibraryShader = {
  name: 'liquid-lens',
  genre: LibraryGenre.Glass,
  description:
    'A single drop of clear liquid floats over the image: three bodies merge with a smooth union and slowly trade mass. Light bends hardest at the rim, the centre magnifies slightly, the edge splits red and blue a hair apart, and one cold specular sits top-left with a thin lip line. A soft contact shadow grounds it.',
  frag,
  params: [
    num('size', 'Size', 0.1, 0.6, 0.01, 0.3),
    num('refraction', 'Refraction', 0, 2, 0.01, 1),
    num('dispersion', 'Dispersion', 0, 2, 0.01, 0.4),
    num('highlight', 'Highlight', 0, 1.5, 0.01, 0.9),
    num('speed', 'Speed', 0, 3, 0.01, 1)
  ]
};
