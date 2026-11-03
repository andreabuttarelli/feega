import type { Point } from './camera';
import { PortSide, curvePoint, type Curve, type Port } from './geometry';
import { CONNECTOR_STYLE, portAccepts } from '../connectors';

export type Spring = { value: number; velocity: number };

const STIFFNESS = 260;
const DAMPING = 26;
const MAX_STEP_S = 1 / 30;
const REST = 0.05;
const CURVE_SAMPLES = 32;
const MIDPOINT_PULL = 8 / 6;

export function magnetPort(ports: readonly Port[], at: Point, reach: number, accepts: (p: Port) => boolean): Port | null {
  let best: Port | null = null;
  let bestDist = reach;
  for (const p of ports) {
    const d = Math.hypot(p.x - at.x, p.y - at.y);
    if (d <= bestDist && accepts(p)) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

export function bubbleRadius(distance: number, reach: number, rest: number, full: number): number {
  const closeness = Math.max(0, 1 - distance / reach);
  return rest + (full - rest) * closeness * closeness * (3 - 2 * closeness);
}

export function springTo(s: Spring, target: number, dt: number): Spring {
  let { value, velocity } = s;
  for (let left = dt; left > 0; left -= MAX_STEP_S) {
    const step = Math.min(left, MAX_STEP_S);
    velocity += (STIFFNESS * (target - value) - DAMPING * velocity) * step;
    value += velocity * step;
  }
  return { value, velocity };
}

export const atRest = (s: Spring, target: number): boolean => Math.abs(s.value - target) < REST && Math.abs(s.velocity) < REST;

export function throughPoint(c: Curve, p: Point): Curve {
  const dx = (p.x - curvePoint(c, 0.5).x) * MIDPOINT_PULL;
  const dy = (p.y - curvePoint(c, 0.5).y) * MIDPOINT_PULL;
  return { from: c.from, to: c.to, c1: { x: c.c1.x + dx, y: c.c1.y + dy }, c2: { x: c.c2.x + dx, y: c.c2.y + dy }, mid: p };
}

function segmentCross(a: Point, b: Point, c: Point, d: Point): Point | null {
  const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (!den) {
    return null;
  }
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den;
  const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / den;
  return t >= 0 && t <= 1 && u >= 0 && u < 1 ? { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) } : null;
}

export function crossings(c: Curve, a: Point, b: Point): Point[] {
  const hits: Point[] = [];
  let prev = c.from;
  for (let i = 1; i <= CURVE_SAMPLES; i++) {
    const next = curvePoint(c, i / CURVE_SAMPLES);
    const hit = segmentCross(a, b, prev, next);
    if (hit) {
      hits.push(hit);
    }
    prev = next;
  }
  return hits;
}

export function tieAcross(wires: readonly { id: string; curve: Curve }[], a: Point, b: Point): { ids: string[]; at: Point } | null {
  const cut = wires.flatMap((w) => {
    const hit = crossings(w.curve, a, b)[0];
    return hit ? [{ id: w.id, hit }] : [];
  });
  if (cut.length < 2) {
    return null;
  }
  const at = { x: cut.reduce((s, c) => s + c.hit.x, 0) / cut.length, y: cut.reduce((s, c) => s + c.hit.y, 0) / cut.length };
  return { ids: cut.map((c) => c.id), at };
}

export type Tie = { id: string; x: number; y: number };

export function tieOf(raw: unknown): Tie | null {
  const t = raw as Partial<Tie> | null;
  return t && typeof t.id === 'string' && Number.isFinite(t.x) && Number.isFinite(t.y) ? { id: t.id, x: t.x!, y: t.y! } : null;
}

export const UNTYPED_BUBBLE = '#0099ff';

export const bubbleColour = (p: Port): string => (p.port ? CONNECTOR_STYLE[p.port].color : UNTYPED_BUBBLE);

export enum Wiring {
  Idle = 'idle',
  Dragging = 'dragging'
}

export enum WireAim {
  None = 'none',
  Port = 'port',
  Drop = 'drop',
  Refused = 'refused'
}

export const WIRE_CURSOR: Record<WireAim, string | null> = {
  [WireAim.None]: null,
  [WireAim.Port]: 'crosshair',
  [WireAim.Drop]: 'copy',
  [WireAim.Refused]: 'not-allowed'
};

export function wireAim(wiring: Wiring, under: Port | null, magnet: Port | null): WireAim {
  if (wiring === Wiring.Idle) {
    return under ? WireAim.Port : WireAim.None;
  }
  if (magnet) {
    return WireAim.Drop;
  }
  return under ? WireAim.Refused : WireAim.None;
}

export function typesMeet(from: Port, to: Port): boolean {
  const [output, input] = from.side === PortSide.Out ? [from.port, to.port] : [to.port, from.port];
  return !output || !input || portAccepts(input, output);
}
