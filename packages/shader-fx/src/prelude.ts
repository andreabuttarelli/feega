import type { ShaderParam } from './effect';

export const CONTRACT_UNIFORMS = ['u_src', 'u_res', 'u_time', 'u_seed'] as const;

const GLSL_TYPE: Record<ShaderParam['kind'], string> = { number: 'float', color: 'vec3', seed: 'float' };

const HEADER = `precision highp float;
uniform sampler2D u_src;
uniform vec2 u_res;
uniform float u_time;
uniform float u_seed;
varying vec2 v_uv;
float hash(vec2 p) { return fract(sin(dot(p + u_seed, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 s = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), s.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), s.x), s.y);
}
`;

const MAIN = `
void main() {
  gl_FragColor = effect(v_uv);
}
`;

export const uniformName = (key: string) => `u_${key}`;

export function buildFragment(frag: string, params: ShaderParam[]): string {
  const uniforms = params.map((p) => `uniform ${GLSL_TYPE[p.kind]} ${uniformName(p.key)};`).join('\n');
  return `${HEADER}${uniforms}\n${frag}\n${MAIN}`;
}

export const VERTEX = `attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;
