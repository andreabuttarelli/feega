import { describe, expect, it } from 'vitest';
import { buildFragment, uniformName } from './prelude';

describe('buildFragment', () => {
  const src = buildFragment('vec4 effect(vec2 uv) { return texture2D(u_src, uv); }', [
    { key: 'amount', label: 'A', kind: 'number', min: 0, max: 1, step: 0.1, default: 0.5 },
    { key: 'tint', label: 'T', kind: 'color', default: '#ff0000' },
    { key: 'grain', label: 'G', kind: 'seed', default: 3 }
  ]);

  it('declares the fixed contract and one uniform per param', () => {
    for (const line of ['uniform sampler2D u_src;', 'uniform vec2 u_res;', 'uniform float u_time;', 'uniform float u_seed;', 'varying vec2 v_uv;', 'uniform float u_amount;', 'uniform vec3 u_tint;', 'uniform float u_grain;']) {
      expect(src).toContain(line);
    }
  });

  it('calls the authored effect from main', () => {
    expect(src).toMatch(/void main\(\)\s*\{\s*gl_FragColor = effect\(v_uv\);/);
  });

  it('names uniforms after the key', () => {
    expect(uniformName('amount')).toBe('u_amount');
  });
});
