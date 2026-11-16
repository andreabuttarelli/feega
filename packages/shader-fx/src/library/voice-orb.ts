import { colour, LibraryGenre, num, type LibraryShader } from './shader';

const frag = `
const float TAU = 6.2831853;

float weight(float state, float k) {
  return clamp(1.0 - abs(state - k), 0.0, 1.0);
}

float speech(float t) {
  float syllable = sin(t * 7.3) * 0.5 + sin(t * 11.9 + 1.7) * 0.3 + sin(t * 17.1 + 0.4) * 0.2;
  float phrase = smoothstep(-0.3, 0.6, sin(t * 1.9) + sin(t * 0.7 + 2.0) * 0.6);
  return clamp(syllable * 0.5 + 0.5, 0.0, 1.0) * phrase;
}

vec4 effect(vec2 uv) {
  float ar = u_res.x / u_res.y;
  vec2 p = (uv - 0.5) * vec2(ar, 1.0);
  float t = u_time;
  float px = 1.0 / u_res.y;

  float idle = weight(u_state, 0.0);
  float think = weight(u_state, 1.0);
  float speak = weight(u_state, 2.0);
  float voice = speak * u_energy * speech(t);

  float a = atan(p.y, p.x);
  float breath = sin(t * 1.25) * 0.018 * idle;
  float ripple = (sin(a * 3.0 + t * 3.1) * 0.6 + sin(a * 5.0 - t * 4.3) * 0.4) * 0.035 * voice;
  float lean = sin(a * 2.0 - t * 2.2) * 0.01 * think;
  float radius = u_size * (1.0 + breath + voice * 0.1 + ripple + lean);

  float r = length(p);
  float d = r - radius;
  float inside = 1.0 - smoothstep(-px, px, d);

  vec2 s = p / radius;
  float z = sqrt(max(1.0 - dot(s, s), 0.0));
  vec3 n = vec3(s, z);

  float spin = t * (0.12 + think * 0.55 + voice * 0.4);
  vec2 q = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * (s / (0.6 + z * 0.6));
  float swirl = noise(q * 1.8 + vec2(t * 0.25, -t * 0.18));
  float flow = noise(q * 2.6 + swirl * 1.7 - vec2(0.0, t * (0.2 + voice * 0.6)));

  vec3 body = mix(u_color_a, u_color_b, smoothstep(0.2, 0.9, flow));
  body = mix(body, u_color_c, smoothstep(0.55, 0.9, flow * 0.6 + (n.y * 0.5 + 0.5) * 0.5));
  body *= 0.5 + 0.5 * z;
  body *= 1.0 + voice * 0.35;

  float fresnel = pow(1.0 - z, 2.5);
  body += fresnel * mix(u_color_b, vec3(1.0), 0.4) * 0.55;
  body += pow(max(dot(n, normalize(vec3(-0.4, 0.55, 0.75))), 0.0), 48.0) * 0.35;

  float sweep = mod(a - t * 2.6 + TAU * 0.5, TAU) - TAU * 0.5;
  float arc = exp(-sweep * sweep * 3.0) * exp(-abs(d) / (px * 6.0 + u_size * 0.02)) * think;

  float halo = exp(-max(d, 0.0) / (u_size * 0.28)) * (0.12 + 0.45 * voice + 0.12 * think + 0.06 * idle);
  vec3 col = u_base + mix(u_color_a, u_color_b, 0.5) * halo * (1.0 - inside);
  col = mix(col, body, inside);
  col += mix(u_color_b, vec3(1.0), 0.6) * arc * 0.9;

  return vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export const voiceOrb: LibraryShader = {
  name: 'voice-orb',
  genre: LibraryGenre.Orb,
  description:
    'A glassy sphere of slowly folding colour for a voice assistant. State 0 is idle: the orb breathes. State 1 is thinking: the interior spins faster and a bright arc orbits the rim. State 2 is speaking: energy drives syllable-like swells, a soft three- and five-lobe ripple and a stronger halo. States blend between whole numbers.',
  frag,
  params: [
    colour('base', 'Background', '#030305'),
    colour('color_a', 'Deep', '#1b2cff'),
    colour('color_b', 'Light', '#7fd8ff'),
    colour('color_c', 'Accent', '#f3e9ff'),
    num('state', 'State', 0, 2, 0.01, 2),
    num('energy', 'Energy', 0, 1, 0.01, 0.7),
    num('size', 'Size', 0.1, 0.45, 0.01, 0.24)
  ]
};
