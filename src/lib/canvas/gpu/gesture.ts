import { CanvasMode } from '../canvas-mode';
import type { Point } from './camera';
import { Corner, type Box } from './geometry';

export enum HitKind {
  Port = 'port',
  Corner = 'corner',
  Node = 'node',
  Edge = 'edge',
  Empty = 'empty'
}

export type Hit =
  | { kind: HitKind.Port; nodeId: string; handle: string | null }
  | { kind: HitKind.Corner; nodeId: string; corner: Corner }
  | { kind: HitKind.Node; nodeId: string }
  | { kind: HitKind.Edge; edgeId: string }
  | { kind: HitKind.Empty };

export enum GestureKind {
  Pan = 'pan',
  Drag = 'drag',
  Resize = 'resize',
  Marquee = 'marquee',
  Connect = 'connect',
  PickEdge = 'pick-edge'
}

export enum Pointer {
  Mouse = 'mouse',
  Pen = 'pen',
  Touch = 'touch'
}

export type Press = { pointer: Pointer; button: number; shift: boolean; space: boolean; mode: CanvasMode };

const PAN_BUTTONS = new Set([1, 2]);

const ON_HIT: Record<HitKind, (p: Press) => GestureKind> = {
  [HitKind.Port]: () => GestureKind.Connect,
  [HitKind.Corner]: () => GestureKind.Resize,
  [HitKind.Node]: () => GestureKind.Drag,
  [HitKind.Edge]: () => GestureKind.PickEdge,
  [HitKind.Empty]: (p) => (p.pointer === Pointer.Touch ? GestureKind.Pan : GestureKind.Marquee)
};

export function gestureFor(hit: Hit, press: Press): GestureKind {
  if (press.mode === CanvasMode.View || press.space || PAN_BUTTONS.has(press.button)) {
    return GestureKind.Pan;
  }
  return ON_HIT[hit.kind](press);
}

export function clicked(selection: string[], id: string, toggle: boolean): string[] {
  if (toggle) {
    return selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id];
  }
  return selection.includes(id) ? selection : [id];
}

export function movedBy(origins: Map<string, Point>, d: Point): { id: string; x: number; y: number }[] {
  return [...origins].map(([id, o]) => ({ id, x: o.x + d.x, y: o.y + d.y }));
}

const GROWS: Record<Corner, { left: boolean; top: boolean }> = {
  [Corner.TopLeft]: { left: true, top: true },
  [Corner.TopRight]: { left: false, top: true },
  [Corner.BottomLeft]: { left: true, top: false },
  [Corner.BottomRight]: { left: false, top: false }
};

export function resized(b: Box, corner: Corner, d: Point, min: { w: number; h: number }): Box {
  const grows = GROWS[corner];
  const w = Math.max(min.w, b.w + (grows.left ? -d.x : d.x));
  const h = Math.max(min.h, b.h + (grows.top ? -d.y : d.y));
  return { x: grows.left ? b.x + b.w - w : b.x, y: grows.top ? b.y + b.h - h : b.y, w, h };
}

export function marqueeBox(a: Point, b: Point): Box {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

const touches = (t: Box, m: Box) => t.x < m.x + m.w && t.x + t.w > m.x && t.y < m.y + m.h && t.y + t.h > m.y;

export function marqueePick(tiles: (Box & { id: string })[], m: Box, base: string[], additive: boolean): string[] {
  const hit = tiles.filter((t) => touches(t, m)).map((t) => t.id);
  if (!additive) {
    return hit;
  }
  return [...base, ...hit.filter((id) => !base.includes(id))];
}
