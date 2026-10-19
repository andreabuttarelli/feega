import { rgbaOf, type Rgba } from '$lib/motion/gpu-full/rgba';
import { FillRule, PaintKind } from '$lib/motion/gpu-full/paint';
import { ItemKind, type PathItem } from '$lib/motion/gpu-full/display-list';
import { BlendMode } from '$lib/motion/blend';
import { IDENTITY } from '$lib/motion/parent';
import { Cap, Join, strokePolygons } from '$lib/motion/gpu-full/stroke';
import { ellipseOutline, flatten, rectOutline, type Outline } from '$lib/motion/shape/geometry';
import type { Curve } from '$lib/canvas/gpu/geometry';

const CURVE_STEPS = 32;
const BLACK: Rgba = [0, 0, 0, 1];

export const rect = (x: number, y: number, w: number, h: number): number[] => [x, y, x + w, y, x + w, y + h, x, y + h];

const placed = (outline: Outline, x: number, y: number): number[][] => outline.map((c) => flatten(c).flatMap(([px, py]) => [px + x, py + y]));

export const roundRect = (x: number, y: number, w: number, h: number, r: number): number[][] => placed(rectOutline(r / Math.min(w, h), { w, h }), x, y);

export const circle = (cx: number, cy: number, r: number): number[][] => placed(ellipseOutline({ w: 2 * r, h: 2 * r }), cx - r, cy - r);

export const line = (points: number[], width: number, closed = false): number[][] => strokePolygons(points, closed, width, Cap.Butt, Join.Miter);

export function reverse(contour: number[]): number[] {
  const out: number[] = [];
  for (let i = contour.length - 2; i >= 0; i -= 2) {
    out.push(contour[i], contour[i + 1]);
  }
  return out;
}

export function cubic(c: Curve): number[] {
  const out: number[] = [];
  for (let i = 0; i <= CURVE_STEPS; i++) {
    const t = i / CURVE_STEPS;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const d = 3 * u * t * t;
    const e = t * t * t;
    out.push(a * c.from.x + b * c.c1.x + d * c.c2.x + e * c.to.x, a * c.from.y + b * c.c1.y + d * c.c2.y + e * c.to.y);
  }
  return out;
}

export function solid(clip: string, contours: number[][], color: string, opacity = 1): PathItem {
  return { kind: ItemKind.Path, clip, contours, rule: FillRule.NonZero, paint: { kind: PaintKind.Solid, color: rgbaOf(color) ?? BLACK }, opacity, matrix: IDENTITY, blur: 0, blend: BlendMode.Normal };
}
