import { describe, expect, it } from 'vitest';
import { strokesFromPx } from './px-fields';

const FRAME = { width: 1000, height: 2000 } as Parameters<typeof strokesFromPx>[1];

describe('stroke px fields', () => {
  it('a dash pattern in px becomes fractions of the short side', () => {
    expect(strokesFromPx([{ pattern_px: [10, 20, 5] }], FRAME)).toEqual([{ pattern: [0.01, 0.02, 0.005] }]);
  });
});
