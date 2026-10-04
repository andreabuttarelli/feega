import { corner, type Outline, type Pt, type Vertex } from './geometry';

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
