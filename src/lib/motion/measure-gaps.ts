import type { Gap } from './scene-select';

export type Rect = { left: number; top: number; right: number; bottom: number };

const contains = (outer: Rect, inner: Rect) => outer.left <= inner.left && outer.top <= inner.top && outer.right >= inner.right && outer.bottom >= inner.bottom;

function band(a0: number, a1: number, b0: number, b1: number, fallback: number): number {
  const from = Math.max(a0, b0);
  const to = Math.min(a1, b1);
  return to > from ? (from + to) / 2 : fallback;
}

function inside(inner: Rect, outer: Rect): Gap[] {
  const midY = (inner.top + inner.bottom) / 2;
  const midX = (inner.left + inner.right) / 2;
  return [
    { axis: 'x', from: outer.left, to: inner.left, at: midY },
    { axis: 'x', from: inner.right, to: outer.right, at: midY },
    { axis: 'y', from: outer.top, to: inner.top, at: midX },
    { axis: 'y', from: inner.bottom, to: outer.bottom, at: midX }
  ];
}

function apart(a: Rect, b: Rect): Gap[] {
  const gaps: Gap[] = [];
  const atY = band(a.top, a.bottom, b.top, b.bottom, (a.top + a.bottom) / 2);
  const atX = band(a.left, a.right, b.left, b.right, (a.left + a.right) / 2);
  if (a.right <= b.left) {
    gaps.push({ axis: 'x', from: a.right, to: b.left, at: atY });
  }
  if (b.right <= a.left) {
    gaps.push({ axis: 'x', from: b.right, to: a.left, at: atY });
  }
  if (a.bottom <= b.top) {
    gaps.push({ axis: 'y', from: a.bottom, to: b.top, at: atX });
  }
  if (b.bottom <= a.top) {
    gaps.push({ axis: 'y', from: b.bottom, to: a.top, at: atX });
  }
  return gaps;
}

export function measureGaps(selected: Rect, hovered: Rect): Gap[] {
  if (contains(hovered, selected)) {
    return inside(selected, hovered);
  }
  if (contains(selected, hovered)) {
    return inside(hovered, selected);
  }
  return apart(selected, hovered);
}
