import type { Vector, VectorNetwork, VectorSegment } from './model';

export type Cubic = { p0: Vector; cp1: Vector; cp2: Vector; p3: Vector };

export type Nearest = { t: number; x: number; y: number; distance: number };

export type NetworkNearest = Nearest & { segmentIndex: number };

const EPSILON = 1e-12;
const COARSE_SAMPLES = 64;
const REFINE_ROUNDS = 5;
const REFINE_STEPS = 4;

export function evalCubic(c: Cubic, t: number): Vector {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const d = 3 * mt * t * t;
  const e = t * t * t;
  return { x: a * c.p0.x + b * c.cp1.x + d * c.cp2.x + e * c.p3.x, y: a * c.p0.y + b * c.cp1.y + d * c.cp2.y + e * c.p3.y };
}

const mix = (a: Vector, b: Vector, t: number): Vector => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export function splitCubicAt(c: Cubic, t: number): { left: Cubic; right: Cubic } {
  const m01 = mix(c.p0, c.cp1, t);
  const m12 = mix(c.cp1, c.cp2, t);
  const m23 = mix(c.cp2, c.p3, t);
  const m012 = mix(m01, m12, t);
  const m123 = mix(m12, m23, t);
  const at = mix(m012, m123, t);
  return { left: { p0: { ...c.p0 }, cp1: m01, cp2: m012, p3: at }, right: { p0: { ...at }, cp1: m123, cp2: m23, p3: { ...c.p3 } } };
}

export function segmentCubic(network: VectorNetwork, index: number): Cubic {
  const s = network.segments[index];
  const a = network.vertices[s.start];
  const b = network.vertices[s.end];
  return {
    p0: { x: a.x, y: a.y },
    cp1: { x: a.x + s.tangentStart.x, y: a.y + s.tangentStart.y },
    cp2: { x: b.x + s.tangentEnd.x, y: b.y + s.tangentEnd.y },
    p3: { x: b.x, y: b.y }
  };
}

export const isLine = (s: VectorSegment) => s.tangentStart.x === 0 && s.tangentStart.y === 0 && s.tangentEnd.x === 0 && s.tangentEnd.y === 0;

export function cubicExtrema(p0: number, p1: number, p2: number, p3: number): number[] {
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = -p0 + p1;
  const inside = (t: number) => t > 0 && t < 1;

  if (Math.abs(a) < EPSILON) {
    return Math.abs(b) > EPSILON && inside(-c / b) ? [-c / b] : [];
  }
  const disc = b * b - 4 * a * c;
  if (disc < 0) {
    return [];
  }
  const root = Math.sqrt(disc);
  const roots = [(-b + root) / (2 * a), (-b - root) / (2 * a)];
  return roots.filter((t, i) => inside(t) && (i === 0 || Math.abs(t - roots[0]) > EPSILON));
}

export function networkBounds(network: VectorNetwork): { x: number; y: number; width: number; height: number } {
  if (!network.vertices.length) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const points: Vector[] = network.vertices.map((v) => ({ x: v.x, y: v.y }));
  network.segments.forEach((_, i) => {
    const c = segmentCubic(network, i);
    const ts = [...cubicExtrema(c.p0.x, c.cp1.x, c.cp2.x, c.p3.x), ...cubicExtrema(c.p0.y, c.cp1.y, c.cp2.y, c.p3.y)];
    points.push(...ts.map((t) => evalCubic(c, t)));
  });
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

const distance2 = (a: Vector, p: Vector) => (a.x - p.x) ** 2 + (a.y - p.y) ** 2;

function nearestOnCubic(p: Vector, c: Cubic): Nearest {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i <= COARSE_SAMPLES; i++) {
    const d = distance2(evalCubic(c, i / COARSE_SAMPLES), p);
    if (d < bestD) {
      bestD = d;
      best = i / COARSE_SAMPLES;
    }
  }

  let lo = Math.max(0, best - 1 / COARSE_SAMPLES);
  let hi = Math.min(1, best + 1 / COARSE_SAMPLES);
  for (let round = 0; round < REFINE_ROUNDS; round++) {
    const step = (hi - lo) / REFINE_STEPS;
    bestD = Infinity;
    for (let i = 0; i <= REFINE_STEPS; i++) {
      const t = lo + step * i;
      const d = distance2(evalCubic(c, t), p);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    lo = Math.max(0, best - step);
    hi = Math.min(1, best + step);
  }

  const at = evalCubic(c, best);
  return { t: best, x: at.x, y: at.y, distance: Math.sqrt(bestD) };
}

function nearestOnLine(p: Vector, a: Vector, b: Vector): Nearest {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  const t = length2 < EPSILON ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2));
  const x = a.x + t * dx;
  const y = a.y + t * dy;
  return { t, x, y, distance: Math.hypot(x - p.x, y - p.y) };
}

export function nearestOnNetwork(p: Vector, network: VectorNetwork, threshold: number): NetworkNearest | null {
  let best: NetworkNearest | null = null;
  network.segments.forEach((s, i) => {
    const found = isLine(s) ? nearestOnLine(p, network.vertices[s.start], network.vertices[s.end]) : nearestOnCubic(p, segmentCubic(network, i));
    if (found.distance <= threshold && (!best || found.distance < best.distance)) {
      best = { ...found, segmentIndex: i };
    }
  });
  return best;
}
