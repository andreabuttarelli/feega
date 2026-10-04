export type Pt = readonly [number, number];
export type Vertex = { p: Pt; in: Pt; out: Pt };
export type Contour = { vertices: Vertex[]; closed: boolean };
export type Outline = Contour[];
export type Size = { w: number; h: number };

const UNIT: Size = { w: 1, h: 1 };
const CURVE_SAMPLES = 16;
const KAPPA = 0.5522847498;
const DIGITS = 10000;
const PATH_CHARS = /^[\sMmLlHhVvCcSsQqTtZz0-9eE.,+-]*$/;
const TOKEN = /[MmLlHhVvCcSsQqTtZz]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;

export const corner = (p: Pt): Vertex => ({ p, in: p, out: p });
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const times = (a: Pt, n: number): Pt => [a[0] * n, a[1] * n];
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const same = (a: Pt, b: Pt) => a[0] === b[0] && a[1] === b[1];
export const distance = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function cubicAt(a: Pt, b: Pt, c: Pt, d: Pt, t: number): Pt {
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [w[0] * a[0] + w[1] * b[0] + w[2] * c[0] + w[3] * d[0], w[0] * a[1] + w[1] * b[1] + w[2] * c[1] + w[3] * d[1]];
}

export function segmentsOf(contour: Contour): [Vertex, Vertex][] {
  const v = contour.vertices;
  const open = v.slice(1).map((next, i): [Vertex, Vertex] => [v[i], next]);
  return contour.closed && v.length > 1 ? [...open, [v[v.length - 1], v[0]]] : open;
}

const straight = ([a, b]: [Vertex, Vertex]) => same(a.out, a.p) && same(b.in, b.p);

export function flatten(contour: Contour): Pt[] {
  const points: Pt[] = [];
  for (const segment of segmentsOf(contour)) {
    const [a, b] = segment;
    if (straight(segment)) {
      points.push(a.p);
      continue;
    }
    for (let i = 0; i < CURVE_SAMPLES; i++) {
      points.push(cubicAt(a.p, a.out, b.in, b.p, i / CURVE_SAMPLES));
    }
  }
  const last = contour.vertices[contour.vertices.length - 1];
  return contour.closed || !last ? points : [...points, last.p];
}

export function polylineLength(points: readonly Pt[], closed: boolean): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distance(points[i - 1], points[i]);
  }
  return closed && points.length > 1 ? total + distance(points[points.length - 1], points[0]) : total;
}

export function contourLength(contour: Contour): number {
  return polylineLength(flatten(contour), contour.closed);
}

export const polyline = (points: readonly Pt[], closed: boolean): Contour => ({ vertices: points.map(corner), closed });

function cutPolyline(points: readonly Pt[], from: number, to: number): Pt[] {
  const out: Pt[] = [];
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = distance(a, b);
    const next = walked + len;
    if (next >= from && walked <= to && len > 0) {
      const start = Math.max(0, (from - walked) / len);
      const end = Math.min(1, (to - walked) / len);
      if (!out.length) {
        out.push(lerp(a, b, start));
      }
      out.push(lerp(a, b, end));
    }
    walked = next;
  }
  return out;
}

export function trimContour(contour: Contour, start: number, end: number, offset: number): Contour[] {
  const span = end - start;
  if (span <= 0) {
    return [];
  }
  if (span >= 1) {
    return [contour];
  }
  const flat = flatten(contour);
  const ring = contour.closed ? [...flat, flat[0]] : flat;
  const total = polylineLength(ring, false);
  const from = (((start + offset) % 1) + 1) % 1;
  const to = from + span;
  const pieces = to <= 1 ? [[from, to]] : [[from, 1], [0, to - 1]];
  return pieces
    .map(([a, b]) => cutPolyline(ring, a * total, b * total))
    .filter((p) => p.length > 1)
    .map((p) => polyline(p, false));
}

