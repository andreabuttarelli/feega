import { Cap, Join, strokePolygons } from '../gpu-full/stroke';
import type { Contour, Outline, Pt } from '../shape/geometry';

export enum ArrowCap {
  None = 'none',
  LineArrow = 'line-arrow',
  TriangleArrow = 'triangle-arrow',
  ReversedTriangle = 'reversed-triangle',
  Circle = 'circle',
  Diamond = 'diamond'
}

export const ARROW_CAPS = Object.values(ArrowCap) as [ArrowCap, ...ArrowCap[]];

export type Ends = { start: ArrowCap; end: ArrowCap };

type Tip = { at: Pt; dir: Pt; normal: Pt };

const HEAD_LENGTH = 3;
const HEAD_HALF = 1.5;
const LINE_REACH = 3;
const DOT_RADIUS = 1.5;
const DIAMOND_REACH = 2;
const ROUND_STEPS = 24;
const EPSILON = 1e-9;

const along = (t: Tip, d: number, n: number): number[] => [t.at[0] + t.dir[0] * d + t.normal[0] * n, t.at[1] + t.dir[1] * d + t.normal[1] * n];

const HEADS: Record<ArrowCap, (t: Tip, w: number) => number[][]> = {
  [ArrowCap.None]: () => [],
  [ArrowCap.LineArrow]: (t, w) => strokePolygons([...along(t, -LINE_REACH * w, LINE_REACH * w), ...t.at, ...along(t, -LINE_REACH * w, -LINE_REACH * w)], false, w, Cap.Round, Join.Miter),
  [ArrowCap.TriangleArrow]: (t, w) => [[...along(t, HEAD_LENGTH * w, 0), ...along(t, 0, HEAD_HALF * w), ...along(t, 0, -HEAD_HALF * w)]],
  [ArrowCap.ReversedTriangle]: (t, w) => [[...along(t, -HEAD_LENGTH * w, 0), ...along(t, 0, -HEAD_HALF * w), ...along(t, 0, HEAD_HALF * w)]],
  [ArrowCap.Circle]: (t, w) => [Array.from({ length: ROUND_STEPS }, (_, i) => along(t, Math.cos((i / ROUND_STEPS) * Math.PI * 2) * DOT_RADIUS * w, Math.sin((i / ROUND_STEPS) * Math.PI * 2) * DOT_RADIUS * w)).flat()],
  [ArrowCap.Diamond]: (t, w) => [[...along(t, DIAMOND_REACH * w, 0), ...along(t, 0, DIAMOND_REACH * w), ...along(t, -DIAMOND_REACH * w, 0), ...along(t, 0, -DIAMOND_REACH * w)]]
};

const distinct = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]) > EPSILON;

function tip(at: Pt, from: Pt): Tip | null {
  const len = Math.hypot(at[0] - from[0], at[1] - from[1]);
  if (len <= EPSILON) {
    return null;
  }
  const dir: Pt = [(at[0] - from[0]) / len, (at[1] - from[1]) / len];
  return { at, dir, normal: [-dir[1], dir[0]] };
}

function tips(c: Contour): { start: Tip | null; end: Tip | null } {
  const v = c.vertices;
  if (c.closed || v.length < 2) {
    return { start: null, end: null };
  }
  const first = v[0];
  const last = v[v.length - 1];
  const startFrom = distinct(first.out, first.p) ? first.out : v[1].p;
  const endFrom = distinct(last.in, last.p) ? last.in : v[v.length - 2].p;
  return { start: tip(first.p, startFrom), end: tip(last.p, endFrom) };
}

export function arrowHeads(outline: Outline, ends: Ends, width: number): number[][] {
  return outline.flatMap((c) => {
    const { start, end } = tips(c);
    return [...(start ? HEADS[ends.start](start, width) : []), ...(end ? HEADS[ends.end](end, width) : [])];
  });
}

export const hasArrows = (ends: Ends): boolean => ends.start !== ArrowCap.None || ends.end !== ArrowCap.None;
