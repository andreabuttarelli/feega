import { describe, expect, it } from 'vitest';
import { textBaseline } from './text-extent';

describe('textBaseline', () => {
  it('sits an ascent below the top, plus half the extra leading', () => {
    expect(textBaseline('Text', { size: 0.1, leading: 1.2 }, 100)).toBeCloseTo(1 + 8, 5);
  });

  it('adds the caption inset', () => {
    expect(textBaseline('Caption', { size: 0.1, leading: 1 }, 100)).toBeCloseTo(2.5 + 8, 5);
  });
});
