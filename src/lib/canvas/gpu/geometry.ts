import type { ConnectorType } from '../connectors';
import type { Point } from './camera';

export enum PortSide {
  In = 'in',
  Out = 'out'
}

export enum Corner {
  TopLeft = 'tl',
  TopRight = 'tr',
  BottomLeft = 'bl',
  BottomRight = 'br'
}

export type PortTile = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  connectable?: boolean;
  connectors?: readonly ConnectorType[];
  output?: ConnectorType | null;
  outputs?: readonly { handle: string; port: ConnectorType }[];
};

export type Port = { nodeId: string; side: PortSide; handle: string | null; port: ConnectorType | null; x: number; y: number };

export type Box = { x: number; y: number; w: number; h: number };

export type Curve = { from: Point; c1: Point; c2: Point; to: Point; mid: Point };

const PORT_HIT_PX = 10;
export const PORT_SIZE = 10;
const PORT_OFFSET = PORT_SIZE / 2;
const CORNER_HIT_PX = 8;
const EDGE_HIT_PX = 6;
const CURVATURE = 0.25;
const CURVE_SAMPLES = 24;

const spaced = (i: number, n: number, h: number) => ((i + 1) / (n + 1)) * h;

function inputsOf(t: PortTile): Port[] {
  const connectors = t.connectors ?? [];
  if (!connectors.length) {
    return [{ nodeId: t.id, side: PortSide.In, handle: null, port: null, x: t.x - PORT_OFFSET, y: t.y + t.h / 2 }];
  }
  return connectors.map((c, i) => ({ nodeId: t.id, side: PortSide.In, handle: c, port: c, x: t.x - PORT_OFFSET, y: t.y + spaced(i, connectors.length, t.h) }));
}

function outputsOf(t: PortTile): Port[] {
  const named = t.outputs ?? [];
  const right = t.x + t.w + PORT_OFFSET;
  const single: Port[] = t.output || !named.length ? [{ nodeId: t.id, side: PortSide.Out, handle: null, port: t.output ?? null, x: right, y: t.y + t.h / 2 }] : [];
  const listed = named.map((o, i) => ({ nodeId: t.id, side: PortSide.Out, handle: o.handle, port: o.port, x: right, y: t.y + spaced(i, named.length, t.h) }));
  return [...single, ...listed];
}

export function portsOf(t: PortTile): Port[] {
  if (t.connectable === false) {
    return [];
  }
  return [...inputsOf(t), ...outputsOf(t)];
}

export function portAt(ports: Port[], p: Point, zoom: number): Port | null {
  const radius = PORT_HIT_PX / zoom;
  let best: Port | null = null;
  let bestDist = radius;
  for (const port of ports) {
    const d = Math.hypot(port.x - p.x, port.y - p.y);
    if (d <= bestDist) {
      best = port;
      bestDist = d;
    }
  }
  return best;
}

export function cornersOf(b: Box): Record<Corner, Point> {
  return {
    [Corner.TopLeft]: { x: b.x, y: b.y },
    [Corner.TopRight]: { x: b.x + b.w, y: b.y },
    [Corner.BottomLeft]: { x: b.x, y: b.y + b.h },
    [Corner.BottomRight]: { x: b.x + b.w, y: b.y + b.h }
  };
}

export function resizeCornerAt(b: Box, p: Point, zoom: number): Corner | null {
  const radius = CORNER_HIT_PX / zoom;
  for (const [corner, at] of Object.entries(cornersOf(b)) as [Corner, Point][]) {
    if (Math.abs(at.x - p.x) <= radius && Math.abs(at.y - p.y) <= radius) {
      return corner;
    }
  }
  return null;
}

const controlOffset = (d: number) => (d >= 0 ? 0.5 * d : CURVATURE * 25 * Math.sqrt(-d));

export function wireCurve(from: Point, to: Point): Curve {
  const c1 = { x: from.x + controlOffset(to.x - from.x), y: from.y };
  const c2 = { x: to.x - controlOffset(to.x - from.x), y: to.y };
  const mid = {
    x: from.x * 0.125 + c1.x * 0.375 + c2.x * 0.375 + to.x * 0.125,
    y: from.y * 0.125 + c1.y * 0.375 + c2.y * 0.375 + to.y * 0.125
  };
  return { from, c1, c2, to, mid };
}

export function curvePoint(c: Curve, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const d = 3 * u * t * t;
  const e = t * t * t;
  return { x: a * c.from.x + b * c.c1.x + d * c.c2.x + e * c.to.x, y: a * c.from.y + b * c.c1.y + d * c.c2.y + e * c.to.y };
}

function segmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function curveDistance(c: Curve, p: Point): number {
  let best = Infinity;
  let prev = c.from;
  for (let i = 1; i <= CURVE_SAMPLES; i++) {
    const next = curvePoint(c, i / CURVE_SAMPLES);
    best = Math.min(best, segmentDistance(p, prev, next));
    prev = next;
  }
  return best;
}

export function edgeAt(edges: { id: string; curve: Curve }[], p: Point, zoom: number): string | null {
  const radius = EDGE_HIT_PX / zoom;
  for (let i = edges.length - 1; i >= 0; i--) {
    if (curveDistance(edges[i].curve, p) <= radius) {
      return edges[i].id;
    }
  }
  return null;
}
