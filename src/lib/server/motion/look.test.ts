import { describe, expect, it } from 'vitest';
import { lookOf } from './look';

describe('the brand look a cached frame was drawn with', () => {
  it('changes when the brand changes, so a frame kept under the old look is never drawn', () => {
    const before = { name: 'acme', palette: { primary: '#000' } } as never;
    const after = { name: 'acme', palette: { primary: '#f00' } } as never;

    expect(lookOf(before)).toBe(lookOf(before));
    expect(lookOf(before)).not.toBe(lookOf(after));
  });
});
