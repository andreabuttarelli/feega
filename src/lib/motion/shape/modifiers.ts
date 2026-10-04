import clipping, { type MultiPolygon, type Polygon } from 'polygon-clipping';
import { corner, distance, flatten, polyline, trimContour, type Contour, type Outline, type Pt, type Size, type Vertex } from './geometry';
import { resample } from './morph';

export type Matrix = readonly [number, number, number, number, number, number];
export type Layer = { outline: Outline; opacity: number; matrix: Matrix };
export type ModContext = { size: Size; time: number };
export type ModParam = { key: string; label: string; min: number; max: number; step: number; fallback: number; options?: readonly string[] };
export type Values = Record<string, number>;

export enum ModifierKind {
  Trim = 'trim',
  Repeater = 'repeater',
  Offset = 'offset',
  Wiggle = 'wiggle',
  ZigZag = 'zigzag',
  RoundCorners = 'round',
  Merge = 'merge'
}

export const MODIFIER_KINDS = Object.values(ModifierKind) as [ModifierKind, ...ModifierKind[]];
export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
export const MERGE_OPS = ['union', 'subtract', 'intersect', 'exclude'] as const;

const KAPPA = 0.5522847498;
const MITER_LIMIT = 4;
const DEGREES = Math.PI / 180;

const param = (key: string, label: string, min: number, max: number, step: number, fallback: number, options?: readonly string[]): ModParam => ({ key, label, min, max, step, fallback, options });

export function multiply(m: Matrix, n: Matrix): Matrix {
  return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
}

