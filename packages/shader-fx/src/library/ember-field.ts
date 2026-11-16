import { colour, LibraryGenre, num, type LibraryShader } from './shader';

const frag = `
float motes(vec2 p, float cells, float t, float layer, float soft) {
  vec2 g = p * cells;
  g += vec2(t * 0.09, t * 0.03) * cells * (0.4 + layer * 0.3);
  g += (vec2(noise(g * 0.11 + layer * 7.0 + t * 0.05), noise(g * 0.11 - layer * 3.0 - t * 0.04)) - 0.5) * 1.6;
  vec2 id = floor(g);
  vec2 f = fract(g);
  float lit = 0.0;
  for (int i = 0; i < 9; i++) {
    vec2 o = vec2(float(i - (i / 3) * 3) - 1.0, float(i / 3) - 1.0);
    vec2 cell = id + o;
    float h = hash(cell * 1.37 + layer * 11.0);
    float k = hash(cell * 2.91 + layer * 5.0 + 3.1);
    vec2 at = o + 0.15 + vec2(h, k) * 0.7 + 0.18 * vec2(sin(t * 0.5 + h * 6.28), cos(t * 0.42 + k * 6.28));
    float d = length(f - at);
    float r = mix(0.025, 0.07, k) * u_size;
    float pulse = 0.55 + 0.45 * sin(t * 1.3 + h * 37.0);
    float core = smoothstep(r * (1.0 + soft * 3.0), r * (1.0 - soft) * 0.4, d);
    float halo = exp(-d * d / (r * r * 14.0)) * 0.22;
    lit += (core + halo) * pulse * step(h, u_density);
  }
  return lit;
}

vec4 effect(vec2 uv) {
  float ar = u_res.x / u_res.y;
  vec2 p = (uv - 0.5) * vec2(ar, 1.0);
  float t = u_time * u_speed;

  float glow = 1.0 - smoothstep(0.0, 1.1, length(p - vec2(0.0, -0.55)));
  vec3 col = u_base + u_color_b * glow * 0.12;

  float far = motes(p, 22.0, t * 0.6, 0.0, 0.0);
  float mid = motes(p, 12.0, t * 0.8, 1.0, 0.2);
  float near = motes(p, 6.0, t, 2.0, 0.6 * u_depth);

  col += u_color_b * far * 0.35;
  col += mix(u_color_b, u_color_a, 0.6) * mid * 0.6;
  col += u_color_a * near * 0.45;

  col *= 1.0 - smoothstep(0.4, 1.1, length(p * vec2(0.8, 1.0))) * 0.5;
  return vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export const emberField: LibraryShader = {
  name: 'ember-field',
  genre: LibraryGenre.Field,
  description:
    'Three depths of motes drift up and across through a slow noise current, like dust in a projector beam. Far motes are small, sharp and cool, near ones large, soft and warm, so the frame reads with depth of field. Each mote breathes on its own phase. A low glow rises from the bottom edge.',
  frag,
  params: [
    colour('base', 'Base', '#050608'),
    colour('color_a', 'Near', '#ffcf9e'),
    colour('color_b', 'Far', '#7f9cff'),
    num('density', 'Density', 0, 1, 0.01, 0.55),
    num('size', 'Size', 0.3, 2, 0.01, 1),
    num('depth', 'Depth blur', 0, 1, 0.01, 0.8),
    num('speed', 'Speed', 0, 3, 0.01, 1)
  ]
};
