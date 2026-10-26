import { CanvasMode } from '../canvas-mode';
import type { Point } from './camera';
import { Corner, ROTATE_REACH_PX, type Box } from './geometry';

export enum HitKind {
  Port = 'port',
  Corner = 'corner',
  Rotate = 'rotate',
  Node = 'node',
  Edge = 'edge',
  Empty = 'empty'
}

export type Hit =
  | { kind: HitKind.Port; nodeId: string; handle: string | null }
  | { kind: HitKind.Corner; nodeId: string; unit: [number, number] }
  | { kind: HitKind.Rotate; nodeId: string; unit: [number, number] }
  | { kind: HitKind.Node; nodeId: string }
  | { kind: HitKind.Edge; edgeId: string }
  | { kind: HitKind.Empty };

export enum GestureKind {
  Pan = 'pan',
  Drag = 'drag',
  Resize = 'resize',
  Rotate = 'rotate',
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
  [HitKind.Rotate]: () => GestureKind.Rotate,
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

type Unit = [number, number];
type ResizeKeys = { shift: boolean; alt: boolean };

const CORNER_UNIT: Record<Corner, Unit> = {
  [Corner.TopLeft]: [0, 0],
  [Corner.TopRight]: [1, 0],
  [Corner.BottomLeft]: [0, 1],
  [Corner.BottomRight]: [1, 1]
};

const SIDE = 0.5;
const STILL: ResizeKeys = { shift: false, alt: false };

const turned = (p: Point, degrees: number): Point => {
  const r = (degrees * Math.PI) / 180;
  return { x: p.x * Math.cos(r) - p.y * Math.sin(r), y: p.x * Math.sin(r) + p.y * Math.cos(r) };
};

function grown(size: number, unit: number, by: number, alt: boolean): number {
  if (unit === SIDE) {
    return size;
  }
  return size + (unit === 1 ? by : -by) * (alt ? 2 : 1);
}

function keptRatio(b: Box, unit: Unit, w: number, h: number): { w: number; h: number } {
  const factor = unit[0] === SIDE ? h / b.h : unit[1] === SIDE ? w / b.w : Math.max(w / b.w, h / b.h);
  return { w: b.w * factor, h: b.h * factor };
}

export function resizedAt(b: Box, unit: Unit, d: Point, min: { w: number; h: number }, keys: ResizeKeys, rotation: number): Box {
  const local = turned(d, -rotation);
  const free = { w: grown(b.w, unit[0], local.x, keys.alt), h: grown(b.h, unit[1], local.y, keys.alt) };
  const sized = keys.shift ? keptRatio(b, unit, free.w, free.h) : free;
  const w = Math.max(min.w, sized.w);
  const h = Math.max(min.h, sized.h);
  const pin = (size: number, u: number) => (keys.alt ? 0 : (SIDE - u) * size);
  const anchor = turned({ x: pin(b.w, unit[0]), y: pin(b.h, unit[1]) }, rotation);
  const moved = turned({ x: pin(w, unit[0]), y: pin(h, unit[1]) }, rotation);
  const cx = b.x + b.w / 2 + anchor.x - moved.x;
  const cy = b.y + b.h / 2 + anchor.y - moved.y;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

export function rotateZoneAt(b: Box, rotation: number, p: Point, zoom: number): Unit | null {
  const local = turned({ x: p.x - (b.x + b.w / 2), y: p.y - (b.y + b.h / 2) }, -rotation);
  const beyondX = Math.abs(local.x) - b.w / 2;
  const beyondY = Math.abs(local.y) - b.h / 2;
  if (beyondX < 0 || beyondY < 0 || Math.hypot(beyondX, beyondY) > ROTATE_REACH_PX / zoom) {
    return null;
  }
  return [Math.sign(local.x), Math.sign(local.y)];
}

export const resized = (b: Box, corner: Corner, d: Point, min: { w: number; h: number }): Box => resizedAt(b, CORNER_UNIT[corner], d, min, STILL, 0);

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
