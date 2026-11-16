import { colour, LibraryGenre, num, type LibraryShader } from './shader';

const frag = `
float pool(vec2 p, vec2 c, float s) {
  vec2 d = p - c;
  return exp(-dot(d, d) / (s * s));
}

vec4 effect(vec2 uv) {
  float ar = u_res.x / u_res.y;
  vec2 p = (uv - 0.5) * vec2(ar, 1.0);
  float t = u_time * u_speed;

  vec2 bend = vec2(noise(p * 1.1 + vec2(t * 0.07, 1.3)), noise(p * 1.1 + vec2(5.2, -t * 0.06))) - 0.5;
  vec2 q = p + bend * u_warp;

  vec2 c1 = vec2(cos(t * 0.19) * 0.52 * ar, sin(t * 0.15) * 0.34);
  vec2 c2 = vec2(cos(t * 0.12 + 2.1) * 0.46 * ar, sin(t * 0.21 + 1.3) * 0.38);
  vec2 c3 = vec2(cos(t * 0.16 + 4.2) * 0.40 * ar, sin(t * 0.10 + 3.7) * 0.30);

  float s = u_softness;
  vec3 col = u_base;
  col = mix(col, u_color_a, pool(q, c1, s) * 0.95);
  col = mix(col, u_color_b, pool(q, c2, s * 0.8) * 0.8);
  col = mix(col, u_color_c, pool(q, c3, s * 0.65) * 0.7);

  float fold = sin((q.x * 0.8 - q.y) * 3.2 + bend.x * 7.0 + t * 0.25);
  col += smoothstep(0.6, 1.0, fold) * 0.035 * (col + 0.2);

  float edge = length(p * vec2(0.7, 1.0));
  col *= 1.0 - smoothstep(0.35, 1.05, edge) * 0.35;

  col += (hash(floor(uv * u_res)) - 0.5) * u_grain;
  return vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export const silkDrift: LibraryShader = {
  name: 'silk-drift',
  genre: LibraryGenre.Gradient,
  description:
    'Three soft pools of colour drift on slow, unrelated orbits over a deep base, bent by a low-frequency warp so their edges never read as circles. A faint diagonal fold catches light like satin, the corners fall off gently and a fixed grain kills banding. Calm enough to sit behind type.',
  frag,
  params: [
    colour('base', 'Base', '#06070b'),
    colour('color_a', 'Colour A', '#2a3dff'),
    colour('color_b', 'Colour B', '#8aa2ff'),
    colour('color_c', 'Colour C', '#f0b48c'),
    num('speed', 'Speed', 0, 3, 0.01, 1),
    num('softness', 'Softness', 0.1, 1.2, 0.01, 0.48),
    num('warp', 'Warp', 0, 1.5, 0.01, 0.7),
    num('grain', 'Grain', 0, 0.08, 0.001, 0.018)
  ]
};
