import { describe, expect, it } from 'vitest';
import { lintFrag, LintRule } from './lint';

const params = [{ key: 'amount', label: 'Amount', kind: 'number' as const, min: 0, max: 1, step: 0.1, default: 0.5 }];
const body = (inner: string) => `vec4 effect(vec2 uv) { ${inner} }`;
const rules = (frag: string) => lintFrag(frag, params).map((p) => p.rule);

describe('lintFrag', () => {
  it('passes a clean effect', () => {
    expect(lintFrag(body('return texture2D(u_src, uv) * u_amount;'), params)).toEqual([]);
  });

  it.each([
    [LintRule.Extension, '#extension GL_OES_standard_derivatives : enable\n' + body('return vec4(0.0);')],
    [LintRule.OffSpec, body('return texture2DLod(u_src, uv, 0.0);')],
    [LintRule.OffSpec, body('return vec4(dFdx(uv.x));')],
    [LintRule.UnboundedLoop, body('vec4 c; for (int i = 0; i < 65; i++) { c += vec4(0.0); } return c;')],
    [LintRule.UnboundedLoop, body('vec4 c; while (true) { } return c;')],
    [LintRule.TooManyFetches, body(Array.from({ length: 17 }, () => 'texture2D(u_src, uv);').join(' ') + ' return vec4(0.0);')],
    [LintRule.UndeclaredUniform, 'uniform float u_other;\n' + body('return vec4(u_other);')],
    [LintRule.UnknownUniform, body('return vec4(u_missing);')],
    [LintRule.NoEntry, 'vec4 main2(vec2 uv) { return vec4(0.0); }']
  ])('flags %s', (rule, frag) => {
    expect(rules(frag)).toContain(rule);
  });

  it('allows a loop bounded at 64', () => {
    expect(rules(body('vec4 c; for (int i = 0; i < 64; i++) { c += vec4(0.0); } return c;'))).toEqual([]);
  });
});
