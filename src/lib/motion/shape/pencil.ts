import { corner, distance, type Outline, type Pt, type Vertex } from '@feega/motion-core/motion/shape/geometry';

const SIMPLIFY_TOLERANCE = 2;
const HANDLE_SHARE = 1 / 6;
const MIN_SAMPLES = 2;

function offLine(p: Pt, a: Pt, b: Pt): number {
  const length = distance(a, b);
  if (length === 0) {
    return distance(p, a);
  }
  return Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / length;
}

function simplified(points: readonly Pt[], tolerance: number): Pt[] {
  const first = points[0];
  const last = points[points.length - 1];
  const far = points.slice(1, -1).reduce((best, p, i) => {
    const d = offLine(p, first, last);
    return d > best.d ? { d, i: i + 1 } : best;
  }, { d: 0, i: 0 });
  if (far.d <= tolerance) {
    return [first, last];
  }
  return [...simplified(points.slice(0, far.i + 1), tolerance).slice(0, -1), ...simplified(points.slice(far.i), tolerance)];
}

function smoothed(points: readonly Pt[], i: number): Vertex {
  const p = points[i];
  const before = points[i - 1];
  const after = points[i + 1];
  if (!before || !after) {
    return corner(p);
  }
  const tx = (after[0] - before[0]) * HANDLE_SHARE;
  const ty = (after[1] - before[1]) * HANDLE_SHARE;
  return { p, in: [p[0] - tx, p[1] - ty], out: [p[0] + tx, p[1] + ty] };
}

export function smoothStroke(samples: readonly Pt[], tolerance = SIMPLIFY_TOLERANCE): Outline {
  if (samples.length < MIN_SAMPLES) {
    return [];
  }
  const points = simplified(samples, tolerance);
  return [{ vertices: points.map((_, i) => smoothed(points, i)), closed: false }];
}

export function straightStroke(from: Pt, to: Pt): Outline {
  return [{ vertices: [corner(from), corner(to)], closed: false }];
}
