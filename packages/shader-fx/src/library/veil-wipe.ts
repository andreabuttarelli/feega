import { colour, LibraryGenre, num, type LibraryShader } from './shader';

const frag = `
vec4 effect(vec2 uv) {
  float ar = u_res.x / u_res.y;
  vec2 p = (uv - 0.5) * vec2(ar, 1.0);
  float an = radians(u_angle);
  vec2 dir = vec2(cos(an), sin(an));
  vec2 side = vec2(-dir.y, dir.x);
  float reach = 0.5 * (abs(dir.x) * ar + abs(dir.y));

  float s = dot(p, dir) / reach * 0.5 + 0.5;
  float along = dot(p, side);
  float ragged = (noise(vec2(along * u_scale, u_progress * 3.0)) - 0.5) * 0.6 + (noise(vec2(along * u_scale * 3.1, 7.0 - u_progress * 2.0)) - 0.5) * 0.25;
  float x = s + ragged * u_turbulence * 0.25;

  float f = u_feather * 0.25 + 0.002;
  float margin = f + u_turbulence * 0.12 + 0.02;
  float front = mix(-margin, 1.0 + margin, u_progress);
  float cover = 1.0 - smoothstep(front - f, front + f, x);

  float band = exp(-pow((x - front) / (f * 0.6 + 0.004), 2.0));
  vec2 pull = dir / vec2(ar, 1.0) * band * 0.015;
  vec3 src = texture2D(u_src, uv - pull).rgb;

  vec3 col = mix(src, u_color, cover);
  col += u_glow * band * u_glow_amount * (1.0 - cover * 0.5);
  return vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export const veilWipe: LibraryShader = {
  name: 'veil-wipe',
  genre: LibraryGenre.Transition,
  description:
    'A veil of solid colour sweeps across the image at any angle. The front is torn softly by two scales of noise that shift as it travels, carries a thin band of light, and drags the pixels it passes by a few points. Progress 0 shows the image, 1 covers it; keyframe 1 to 0 to reveal. Time is ignored, so progress alone sets the frame.',
  frag,
  params: [
    num('progress', 'Progress', 0, 1, 0.001, 0.5),
    num('angle', 'Angle', 0, 360, 1, 20),
    num('feather', 'Feather', 0, 1, 0.01, 0.1),
    num('turbulence', 'Turbulence', 0, 1, 0.01, 0.5),
    num('scale', 'Tear scale', 0.5, 12, 0.1, 4),
    colour('color', 'Veil', '#0a0b0f'),
    colour('glow', 'Edge light', '#cfd8ff'),
    num('glow_amount', 'Edge glow', 0, 1, 0.01, 0.2)
  ]
};
