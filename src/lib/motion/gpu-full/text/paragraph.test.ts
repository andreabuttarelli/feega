import { describe, expect, it } from 'vitest';
import { COMPONENTS } from '@feega/motion-core/motion/components';
import { boxOf } from '@feega/motion-core/motion/layout';
import { apply2d } from '@feega/motion-core/motion/affine';
import { casedOf, paintText, Smoothing, type Ink, type TextEnv } from '@feega/motion-core/motion/gpu-full/text/painter';
import { boxBook } from './test-face';

const stage = { width: 1920, height: 1080 };
const SIZE = 0.04;
const SIZE_PX = SIZE * 1080;

function env(props: Record<string, unknown>): TextEnv {
  const parsed = COMPONENTS.Text.schema.parse({ size: SIZE, ...props }) as Record<string, unknown>;
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

function extent(inks: Ink[]) {
  const all = points(inks);
  return { left: Math.min(...all.map((p) => p[0])), right: Math.max(...all.map((p) => p[0])), top: Math.min(...all.map((p) => p[1])), bottom: Math.max(...all.map((p) => p[1])) };
}

const rowsOf = (inks: Ink[]) => [...new Set(points(inks).map((p) => Math.round(p[1])))].sort((a, b) => a - b);

describe('paragraph typography', () => {
  it('justifies every line but the last flush to both edges', () => {
    const e = env({ text: 'aa b cc dd', align: 'justify', width: 0.06, height: 0.6 });
    const inks = inksOf(e);
    const first = points(inks).filter((p) => p[1] < extent(inks).top + SIZE_PX);

    expect(Math.min(...first.map((p) => p[0]))).toBeCloseTo(0, 0);
    expect(Math.max(...first.map((p) => p[0]))).toBeCloseTo(e.box.width, 0);
  });

  it('sits a fixed text at the top or bottom of its box', () => {
    const top = extent(inksOf(env({ text: 'a', verticalAlign: 'top', height: 0.5 })));
    const bottom = extent(inksOf(env({ text: 'a', verticalAlign: 'bottom', height: 0.5 })));
    const box = env({ height: 0.5 }).box;

    expect(top.top).toBeLessThan(SIZE_PX);
    expect(bottom.bottom).toBeGreaterThan(box.height - SIZE_PX);
  });

  it('adds paragraph spacing between paragraphs, not after the last', () => {
    const plain = rowsOf(inksOf(env({ text: 'a\nb', align: 'left', verticalAlign: 'top' })));
    const spaced = rowsOf(inksOf(env({ text: 'a\nb', align: 'left', verticalAlign: 'top', paragraphSpacing: 1 })));

    expect(spaced.at(-1)! - spaced[0]).toBeCloseTo(plain.at(-1)! - plain[0] + SIZE_PX, 0);
  });

  it('indents the first line of every paragraph', () => {
    const inks = inksOf(env({ text: 'a\nb', align: 'left', paragraphIndent: 2 }));

    expect(extent(inks).left).toBeCloseTo(2 * SIZE_PX, 0);
  });

  it('title-cases every word', () => {
    expect(casedOf('Text', { text: 'hello big world', textCase: 'title' })).toBe('Hello Big World');
  });
});
