import { Op, type Command } from './face';

export type Rect = [left: number, top: number, right: number, bottom: number];

const TOLERANCE_PX = 0.05;
const MAX_STEPS = 128;

function steps(deviation: number): number {
  return Math.min(MAX_STEPS, Math.max(1, Math.ceil(Math.sqrt(deviation / (4 * TOLERANCE_PX)))));
}

const off = (ax: number, ay: number, bx: number, by: number, px: number, py: number) => {
  const length = Math.hypot(bx - ax, by - ay) || 1;
  return Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length;
};

export function contoursOf(commands: Command[], scale: number, skew: number): number[][] {
  const contours: number[][] = [];
  let contour: number[] = [];
  let [x, y] = [0, 0];
  const put = (ux: number, uy: number) => {
    const px = ux * scale;
    const py = uy * scale;
    contour.push(px + py * skew, -py);
  };
  const close = () => {
    if (contour.length >= 6) {
      contours.push(contour);
    }
    contour = [];
  };
  for (const { op, at } of commands) {
    if (op === Op.Move) {
      close();
      [x, y] = at;
      put(x, y);
      continue;
    }
    if (op === Op.Line) {
      [x, y] = at;
      put(x, y);
      continue;
    }
    if (op === Op.Quad) {
      const [cx, cy, ex, ey] = at;
      const n = steps(off(x, y, ex, ey, cx, cy) * scale);
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const u = 1 - t;
        put(u * u * x + 2 * u * t * cx + t * t * ex, u * u * y + 2 * u * t * cy + t * t * ey);
      }
      [x, y] = [ex, ey];
      continue;
    }
    if (op === Op.Cubic) {
      const [c1x, c1y, c2x, c2y, ex, ey] = at;
      const n = steps(Math.max(off(x, y, ex, ey, c1x, c1y), off(x, y, ex, ey, c2x, c2y)) * scale * 0.75);
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const u = 1 - t;
        const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
        put(w[0] * x + w[1] * c1x + w[2] * c2x + w[3] * ex, w[0] * y + w[1] * c1y + w[2] * c2y + w[3] * ey);
      }
      [x, y] = [ex, ey];
      continue;
    }
    close();
  }
  close();
  return contours;
}

function area(c: number[]): number {
  let sum = 0;
  for (let i = 0; i < c.length; i += 2) {
    const j = (i + 2) % c.length;
    sum += c[i] * c[j + 1] - c[j] * c[i + 1];
  }
  return sum / 2;
}

const MIN_COSINE = 0.25;

function distinct(c: number[]): number[] {
  const out: number[] = [];
  const n = c.length / 2;
  for (let i = 0; i < n; i++) {
    const j = ((i + 1) % n) * 2;
    if (c[i * 2] === c[j] && c[i * 2 + 1] === c[j + 1]) {
      continue;
    }
    out.push(c[i * 2], c[i * 2 + 1]);
  }
  return out;
}

function pushed(points: number[], distance: number): number[] {
  const c = distinct(points);
  const n = c.length / 2;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const [px, py] = [c[((i + n - 1) % n) * 2], c[((i + n - 1) % n) * 2 + 1]];
    const [x, y] = [c[i * 2], c[i * 2 + 1]];
    const [nx, ny] = [c[((i + 1) % n) * 2], c[((i + 1) % n) * 2 + 1]];
    const a = Math.hypot(x - px, y - py) || 1;
    const b = Math.hypot(nx - x, ny - y) || 1;
    const [ax, ay] = [(y - py) / a, -(x - px) / a];
    const [bx, by] = [(ny - y) / b, -(nx - x) / b];
    const [sx, sy] = [ax + bx, ay + by];
    const length = Math.hypot(sx, sy) || 1;
    const [ux, uy] = [sx / length, sy / length];
    const stretch = distance / Math.max(MIN_COSINE, ux * ax + uy * ay);
    out.push(x + ux * stretch, y + uy * stretch);
  }
  return out;
}

export function dilated(contours: number[][], by: number): number[][] {
  const outer = contours.reduce((best, c) => (Math.abs(area(c)) > Math.abs(area(best)) ? c : best), contours[0] ?? []);
  const side = area(outer) > 0 ? by : -by;
  return contours.map((c) => pushed(c, side));
}

type Edge = { inside: (x: number, y: number) => boolean; cross: (ax: number, ay: number, bx: number, by: number) => [number, number] };

const vertical = (at: number, keep: 1 | -1): Edge => ({
  inside: (x) => (x - at) * keep >= 0,
  cross: (ax, ay, bx, by) => [at, ay + ((by - ay) * (at - ax)) / (bx - ax)]
});

const horizontal = (at: number, keep: 1 | -1): Edge => ({
  inside: (_x, y) => (y - at) * keep >= 0,
  cross: (ax, ay, bx, by) => [ax + ((bx - ax) * (at - ay)) / (by - ay), at]
});

function cut(points: number[], edge: Edge): number[] {
  const out: number[] = [];
  const n = points.length / 2;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = [points[i * 2], points[i * 2 + 1]];
    const j = (i + 1) % n;
    const [bx, by] = [points[j * 2], points[j * 2 + 1]];
    const a = edge.inside(ax, ay);
    const b = edge.inside(bx, by);
    if (a) {
      out.push(ax, ay);
    }
    if (a !== b) {
      out.push(...edge.cross(ax, ay, bx, by));
    }
  }
  return out;
}

export function clipped(contours: number[][], [left, top, right, bottom]: Rect): number[][] {
  const edges = [vertical(left, 1), vertical(right, -1), horizontal(top, 1), horizontal(bottom, -1)];
  return contours.map((c) => edges.reduce(cut, c)).filter((c) => c.length >= 6);
}

const side = (ax: number, ay: number, bx: number, by: number, x: number, y: number) => (bx - ax) * (y - ay) - (by - ay) * (x - ax);

const halfPlane = (ax: number, ay: number, bx: number, by: number, keep: number): Edge => ({
  inside: (x, y) => side(ax, ay, bx, by, x, y) * keep >= 0,
  cross: (px, py, qx, qy) => {
    const t = side(ax, ay, bx, by, px, py) / (side(ax, ay, bx, by, px, py) - side(ax, ay, bx, by, qx, qy));
    return [px + (qx - px) * t, py + (qy - py) * t];
  }
});

export function within(contours: number[][], polygon: number[]): number[][] {
  const n = polygon.length / 2;
  const keep = Math.sign(area(polygon)) || 1;
  const edges = Array.from({ length: n }, (_, i) => halfPlane(polygon[i * 2], polygon[i * 2 + 1], polygon[((i + 1) % n) * 2], polygon[((i + 1) % n) * 2 + 1], keep));
  return contours.map((c) => edges.reduce(cut, c)).filter((c) => c.length >= 6);
}
