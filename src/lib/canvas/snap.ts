export type SnapRect = { x: number; y: number; w: number; h: number };
export type SnapGuide = { axis: 'x' | 'y'; at: number; from: number; to: number };
export type SpacingGap = { axis: 'x' | 'y'; from: number; to: number; at: number };
export type Snap = { dx: number; dy: number; guides: SnapGuide[]; spacing: SpacingGap[] };

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

type Spacing = { delta: number; gaps: SpacingGap[] };

function facing(a: Axis, moving: SnapRect, other: SnapRect): boolean {
  return a.crossStart(other) < a.crossStart(moving) + a.crossSize(moving) && a.crossStart(moving) < a.crossStart(other) + a.crossSize(other);
}

function equalSpacing(a: Axis, moving: SnapRect, others: readonly SnapRect[], reach: number): Spacing | null {
  const facingOthers = others.filter((o) => facing(a, moving, o));
  const end = (r: SnapRect) => a.start(r) + a.size(r);
  const before = facingOthers.filter((o) => end(o) <= a.start(moving) + reach).sort((p, q) => end(q) - end(p))[0];
  const after = facingOthers.filter((o) => a.start(o) >= end(moving) - reach).sort((p, q) => a.start(p) - a.start(q))[0];
  if (!before || !after) {
    return null;
  }

  const start = (end(before) + a.start(after) - a.size(moving)) / 2;
  const delta = start - a.start(moving);
  if (Math.abs(delta) > reach || start <= end(before)) {
    return null;
  }

  const crossFrom = Math.max(a.crossStart(moving), a.crossStart(before), a.crossStart(after));
  const crossTo = Math.min(...[moving, before, after].map((r) => a.crossStart(r) + a.crossSize(r)));
  const at = (crossFrom + crossTo) / 2;
  return {
    delta,
    gaps: [
      { axis: a.axis, from: end(before), to: start, at },
      { axis: a.axis, from: start + a.size(moving), to: a.start(after), at }
    ]
  };
}

type AxisSnap = { delta: number; hits: Hit[]; spacing: SpacingGap[] };

function snapAxis(a: Axis, moving: SnapRect, others: readonly SnapRect[], reach: number): AxisSnap {
  const hits = nearest(a, moving, others, reach);
  const spacing = equalSpacing(a, moving, others, reach);
  if (spacing && (!hits.length || Math.abs(spacing.delta) < Math.abs(hits[0].delta))) {
    return { delta: spacing.delta, hits: [], spacing: spacing.gaps };
  }
  return { delta: hits[0]?.delta ?? 0, hits, spacing: [] };
}

export function snapBox(moving: SnapRect, others: readonly SnapRect[], reach: number): Snap {
  const x = snapAxis(X, moving, others, reach);
  const y = snapAxis(Y, moving, others, reach);
  const moved = { ...moving, x: moving.x + x.delta, y: moving.y + y.delta };
  return { dx: x.delta, dy: y.delta, guides: [...guidesFor(X, x.hits, moved), ...guidesFor(Y, y.hits, moved)], spacing: [...x.spacing, ...y.spacing] };
}

export type DraggedRect = SnapRect & { id: string };

export function snapDrag(dragged: readonly DraggedRect[], others: readonly SnapRect[], reach: number): { moves: { id: string; x: number; y: number }[]; guides: SnapGuide[]; spacing: SpacingGap[] } {
  if (!dragged.length) {
    return { moves: [], guides: [], spacing: [] };
  }
  const x = Math.min(...dragged.map((r) => r.x));
  const y = Math.min(...dragged.map((r) => r.y));
  const joint = { x, y, w: Math.max(...dragged.map((r) => r.x + r.w)) - x, h: Math.max(...dragged.map((r) => r.y + r.h)) - y };
  const snap = snapBox(joint, others, reach);
  return { moves: dragged.map((r) => ({ id: r.id, x: r.x + snap.dx, y: r.y + snap.dy })), guides: snap.guides, spacing: snap.spacing };
}
