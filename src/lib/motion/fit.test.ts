import { describe, expect, it } from 'vitest';
import { GLYPH_EM, SAFE_INSET, fitTitleSize, safeBox, wrapLines } from './fit';

describe('a title fits its box', () => {
  it('a short title keeps the size it asked for', () => {
    expect(fitTitleSize('One', 120, { width: 1700, height: 430 })).toBe(120);
  });

  it('a long line wraps at words instead of running out of the box', () => {
    expect(wrapLines('Your whole marketing, on one canvas', 160, 900).length).toBeGreaterThan(1);
  });

  it('two long lines in a narrow frame shrink until every wrapped line fits the height', () => {
    const box = { width: 870, height: 400 };
    const size = fitTitleSize('Your whole marketing,\non one canvas', 160, box);
    const lines = wrapLines('Your whole marketing,\non one canvas', size, box.width);

    expect(size).toBeLessThan(160);
    expect(lines.length * size).toBeLessThanOrEqual(box.height);
  });

  it('a word longer than the box shrinks the type rather than spilling sideways', () => {
    const word = 'Supercalifragilistic';
    const size = fitTitleSize(word, 200, { width: 600, height: 600 });

    expect(size * GLYPH_EM * word.length).toBeLessThanOrEqual(600);
  });
});

describe('the safe area', () => {
  it('a box wider than the frame is pulled inside the title-safe margins', () => {
    const frame = { width: 1080, height: 1920 };
    const box = safeBox({ left: -100, top: 800, width: 1280, height: 400 }, frame);

    expect(box.left).toBe(1080 * SAFE_INSET);
    expect(box.left + box.width).toBe(1080 * (1 - SAFE_INSET));
    expect(box).toMatchObject({ top: 800, height: 400 });
  });
});
