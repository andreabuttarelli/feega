import { describe, expect, it } from 'vitest';
import { Ligatures } from './face';
import { layOut, Shaping, Spaces, type Flow, type Type } from './layout';
import { boxBook, boxFace, seenLigatures, SPACE, UPM, WIDE } from './test-face';

const SIZE = 100;
const em = (units: number) => (units / UPM) * SIZE;
const type: Type = { request: { family: 'sans', weight: 400, italic: false, axes: {} }, size: SIZE, tracking: 0, leading: 1.2, inset: 0, shaping: Shaping.Runs };
const wrapping: Flow = { spaces: Spaces.Collapse, wraps: true };
const lines = (laid: ReturnType<typeof layOut>) => laid.blocks.flatMap((b) => b.lines);

describe('layOut', () => {
  it('measures a word as its advances plus the tracking after every character', () => {
    const laid = layOut(['abc'], { ...type, tracking: 0.1 }, wrapping, 10_000, boxBook());

    expect(laid.width).toBeCloseTo(3 * em(WIDE) + 3 * 0.1 * SIZE);
  });

  it('breaks greedily at spaces and leaves the trailing space out of the width', () => {
    const laid = layOut(['aa bb cc'], type, wrapping, 5 * em(WIDE) + em(SPACE), boxBook());

    expect(lines(laid).map((l) => l.glyphs.length)).toEqual([5, 2]);
    expect(lines(laid)[0].width).toBeCloseTo(4 * em(WIDE) + em(SPACE));
  });

  it('collapses runs of spaces and newlines like white-space normal', () => {
    const laid = layOut(['  a \n\n b  '], type, wrapping, 10_000, boxBook());

    expect(laid.width).toBeCloseTo(2 * em(WIDE) + em(SPACE));
  });

  it('keeps leading spaces when spaces are preserved', () => {
    const laid = layOut(['  a'], type, { spaces: Spaces.Keep, wraps: true }, 10_000, boxBook());

    expect(lines(laid)[0].glyphs.at(-1)!.x).toBeCloseTo(2 * em(SPACE));
  });

  it('runs past the room when it may not wrap', () => {
    const laid = layOut(['aa bb cc'], type, { spaces: Spaces.Keep, wraps: false }, em(WIDE), boxBook());

    expect(lines(laid)).toHaveLength(1);
  });

  it('stacks paragraphs as blocks of line-height lines, baseline after half the leading', () => {
    const laid = layOut(['a', '', 'b'], type, wrapping, 10_000, boxBook());
    const lh = 1.2 * SIZE;

    expect(laid.blocks.map((b) => b.top)).toEqual([0, lh, 2 * lh]);
    expect(laid.height).toBeCloseTo(3 * lh);
    expect(laid.blocks[0].lines[0].baseline).toBeCloseTo((lh - 100) / 2 + 80);
  });

  it('snaps line height to layout units and floors the half leading above the baseline, like the browser', () => {
    const laid = layOut(['a'], { ...type, size: 118.8, leading: 0.95 }, wrapping, 10_000, boxBook());
    const heights = [[43.2, 1.3, 56.15625], [37.8, 1.25, 47.234375], [33.33, 1.17, 38.984375]].map(([size, leading]) => layOut(['a'], { ...type, size, leading }, wrapping, 10_000, boxBook()).height);

    expect(laid.height).toBe(112.84375);
    expect(heights).toEqual([56.15625, 47.234375, 38.984375]);
    expect(laid.blocks[0].lines[0].baseline).toBe(95 + Math.floor((112.84375 - 95 - 24) / 2));
  });

  it('turns ligatures off once the text is tracked, as the browser does', () => {
    seenLigatures.length = 0;
    layOut(['fi'], { ...type, tracking: -0.04 }, wrapping, 10_000, boxBook());

    expect(new Set(seenLigatures)).toEqual(new Set([Ligatures.Off]));
  });

  it('says a character no font covers is missing', () => {
    expect(layOut(['a★'], type, wrapping, 10_000, boxBook(new Set(['★']))).missing).toBe(true);
  });

  it('pads the outer ends of an inline box', () => {
    const laid = layOut(['a'], { ...type, inset: 10 }, wrapping, 10_000, boxBook());

    expect(lines(laid)[0].glyphs[0].x).toBe(10);
    expect(laid.width).toBeCloseTo(em(WIDE) + 20);
  });
  it('shapes every character alone when characters are their own boxes, so pairs do not kern', () => {
    const KERN = 100;
    const kerning = { ...boxFace, shape: (text: string, l: Ligatures) => boxFace.shape(text, l).map((g, i) => (i === 0 && text.length > 1 ? { ...g, advance: g.advance - KERN } : g)) };
    const book = () => ({ face: kerning, skew: 0 });

    expect(layOut(['ab'], type, wrapping, 10_000, book).width).toBeCloseTo(2 * em(WIDE) - em(KERN));
    expect(layOut(['ab'], { ...type, shaping: Shaping.Chars }, wrapping, 10_000, book).width).toBeCloseTo(2 * em(WIDE));
  });

  it('tells each glyph its word, its letter and the advance it spans', () => {
    const laid = layOut(['ab cd'], { ...type, tracking: 0.1 }, wrapping, 10_000, boxBook());
    const glyphs = lines(laid)[0].glyphs;
    const step = em(WIDE) + 0.1 * SIZE;

    expect(glyphs.map((g) => [g.word, g.letter])).toEqual([[0, 0], [0, 1], [-1, 0], [1, 0], [1, 1]]);
    expect(glyphs[3].pen).toBeCloseTo(2 * step + em(SPACE) + 0.1 * SIZE);
    expect(glyphs[3].advance).toBeCloseTo(step);
  });

  it('gives the line height it stacked lines with', () => {
    expect(layOut(['a'], type, wrapping, 10_000, boxBook()).lineHeight).toBeCloseTo(1.2 * SIZE);
  });

  it('adds extra spacing after the characters it is asked to, in em', () => {
    const spaced = layOut(['ab cd'], type, wrapping, 10_000, boxBook(), (_p, word, letter) => (word === 0 && letter === 0 ? 0.5 : 0));
    const glyphs = lines(spaced)[0].glyphs;

    expect(glyphs[1].x - glyphs[0].x).toBeCloseTo(em(WIDE) + 0.5 * SIZE);
    expect(spaced.width).toBeCloseTo(layOut(['ab cd'], type, wrapping, 10_000, boxBook()).width + 0.5 * SIZE);
  });
});
