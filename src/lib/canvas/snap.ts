export type SnapRect = { x: number; y: number; w: number; h: number };
export type SnapGuide = { axis: 'x' | 'y'; at: number; from: number; to: number };
export type Snap = { dx: number; dy: number; guides: SnapGuide[] };

type Axis = { axis: 'x' | 'y'; start: (r: SnapRect) => number; size: (r: SnapRect) => number; crossStart: (r: SnapRect) => number; crossSize: (r: SnapRect) => number };

const X: Axis = { axis: 'x', start: (r) => r.x, size: (r) => r.w, crossStart: (r) => r.y, crossSize: (r) => r.h };
const Y: Axis = { axis: 'y', start: (r) => r.y, size: (r) => r.h, crossStart: (r) => r.x, crossSize: (r) => r.w };

const lines = (a: Axis, r: SnapRect) => [a.start(r), a.start(r) + a.size(r) / 2, a.start(r) + a.size(r)];

type Hit = { delta: number; at: number; other: SnapRect };

function nearest(a: Axis, moving: SnapRect, others: readonly SnapRect[], reach: number): Hit[] {
  const hits = others.flatMap((other) => lines(a, other).flatMap((at) => lines(a, moving).map((mine) => ({ delta: at - mine, at, other }))));
  const close = hits.filter((h) => Math.abs(h.delta) <= reach);
  if (!close.length) {
    return [];
  }
  const best = Math.min(...close.map((h) => Math.abs(h.delta)));
  const delta = close.find((h) => Math.abs(h.delta) === best)!.delta;
  return close.filter((h) => h.delta === delta);
}

function guidesFor(a: Axis, hits: Hit[], moved: SnapRect): SnapGuide[] {
  const seen = new Map<number, SnapGuide>();
  for (const h of hits) {
    const from = Math.min(a.crossStart(h.other), a.crossStart(moved));
    const to = Math.max(a.crossStart(h.other) + a.crossSize(h.other), a.crossStart(moved) + a.crossSize(moved));
    const was = seen.get(h.at);
    seen.set(h.at, { axis: a.axis, at: h.at, from: Math.min(from, was?.from ?? from), to: Math.max(to, was?.to ?? to) });
  }
  return [...seen.values()];
}

export function snapBox(moving: SnapRect, others: readonly SnapRect[], reach: number): Snap {
  const xs = nearest(X, moving, others, reach);
  const ys = nearest(Y, moving, others, reach);
  const dx = xs[0]?.delta ?? 0;
  const dy = ys[0]?.delta ?? 0;
  const moved = { ...moving, x: moving.x + dx, y: moving.y + dy };
  return { dx, dy, guides: [...guidesFor(X, xs, moved), ...guidesFor(Y, ys, moved)] };
}

export type DraggedRect = SnapRect & { id: string };

export function snapDrag(dragged: readonly DraggedRect[], others: readonly SnapRect[], reach: number): { moves: { id: string; x: number; y: number }[]; guides: SnapGuide[] } {
  if (!dragged.length) {
    return { moves: [], guides: [] };
  }
  const x = Math.min(...dragged.map((r) => r.x));
  const y = Math.min(...dragged.map((r) => r.y));
  const joint = { x, y, w: Math.max(...dragged.map((r) => r.x + r.w)) - x, h: Math.max(...dragged.map((r) => r.y + r.h)) - y };
  const snap = snapBox(joint, others, reach);
  return { moves: dragged.map((r) => ({ id: r.id, x: r.x + snap.dx, y: r.y + snap.dy })), guides: snap.guides };
}
