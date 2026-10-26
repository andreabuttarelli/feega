import { flatten, type Size } from '../shape/geometry';
import { shapeLayers, type ShapeLook } from '../shape/render';
import { PathPreset } from './model';
import type { Curve } from './layout';

export type Bend = { radius: number; arc: number };

const SAMPLES = 128;
const ELLIPSE_SQUASH = 0.6;
const BOTTOM = 90;
const TOP = 270;
const DIGITS = 100;

const round = (n: number) => Math.round(n * DIGITS) / DIGITS || 0;
const rad = (deg: number) => (deg * Math.PI) / 180;
const point = (x: number, y: number): [number, number] => [round(x), round(y)];

function around(box: Size, rx: number, ry: number, from: number, sweep: number, closed: boolean): Curve {
  const count = closed ? SAMPLES : SAMPLES + 1;
  const points = Array.from({ length: count }, (_, i) => {
    const angle = rad(from + (sweep * i) / SAMPLES);
    return point(box.w / 2 + rx * Math.cos(angle), box.h / 2 + ry * Math.sin(angle));
  });
  return { points, closed };
}

const PRESET: Record<PathPreset, (bend: Bend, box: Size) => Curve> = {
  [PathPreset.Circle]: (b, box) => around(box, b.radius, b.radius, BOTTOM, 360, true),
  [PathPreset.Ellipse]: (b, box) => around(box, b.radius, b.radius * ELLIPSE_SQUASH, BOTTOM, 360, true),
  [PathPreset.Arc]: (b, box) => around(box, b.radius, b.radius, TOP - b.arc / 2, b.arc, false),
  [PathPreset.Wave]: (b, box) => ({
    points: Array.from({ length: SAMPLES + 1 }, (_, i) => point((box.w * i) / SAMPLES, box.h / 2 - b.radius * Math.sin(rad((b.arc * i) / SAMPLES)))),
    closed: false
  }),
  [PathPreset.Line]: (_b, box) => ({ points: [point(0, box.h / 2), point(box.w, box.h / 2)], closed: false })
};

export function presetCurve(preset: PathPreset, bend: Bend, box: Size): Curve {
  return PRESET[preset](bend, box);
}

export function shapeCurve(look: ShapeLook, shapeSize: Size, time: number, box: Size): Curve | null {
  const contour = shapeLayers(look, shapeSize, time)[0]?.outline[0];
  if (!contour) {
    return null;
  }
  const dx = (box.w - shapeSize.w) / 2;
  const dy = (box.h - shapeSize.h) / 2;
  return { points: flatten(contour).map((p) => point(p[0] + dx, p[1] + dy)), closed: contour.closed };
}
