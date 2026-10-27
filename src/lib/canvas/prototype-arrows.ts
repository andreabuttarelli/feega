import type { PrototypeLink } from '$lib/motion/prototype/links';
import { frameScreenRect, type FrameBox } from '$lib/canvas/frame-screen';
import type { Viewport } from '$lib/canvas/dot-grid';

export type ArrowFrame = FrameBox & { id: string };
export type Arrow = { id: string; path: string; head: string; label: { x: number; y: number }; from: string; to: string };
type Point = { x: number; y: number };

const CURVE_REACH = 0.45;
const HEAD = 7;

function rightEdge(frame: ArrowFrame, view: Viewport): Point {
  const r = frameScreenRect(view, frame);
  return { x: r.left + r.width, y: r.top + r.height / 2 };
}

function leftEdge(frame: ArrowFrame, view: Viewport): Point {
  const r = frameScreenRect(view, frame);
  return { x: r.left, y: r.top + r.height / 2 };
}

export function headAt(to: Point, from: Point): string {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const wing = (turn: number) => `${to.x - HEAD * Math.cos(angle + turn)},${to.y - HEAD * Math.sin(angle + turn)}`;
  return `${to.x},${to.y} ${wing(0.45)} ${wing(-0.45)}`;
}

export function curveBetween(from: Point, to: Point): { path: string; head: string; mid: Point } {
  const reach = Math.max(24, Math.abs(to.x - from.x) * CURVE_REACH);
  const c1 = { x: from.x + reach, y: from.y };
  const c2 = { x: to.x - reach, y: to.y };
  return {
    path: `M${from.x},${from.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${to.x},${to.y}`,
    head: headAt(to, c2),
    mid: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
  };
}

export function arrowsFor(links: readonly PrototypeLink[], frames: readonly ArrowFrame[], view: Viewport): Arrow[] {
  const byId = new Map(frames.map((f) => [f.id, f]));
  return links.flatMap((link) => {
    const source = byId.get(link.from);
    const target = byId.get(link.to);
    if (!source || !target) {
      return [];
    }
    const curve = curveBetween(rightEdge(source, view), leftEdge(target, view));
    return [{ id: `${link.from}:${link.id}`, path: curve.path, head: curve.head, label: curve.mid, from: link.from, to: link.to }];
  });
}

export const draftFrom = (frames: readonly ArrowFrame[], id: string, view: Viewport): Point | null => {
  const frame = frames.find((f) => f.id === id);
  return frame ? rightEdge(frame, view) : null;
};
