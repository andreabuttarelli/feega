import { describe, expect, it } from 'vitest';
import { COMPONENTS } from '../../components';
import { boxOf } from '../../layout';
import { apply2d } from '../../affine';
import { LIST_STEP_EM, MARKER_GAP_EM } from '../../text-lists';
import { paintText, Smoothing, type Ink, type TextEnv } from './painter';
import { UPM, WIDE, boxBook } from './test-face';

const stage = { width: 1920, height: 1080 };
const SIZE = 0.04;
const SIZE_PX = SIZE * 1080;
const MARKER_WIDTH_EM = WIDE / UPM;

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

const left = (inks: Ink[]) => Math.min(...points(inks).map((p) => p[0]));
const right = (inks: Ink[]) => Math.max(...points(inks).map((p) => p[0]));
const bullet = (level = 0) => ({ kind: 'bullet', level });

describe('list paragraphs on the canvas', () => {
  it('indents the text one step and hangs the marker in the gutter before it', () => {
    const plain = inksOf(env({ text: 'aa' }));
    const listed = inksOf(env({ text: 'aa', lists: [bullet()] }));
    const markerLeft = (LIST_STEP_EM - MARKER_GAP_EM - MARKER_WIDTH_EM) * SIZE_PX;

    expect(left(listed)).toBeCloseTo(markerLeft, 0);
    expect(right(listed) - right(plain)).toBeCloseTo(LIST_STEP_EM * SIZE_PX, 0);
  });

  it('moves a nested item one more step in', () => {
    const level0 = inksOf(env({ text: 'aa', lists: [bullet()] }));
    const level1 = inksOf(env({ text: 'aa', lists: [bullet(1)] }));

    expect(right(level1) - right(level0)).toBeCloseTo(LIST_STEP_EM * SIZE_PX, 0);
  });

  it('wraps a long item back to the text edge, not to the marker', () => {
    const wide = env({ text: 'aa bb cc dd ee', width: 0.12, height: 0.6, lists: [bullet()] });
    const rows = new Map<number, number>();
    for (const p of points(inksOf(wide))) {
      rows.set(Math.round(p[1]), Math.min(rows.get(Math.round(p[1])) ?? Infinity, p[0]));
    }
    const starts = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, x]) => Math.round(x));

    expect(starts.length).toBeGreaterThan(2);
    expect(Math.max(...starts.slice(1))).toBeGreaterThanOrEqual(Math.round(LIST_STEP_EM * SIZE_PX) - 1);
  });

  it('leaves a plain paragraph beside a list item where it was', () => {
    const only = inksOf(env({ text: 'aa\nbb' }));
    const mixed = inksOf(env({ text: 'aa\nbb', lists: [null, bullet()] }));
    const firstRow = (inks: Ink[]) => points(inks).filter((p) => p[1] < SIZE_PX);

    expect(Math.min(...firstRow(mixed).map((p) => p[0]))).toBe(Math.min(...firstRow(only).map((p) => p[0])));
  });

  it('keeps the first-line indent on top of the list indent', () => {
    const a = inksOf(env({ text: 'aa', lists: [bullet()] }));
    const b = inksOf(env({ text: 'aa', lists: [bullet()], paragraphIndent: 1 }));

    expect(right(b) - right(a)).toBeCloseTo(SIZE_PX, 0);
  });

  it('aligns the text, not the marker, to the right edge', () => {
    const e = env({ text: 'aa', align: 'right', lists: [bullet()] });

    expect(right(inksOf(e))).toBeCloseTo(e.box.width, 0);
  });
});
