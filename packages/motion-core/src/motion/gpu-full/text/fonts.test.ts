import { describe, expect, it } from 'vitest';
import { faceBook, type Source } from './fonts';
import type { Face } from './face';

const seen: Record<string, number>[] = [];
const source: Source = { axes: { opsz: [14, 32, 14], wght: [100, 900, 400] }, covers: () => true, at: (coords) => {
    seen.push(coords);
    return {} as Face;
  } };
const rules = [{ family: 'Inter', italic: false, weight: [100, 900] as [number, number], url: 'inter.woff2', ranges: [[0, 0x10ffff]] as [number, number][] }];

describe('an optical size outside the font axis', () => {
  it('lands on the nearest end of the axis, so asking for the smallest gives the text cut (traidue: Inter titles drew in the display cut)', () => {
    const book = faceBook(rules, new Map([['inter.woff2', source]]), []);
    book({ family: 'Inter', weight: 600, italic: false, size: 48, axes: { opsz: 0 } } as never, 'A'.codePointAt(0)!);

    expect(seen.at(-1)?.opsz).toBe(14);
  });
});
