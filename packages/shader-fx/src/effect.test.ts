import { describe, expect, it } from 'vitest';
import { parseEffect, MAX_FRAG_BYTES, MAX_PARAMS } from './effect';

const frag = 'vec4 effect(vec2 uv) { return texture2D(u_src, uv) * u_amount; }';
const amount = { key: 'amount', label: 'Amount', kind: 'number', min: 0, max: 2, step: 0.1, default: 1 };

describe('parseEffect', () => {
  it('accepts a well formed effect', () => {
    expect(parseEffect({ name: 'vhs-glow', frag, params: [amount] }).ok).toBe(true);
  });

  it.each([
    ['a name that is not kebab', { name: 'VHS Glow', frag, params: [] }],
    ['a frag over the size limit', { name: 'big', frag: 'x'.repeat(MAX_FRAG_BYTES + 1), params: [] }],
    ['too many params', { name: 'many', frag, params: Array.from({ length: MAX_PARAMS + 1 }, (_, i) => ({ ...amount, key: `p${i}` })) }],
    ['min not below max', { name: 'flat', frag, params: [{ ...amount, min: 2, max: 2 }] }],
    ['default outside range', { name: 'out', frag, params: [{ ...amount, default: 5 }] }],
    ['duplicate keys', { name: 'dup', frag, params: [amount, amount] }],
    ['a key that redefines a contract uniform', { name: 'seeded', frag, params: [{ key: 'seed', label: 'Seed', kind: 'seed', default: 1 }] }],
    ['a key that is not an identifier', { name: 'bad-key', frag, params: [{ ...amount, key: '1x' }] }],
    ['a colour that is not hex', { name: 'col', frag, params: [{ key: 'tint', label: 'Tint', kind: 'color', default: 'red' }] }]
  ])('refuses %s', (_, input) => {
    expect(parseEffect(input).ok).toBe(false);
  });
});
