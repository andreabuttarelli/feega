import { Cap, Join, strokePolygons } from '$lib/motion/gpu-full/stroke';

export type Polyline = { points: number[]; closed: boolean };

export type IconNode = [tag: string, attrs: Record<string, string | number>];

const ICON_UNITS = 24;
const CURVE_STEPS = 12;
const ARC_STEP = Math.PI / 12;
const CIRCLE_STEPS = 32;
const COMMAND = /[MmLlHhVvCcSsQqTtAaZz]/;
const TOKEN = /[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g;

type Pen = { x: number; y: number; startX: number; startY: number; cx: number; cy: number; cmd: string; out: Polyline[] };

const ARITY: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

const isFlag = (cmd: string, index: number) => cmd === 'a' && (index % ARITY.a === 3 || index % ARITY.a === 4);

function tokens(d: string): string[] {
  const queue: string[] = [...(d.match(TOKEN) ?? [])];
  const out: string[] = [];
  let cmd = '';
  let index = 0;
  while (queue.length) {
    const t = queue.shift()!;
    if (COMMAND.test(t)) {
      cmd = t.toLowerCase();
      index = 0;
      out.push(t);
      continue;
    }
    if (isFlag(cmd, index) && t.length > 1) {
      queue.unshift(t.slice(1));
      out.push(t[0]);
      index++;
      continue;
    }
    out.push(t);
    index++;
  }
  return out;
}

const current = (p: Pen) => p.out[p.out.length - 1];

const to = (p: Pen, x: number, y: number) => {
  current(p).points.push(x, y);
  p.x = x;
  p.y = y;
};

function cubicTo(p: Pen, x1: number, y1: number, x2: number, y2: number, x: number, y: number) {
  const [x0, y0] = [p.x, p.y];
  for (let i = 1; i <= CURVE_STEPS; i++) {
    const t = i / CURVE_STEPS;
    const u = 1 - t;
    to(p, u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y);
  }
  p.cx = x2;
  p.cy = y2;
}

function quadTo(p: Pen, x1: number, y1: number, x: number, y: number) {
  cubicTo(p, p.x + (2 / 3) * (x1 - p.x), p.y + (2 / 3) * (y1 - p.y), x + (2 / 3) * (x1 - x), y + (2 / 3) * (y1 - y), x, y);
  p.cx = x1;
  p.cy = y1;
}

function arcTo(p: Pen, rx: number, ry: number, rotation: number, large: number, sweep: number, x: number, y: number) {
  const phi = (rotation * Math.PI) / 180;
  const [cos, sin] = [Math.cos(phi), Math.sin(phi)];
  const dx = (p.x - x) / 2;
  const dy = (p.y - y) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  const grow = Math.max(1, Math.sqrt(lambda));
  const [a, b] = [Math.abs(rx) * grow, Math.abs(ry) * grow];
  const num = a * a * b * b - a * a * y1 * y1 - b * b * x1 * x1;
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / (a * a * y1 * y1 + b * b * x1 * x1)));
  const cxp = (k * a * y1) / b;
  const cyp = (-k * b * x1) / a;
  const cx = cos * cxp - sin * cyp + (p.x + x) / 2;
  const cy = sin * cxp + cos * cyp + (p.y + y) / 2;
  const angle = (ux: number, uy: number) => Math.atan2(uy, ux);
  const start = angle((x1 - cxp) / a, (y1 - cyp) / b);
  let delta = angle((-x1 - cxp) / a, (-y1 - cyp) / b) - start;
  if (!sweep && delta > 0) {
    delta -= 2 * Math.PI;
  }
  if (sweep && delta < 0) {
    delta += 2 * Math.PI;
  }
  const steps = Math.max(2, Math.ceil(Math.abs(delta) / ARC_STEP));
  for (let i = 1; i <= steps; i++) {
    const t = start + (delta * i) / steps;
    to(p, cx + a * Math.cos(t) * cos - b * Math.sin(t) * sin, cy + a * Math.cos(t) * sin + b * Math.sin(t) * cos);
  }
  to(p, x, y);
}

