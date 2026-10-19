import { describe, expect, it } from 'vitest';
import type { PathItem } from '$lib/motion/gpu-full/display-list';
import { rgbaOf } from '$lib/motion/gpu-full/rgba';
import type { Glyphs } from './chrome';
import type { CoreTheme } from './overlay';
import { EmptyPart, emptyItems } from './empty-card';

const theme: CoreTheme = { paper: '#ffffff', panel: '#ffffff', paper2: '#f9f9f9', line: '#ededef', line2: '#d2d2d7', chip: '#f2f2f2', chipInk: '#141414', ink: '#1d1d1f', inkSoft: '#6e6e73', accent: '#0099ff', wire: '#b3b3b6', iterate: '#d97706' };
const glyphs: Glyphs = (text, size, set) => ({ contours: text ? [[0, 0, 10, 0, 10, size, 0, size]] : [], width: 10 * text.length, height: set?.width && text.length * 10 > set.width ? 2 * size * 1.4 : size * 1.4 });
const icon = [[0, 0, 20, 0, 20, 20, 0, 20]];

const draw = (h = 240) => emptyItems({ id: 'n', x: 0, y: 0, w: 320, h }, { title: 'Ads', hint: 'Search a brand.', icon }, { theme, glyphs, bold: glyphs }) as PathItem[];
const parts = (items: PathItem[], p: EmptyPart) => items.filter((i) => i.clip === `n:${p}` || i.clip.startsWith(`n:${p}:`));
const bounds = (i: PathItem) => {
  const xs = i.contours.flatMap((c) => c.filter((_, k) => k % 2 === 0));
  const ys = i.contours.flatMap((c) => c.filter((_, k) => k % 2 === 1));
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) => Math.round(v * 10) / 10);
};

describe('emptyItems', () => {
  it('centres a 40px icon box above the title and the hint, like the DOM empty node', () => {
    const items = draw();
    const [boxFill] = parts(items, EmptyPart.IconBox);

    expect(bounds(boxFill)).toEqual([140, 73.9, 180, 113.9]);
    expect(boxFill.paint).toEqual({ kind: 'solid', color: rgbaOf(theme.paper2) });
    expect(bounds(parts(items, EmptyPart.Icon)[0])).toEqual([150, 83.9, 170, 103.9]);
  });

  it('draws a dashed border in line-2 on paper', () => {
    const items = draw();

    expect(parts(items, EmptyPart.Border).length).toBeGreaterThan(4);
    expect(parts(items, EmptyPart.Paper)[0].paint).toEqual({ kind: 'solid', color: rgbaOf(theme.paper) });
  });

  it('writes the title bold in ink and the hint in soft ink', () => {
    const items = draw();

    expect(parts(items, EmptyPart.Title)[0].paint).toEqual({ kind: 'solid', color: rgbaOf(theme.ink) });
    expect(parts(items, EmptyPart.Hint)[0].paint).toEqual({ kind: 'solid', color: rgbaOf(theme.inkSoft) });
  });
});
