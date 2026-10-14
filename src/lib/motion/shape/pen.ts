import { cubicAt, distance, segmentsOf, type Outline, type Pt, type Vertex, corner } from './geometry';

export type PointRef = { contour: number; index: number };

export enum Handle {
  In = 'in',
  Out = 'out'
}

export enum Mirror {
  Mirrored = 'mirrored',
  Broken = 'broken'
}

const OPPOSITE: Record<Handle, Handle> = { [Handle.In]: Handle.Out, [Handle.Out]: Handle.In };

const round = (n: number) => Math.round(n * 10000) / 10000;
const pt = (x: number, y: number): Pt => [round(x), round(y)];

function editVertex(outline: Outline, ref: PointRef, edit: (v: Vertex) => Vertex): Outline {
  return outline.map((c, ci) => (ci === ref.contour ? { ...c, vertices: c.vertices.map((v, vi) => (vi === ref.index ? edit(v) : v)) } : c));
}

export function addPoint(outline: Outline, at: Pt): Outline {
  const last = outline[outline.length - 1];
  if (!last || last.closed) {
    return [...outline, { vertices: [corner(at)], closed: false }];
  }
  return [...outline.slice(0, -1), { ...last, vertices: [...last.vertices, corner(at)] }];
}

export function movePoint(outline: Outline, ref: PointRef, delta: Pt): Outline {
  const shift = (p: Pt) => pt(p[0] + delta[0], p[1] + delta[1]);
  return editVertex(outline, ref, (v) => ({ p: shift(v.p), in: shift(v.in), out: shift(v.out) }));
}

export function dragHandle(outline: Outline, ref: PointRef, handle: Handle, to: Pt, mirror: Mirror): Outline {
  return editVertex(outline, ref, (v) => {
    const moved = { ...v, [handle]: pt(to[0], to[1]) };
    if (mirror === Mirror.Broken) {
      return moved;
    }
    return { ...moved, [OPPOSITE[handle]]: pt(2 * v.p[0] - to[0], 2 * v.p[1] - to[1]) };
  });
}

export function deletePoint(outline: Outline, ref: PointRef): Outline {
  return outline
    .map((c, ci) => (ci === ref.contour ? { ...c, vertices: c.vertices.filter((_, vi) => vi !== ref.index) } : c))
    .filter((c) => c.vertices.length > 0);
}

export function toggleClosed(outline: Outline, contour: number): Outline {
  return outline.map((c, ci) => (ci === contour ? { ...c, closed: !c.closed } : c));
}

export type SegmentHit = PointRef & { t: number };

const HIT_SAMPLES = 48;

export function segmentHit(outline: Outline, at: Pt, reach: number): SegmentHit | null {
  let best: (SegmentHit & { gap: number }) | null = null;
  outline.forEach((contour, ci) => {
    segmentsOf(contour).forEach(([a, b], index) => {
      for (let i = 0; i <= HIT_SAMPLES; i++) {
        const t = i / HIT_SAMPLES;
        const gap = distance(cubicAt(a.p, a.out, b.in, b.p, t), at);
        if (gap <= reach && (!best || gap < best.gap)) {
          best = { contour: ci, index, t, gap };
        }
      }
    });
  });
  if (!best) {
    return null;
  }
  const { contour, index, t } = best;
  return { contour, index, t };
}

const mix = (a: Pt, b: Pt, t: number): Pt => pt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);

const sameAt = (a: Pt, b: Pt) => a[0] === b[0] && a[1] === b[1];

function splitAt(a: Vertex, b: Vertex, t: number): { a: Vertex; mid: Vertex; b: Vertex } {
  if (sameAt(a.out, a.p) && sameAt(b.in, b.p)) {
    return { a, mid: corner(mix(a.p, b.p, t)), b };
  }
  const ab = mix(a.p, a.out, t);
  const bc = mix(a.out, b.in, t);
  const cd = mix(b.in, b.p, t);
  const abc = mix(ab, bc, t);
  const bcd = mix(bc, cd, t);
  return { a: { ...a, out: ab }, mid: { p: mix(abc, bcd, t), in: abc, out: bcd }, b: { ...b, in: cd } };
}

export function insertPoint(outline: Outline, hit: SegmentHit): { outline: Outline; ref: PointRef } {
  const vertices = outline[hit.contour].vertices;
  const nextIndex = (hit.index + 1) % vertices.length;
  const parts = splitAt(vertices[hit.index], vertices[nextIndex], hit.t);
  const next = vertices.map((v, i) => (i === hit.index ? parts.a : v)).map((v, i) => (i === nextIndex ? parts.b : v));
  const at = hit.index + 1;
  next.splice(at, 0, parts.mid);
  return { outline: outline.map((c, ci) => (ci === hit.contour ? { ...c, vertices: next } : c)), ref: { contour: hit.contour, index: at } };
}
