import { describe, expect, it } from 'vitest';
import { boxBook } from '$lib/motion/gpu-full/text/test-face';
import { glyphsOf } from './glyphs';

const box = (contours: number[][]) => {
  const xs = contours.flatMap((c) => c.filter((_, i) => i % 2 === 0));
  const ys = contours.flatMap((c) => c.filter((_, i) => i % 2 === 1));
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) => Math.round(v * 10) / 10 + 0);
};

const glyphs = glyphsOf(boxBook(), 'DM Sans', 400);

describe('glyphsOf', () => {
  it('anchors a line at its line-box top like CSS, the baseline centred in a 1.4 leading', () => {
    const { contours, width, height } = glyphs('ab', 10);

    expect(width).toBeCloseTo(9.6);
    expect(height).toBe(14);
    expect(box(contours)).toEqual([0, 3, 9.8, 10]);
  });

  it('takes the leading from the caller', () => {
    expect(glyphs('ab', 10, { leading: 1 }).height).toBe(10);
  });

  it('wraps into the box and drops lines that do not fit', () => {
    const one = glyphs('aa aa aa aa', 10, { width: 12, height: 14 });
    const all = glyphs('aa aa aa aa', 10, { width: 12, height: 1000 });

    expect(box(one.contours)[2]).toBeLessThanOrEqual(12);
    expect(all.contours.length).toBeGreaterThan(one.contours.length);
  });
});
