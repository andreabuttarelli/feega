import { describe, expect, it } from 'vitest';
import { EFFECTS, EFFECT_KINDS, EFFECT_LENGTHS } from './registry';

describe('effect lengths', () => {
  it('a param name that is a length is a length in every effect that has it', () => {
    const named = EFFECT_KINDS.flatMap((kind) => EFFECTS[kind].params.map((p) => ({ kind, key: p.key, length: p.length === true })));

    for (const p of named.filter((n) => EFFECT_LENGTHS.has(n.key))) {
      expect(p.length, `${p.kind}.${p.key}`).toBe(true);
    }
  });

  it('a shadow offset, softness and spread are lengths, its opacity and angle are not', () => {
    expect(['x', 'y', 'blur', 'spread', 'distance'].every((k) => EFFECT_LENGTHS.has(k))).toBe(true);
    expect(EFFECT_LENGTHS.has('opacity')).toBe(false);
    expect(EFFECT_LENGTHS.has('angle')).toBe(false);
  });
});
