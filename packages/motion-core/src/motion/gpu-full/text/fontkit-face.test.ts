import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fontkitSource } from './fontkit-face';
import { faceBook, type Source } from './fonts';
import type { Face } from './face';

const UNDECODABLE = new Uint8Array(readFileSync(new URL('./fixtures/undecodable-glyphs.ttf', import.meta.url)));
const BROKEN_URL = 'nanum-pen.ttf';
const FALLBACK_URL = 'dm-sans.woff2';
const EVERY: [number, number][] = [[0, 0x10ffff]];
const H = 'H'.codePointAt(0)!;
const I = 'i'.codePointAt(0)!;

const fallback: Source = { axes: {}, covers: () => true, at: () => ({ unitsPerEm: 1000, ascent: 800, descent: 200, shape: () => [], outline: () => [] }) as Face };

function bookOver(broken: Source) {
  const rules = [
    { family: 'Nanum Pen', italic: false, weight: [400, 400] as [number, number], url: BROKEN_URL, ranges: EVERY },
    { family: 'DM Sans', italic: false, weight: [100, 900] as [number, number], url: FALLBACK_URL, ranges: EVERY }
  ];
  const book = faceBook(rules, new Map([[BROKEN_URL, broken], [FALLBACK_URL, fallback]]), []);
  return (codePoint: number) => book({ family: 'Nanum Pen', weight: 400, italic: false, size: 16, axes: {} }, codePoint)?.face.key?.font;
}

describe('a font whose glyphs cannot be decoded', () => {
  it('draws those glyphs with the fallback, as if the font were missing (Miro frame stayed blank on a truncated Nanum Pen)', () => {
    const fontOf = bookOver(fontkitSource(UNDECODABLE));

    expect(fontOf(H)).toBe(FALLBACK_URL);
    expect(fontOf(I)).toBe(BROKEN_URL);
  });

  it('is reported once, however many glyphs fail', () => {
    const broken = vi.fn();
    const source = fontkitSource(UNDECODABLE, broken);

    [H, H, ' '.codePointAt(0)!, H].forEach((cp) => source.covers(cp));

    expect(broken).toHaveBeenCalledTimes(1);
  });
});