const translate = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];
const rotation = (degrees: number): Matrix => {
  const r = degrees * DEGREES;
  return [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
};
const scaling = (s: number): Matrix => [s, 0, 0, s, 0, 0];

const unitOf = (size: Size) => Math.min(size.w, size.h);
const each = (layers: Layer[], f: (c: Contour) => Contour[]): Layer[] => layers.map((l) => ({ ...l, outline: l.outline.flatMap(f) }));

function signedArea(points: readonly Pt[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
}

function edgeNormal(a: Pt, b: Pt): Pt {
  const len = distance(a, b) || 1;
  return [(b[1] - a[1]) / len, -(b[0] - a[0]) / len];
}

function normals(points: readonly Pt[], closed: boolean): Pt[] {
  const outward = closed && signedArea(points) < 0 ? -1 : 1;
  const n = points.length;
  return points.map((p, i) => {
    const prev = closed ? points[(i - 1 + n) % n] : points[Math.max(i - 1, 0)];
    const next = closed ? points[(i + 1) % n] : points[Math.min(i + 1, n - 1)];
    const a = edgeNormal(prev === p ? p : prev, prev === p ? next : p);
    const b = edgeNormal(next === p ? prev : p, next === p ? p : next);
    const dot = a[0] * b[0] + a[1] * b[1];
    const miter = Math.min(1 / Math.max(1 + dot, 1e-9), MITER_LIMIT / 2);
    return [(a[0] + b[0]) * miter * outward, (a[1] + b[1]) * miter * outward];
  });
}

function displaced(points: readonly Pt[], closed: boolean, by: (i: number) => number): Pt[] {
  const n = normals(points, closed);
  return points.map((p, i) => [p[0] + n[i][0] * by(i), p[1] + n[i][1] * by(i)]);
}

function hash(seed: number, i: number, k: number, axis: number): number {
  let h = Math.imul(seed | 0, 374761393) ^ Math.imul(i | 0, 668265263) ^ Math.imul(k | 0, 2246822519) ^ Math.imul(axis, 3266489917);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967295) * 2 - 1;
}

function noise(seed: number, i: number, phase: number, axis: number): number {
  const k = Math.floor(phase);
  const f = phase - k;
  const s = f * f * (3 - 2 * f);
  return hash(seed, i, k, axis) * (1 - s) + hash(seed, i, k + 1, axis) * s;
}

function roundContour(contour: Contour, radius: number): Contour {
  const v = contour.vertices;
  const n = v.length;
  const sharp = (x: Vertex) => x.in === x.p || (x.in[0] === x.p[0] && x.in[1] === x.p[1] && x.out[0] === x.p[0] && x.out[1] === x.p[1]);
  const vertices = v.flatMap((x, i): Vertex[] => {
    const inner = contour.closed || (i > 0 && i < n - 1);
    if (!inner || !sharp(x)) {
      return [x];
    }
    const prev = v[(i - 1 + n) % n].p;
    const next = v[(i + 1) % n].p;
    const r = Math.min(radius, distance(prev, x.p) / 2, distance(next, x.p) / 2);
    const toward = (q: Pt): Pt => {
      const d = distance(q, x.p) || 1;
      return [x.p[0] + ((q[0] - x.p[0]) * r) / d, x.p[1] + ((q[1] - x.p[1]) * r) / d];
    };
    const bend = (from: Pt): Pt => [from[0] + (x.p[0] - from[0]) * KAPPA, from[1] + (x.p[1] - from[1]) * KAPPA];
    const a = toward(prev);
    const b = toward(next);
    return [
      { p: a, in: a, out: bend(a) },
      { p: b, in: bend(b), out: b }
    ];
  });
  return { vertices, closed: contour.closed };
}

const ringOf = (c: Contour): [number, number][] => flatten(c).map((p) => [p[0], p[1]]);

const MERGE: Record<(typeof MERGE_OPS)[number], (first: Polygon, rest: Polygon[]) => MultiPolygon> = {
  union: (first, rest) => clipping.union(first, ...rest),
  subtract: (first, rest) => clipping.difference(first, ...rest),
  intersect: (first, rest) => clipping.intersection(first, ...rest),
  exclude: (first, rest) => clipping.xor(first, ...rest)
};

function merged(outline: Outline, op: number): Outline {
  const closed = outline.filter((c) => c.closed && c.vertices.length > 2);
  if (closed.length < 2) {
    return outline;
  }
  const [first, ...rest] = closed.map((c) => [ringOf(c)] as Polygon);
  const name = MERGE_OPS[Math.min(Math.max(Math.round(op), 0), MERGE_OPS.length - 1)];
  return MERGE[name](first, rest).flatMap((polygon) => polygon.map((ring) => polyline(ring.slice(0, -1), true)));
}

type Spec = { label: string; params: readonly ModParam[]; apply: (layers: Layer[], v: Values, ctx: ModContext) => Layer[] };

export const MODIFIERS: Record<ModifierKind, Spec> = {
  [ModifierKind.Trim]: {
    label: 'Trim paths',
    params: [param('start', 'Start', 0, 1, 0.01, 0), param('end', 'End', 0, 1, 0.01, 1), param('offset', 'Offset', -10, 10, 0.01, 0)],
    apply: (layers, v) => each(layers, (c) => trimContour(c, Math.min(v.start, v.end), Math.max(v.start, v.end), v.offset))
  },
  [ModifierKind.Repeater]: {
    label: 'Repeater',
    params: [
      param('copies', 'Copies', 1, 100, 1, 3),
      param('offsetX', 'Step X', -2, 2, 0.01, 0.1),
      param('offsetY', 'Step Y', -2, 2, 0.01, 0),
      param('rotation', 'Step rotation', -360, 360, 1, 0),
      param('scale', 'Step scale', 0, 4, 0.01, 1),
      param('endOpacity', 'Last copy opacity', 0, 1, 0.01, 1)
    ],
    apply: (layers, v, { size }) => {
      const copies = Math.max(1, Math.round(v.copies));
      const pivot: Pt = [size.w / 2, size.h / 2];
      return Array.from({ length: copies }, (_, i) => {
        const turn = multiply(translate(pivot[0], pivot[1]), multiply(rotation(v.rotation * i), multiply(scaling(v.scale ** i), translate(-pivot[0], -pivot[1]))));
        const step = multiply(translate(v.offsetX * size.w * i, v.offsetY * size.h * i), turn);
        const opacity = copies === 1 ? 1 : 1 + ((v.endOpacity - 1) * i) / (copies - 1);
        return layers.map((l) => ({ outline: l.outline, opacity: l.opacity * opacity, matrix: multiply(step, l.matrix) }));
      }).flat();
    }
  },
  [ModifierKind.Offset]: {
    label: 'Offset path',
    params: [param('amount', 'Amount', -0.5, 0.5, 0.005, 0.05)],
    apply: (layers, v, { size }) => each(layers, (c) => [polyline(displaced(flatten(c), c.closed, () => v.amount * unitOf(size)), c.closed)])
  },
  [ModifierKind.Wiggle]: {
    label: 'Wiggle paths',
    params: [param('size', 'Size', 0, 0.5, 0.005, 0.03), param('detail', 'Points', 4, 300, 1, 48), param('speed', 'Wiggles/s', 0, 30, 0.1, 2), param('seed', 'Seed', 0, 9999, 1, 1)],
    apply: (layers, v, { size, time }) =>
      each(layers, (c) => {
        const points = resample(c, Math.max(4, Math.round(v.detail)));
        const phase = time * v.speed;
        const amp = v.size * unitOf(size);
        return [polyline(points.map((p, i): Pt => [p[0] + noise(v.seed, i, phase, 0) * amp, p[1] + noise(v.seed, i, phase, 1) * amp]), c.closed)];
      })
  },
  [ModifierKind.ZigZag]: {
    label: 'Zig zag',
    params: [param('size', 'Size', 0, 0.5, 0.005, 0.03), param('ridges', 'Ridges', 1, 200, 1, 12)],
    apply: (layers, v, { size }) =>
      each(layers, (c) => {
        const points = resample(c, Math.max(2, Math.round(v.ridges)) * 2);
        return [polyline(displaced(points, c.closed, (i) => (i % 2 ? -1 : 1) * v.size * unitOf(size)), c.closed)];
      })
  },
  [ModifierKind.RoundCorners]: {
    label: 'Round corners',
    params: [param('radius', 'Radius', 0, 0.5, 0.005, 0.05)],
    apply: (layers, v, { size }) => each(layers, (c) => [roundContour(c, v.radius * unitOf(size))])
  },
  [ModifierKind.Merge]: {
    label: 'Merge paths',
    params: [param('op', 'Mode', 0, MERGE_OPS.length - 1, 1, 0, MERGE_OPS)],
    apply: (layers, v) => layers.map((l) => ({ ...l, outline: merged(l.outline, v.op) }))
  }
};

export type AppliedModifier = { kind: ModifierKind; values: Values };

export function applyModifiers(layers: Layer[], stack: readonly AppliedModifier[], ctx: ModContext): Layer[] {
  return stack.reduce((current, m) => MODIFIERS[m.kind].apply(current, m.values, ctx), layers);
}

export const pointsOnly = (outline: Outline): Outline => outline.map((c) => ({ closed: c.closed, vertices: flatten(c).map(corner) }));
