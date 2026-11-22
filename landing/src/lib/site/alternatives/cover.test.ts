import { describe, expect, it } from 'vitest';
import { CoverShape, coverFor, densityAt, glyphAt } from './cover';

describe('alternative covers', () => {
  it('neighbouring articles get a different shape, ramp and flag', () => {
    const [a, b] = [coverFor(0), coverFor(1)];
    expect(a.shape).not.toBe(b.shape);
    expect(a.ramp).not.toBe(b.ramp);
    expect(a.flag).not.toBe(b.flag);
  });

  it.each(Object.values(CoverShape))('%s stays within 0..1', (shape) => {
    for (const [x, y] of [[0, 0], [0.5, 0.5], [1, 1], [0.2, 0.8]]) {
      const d = densityAt(shape, x, y);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(1);
    }
  });

  it('empty density draws nothing, full density the last glyph', () => {
    expect(glyphAt(' .:#', 0)).toBe(' ');
    expect(glyphAt(' .:#', 1)).toBe('#');
  });
});
