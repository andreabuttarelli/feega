import { distance, flatten, polyline, polylineLength, type Contour, type Outline, type Pt } from './geometry';

export const MORPH_POINTS = 120;

export function resample(contour: Contour, n: number): Pt[] {
  const flat = flatten(contour);
  if (flat.length < 2) {
    return Array.from({ length: n }, () => flat[0] ?? [0, 0]);
  }
  const ring = contour.closed ? [...flat, flat[0]] : flat;
  const total = polylineLength(ring, false);
  const step = total / (contour.closed ? n : n - 1);
  const out: Pt[] = [];
  let seg = 1;
  let walked = 0;
  for (let i = 0; i < n; i++) {
    const target = Math.min(i * step, total);
    while (seg < ring.length - 1 && walked + distance(ring[seg - 1], ring[seg]) < target) {
      walked += distance(ring[seg - 1], ring[seg]);
      seg++;
    }
    const a = ring[seg - 1];
    const b = ring[seg];
    const len = distance(a, b);
    const t = len ? (target - walked) / len : 0;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

const rotate = (ring: readonly Pt[], shift: number): Pt[] => ring.map((_, i) => ring[(i + shift) % ring.length]);

function cost(a: readonly Pt[], b: readonly Pt[]): number {
  let total = 0;
  for (let i = 0; i < a.length; i++) {
    total += (a[i][0] - b[i][0]) ** 2 + (a[i][1] - b[i][1]) ** 2;
  }
  return total;
}

function aligned(from: readonly Pt[], to: readonly Pt[], closed: boolean, startShift: number): Pt[] {
  const reversed = [...to].reverse();
  if (!closed) {
    return cost(from, to) <= cost(from, reversed) ? [...to] : reversed;
  }
  let best: Pt[] = [...to];
  let lowest = Infinity;
  for (const ring of [to, reversed]) {
    for (let shift = 0; shift < ring.length; shift++) {
      const candidate = rotate(ring, shift);
      const c = cost(from, candidate);
      if (c < lowest - 1e-12) {
        lowest = c;
        best = candidate;
      }
    }
  }
  const n = best.length;
  return rotate(best, ((Math.round(startShift * n) % n) + n) % n);
}

function centroid(points: readonly Pt[]): Pt {
  const sum = points.reduce<[number, number]>((s, p) => [s[0] + p[0], s[1] + p[1]], [0, 0]);
  return [sum[0] / points.length, sum[1] / points.length];
}

type Ring = { points: Pt[]; closed: boolean };

const ringOf = (c: Contour): Ring => ({ points: resample(c, MORPH_POINTS), closed: c.closed });
const dotOf = (other: Ring): Ring => ({ points: Array.from({ length: MORPH_POINTS }, () => centroid(other.points)), closed: other.closed });

export function morphBetween(a: Outline, b: Outline, t: number, startShift: number): Outline {
  const count = Math.max(a.length, b.length);
  const from = Array.from({ length: count }, (_, i) => (a[i] ? ringOf(a[i]) : null));
  const to = Array.from({ length: count }, (_, i) => (b[i] ? ringOf(b[i]) : null));
  return from.map((maybeFrom, i) => {
    const source = maybeFrom ?? dotOf(to[i]!);
    const target = to[i] ?? dotOf(source);
    const closed = source.closed && target.closed;
    const matched = aligned(source.points, target.points, closed, startShift);
    return polyline(
      source.points.map((p, k) => [p[0] + (matched[k][0] - p[0]) * t, p[1] + (matched[k][1] - p[1]) * t]),
      closed
    );
  });
}

export function morphOutline(shapes: readonly Outline[], position: number, startShift: number): Outline {
  if (shapes.length < 2) {
    return shapes[0] ?? [];
  }
  const clamped = Math.min(Math.max(position, 0), shapes.length - 1);
  const i = Math.min(Math.floor(clamped), shapes.length - 2);
  return morphBetween(shapes[i], shapes[i + 1], clamped - i, startShift);
}
