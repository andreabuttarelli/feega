export type Vec = { x: number; y: number };
export type Drop = { x: number; y: number; r: number };
export type Strain = { p: number; q: number };
export type Deform = { xx: number; xy: number; yy: number };

const DEG = Math.PI / 180;
const MAX_STRAIN = 0.45;
const SUBSTEPS = 4;
const STILL = 1e-6;

export const NO_STRAIN: Strain = { p: 0, q: 0 };

export function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

const smooth = (t: number) => {
  const c = Math.min(Math.max(t, 0), 1);
  return c * c * (3 - 2 * c);
};

export function dropRadius(radius: number, count: number, split: number): number {
  const apart = smooth(split / radius);
  return radius * (1 - apart + apart * count ** (-1 / 3));
}

export function dropsOf(center: Vec, radius: number, count: number, split: number, angle: number): Drop[] {
  const n = Math.max(1, Math.round(count));
  const r = dropRadius(radius, n, split);
  const ux = Math.cos(angle * DEG);
  const uy = Math.sin(angle * DEG);
  return Array.from({ length: n }, (_, i) => {
    const along = (i - (n - 1) / 2) * split;
    return { x: center.x + ux * along, y: center.y + uy * along, r };
  });
}

export function strainAlong(u: Vec, amount: number): Strain {
  const length = Math.hypot(u.x, u.y);
  if (length < STILL) {
    return NO_STRAIN;
  }
  const x = u.x / length;
  const y = u.y / length;
  return { p: ((x * x - y * y) / 2) * amount, q: x * y * amount };
}

export function deformOf(e: Strain): Deform {
  const raw = Math.hypot(e.p, e.q);
  const m = Math.min(raw, MAX_STRAIN);
  const k = raw > STILL ? m / raw : 0;
  const norm = 1 / Math.sqrt(1 - m * m);
  return { xx: (1 + e.p * k) * norm, xy: e.q * k * norm, yy: (1 - e.p * k) * norm };
}

export function inverseOf(d: Deform): Deform {
  const det = d.xx * d.yy - d.xy * d.xy;
  return { xx: d.yy / det, xy: -d.xy / det, yy: d.xx / det };
}

export function field(point: { x: number; y: number; z: number }, drops: readonly Drop[], blend: number, flat: number): number {
  return drops.reduce((d, drop) => smin(d, Math.hypot(point.x - drop.x, point.y - drop.y, point.z / flat) - drop.r, blend), Number.POSITIVE_INFINITY);
}

export type Jelly = { stiffness: number; damping: number };

export function jellyOf(viscosity: number): Jelly {
  const hz = 3.2 - 1.8 * viscosity;
  const zeta = 0.16 + 0.5 * viscosity;
  const w = 2 * Math.PI * hz;
  return { stiffness: w * w, damping: 2 * zeta * w };
}

export type JellyState = { e: Strain; v: Strain };

export const JELLY_AT_REST: JellyState = { e: NO_STRAIN, v: NO_STRAIN };

export function jellyStep(state: JellyState, target: Strain, jelly: Jelly, seconds: number): JellyState {
  const dt = seconds / SUBSTEPS;
  const { stiffness, damping } = jelly;
  let { e, v } = state;
  for (let s = 0; s < SUBSTEPS; s++) {
    v = { p: v.p + (stiffness * (target.p - e.p) - damping * v.p) * dt, q: v.q + (stiffness * (target.q - e.q) - damping * v.q) * dt };
    e = { p: e.p + v.p * dt, q: e.q + v.q * dt };
  }
  return { e, v };
}

export function jellyStrains(targets: readonly Strain[], jellies: readonly Jelly[], fps: number): Strain[] {
  let state = JELLY_AT_REST;
  return targets.map((target, i) => {
    state = jellyStep(state, target, jellies[i], 1 / fps);
    return state.e;
  });
}

export function bounds(drops: readonly Drop[], d: Deform, center: Vec, margin: number): { x: number; y: number; width: number; height: number } {
  const reach = Math.max(Math.hypot(d.xx, d.xy), Math.hypot(d.xy, d.yy));
  const xs = drops.flatMap((p) => {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    const x = center.x + d.xx * dx + d.xy * dy;
    return [x - p.r * reach - margin, x + p.r * reach + margin];
  });
  const ys = drops.flatMap((p) => {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    const y = center.y + d.xy * dx + d.yy * dy;
    return [y - p.r * reach - margin, y + p.r * reach + margin];
  });
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}
