import { describe, expect, it } from 'vitest';
import { COMPONENTS } from '../../components';
import { boxOf } from '../../layout';
import { apply2d } from '../../affine';
import { paintText, Smoothing, type Ink, type TextEnv } from './painter';
import { boxBook } from './test-face';

const stage = { width: 1920, height: 1080 };
const SIZE = 0.04;
const SIZE_PX = SIZE * 1080;
const GLYPH_TOP_EM = 0.7;

function env(props: Record<string, unknown>): TextEnv {
  const parsed = COMPONENTS.Text.schema.parse({ size: SIZE, align: 'left', verticalAlign: 'top', ...props }) as Record<string, unknown>;
  return { component: 'Text', smoothing: Smoothing.Plain, props: parsed, box: boxOf(parsed as never, stage), stage, colour: () => '#ffffff', time: 10, trim: 0, fps: 30, still: null, fonts: boxBook(), animators: [], asset: () => null };
}

const inksOf = (e: TextEnv): Ink[] => {
  const painted = paintText(e);
  if (typeof painted === 'string') {
    throw new Error(painted);
  }
  return painted.inks;
};

const points = (inks: Ink[]) => inks.flatMap((ink) => ink.contours.flatMap((c) => Array.from({ length: c.length / 2 }, (_, i) => apply2d(ink.matrix, [c[2 * i], c[2 * i + 1]]))));
const glyphTops = (inks: Ink[]) => [...new Set(points(inks).map((p) => Math.round(p[1] * 10) / 10))].sort((a, b) => a - b);
const lineCount = (inks: Ink[]) => new Set(inks.flatMap((ink) => ink.contours.map((c) => Math.round(apply2d(ink.matrix, [c[0], c[1]])[1])))).size;
const right = (inks: Ink[]) => Math.max(...points(inks).map((p) => p[0]));

describe('line typography', () => {
  it('reads line height in px as px', () => {
    const tops = glyphTops(inksOf(env({ text: 'a\nb', lineHeight: '100px' })));

    expect(tops.at(-1)! - tops[0]).toBeCloseTo(100 + GLYPH_TOP_EM * SIZE_PX, 0);
  });

  it('reads line height in % of the type size', () => {
    const half = glyphTops(inksOf(env({ text: 'a\nb', lineHeight: '200%' })));

    expect(half.at(-1)! - half[0]).toBeCloseTo(2 * SIZE_PX + GLYPH_TOP_EM * SIZE_PX, 0);
  });

  it('auto line height is the font ascent plus descent', () => {
    const tops = glyphTops(inksOf(env({ text: 'a\nb', lineHeight: 'auto' })));

    expect(tops.at(-1)! - tops[0]).toBeCloseTo(Math.round(0.8 * SIZE_PX) + Math.round(0.2 * SIZE_PX) + GLYPH_TOP_EM * SIZE_PX, 0);
  });

  it('reads letter spacing in px and in %', () => {
    const plain = right(inksOf(env({ text: 'aa', tracking: 0 })));

    expect(right(inksOf(env({ text: 'aa', letterSpacing: '10px' })))).toBeCloseTo(plain + 10, 0);
    expect(right(inksOf(env({ text: 'aa', letterSpacing: '50%' })))).toBeCloseTo(plain + 0.5 * SIZE_PX, 0);
  });

  it('stops at max lines and ends the last with an ellipsis', () => {
    const inks = inksOf(env({ text: 'aa bb cc dd ee', width: 0.04, truncate: true, maxLines: 2 }));

    expect(lineCount(inks)).toBe(2);
    expect(right(inks)).toBeLessThanOrEqual(env({ width: 0.04 }).box.width + 0.5);
  });

  it('balances the lines of a wrapped paragraph', () => {
    const ragged = inksOf(env({ text: 'aa bb cc dd ee', width: 0.13 }));
    const balanced = inksOf(env({ text: 'aa bb cc dd ee', width: 0.13, textWrap: 'balance' }));

    expect(lineCount(balanced)).toBe(lineCount(ragged));
    expect(right(balanced)).toBeLessThan(right(ragged));
  });

  it('trims the leading above the cap height and below the baseline', () => {
    const trimmed = points(inksOf(env({ text: 'a', leadingTrim: 'cap', lineHeight: '300%' })));

    expect(Math.min(...trimmed.map((p) => p[1]))).toBeCloseTo(0, 0);
  });
});
