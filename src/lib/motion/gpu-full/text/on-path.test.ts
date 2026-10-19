import { describe, expect, it } from 'vitest';
import { COMPONENTS } from '../../components';
import { apply2d } from '../../affine';
import { animatorSchema, AnimatorUnit, SelectorShape } from '../../text-animators/model';
import type { Placement } from '../../text-path/layout';
import { paintOnPath, type PathEnv } from './on-path';
import { Smoothing, TextGap, type Ink } from './painter';
import { boxBook } from './test-face';

const stage = { width: 1920, height: 1080 };
const SIZE = 108;
const straight: Placement = { first: 0, last: 0, align: 0, reverse: false, perpendicular: true, force: false };

function env(text: string, points: [number, number][], change: Partial<PathEnv> = {}): PathEnv {
  const props = COMPONENTS.Title.schema.parse({ text, size: SIZE / stage.height, tracking: 0, color: '#ffffff' }) as Record<string, unknown>;
  return { component: 'Title', smoothing: Smoothing.Plain, props, stage, box: { width: 1000, height: 400 }, colour: (v) => v, fonts: boxBook(), animators: [], onPath: { curve: { points, closed: false }, placement: straight }, ...change };
}

function extent(inks: Ink[]) {
  const pts = inks.flatMap((ink) => ink.contours.flatMap((c) => c.flatMap((_, i) => (i % 2 === 0 ? [apply2d(ink.matrix, [c[i], c[i + 1]])] : []))));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

const drawn = (painted: ReturnType<typeof paintOnPath>): Ink[] => {
  if (typeof painted === 'string') {
    throw new Error(`gap ${painted}`);
  }
  return painted.inks;
};

describe('paintOnPath', () => {
  it('centres each character on its arc length, baseline on the path', () => {
    const ink = extent(drawn(paintOnPath(env('ab', [[0, 200], [1000, 200]]))));

    expect(ink.left).toBeCloseTo(0);
    expect(ink.right).toBeCloseTo(SIZE);
    expect(ink.bottom).toBeCloseTo(200, 0);
    expect(ink.top).toBeCloseTo(200 - 0.7 * SIZE, 0);
  });

  it('turns each character with the tangent', () => {
    const ink = extent(drawn(paintOnPath(env('a', [[300, 0], [300, 1000]]))));

    expect(ink.right - ink.left).toBeCloseTo(0.7 * SIZE);
    expect(ink.bottom - ink.top).toBeCloseTo(0.5 * SIZE);
  });

  it('animates each character in its own box', () => {
    const hide = animatorSchema.parse({ id: 'a', unit: AnimatorUnit.Char, shape: SelectorShape.Square, end: 50, values: { opacity: 0 } });
    const ink = extent(drawn(paintOnPath(env('ab', [[0, 200], [1000, 200]], { animators: [hide] }))));

    expect(ink.left).toBeCloseTo(SIZE / 2);
  });

  it('names a character no font covers', () => {
    expect(paintOnPath(env('a★', [[0, 0], [100, 0]], { fonts: boxBook(new Set(['★'])) }))).toBe(TextGap.Glyph);
  });

  it('spreads characters by a tracking animator', () => {
    const spread = animatorSchema.parse({ id: 'a', unit: AnimatorUnit.Char, values: { tracking: 0.5 } });

    expect(extent(drawn(paintOnPath(env('ab', [[0, 200], [1000, 200]], { animators: [spread] })))).right).toBeCloseTo(SIZE + SIZE / 2);
  });
});