function arcCorner(center: Pt, r: Pt, startAngle: number): Vertex[] {
  const at = (angle: number): Pt => [center[0] + r[0] * Math.cos(angle), center[1] + r[1] * Math.sin(angle)];
  const tangent = (angle: number, n: number): Pt => [-Math.sin(angle) * r[0] * KAPPA * n, Math.cos(angle) * r[1] * KAPPA * n];
  const end = startAngle + Math.PI / 2;
  const a = at(startAngle);
  const b = at(end);
  return [
    { p: a, in: a, out: add(a, tangent(startAngle, 1)) },
    { p: b, in: sub(b, tangent(end, 1)), out: b }
  ];
}

export function rectOutline(roundness: number, size: Size = UNIT): Outline {
  const { w, h } = size;
  const r = Math.min(Math.max(roundness, 0), 0.5) * Math.min(w, h);
  if (r === 0) {
    return [polyline([[0, 0], [w, 0], [w, h], [0, h]], true)];
  }
  const quarter = Math.PI / 2;
  const corners: [Pt, number][] = [
    [[w - r, r], -quarter],
    [[w - r, h - r], 0],
    [[r, h - r], quarter],
    [[r, r], Math.PI]
  ];
  return [{ vertices: merged(corners.flatMap(([c, a]) => arcCorner(c, [r, r], a))), closed: true }];
}

function merged(vertices: Vertex[]): Vertex[] {
  const out: Vertex[] = [];
  for (const v of vertices) {
    const prev = out[out.length - 1];
    if (prev && distance(prev.p, v.p) < 1e-9) {
      out[out.length - 1] = { p: prev.p, in: prev.in, out: v.out };
      continue;
    }
    out.push(v);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length > 1 && distance(first.p, last.p) < 1e-9) {
    out[0] = { p: first.p, in: last.in, out: first.out };
    out.pop();
  }
  return out;
}

export function ellipseOutline(size: Size = UNIT): Outline {
  const c: Pt = [size.w / 2, size.h / 2];
  const r: Pt = [size.w / 2, size.h / 2];
  const starts = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
  return [{ vertices: merged(starts.flatMap((a) => arcCorner(c, r, a))), closed: true }];
}

function radial(count: number, radius: (i: number) => number, roundness: (i: number) => number, size: Size): Outline {
  const c: Pt = [size.w / 2, size.h / 2];
  const step = (Math.PI * 2) / count;
  const vertices = Array.from({ length: count }, (_, i): Vertex => {
    const angle = -Math.PI / 2 + i * step;
    const r = radius(i);
    const p: Pt = [c[0] + (Math.cos(angle) * r * size.w) / 2, c[1] + (Math.sin(angle) * r * size.h) / 2];
    const handle = (roundness(i) * r * step) / 2;
    const tangent: Pt = [(-Math.sin(angle) * handle * size.w) / 2, (Math.cos(angle) * handle * size.h) / 2];
    return { p, in: sub(p, tangent), out: add(p, tangent) };
  });
  return [{ vertices, closed: true }];
}

export function polygonOutline(sides: number, roundness: number, size: Size = UNIT): Outline {
  return radial(Math.max(3, Math.round(sides)), () => 1, () => roundness, size);
}

export function starOutline(points: number, inner: number, roundness: number, size: Size = UNIT, innerRoundness = 0): Outline {
  const count = Math.max(3, Math.round(points)) * 2;
  return radial(count, (i) => (i % 2 ? inner : 1), (i) => (i % 2 ? innerRoundness : roundness), size);
}

export function mapOutline(outline: Outline, f: (p: Pt) => Pt): Outline {
  return outline.map((c) => ({ closed: c.closed, vertices: c.vertices.map((v) => ({ p: f(v.p), in: f(v.in), out: f(v.out) })) }));
}

export const scaled = (outline: Outline, size: Size): Outline => mapOutline(outline, (p) => [p[0] * size.w, p[1] * size.h]);

const num = (n: number) => String(Math.round(n * DIGITS) / DIGITS);
const pair = (p: Pt) => `${num(p[0])} ${num(p[1])}`;

export function pathData(outline: Outline): string {
  return outline
    .filter((c) => c.vertices.length)
    .map((c) => {
      const moves = segmentsOf(c).map((s) => (straight(s) ? `L${pair(s[1].p)}` : `C${pair(s[0].out)} ${pair(s[1].in)} ${pair(s[1].p)}`));
      const closing = c.closed ? moves.pop()! : '';
      const tail = c.closed ? `${closing.startsWith('C') ? closing : ''}Z` : '';
      return `M${pair(c.vertices[0].p)}${moves.join('')}${tail}`;
    })
    .join('');
}

