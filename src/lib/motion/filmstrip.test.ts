import { describe, expect, it } from 'vitest';
import { stripSamples } from './filmstrip';

describe('stripSamples', () => {
  it('takes one frame per second of source', () => {
    expect(stripSamples(7.2)).toBe(8);
  });

  it('caps a long source so capture stays cheap', () => {
    expect(stripSamples(600)).toBe(24);
  });

  it('keeps at least one frame for a sub-second clip', () => {
    expect(stripSamples(0.2)).toBe(1);
  });
});
