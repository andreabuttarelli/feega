import { describe, expect, it } from 'vitest';
import { COMPONENTS } from '@feega/motion-core/motion/components';
import { boxOf } from '@feega/motion-core/motion/layout';
import { apply2d } from '@feega/motion-core/motion/affine';
import { paintText, Smoothing, type Ink, type TextEnv } from '@feega/motion-core/motion/gpu-full/text/painter';
import { boxBook, seenFeatures } from './test-face';
import { PaintKind } from '@feega/motion-core/motion/gpu-full/paint';

const stage = { width: 1920, height: 1080 };
const SIZE = 0.04;
const SIZE_PX = SIZE * 1080;

function env(props: Record<string, unknown>): TextEnv {
  const parsed = COMPONENTS.Text.schema.parse({ size: SIZE, align: 'left', verticalAlign: 'top', text: 'aa', ...props }) as Record<string, unknown>;
  return { component: 'Text', smoothing: Smoothing.Plain, props: parsed, box: boxOf(parsed as never, stage), stage, colour: (v) => (v.startsWith('#') ? v : '#ffffff'), time: 10, trim: 0, fps: 30, still: null, fonts: boxBook(), animators: [], asset: () => null };
}

const inksOf = (e: TextEnv): Ink[] => {
  const painted = paintText(e);
  if (typeof painted === 'string') {
    throw new Error(painted);
  }
  return painted.inks;
};

const points = (inks: Ink[]) => inks.flatMap((ink) => ink.contours.flatMap((c) => Array.from({ length: c.length / 2 }, (_, i) => apply2d(ink.matrix, [c[2 * i], c[2 * i + 1]]))));
const bottom = (inks: Ink[]) => Math.max(...points(inks).map((p) => p[1]));
const contours = (inks: Ink[]) => inks.reduce((n, i) => n + i.contours.length, 0);

describe('text decoration', () => {
  it('draws an underline at its offset with its thickness', () => {
    const plain = bottom(inksOf(env({})));
    const under = bottom(inksOf(env({ decoration: 'underline', decorationOffset: 0.2, decorationThickness: 0.1 })));

    expect(under - plain).toBeCloseTo(0.3 * SIZE_PX, 0);
  });

  it('draws a strikethrough inside the glyphs', () => {
    expect(contours(inksOf(env({ decoration: 'strikethrough' })))).toBeGreaterThan(contours(inksOf(env({}))));
    expect(bottom(inksOf(env({ decoration: 'strikethrough' })))).toBeCloseTo(bottom(inksOf(env({}))), 5);
  });

  it('breaks a dashed underline into pieces', () => {
    const solid = contours(inksOf(env({ decoration: 'underline' })));

    expect(contours(inksOf(env({ decoration: 'underline', decorationStyle: 'dashed' })))).toBeGreaterThan(solid);
  });

  it('skips the ink where the underline crosses a glyph', () => {
    const crossing = { decoration: 'underline', decorationOffset: -0.3 };
    const through = points(inksOf(env({ ...crossing, skipInk: false })));
    const skipped = points(inksOf(env({ ...crossing, skipInk: true })));

    expect(skipped.length).toBeLessThan(through.length);
  });

  it('paints the decoration in its own colour', () => {
    const inks = inksOf(env({ decoration: 'underline', decorationColor: '#ff0000' }));

    expect(inks.some((i) => i.paint.kind === PaintKind.Solid && i.paint.color[0] === 1 && i.paint.color[1] === 0)).toBe(true);
  });
});

describe('OpenType features', () => {
  it('hands the features to the shaper', () => {
    seenFeatures.length = 0;
    inksOf(env({ features: "'tnum' 1, 'liga' 0" }));

    expect(seenFeatures.at(-1)).toMatchObject({ tnum: true, liga: false });
  });

  it('turns small caps into the smcp feature', () => {
    seenFeatures.length = 0;
    inksOf(env({ textCase: 'small-caps' }));

    expect(seenFeatures.at(-1)).toMatchObject({ smcp: true });
  });
});
