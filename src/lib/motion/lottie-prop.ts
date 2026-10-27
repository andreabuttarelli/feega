export type LottieProp = { a?: number; k?: unknown; s?: boolean; x?: LottieProp; y?: LottieProp; z?: LottieProp };

type Handle = { x: number | number[]; y: number | number[] };

export type LottieKey = { t: number; s?: unknown[]; e?: unknown[]; o?: Handle; i?: Handle; h?: number; ti?: number[]; to?: number[] };

export type Bezier4 = [number, number, number, number];

const SOLVE_STEPS = 24;
const FLAT: Bezier4 = [0, 0, 1, 1];
const HELD = 1;

const first = (n: number | number[] | undefined, fallback: number) => (Array.isArray(n) ? (n[0] ?? fallback) : (n ?? fallback));

export function keysOf(p: LottieProp): LottieKey[] | null {
  const k = p.k;
  if (!Array.isArray(k) || !k.length) {
    return null;
  }
  const head = k[0] as unknown;
  return typeof head === 'object' && head !== null && 't' in head ? (k as LottieKey[]) : null;
}

export function isAnimated(p: LottieProp | undefined): boolean {
  if (!p) {
    return false;
  }
  if (p.s) {
    return isAnimated(p.x) || isAnimated(p.y) || isAnimated(p.z);
  }
  return (keysOf(p)?.length ?? 0) > 1;
}

export function keyTimes(p: LottieProp | undefined): number[] {
  if (!p) {
    return [];
  }
  if (p.s) {
    return [...keyTimes(p.x), ...keyTimes(p.y), ...keyTimes(p.z)];
  }
  return keysOf(p)?.map((k) => k.t) ?? [];
}

export function easeOf(key: LottieKey): Bezier4 {
  if (!key.o || !key.i) {
    return FLAT;
  }
  return [first(key.o.x, 0), first(key.o.y, 0), first(key.i.x, 1), first(key.i.y, 1)];
}

export function hasCurvedPath(p: LottieProp | undefined): boolean {
  if (!p || p.s) {
    return false;
  }
  return (keysOf(p) ?? []).some((k) => k.to?.some((n) => n !== 0) || k.ti?.some((n) => n !== 0));
}

const numbers = (v: unknown): number[] => (Array.isArray(v) ? (v as number[]) : typeof v === 'number' ? [v] : []);

function eased(progress: number, [ox, oy, ix, iy]: Bezier4): number {
  let lo = 0;
  let hi = 1;
  for (let step = 0; step < SOLVE_STEPS; step++) {
    const mid = (lo + hi) / 2;
    const u = 1 - mid;
    const x = 3 * u * u * mid * ox + 3 * u * mid * mid * ix + mid * mid * mid;
    if (x < progress) {
      lo = mid;
      continue;
    }
    hi = mid;
  }
  const t = (lo + hi) / 2;
  const u = 1 - t;
  return 3 * u * u * t * oy + 3 * u * t * t * iy + t * t * t;
}

function startOf(keys: LottieKey[], n: number): number[] {
  const own = keys[n].s;
  if (own) {
    return numbers(own);
  }
  return numbers(keys[n - 1]?.e);
}

function endOf(keys: LottieKey[], n: number): number[] {
  const next = keys[n + 1];
  if (next?.s) {
    return numbers(next.s);
  }
  return keys[n].e ? numbers(keys[n].e) : startOf(keys, n);
}

export function valueAt(p: LottieProp, t: number): number[] {
  if (p.s) {
    const dims = [p.x, p.y, p.z].filter((d): d is LottieProp => Boolean(d));
    return dims.map((d) => valueAt(d, t)[0] ?? 0);
  }
  const keys = keysOf(p);
  if (!keys) {
    return numbers(p.k);
  }
  if (t <= keys[0].t) {
    return startOf(keys, 0);
  }
  const last = keys.length - 1;
  if (t >= keys[last].t) {
    return startOf(keys, last).length ? startOf(keys, last) : endOf(keys, last - 1);
  }
  const n = keys.findLastIndex((k) => k.t <= t);
  const from = startOf(keys, n);
  if (keys[n].h === HELD) {
    return from;
  }
  const to = endOf(keys, n);
  const progress = eased((t - keys[n].t) / (keys[n + 1].t - keys[n].t), easeOf(keys[n]));
  return from.map((v, d) => v + ((to[d] ?? v) - v) * progress);
}

export const scalarAt = (p: LottieProp | undefined, t: number, fallback: number): number => (p ? (valueAt(p, t)[0] ?? fallback) : fallback);

export const pairAt = (p: LottieProp | undefined, t: number, fallback: [number, number]): [number, number] => {
  if (!p) {
    return fallback;
  }
  const v = valueAt(p, t);
  return [v[0] ?? fallback[0], v[1] ?? fallback[1]];
};
