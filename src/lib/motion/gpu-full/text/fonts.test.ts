import { describe, expect, it } from 'vitest';
import { FontSource, type FontFace } from '../../fonts/model';
import { faceBook, faceRules, type Source } from './fonts';
import { boxFace } from './test-face';

const GOOGLE = `
/* latin-ext */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 100 900;
  font-display: block;
  src: url(https://fonts.gstatic.com/inter-ext.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+1E00-1EFF;
}
/* latin */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 100 900;
  font-display: block;
  src: url(https://fonts.gstatic.com/inter.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131;
}`;

const UPLOAD = `@font-face{font-family:'Brand';src:url("https://x.test/brand-700.otf");font-weight:700;font-style:normal;font-display:block}@font-face{font-family:'Brand';src:url("https://x.test/brand-400.otf");font-weight:400;font-style:normal;font-display:block}`;

const seen: { url: string; coords: Record<string, number> }[] = [];

const source = (url: string, axes: Record<string, [number, number, number]> = {}): Source => ({
  axes,
  covers: () => true,
  at: (coords) => {
    seen.push({ url, coords });
    return boxFace;
  }
});

const registry: FontFace[] = [
  { family: 'Inter', source: FontSource.Google, category: 'sans', weights: [400, 700], italic: false, axes: [['wght', 100, 900]] } as FontFace,
  { family: 'Brand', source: FontSource.Upload, category: 'sans', weights: [400, 700], italic: false, axes: [] } as FontFace
];

const rules = [...faceRules(GOOGLE), ...faceRules(UPLOAD)];
const sources = new Map<string, Source>([
  ['https://fonts.gstatic.com/inter.woff2', source('inter', { wght: [100, 900, 400], opsz: [14, 32, 14] })],
  ['https://fonts.gstatic.com/inter-ext.woff2', source('inter-ext', { wght: [100, 900, 400] })],
  ['https://x.test/brand-700.otf', source('brand-700')],
  ['https://x.test/brand-400.otf', source('brand-400')]
]);
const book = faceBook(rules, sources, registry);
const ask = (family: string, weight: number, codePoint: number, more: { italic?: boolean; axes?: Record<string, number>; size?: number } = {}) => {
  seen.length = 0;
  const resolved = book({ family, weight, italic: more.italic ?? false, size: more.size ?? 20, axes: more.axes ?? {} }, codePoint);
  return { resolved, seen: seen[0] };
};

describe('faceRules', () => {
  it('reads family, style, weight range, file and unicode ranges from @font-face blocks', () => {
    expect(rules[1]).toEqual({ family: 'Inter', italic: false, weight: [100, 900], url: 'https://fonts.gstatic.com/inter.woff2', ranges: [[0, 0xff], [0x131, 0x131]] });
    expect(rules[2]).toMatchObject({ family: 'Brand', weight: [700, 700], url: 'https://x.test/brand-700.otf', ranges: [[0, 0x10ffff]] });
  });
});

describe('faceBook', () => {
  it('picks the subset whose unicode range holds the character', () => {
    expect(ask('Inter', 400, 'a'.codePointAt(0)!).seen.url).toBe('inter');
    expect(ask('Inter', 400, 0x1e00).seen.url).toBe('inter-ext');
  });

  it('drives the weight and optical size axes like the browser, then the explicit axes', () => {
    expect(ask('Inter', 700, 65, { size: 120 }).seen.coords).toEqual({ wght: 700, opsz: 120 });
    expect(ask('Inter', 700, 65, { axes: { wght: 300 } }).seen.coords).toMatchObject({ wght: 300 });
  });

  it('matches static files by the nearest registered weight', () => {
    expect(ask('Brand', 650, 65).seen.url).toBe('brand-700');
    expect(ask('Brand', 300, 65).seen.url).toBe('brand-400');
  });

  it('slants an upright face when italic is asked and none is there', () => {
    expect(ask('Brand', 400, 65, { italic: true }).resolved?.skew).toBeGreaterThan(0);
    expect(ask('Brand', 400, 65).resolved?.skew).toBe(0);
  });

  it('finds nothing for a family it has no file for', () => {
    expect(ask('Missing', 400, 65).resolved).toBeNull();
  });

  it('stamps a face with the file and coordinates it came from', () => {
    expect(ask('Inter', 700, 65, { size: 120 }).resolved?.face.key).toEqual({ font: 'https://fonts.gstatic.com/inter.woff2', coords: [['wght', 700], ['opsz', 120]] });
    expect(ask('Inter', 700, 65, { size: 120 }).resolved?.face).toBe(ask('Inter', 700, 65, { size: 120 }).resolved?.face);
  });
});
