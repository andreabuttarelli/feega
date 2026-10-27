import { IDENTITY, apply2d, mul2d, type Affine } from '@feega/motion-core/motion/affine';
import { corner, flatten, type Contour, type Pt, type Vertex } from '@feega/motion-core/motion/shape/geometry';
import { isAnimated, keysOf, pairAt, scalarAt, type LottieProp } from './lottie-prop';

export type Ks = { o?: LottieProp; r?: LottieProp; p?: LottieProp; a?: LottieProp; s?: LottieProp; sk?: LottieProp };

export type Box = { left: number; top: number; right: number; bottom: number };

export type LottiePath = { i: number[][]; o: number[][]; v: number[][]; c?: boolean };

const KAPPA = 0.5522847498;
const PERCENT = 100;
const DEGREES = Math.PI / 180;
const STAR_STRAIGHT = 'sr';
const POLYGON_KIND = 2;

const point = (p: number[] | undefined): Pt => [p?.[0] ?? 0, p?.[1] ?? 0];

export function translation(x: number, y: number): Affine {
  return [1, 0, 0, 1, x, y];
}

export function rotation(degrees: number): Affine {
  const c = Math.cos(degrees * DEGREES);
  const s = Math.sin(degrees * DEGREES);
  return [c, s, -s, c, 0, 0];
}

export function scaling(x: number, y: number): Affine {
  return [x, 0, 0, y, 0, 0];
}

export function matrixOf(ks: Ks, t: number): Affine {
  const [px, py] = pairAt(ks.p, t, [0, 0]);
  const [ax, ay] = pairAt(ks.a, t, [0, 0]);
  const [sx, sy] = pairAt(ks.s, t, [PERCENT, PERCENT]);
  const turned = mul2d(translation(px, py), rotation(scalarAt(ks.r, t, 0)));
  return mul2d(mul2d(turned, scaling(sx / PERCENT, sy / PERCENT)), translation(-ax, -ay));
}

export const skews = (ks: Ks): boolean => isAnimated(ks.sk) || scalarAt(ks.sk, 0, 0) !== 0;

export function mapContour(contour: Contour, m: Affine): Contour {
  const at = (p: Pt) => apply2d(m, [p[0], p[1]]);
  return { closed: contour.closed, vertices: contour.vertices.map((v): Vertex => ({ p: at(v.p), in: at(v.in), out: at(v.out) })) };
}

export function contourOf(path: LottiePath): Contour {
  const vertices = path.v.map((v, k): Vertex => {
    const p = point(v);
    const i = point(path.i[k]);
    const o = point(path.o[k]);
    return { p, in: [p[0] + i[0], p[1] + i[1]], out: [p[0] + o[0], p[1] + o[1]] };
  });
  return { vertices, closed: path.c !== false };
}

export function pathOf(prop: LottieProp): LottiePath {
  const keys = keysOf(prop);
  return (keys ? keys[0].s?.[0] : prop.k) as LottiePath;
}

export function rectContour(left: number, top: number, width: number, height: number, radius = 0): Contour {
  const r = Math.min(radius, width / 2, height / 2);
  const right = left + width;
  const bottom = top + height;
  if (r <= 0) {
    return { closed: true, vertices: [corner([left, top]), corner([right, top]), corner([right, bottom]), corner([left, bottom])] };
  }
  const round = (p: Pt, before: Pt, after: Pt): Vertex[] => [
    { p: before, in: before, out: [before[0] + (p[0] - before[0]) * KAPPA, before[1] + (p[1] - before[1]) * KAPPA] },
    { p: after, in: [after[0] + (p[0] - after[0]) * KAPPA, after[1] + (p[1] - after[1]) * KAPPA], out: after }
  ];
  return {
    closed: true,
    vertices: [
      ...round([right, top], [right - r, top], [right, top + r]),
      ...round([right, bottom], [right, bottom - r], [right - r, bottom]),
      ...round([left, bottom], [left + r, bottom], [left, bottom - r]),
      ...round([left, top], [left, top + r], [left + r, top])
    ]
  };
}

export function ellipseContour(cx: number, cy: number, width: number, height: number): Contour {
  const rx = width / 2;
  const ry = height / 2;
  const ring = (p: Pt, inn: Pt, out: Pt): Vertex => ({ p, in: inn, out });
  return {
    closed: true,
    vertices: [
      ring([cx, cy - ry], [cx - rx * KAPPA, cy - ry], [cx + rx * KAPPA, cy - ry]),
      ring([cx + rx, cy], [cx + rx, cy - ry * KAPPA], [cx + rx, cy + ry * KAPPA]),
      ring([cx, cy + ry], [cx + rx * KAPPA, cy + ry], [cx - rx * KAPPA, cy + ry]),
      ring([cx - rx, cy], [cx - rx, cy + ry * KAPPA], [cx - rx, cy - ry * KAPPA])
    ]
  };
}

export type StarSpec = { kind: number; points: number; cx: number; cy: number; turn: number; outer: number; inner: number };

export function starContour(star: StarSpec): Contour {
  const count = Math.max(3, Math.round(star.points));
  const tips = star.kind === POLYGON_KIND ? 1 : 2;
  const vertices = Array.from({ length: count * tips }, (_, n) => {
    const radius = tips === 2 && n % 2 === 1 ? star.inner : star.outer;
    const angle = (star.turn - 90) * DEGREES + (n * Math.PI * 2) / (count * tips);
    return corner([star.cx + radius * Math.cos(angle), star.cy + radius * Math.sin(angle)]);
  });
  return { closed: true, vertices };
}

export const isStar = (ty: string): boolean => ty === STAR_STRAIGHT;

export function boxOf(contours: readonly Contour[]): Box | null {
  const points = contours.flatMap((c) => flatten(c));
  if (!points.length) {
    return null;
  }
  return {
    left: Math.min(...points.map((p) => p[0])),
    top: Math.min(...points.map((p) => p[1])),
    right: Math.max(...points.map((p) => p[0])),
    bottom: Math.max(...points.map((p) => p[1]))
  };
}

export function chainMatrix(chain: readonly Ks[], t: number): Affine {
  return chain.reduce<Affine>((m, ks) => mul2d(m, matrixOf(ks, t)), IDENTITY);
}
