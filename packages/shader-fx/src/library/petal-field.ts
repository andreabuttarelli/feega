import { colour, LibraryGenre, num, type LibraryShader } from './shader';

const frag = `
vec3 hueOf(float h) {
  vec3 ab = mix(u_color_a, u_color_b, smoothstep(0.0, 0.5, h));
  return mix(ab, u_color_c, smoothstep(0.5, 1.0, h));
}

vec4 effect(vec2 uv) {
  float ar = u_res.x / u_res.y;
  vec2 p = (uv - 0.5) * vec2(ar, 1.0);
  vec2 pointer = (vec2(u_pointer_x, 1.0 - u_pointer_y) - 0.5) * vec2(ar, 1.0);
  float t = u_time * u_speed;
  float cells = u_density;

  vec2 g = p * cells;
  vec2 id = floor(g);
  vec3 col = u_base;
  vec3 glow = vec3(0.0);

  for (int i = 0; i < 9; i++) {
    vec2 o = vec2(float(i - (i / 3) * 3) - 1.0, float(i / 3) - 1.0);
    vec2 cell = id + o;
    float h1 = hash(cell * 1.71);
    float h2 = hash(cell * 3.13 + 2.0);
    float h3 = hash(cell * 5.37 + 4.0);
    vec2 centre = cell + 0.2 + vec2(h1, h2) * 0.6;
    centre += vec2(sin(t * 0.6 + h1 * 6.28), cos(t * 0.45 + h2 * 6.28)) * 0.06;

    vec2 world = centre / cells;
    float near = exp(-dot(world - pointer, world - pointer) / 0.012) * u_hover;

    float petals = floor(5.0 + h3 * 4.0);
    float size = (0.18 + h2 * 0.2) * (1.0 + near * 0.25);
    float open = 0.55 + 0.25 * sin(t * 0.8 + h3 * 6.28) * 0.3 + near * 0.35;
    float spin = h1 * 6.28 + sin(t * 0.5 + h2 * 9.0) * 0.18;

    vec2 d = g - centre;
    float r = length(d);
    float a = atan(d.y, d.x) + spin;
    float lobe = pow(abs(cos(a * petals * 0.5)), 0.8 - open * 0.5);
    float edge = size * (0.45 + 0.55 * lobe);
    float px = cells / u_res.y;
    float body = 1.0 - smoothstep(edge - px * 1.5, edge + px * 1.5, r);

    vec3 tint = hueOf(h3);
    float inner = r / max(edge, 1e-3);
    vec3 petal = tint * (0.18 + 0.5 * smoothstep(0.35, 1.0, inner) + 0.25 * smoothstep(0.6, 0.0, inner));
    float core = exp(-r * r / (size * size * 0.012));
    petal += mix(tint, vec3(1.0), 0.7) * core * 0.8;

    float shown = step(0.3, h1 * 0.6 + h2 * 0.4);
    col = mix(col, petal, body * (0.55 + near * 0.35) * shown);
    glow += shown * tint * exp(-r * r / (size * size * (0.5 + near * 1.5))) * (0.06 + near * 0.55);
  }

  col += glow;
  col *= 1.0 - smoothstep(0.45, 1.15, length(p * vec2(0.75, 1.0))) * 0.55;
  return vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export const petalField: LibraryShader = {
  name: 'petal-field',
  genre: LibraryGenre.Bloom,
  description:
    'A night meadow of light-made flowers on near-black. Every flower draws its petal count, size, hue and rotation from its own seed, sways a little and breathes open and shut. Near the pointer a flower opens wider, grows slightly and blooms a soft halo of its own colour. Pointer and hover are plain params: live input or keyframes drive them, so every frame stays a function of time and params.',
  frag,
  params: [
    colour('base', 'Background', '#040406'),
    colour('color_a', 'Hue A', '#ff8fb1'),
    colour('color_b', 'Hue B', '#8f9bff'),
    colour('color_c', 'Hue C', '#ffd59a'),
    num('density', 'Flowers', 2, 12, 0.1, 5),
    num('speed', 'Sway', 0, 3, 0.01, 1),
    num('pointer_x', 'Pointer X', 0, 1, 0.001, 0.5),
    num('pointer_y', 'Pointer Y', 0, 1, 0.001, 0.5),
    num('hover', 'Hover', 0, 1, 0.01, 0.8)
  ]
};