const DRAW: Record<string, (p: Pen, n: number[], rel: boolean) => void> = {
  m: (p, [x, y], rel) => {
    const [ax, ay] = rel ? [p.x + x, p.y + y] : [x, y];
    p.out.push({ points: [], closed: false });
    to(p, ax, ay);
    p.startX = ax;
    p.startY = ay;
  },
  l: (p, [x, y], rel) => to(p, rel ? p.x + x : x, rel ? p.y + y : y),
  h: (p, [x], rel) => to(p, rel ? p.x + x : x, p.y),
  v: (p, [y], rel) => to(p, p.x, rel ? p.y + y : y),
  c: (p, n, rel) => {
    const o = rel ? [p.x, p.y] : [0, 0];
    cubicTo(p, n[0] + o[0], n[1] + o[1], n[2] + o[0], n[3] + o[1], n[4] + o[0], n[5] + o[1]);
  },
  s: (p, n, rel) => {
    const o = rel ? [p.x, p.y] : [0, 0];
    const smooth = 'cs'.includes(p.cmd);
    cubicTo(p, smooth ? 2 * p.x - p.cx : p.x, smooth ? 2 * p.y - p.cy : p.y, n[0] + o[0], n[1] + o[1], n[2] + o[0], n[3] + o[1]);
  },
  q: (p, n, rel) => {
    const o = rel ? [p.x, p.y] : [0, 0];
    quadTo(p, n[0] + o[0], n[1] + o[1], n[2] + o[0], n[3] + o[1]);
  },
  t: (p, n, rel) => {
    const o = rel ? [p.x, p.y] : [0, 0];
    const smooth = 'qt'.includes(p.cmd);
    quadTo(p, smooth ? 2 * p.x - p.cx : p.x, smooth ? 2 * p.y - p.cy : p.y, n[0] + o[0], n[1] + o[1]);
  },
  a: (p, n, rel) => arcTo(p, n[0], n[1], n[2], n[3], n[4], rel ? p.x + n[5] : n[5], rel ? p.y + n[6] : n[6]),
  z: (p) => {
    current(p).closed = true;
    p.x = p.startX;
    p.y = p.startY;
  }
};

export function pathPolylines(d: string): Polyline[] {
  const pen: Pen = { x: 0, y: 0, startX: 0, startY: 0, cx: 0, cy: 0, cmd: '', out: [] };
  const list = tokens(d);
  let i = 0;
  let cmd = '';
  while (i < list.length) {
    if (COMMAND.test(list[i])) {
      cmd = list[i++];
    }
    const lower = cmd.toLowerCase();
    const n = list.slice(i, i + ARITY[lower]).map(Number);
    i += ARITY[lower];
    DRAW[lower](pen, n, cmd === lower);
    pen.cmd = lower;
    if (lower === 'm') {
      cmd = cmd === 'm' ? 'l' : 'L';
    }
    if (lower === 'z' && i < list.length && !COMMAND.test(list[i])) {
      break;
    }
  }
  return pen.out.filter((l) => l.points.length >= 4).map((l) => (l.closed ? { ...l, points: dropRepeat(l.points) } : l));
}

function dropRepeat(points: number[]): number[] {
  const n = points.length;
  return n > 2 && points[0] === points[n - 2] && points[1] === points[n - 1] ? points.slice(0, n - 2) : points;
}

const num = (v: string | number | undefined) => Number(v ?? 0);

function ellipse(cx: number, cy: number, rx: number, ry: number): Polyline {
  const points: number[] = [];
  for (let i = 0; i < CIRCLE_STEPS; i++) {
    const t = (i / CIRCLE_STEPS) * 2 * Math.PI;
    points.push(cx + rx * Math.cos(t), cy + ry * Math.sin(t));
  }
  return { points, closed: true };
}

function rounded(x: number, y: number, w: number, h: number, r: number): Polyline[] {
  if (!r) {
    return [{ points: [x, y, x + w, y, x + w, y + h, x, y + h], closed: true }];
  }
  return pathPolylines(`M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`);
}

const pairs = (s: string | number | undefined) => String(s ?? '').trim().split(/[\s,]+/).map(Number);

const SHAPES: Record<string, (a: Record<string, string | number>) => Polyline[]> = {
  path: (a) => pathPolylines(String(a.d ?? '')),
  line: (a) => [{ points: [num(a.x1), num(a.y1), num(a.x2), num(a.y2)], closed: false }],
  circle: (a) => [ellipse(num(a.cx), num(a.cy), num(a.r), num(a.r))],
  ellipse: (a) => [ellipse(num(a.cx), num(a.cy), num(a.rx), num(a.ry))],
  rect: (a) => rounded(num(a.x), num(a.y), num(a.width), num(a.height), num(a.rx ?? a.ry)),
  polyline: (a) => [{ points: pairs(a.points), closed: false }],
  polygon: (a) => [{ points: pairs(a.points), closed: true }]
};

export function iconContours(nodes: readonly IconNode[], size: number, strokeWidth: number): number[][] {
  const k = size / ICON_UNITS;
  return nodes.flatMap(([tag, attrs]) =>
    (SHAPES[tag]?.(attrs) ?? []).flatMap((l) => strokePolygons(l.points.map((v) => v * k), l.closed, strokeWidth * k, Cap.Round, Join.Round))
  );
}