type Cursor = { tokens: string[]; i: number };

const isCommand = (t: string | undefined) => t !== undefined && /^[A-Za-z]$/.test(t);

export function parsePath(d: string): Outline | string {
  if (!PATH_CHARS.test(d)) {
    return 'path data takes only M L H V C S Q T Z and numbers';
  }
  const cur: Cursor = { tokens: d.match(TOKEN) ?? [], i: 0 };
  if (!cur.tokens.length || !/^[Mm]$/.test(cur.tokens[0])) {
    return 'path data starts with M';
  }

  const outline: Outline = [];
  let contour: Contour | null = null;
  let pen: Pt = [0, 0];
  let start: Pt = [0, 0];
  let lastControl: Pt | null = null;
  let lastQuad: Pt | null = null;
  let command = '';

  const read = (): number => {
    const t = cur.tokens[cur.i++];
    const n = Number(t);
    if (t === undefined || isCommand(t) || !Number.isFinite(n)) {
      throw new Error(`path data: ${command} is missing a number`);
    }
    return n;
  };
  const point = (relative: boolean): Pt => {
    const p: Pt = [read(), read()];
    return relative ? add(pen, p) : p;
  };
  const begin = (p: Pt) => {
    contour = { vertices: [corner(p)], closed: false };
    outline.push(contour);
    start = p;
  };
  const curveTo = (c1: Pt, c2: Pt, p: Pt) => {
    if (!contour) {
      begin(pen);
    }
    const v = contour!.vertices;
    v[v.length - 1] = { ...v[v.length - 1], out: c1 };
    v.push({ p, in: c2, out: p });
    pen = p;
  };
  const lineTo = (p: Pt) => curveTo(pen, p, p);
  const close = () => {
    if (!contour) {
      return;
    }
    const v = contour.vertices;
    const last = v[v.length - 1];
    if (v.length > 1 && same(last.p, v[0].p)) {
      v[0] = { ...v[0], in: last.in };
      v.pop();
    }
    contour.closed = true;
    contour = null;
    pen = start;
  };

  const STEPS: Record<string, (rel: boolean) => void> = {
    m: (rel) => {
      const p = point(rel);
      begin(p);
      pen = p;
      command = rel ? 'l' : 'L';
    },
    l: (rel) => lineTo(point(rel)),
    h: (rel) => lineTo([rel ? pen[0] + read() : read(), pen[1]]),
    v: (rel) => lineTo([pen[0], rel ? pen[1] + read() : read()]),
    c: (rel) => {
      const c1 = point(rel);
      const c2 = point(rel);
      const p = point(rel);
      curveTo(c1, c2, p);
      lastControl = c2;
    },
    s: (rel) => {
      const c1 = lastControl ? sub(times(pen, 2), lastControl) : pen;
      const c2 = point(rel);
      const p = point(rel);
      curveTo(c1, c2, p);
      lastControl = c2;
    },
    q: (rel) => {
      const q = point(rel);
      const p = point(rel);
      quadTo(q, p);
    },
    t: (rel) => {
      const q = lastQuad ? sub(times(pen, 2), lastQuad) : pen;
      quadTo(q, point(rel));
    },
    z: () => close()
  };
  const quadTo = (q: Pt, p: Pt) => {
    const from = pen;
    curveTo(lerp(from, q, 2 / 3), lerp(p, q, 2 / 3), p);
    lastQuad = q;
  };

  try {
    while (cur.i < cur.tokens.length) {
      if (isCommand(cur.tokens[cur.i])) {
        command = cur.tokens[cur.i++];
      } else if (!command || /^[Zz]$/.test(command)) {
        return 'path data has a number without a command';
      }
      const key = command.toLowerCase();
      const quad = key === 'q' || key === 't';
      const cubic = key === 'c' || key === 's';
      STEPS[key](command !== command.toUpperCase());
      lastControl = cubic ? lastControl : null;
      lastQuad = quad ? lastQuad : null;
    }
  } catch (error) {
    return (error as Error).message;
  }
  return outline;
}
