import { shared, type Shared } from '$lib/motion/mixed';
import { wrapAngle, type Placed } from './node-layout';
import type { Box } from './gpu/geometry';

type Point = { x: number; y: number };

export enum BoxField {
  X = 'x',
  Y = 'y',
  W = 'w',
  H = 'h',
  Rotation = 'rotation'
}

export const SELECTION_FIELDS: readonly { field: BoxField; label: string; name: string; unit: string }[] = [
  { field: BoxField.X, label: 'X', name: 'X', unit: 'px' },
  { field: BoxField.Y, label: 'Y', name: 'Y', unit: 'px' },
  { field: BoxField.W, label: 'W', name: 'Width', unit: 'px' },
  { field: BoxField.H, label: 'H', name: 'Height', unit: 'px' },
  { field: BoxField.Rotation, label: '↻', name: 'Rotation', unit: '°' }
];

const RADIANS = Math.PI / 180;
const HUNDREDTHS = 100;

const centreOf = (n: Placed): Point => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 });

function cornersOf(n: Placed): Point[] {
  const c = centreOf(n);
  const cos = Math.cos(n.rotation * RADIANS);
  const sin = Math.sin(n.rotation * RADIANS);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1]
  ].map(([u, v]) => {
    const dx = (u * n.w) / 2;
    const dy = (v * n.h) / 2;
    return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
  });
}

export function selectionBox(items: readonly Placed[]): Box {
  const points = items.flatMap(cornersOf);
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function scaledTo(items: readonly Placed[], from: Box, to: Box): Placed[] {
  const sx = to.w / from.w;
  const sy = to.h / from.h;
  return items.map((n) => {
    const c = centreOf(n);
    const w = n.w * sx;
    const h = n.h * sy;
    return { ...n, x: to.x + (c.x - from.x) * sx - w / 2, y: to.y + (c.y - from.y) * sy - h / 2, w, h };
  });
}

export function turnedAbout(items: readonly Placed[], centre: Point, deg: number): Placed[] {
  const cos = Math.cos(deg * RADIANS);
  const sin = Math.sin(deg * RADIANS);
  return items.map((n) => {
    const c = centreOf(n);
    const dx = c.x - centre.x;
    const dy = c.y - centre.y;
    const x = centre.x + dx * cos - dy * sin;
    const y = centre.y + dx * sin + dy * cos;
    return { ...n, x: x - n.w / 2, y: y - n.h / 2, rotation: wrapAngle(n.rotation + deg) };
  });
}

const round = (v: number) => Math.round(v * HUNDREDTHS) / HUNDREDTHS;

export const fieldValue = (items: readonly Placed[], field: BoxField): Shared<number> => shared(items.map((n) => round(n[field])));

const WRITE: Record<BoxField, (n: Placed, value: number) => Placed> = {
  [BoxField.X]: (n, x) => ({ ...n, x }),
  [BoxField.Y]: (n, y) => ({ ...n, y }),
  [BoxField.W]: (n, w) => ({ ...n, w: Math.max(1, w) }),
  [BoxField.H]: (n, h) => ({ ...n, h: Math.max(1, h) }),
  [BoxField.Rotation]: (n, deg) => ({ ...n, rotation: wrapAngle(deg) })
};

export const withField = (items: readonly Placed[], field: BoxField, value: number): Placed[] => items.map((n) => WRITE[field](n, value));
