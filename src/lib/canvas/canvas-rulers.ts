import type { SnapRect } from './snap';
import { GuideAxis, tickStep, type UserGuide } from './user-guides';

export type RulerMark = { screen: number; label: string };

export type CanvasGuide = UserGuide;

export function rulerMarks(offset: number, zoom: number, length: number): RulerMark[] {
  const step = tickStep(zoom);
  const first = Math.ceil(-offset / zoom / step);
  const last = Math.floor((length - offset) / zoom / step);
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => {
    const at = (first + i) * step;
    return { screen: offset + at * zoom, label: String(at) };
  });
}

const same = (a: CanvasGuide, b: CanvasGuide) => a.axis === b.axis && a.at === b.at;

export function addCanvasGuide(guides: readonly CanvasGuide[], guide: CanvasGuide): CanvasGuide[] {
  const placed = { axis: guide.axis, at: Math.round(guide.at) };
  return guides.some((g) => same(g, placed)) ? [...guides] : [...guides, placed];
}

export const removeCanvasGuide = (guides: readonly CanvasGuide[], guide: CanvasGuide): CanvasGuide[] => guides.filter((g) => !same(g, guide));

export const moveCanvasGuide = (guides: readonly CanvasGuide[], from: CanvasGuide, at: number): CanvasGuide[] => addCanvasGuide(removeCanvasGuide(guides, from), { axis: from.axis, at });

type Pull = { dx: number; dy: number };

const lines = (start: number, size: number) => [start, start + size / 2, start + size];

function pullOne(mine: number[], guides: readonly number[], reach: number): number {
  const deltas = guides.flatMap((g) => mine.map((m) => g - m)).filter((d) => Math.abs(d) <= reach);
  return deltas.length ? deltas.reduce((best, d) => (Math.abs(d) < Math.abs(best) ? d : best)) : 0;
}

export function pullToGuides(box: SnapRect, guides: readonly CanvasGuide[], reach: number): Pull {
  const along = (axis: GuideAxis) => guides.filter((g) => g.axis === axis).map((g) => g.at);
  return { dx: pullOne(lines(box.x, box.w), along(GuideAxis.Vertical), reach), dy: pullOne(lines(box.y, box.h), along(GuideAxis.Horizontal), reach) };
}
