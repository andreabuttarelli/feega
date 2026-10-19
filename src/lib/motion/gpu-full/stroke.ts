export enum Cap {
  Butt = 'butt',
  Round = 'round',
  Square = 'square'
}

export enum Join {
  Miter = 'miter',
  Round = 'round',
  Bevel = 'bevel'
}

const MITER_LIMIT = 4;
const ROUND_STEPS = 24;
const EPSILON = 1e-9;
const DASH_SLACK = 1e-6;

type Pt = [number, number];

const pointsOf = (flat: number[]): Pt[] => Array.from({ length: flat.length / 2 }, (_, i) => [flat[i * 2], flat[i * 2 + 1]] as Pt).filter((p, i, all) => i === 0 || Math.hypot(p[0] - all[i - 1][0], p[1] - all[i - 1][1]) > EPSILON);

const normal = (a: Pt, b: Pt): Pt => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
};

const disc = ([x, y]: Pt, r: number): number[] => Array.from({ length: ROUND_STEPS }, (_, i) => [x + Math.cos((i / ROUND_STEPS) * 2 * Math.PI) * r, y + Math.sin((i / ROUND_STEPS) * 2 * Math.PI) * r]).flat();

function band(a: Pt, b: Pt, hw: number, extendA: number, extendB: number): number[] {
  const [nx, ny] = normal(a, b);
  const [dx, dy] = [ny, -nx];
  const s: Pt = [a[0] - dx * extendA, a[1] - dy * extendA];
  const e: Pt = [b[0] + dx * extendB, b[1] + dy * extendB];
  return [s[0] + nx * hw, s[1] + ny * hw, e[0] + nx * hw, e[1] + ny * hw, e[0] - nx * hw, e[1] - ny * hw, s[0] - nx * hw, s[1] - ny * hw];
}

function joinAt(prev: Pt, at: Pt, next: Pt, hw: number, join: Join): number[][] {
  if (join === Join.Round) {
    return [disc(at, hw)];
  }
  const n0 = normal(prev, at);
  const n1 = normal(at, next);
  const out: number[][] = [];
  for (const side of [1, -1]) {
    const a: Pt = [at[0] + side * n0[0] * hw, at[1] + side * n0[1] * hw];
    const b: Pt = [at[0] + side * n1[0] * hw, at[1] + side * n1[1] * hw];
    const mx = n0[0] + n1[0];
    const my = n0[1] + n1[1];
    const mlen = Math.hypot(mx, my);
    const cos = mlen / 2;
    const mitred = join === Join.Miter && mlen > EPSILON && 1 / cos <= MITER_LIMIT;
    out.push(mitred ? [at[0], at[1], a[0], a[1], at[0] + (side * mx * hw) / (mlen * cos), at[1] + (side * my * hw) / (mlen * cos), b[0], b[1]] : [at[0], at[1], a[0], a[1], b[0], b[1]]);
  }
  return out;
}

export function strokePolygons(flat: number[], closed: boolean, width: number, cap: Cap, join: Join): number[][] {
  const pts = pointsOf(flat);
  const hw = width / 2;
  if (pts.length < 2 || hw <= 0) {
    return [];
  }
  const ring = closed && pts.length > 2 ? [...pts, pts[0]] : pts;
  const last = ring.length - 2;
  const reach = cap === Cap.Square && !closed ? hw : 0;
  const polys: number[][] = ring.slice(0, -1).map((a, i) => band(a, ring[i + 1], hw, i === 0 ? reach : 0, i === last ? reach : 0));
  const corners = closed && pts.length > 2 ? ring.slice(0, -1).map((_, i) => i) : ring.slice(1, -1).map((_, i) => i + 1);
  for (const i of corners) {
    const prev = ring[(i - 1 + ring.length - 1) % (ring.length - 1)];
    polys.push(...joinAt(prev, ring[i], ring[i + 1] ?? ring[1], hw, join));
  }
  if (cap === Cap.Round && !closed) {
    polys.push(disc(ring[0], hw), disc(ring[ring.length - 1], hw));
  }
  return polys;
}

export function dashes(flat: number[], closed: boolean, dash: number, gap: number): number[][] {
  const pts = pointsOf(flat);
  const path = closed ? [...pts, pts[0]] : pts;
  const out: number[][] = [];
  const period = dash + gap;
  let travelled = 0;
  let current: number[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const [a, b] = [path[i], path[i + 1]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let at = 0;
    while (at < len) {
      const phase = (travelled + at) % period;
      const on = dash - phase > DASH_SLACK;
      const step = Math.max(DASH_SLACK, Math.min(len - at, on ? dash - phase : period - phase));
      const p = (t: number): number[] => [a[0] + ((b[0] - a[0]) * t) / len, a[1] + ((b[1] - a[1]) * t) / len];
      if (on) {
        current = current.length ? current : p(at);
        current.push(...p(at + step));
      } else if (current.length) {
        out.push(current);
        current = [];
      }
      at += step;
    }
    travelled += len;
  }
  if (current.length) {
    out.push(current);
  }
  return out;
}
