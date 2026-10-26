import { FillType } from '@feega/motion-core/motion/fill/model';
import { cubicAt, distance, parsePath, segmentsOf, type Contour } from '@feega/motion-core/motion/shape/geometry';
import { ClipOp, clipPolygons } from '@feega/motion-core/motion/shape/polygon-clip';

type Matrix = [a: number, b: number, c: number, d: number, e: number, f: number];
type Pt = [number, number];
type Segment = { cmd: 'M' | 'L' | 'C' | 'Z'; pts: Pt[] };
type Attrs = Record<string, string>;
type Paint = { fill: string | null; stroke: string | null; fillRule: SvgFillRule };

type Polygon = Pt[];
type Referable = { tag: string; attrs: Attrs };

type Box = { left: number; top: number; right: number; bottom: number };
type Stop = { color: string; pos: number };
type GradientDef = { kind: FillType.Linear | FillType.Radial; attrs: Attrs; stops: Stop[] };

export type SvgGradient =
  | { type: FillType.Linear; stops: Stop[]; angle: number }
  | { type: FillType.Radial; stops: Stop[]; center: { x: number; y: number }; radius: number }
  | { type: FillType.Angular; stops: Stop[]; angle: number; center: { x: number; y: number } }
  | { type: FillType.Diamond; stops: Stop[] };
export type SvgFillRule = 'nonzero' | 'evenodd';
export type SvgShape = { path: string; fill: string | null; stroke: string | null; fillRule: SvgFillRule; gradient?: SvgGradient };
export type SvgTextAnchor = 'start' | 'middle' | 'end';
export type SvgText = { text: string; x: number; y: number; size: number; fill: string; weight: number; anchor: SvgTextAnchor };
export type SvgRead = { size: { width: number; height: number }; shapes: SvgShape[]; texts: SvgText[] };

const FILL_RULES = new Map<string, SvgFillRule>([
  ['nonzero', 'nonzero'],
  ['evenodd', 'evenodd']
]);
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const DEFAULT_SIDE = 100;
const DIGITS = 1000;
const KAPPA = 0.5522847498;
const HIDDEN_TAGS = new Set(['defs', 'clippath', 'mask', 'symbol', 'style', 'title', 'desc', 'metadata', 'pattern', 'lineargradient', 'radialgradient', 'filter', 'marker', 'text']);
const TAG = /<\s*(\/?)\s*([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)\s*>/g;
const ATTR = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;
const PATH_TOKEN = /[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g;
const COMMAND = /^[MmLlHhVvCcSsQqTtAaZz]$/;
const ARITY: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
const ARC_FLAGS = new Set([3, 4]);
const MAX_STOPS = 8;
const DEFAULT_TEXT_SIZE = 16;
const REGULAR_WEIGHT = 400;
const BOLD_WEIGHT = 700;
const LINE_BREAK = '\u0000';
const RADIAL_FULL = 2;
const MIN_RADIUS = 0.01;
const MAX_RADIUS = 4;
const ANGLE_DIGITS = 100;
const CSS_ANGLE_OFFSET = 90;
const USER_SPACE = 'userspaceonuse';
const FIGMA_GRADIENT = 'data-figma-gradient-fill';
const CONIC_FROM = /conic-gradient\(\s*from\s+(-?[\d.]+)deg/i;
const CHANNEL = 255;
const FULL_TURN = 360;
const MIDDLE = 0.5;
const GRADIENT = /<(linearGradient|radialGradient)\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/\1\s*>/gi;
const STOP = /<stop\b((?:[^>"']|"[^"]*"|'[^']*')*?)\/?>/gi;
const CLIP = /<clipPath\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/clipPath\s*>/gi;
const MASK = /<mask\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/mask\s*>/gi;
const URL_REF = /^url\(\s*['"]?#([^'")\s]+)/;
const LINE_TSPAN = /<tspan\b(?=[^>]*\s(?:y|dy)\s*=)[^>]*>/gi;
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

const NAMED: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  lime: '#00ff00',
  blue: '#0000ff',
  yellow: '#ffff00',
  gray: '#808080',
  grey: '#808080',
  orange: '#ffa500',
  purple: '#800080',
  currentcolor: '#000000'
};

const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');

function colour(raw: string | undefined): string | null | undefined {
  if (raw?.trim().startsWith('url(')) {
    return raw.trim();
  }
  const v = raw?.trim().toLowerCase();
  if (!v) {
    return undefined;
  }
  if (v === 'none' || v === 'transparent') {
    return null;
  }
  if (NAMED[v]) {
    return NAMED[v];
  }
  if (/^#[0-9a-f]{3}$/.test(v)) {
    return `#${[...v.slice(1)].map((c) => c + c).join('')}`;
  }
  if (/^#[0-9a-f]{6}/.test(v)) {
    return v.slice(0, 7);
  }
  const rgb = v.match(/^rgba?\(([^)]*)\)/);
  if (rgb) {
    const [r, g, b] = rgb[1].split(/[\s,/]+/).map(Number);
    return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  }
  return NAMED.black;
}

function attrsOf(raw: string): Attrs {
  const out: Attrs = {};
  for (const m of raw.matchAll(ATTR)) {
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? '';
  }
  for (const rule of (out.style ?? '').split(';')) {
    const [key, ...value] = rule.split(':');
    if (key?.trim() && value.length) {
      out[key.trim().toLowerCase()] = value.join(':').trim();
    }
  }
  return out;
}

const numbers = (s: string | undefined): number[] => (s?.match(NUMBER) ?? []).map(Number);
const num = (s: string | undefined, fallback = 0) => numbers(s)[0] ?? fallback;

const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5]
];

const apply = (m: Matrix, [x, y]: Pt): Pt => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

const rad = (deg: number) => (deg * Math.PI) / 180;

const TRANSFORMS: Record<string, (n: number[]) => Matrix> = {
  matrix: (n) => [n[0], n[1], n[2], n[3], n[4], n[5]],
  translate: ([x = 0, y = 0]) => [1, 0, 0, 1, x, y],
  scale: ([x = 1, y = x]) => [x, 0, 0, y, 0, 0],
  rotate: ([a = 0, cx = 0, cy = 0]) => {
    const [cos, sin] = [Math.cos(rad(a)), Math.sin(rad(a))];
    return multiply(multiply([1, 0, 0, 1, cx, cy], [cos, sin, -sin, cos, 0, 0]), [1, 0, 0, 1, -cx, -cy]);
  },
  skewx: ([a = 0]) => [1, 0, Math.tan(rad(a)), 1, 0, 0],
  skewy: ([a = 0]) => [1, Math.tan(rad(a)), 0, 1, 0, 0]
};

function transformOf(raw: string | undefined): Matrix {
  let m = IDENTITY;
  for (const t of (raw ?? '').matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const make = TRANSFORMS[t[1].toLowerCase()];
    if (make) {
      m = multiply(m, make(numbers(t[2])));
    }
  }
  return m;
}

function arcCurves(from: Pt, rx: number, ry: number, angle: number, large: boolean, sweep: boolean, to: Pt): Pt[][] {
  if (!rx || !ry || (from[0] === to[0] && from[1] === to[1])) {
    return [[from, to, to]];
  }
  const phi = rad(angle);
  const [cos, sin] = [Math.cos(phi), Math.sin(phi)];
  const dx = (from[0] - to[0]) / 2;
  const dy = (from[1] - to[1]) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  const grow = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  const [Rx, Ry] = grow > 1 ? [Math.abs(rx) * Math.sqrt(grow), Math.abs(ry) * Math.sqrt(grow)] : [Math.abs(rx), Math.abs(ry)];
  const sign = large === sweep ? -1 : 1;
  const top = Rx * Rx * Ry * Ry - Rx * Rx * y1 * y1 - Ry * Ry * x1 * x1;
  const k = sign * Math.sqrt(Math.max(0, top / (Rx * Rx * y1 * y1 + Ry * Ry * x1 * x1)));
  const cx1 = (k * Rx * y1) / Ry;
  const cy1 = (-k * Ry * x1) / Rx;
  const cx = cos * cx1 - sin * cy1 + (from[0] + to[0]) / 2;
  const cy = sin * cx1 + cos * cy1 + (from[1] + to[1]) / 2;
  const angleOf = (ux: number, uy: number) => Math.atan2(uy, ux);
  const start = angleOf((x1 - cx1) / Rx, (y1 - cy1) / Ry);
  let delta = angleOf((-x1 - cx1) / Rx, (-y1 - cy1) / Ry) - start;
  if (sweep && delta < 0) {
    delta += Math.PI * 2;
  }
  if (!sweep && delta > 0) {
    delta -= Math.PI * 2;
  }
  const parts = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2)));
  const step = delta / parts;
  const handle = (4 / 3) * Math.tan(step / 4);
  const at = (t: number): Pt => [cx + Rx * Math.cos(t) * cos - Ry * Math.sin(t) * sin, cy + Rx * Math.cos(t) * sin + Ry * Math.sin(t) * cos];
  const tangent = (t: number): Pt => [-Rx * Math.sin(t) * cos - Ry * Math.cos(t) * sin, -Rx * Math.sin(t) * sin + Ry * Math.cos(t) * cos];
  return Array.from({ length: parts }, (_, i) => {
    const a = start + i * step;
    const b = a + step;
    const [p0, p1, t0, t1] = [at(a), at(b), tangent(a), tangent(b)];
    return [
      [p0[0] + handle * t0[0], p0[1] + handle * t0[1]],
      [p1[0] - handle * t1[0], p1[1] - handle * t1[1]],
      i === parts - 1 ? to : p1
    ];
  });
}

function pathTokens(d: string): string[] {
  const queue = [...(d.match(PATH_TOKEN) ?? [])];
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
    const flag = cmd === 'a' && ARC_FLAGS.has(index % ARITY.a);
    if (flag && t.replace('-', '').length > 1) {
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

function pathSegments(d: string): Segment[] {
  const tokens = pathTokens(d);
  const segments: Segment[] = [];
  let pen: Pt = [0, 0];
  let start: Pt = [0, 0];
  let cubic: Pt | null = null;
  let quad: Pt | null = null;
  let cmd = '';
  let i = 0;

  const read = () => Number(tokens[i++]);
  const pt = (rel: boolean): Pt => {
    const p: Pt = [read(), read()];
    return rel ? [pen[0] + p[0], pen[1] + p[1]] : p;
  };
  const curve = (c1: Pt, c2: Pt, p: Pt) => {
    segments.push({ cmd: 'C', pts: [c1, c2, p] });
    pen = p;
  };
  const line = (p: Pt) => {
    segments.push({ cmd: 'L', pts: [p] });
    pen = p;
  };
  const quadTo = (q: Pt, p: Pt) => {
    curve([pen[0] + (2 / 3) * (q[0] - pen[0]), pen[1] + (2 / 3) * (q[1] - pen[1])], [p[0] + (2 / 3) * (q[0] - p[0]), p[1] + (2 / 3) * (q[1] - p[1])], p);
    quad = q;
  };
  const mirror = (c: Pt | null): Pt => (c ? [2 * pen[0] - c[0], 2 * pen[1] - c[1]] : pen);

  const STEP: Record<string, (rel: boolean) => void> = {
    m: (rel) => {
      pen = pt(rel);
      start = pen;
      segments.push({ cmd: 'M', pts: [pen] });
      cmd = rel ? 'l' : 'L';
    },
    l: (rel) => line(pt(rel)),
    h: (rel) => line([rel ? pen[0] + read() : read(), pen[1]]),
    v: (rel) => line([pen[0], rel ? pen[1] + read() : read()]),
    c: (rel) => {
      const [c1, c2, p] = [pt(rel), pt(rel), pt(rel)];
      curve(c1, c2, p);
      cubic = c2;
    },
    s: (rel) => {
      const c1 = mirror(cubic);
      const [c2, p] = [pt(rel), pt(rel)];
      curve(c1, c2, p);
      cubic = c2;
    },
    q: (rel) => {
      const [q, p] = [pt(rel), pt(rel)];
      quadTo(q, p);
    },
    t: (rel) => quadTo(mirror(quad), pt(rel)),
    a: (rel) => {
      const [rx, ry, angle, large, sweep] = [read(), read(), read(), read(), read()];
      for (const [c1, c2, p] of arcCurves(pen, rx, ry, angle, large === 1, sweep === 1, pt(rel))) {
        curve(c1, c2, p);
      }
    },
    z: () => {
      segments.push({ cmd: 'Z', pts: [] });
      pen = start;
    }
  };

  while (i < tokens.length) {
    if (COMMAND.test(tokens[i])) {
      cmd = tokens[i++];
    }
    const lower = cmd.toLowerCase();
    const step = STEP[lower];
    if (!step || (ARITY[lower] && i + ARITY[lower] > tokens.length)) {
      break;
    }
    const before = cmd;
    step(cmd !== cmd.toUpperCase());
    if (lower !== 'c' && lower !== 's') {
      cubic = null;
    }
    if (lower !== 'q' && lower !== 't') {
      quad = null;
    }
    if (lower === 'z' && !COMMAND.test(tokens[i] ?? 'z')) {
      cmd = before === 'z' ? 'l' : 'L';
    }
  }
  return segments;
}

const polyPath = (points: number[], closed: boolean) => {
  const pairs = Array.from({ length: Math.floor(points.length / 2) }, (_, i) => `${points[2 * i]} ${points[2 * i + 1]}`);
  return pairs.length ? `M${pairs.join(' L')}${closed ? ' Z' : ''}` : '';
};

function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  const [kx, ky] = [rx * KAPPA, ry * KAPPA];
  return [
    `M${cx + rx} ${cy}`,
    `C${cx + rx} ${cy + ky} ${cx + kx} ${cy + ry} ${cx} ${cy + ry}`,
    `C${cx - kx} ${cy + ry} ${cx - rx} ${cy + ky} ${cx - rx} ${cy}`,
    `C${cx - rx} ${cy - ky} ${cx - kx} ${cy - ry} ${cx} ${cy - ry}`,
    `C${cx + kx} ${cy - ry} ${cx + rx} ${cy - ky} ${cx + rx} ${cy}Z`
  ].join(' ');
}

function roundedRect(x: number, y: number, w: number, h: number, rx: number, ry: number): string {
  return [
    `M${x + rx} ${y}`,
    `H${x + w - rx}`,
    `A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}`,
    `V${y + h - ry}`,
    `A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}`,
    `H${x + rx}`,
    `A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}`,
    `V${y + ry}`,
    `A${rx} ${ry} 0 0 1 ${x + rx} ${y}`,
    'Z'
  ].join(' ');
}

const SHAPE_PATH: Record<string, (a: Attrs) => string> = {
  path: (a) => a.d ?? '',
  rect: (a) => {
    const [x, y, w, h] = [num(a.x), num(a.y), num(a.width), num(a.height)];
    if (!(w > 0 && h > 0)) {
      return '';
    }
    const rx = Math.min(num(a.rx, num(a.ry)), w / 2);
    const ry = Math.min(num(a.ry, num(a.rx)), h / 2);
    return rx > 0 && ry > 0 ? roundedRect(x, y, w, h, rx, ry) : `M${x} ${y} H${x + w} V${y + h} H${x} Z`;
  },
  circle: (a) => (num(a.r) > 0 ? ellipsePath(num(a.cx), num(a.cy), num(a.r), num(a.r)) : ''),
  ellipse: (a) => (num(a.rx) > 0 && num(a.ry) > 0 ? ellipsePath(num(a.cx), num(a.cy), num(a.rx), num(a.ry)) : ''),
  line: (a) => `M${num(a.x1)} ${num(a.y1)} L${num(a.x2)} ${num(a.y2)}`,
  polyline: (a) => polyPath(numbers(a.points), false),
  polygon: (a) => polyPath(numbers(a.points), true)
};

const OPEN_SHAPES = new Set(['line', 'polyline']);

const round = (n: number) => Math.round(n * DIGITS) / DIGITS;

function placed(segments: Segment[], m: Matrix): string {
  return segments.map((s) => `${s.cmd}${s.pts.map((p) => apply(m, p).map(round).join(' ')).join(' ')}`).join('');
}

function rootOf(a: Attrs): { size: SvgRead['size']; matrix: Matrix } {
  const box = numbers(a.viewbox);
  const hasBox = box.length === 4 && box[2] > 0 && box[3] > 0;
  const side = (raw: string | undefined, fallback: number) => (raw && !raw.includes('%') && num(raw) > 0 ? num(raw) : fallback);
  const width = side(a.width, hasBox ? box[2] : DEFAULT_SIDE);
  const height = side(a.height, hasBox ? box[3] : DEFAULT_SIDE);
  const matrix: Matrix = hasBox ? [width / box[2], 0, 0, height / box[3], (-box[0] * width) / box[2], (-box[1] * height) / box[3]] : IDENTITY;
  return { size: { width, height }, matrix };
}

function paintOf(a: Attrs, inherited: Paint): Paint {
  const fill = colour(a.fill);
  const stroke = colour(a.stroke);
  const fillRule = FILL_RULES.get(a['fill-rule']?.trim().toLowerCase() ?? '') ?? inherited.fillRule;
  return { fill: fill === undefined ? inherited.fill : fill, stroke: stroke === undefined ? inherited.stroke : stroke, fillRule };
}

const fraction = (raw: string | undefined, fallback: number) => (raw === undefined ? fallback : raw.includes('%') ? num(raw) / 100 : num(raw, fallback));

function gradientsOf(svg: string): Map<string, GradientDef> {
  const found = new Map<string, GradientDef>();
  for (const g of svg.matchAll(GRADIENT)) {
    const attrs = attrsOf(g[2]);
    const stops = [...g[3].matchAll(STOP)].slice(0, MAX_STOPS).map((m) => {
      const stop = attrsOf(m[1]);
      return { color: colour(stop['stop-color']) ?? NAMED.black, pos: Math.max(0, Math.min(1, fraction(stop.offset, 0))) };
    });
    if (attrs.id && stops.length) {
      found.set(attrs.id, { kind: g[1].toLowerCase() === 'lineargradient' ? FillType.Linear : FillType.Radial, attrs, stops });
    }
  }
  return found;
}

const boundsOfSegments = (segments: Segment[]): Box => {
  const pts = segments.flatMap((s) => s.pts);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
};

const unit = (n: number, side: number) => (side > 0 ? n / side : 0);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

const HEX_CHANNELS = [1, 3, 5];

function mixed(from: Stop, to: Stop, at: number): string {
  if (from.color.length !== 7 || to.color.length !== 7) {
    return at < 0.5 ? from.color : to.color;
  }
  const channels = HEX_CHANNELS.map((i) => {
    const [a, b] = [parseInt(from.color.slice(i, i + 2), 16), parseInt(to.color.slice(i, i + 2), 16)];
    return Math.round(a + (b - a) * at).toString(16).padStart(2, '0');
  });
  return `#${channels.join('')}`;
}

function stopsAt(stops: Stop[], at: number): Stop {
  const last = stops[stops.length - 1];
  if (at <= stops[0].pos) {
    return { color: stops[0].color, pos: at };
  }
  const next = stops.findIndex((s) => s.pos >= at);
  if (next < 0) {
    return { color: last.color, pos: at };
  }
  const [a, b] = [stops[next - 1] ?? stops[next], stops[next]];
  return { color: mixed(a, b, b.pos === a.pos ? 0 : (at - a.pos) / (b.pos - a.pos)), pos: at };
}

function stopsWithin(stops: Stop[], from: number, to: number): Stop[] {
  const inside = stops.filter((s) => s.pos > from && s.pos < to).map((s) => ({ color: s.color, pos: (s.pos - from) / (to - from) }));
  return [{ color: stopsAt(stops, from).color, pos: 0 }, ...inside, { color: stopsAt(stops, to).color, pos: 1 }];
}

function coveredStops(stops: Stop[], [x1, y1, x2, y2]: number[], bounds: Box): Stop[] {
  const [vx, vy] = [x2 - x1, y2 - y1];
  const reach = vx * vx + vy * vy;
  if (!reach) {
    return stops;
  }
  const [w, h] = [bounds.right - bounds.left, bounds.bottom - bounds.top];
  const centre = ((bounds.left + w / 2 - x1) * vx + (bounds.top + h / 2 - y1) * vy) / reach;
  const half = (Math.abs(vx) * w + Math.abs(vy) * h) / (2 * reach);
  return half > 0 ? stopsWithin(stops, centre - half, centre + half) : stops;
}

function gradientOf(def: GradientDef, bounds: Box): SvgGradient {
  const [w, h] = [bounds.right - bounds.left, bounds.bottom - bounds.top];
  const absolute = def.attrs.gradientunits?.toLowerCase() === USER_SPACE;
  const stops = def.stops.length > 1 ? def.stops : [...def.stops, ...def.stops];
  if (def.kind === FillType.Linear) {
    const [x1, y1, x2, y2] = [fraction(def.attrs.x1, 0), fraction(def.attrs.y1, 0), fraction(def.attrs.x2, 1), fraction(def.attrs.y2, 0)];
    const [dx, dy] = absolute ? [x2 - x1, y2 - y1] : [(x2 - x1) * w, (y2 - y1) * h];
    const css = (Math.atan2(dx, -dy) * 180) / Math.PI;
    const covered = absolute ? coveredStops(stops, [x1, y1, x2, y2], bounds) : stops;
    return { type: FillType.Linear, stops: covered, angle: Math.round((css - CSS_ANGLE_OFFSET) * ANGLE_DIGITS) / ANGLE_DIGITS };
  }
  const [cx, cy, r] = [fraction(def.attrs.cx, 0.5), fraction(def.attrs.cy, 0.5), fraction(def.attrs.r, 0.5)];
  const center = absolute ? { x: unit(cx - bounds.left, w), y: unit(cy - bounds.top, h) } : { x: cx, y: cy };
  const radius = absolute ? unit(r, Math.max(w, h) / 2) : r * RADIAL_FULL;
  return { type: FillType.Radial, stops, center: { x: clamp(center.x, 0, 1), y: clamp(center.y, 0, 1) }, radius: clamp(radius, MIN_RADIUS, MAX_RADIUS) };
}

const refOf = (paint: string | null | undefined) => paint?.match(URL_REF)?.[1];

type Conic = { from: number; matrix: Matrix };
type FigmaPaint = { type?: string; stops?: { color: { r: number; g: number; b: number }; position: number }[] };

const turned = (degrees: number) => Math.round((((degrees % FULL_TURN) + FULL_TURN) % FULL_TURN) * ANGLE_DIGITS) / ANGLE_DIGITS;

function angularOf(stops: Stop[], conic: Conic | null, bounds: Box): SvgGradient {
  if (!conic) {
    return { type: FillType.Angular, stops, angle: 0, center: { x: MIDDLE, y: MIDDLE } };
  }
  const [cx, cy] = apply(conic.matrix, [0, 0]);
  const centre = { x: clamp(unit(cx - bounds.left, bounds.right - bounds.left), 0, 1), y: clamp(unit(cy - bounds.top, bounds.bottom - bounds.top), 0, 1) };
  const spin = (Math.atan2(conic.matrix[1], conic.matrix[0]) * 180) / Math.PI;
  return { type: FillType.Angular, stops, angle: turned(conic.from + spin), center: centre };
}

const FIGMA_GRADIENTS: Record<string, (stops: Stop[], conic: Conic | null, bounds: Box) => SvgGradient> = {
  GRADIENT_ANGULAR: angularOf,
  GRADIENT_DIAMOND: (stops) => ({ type: FillType.Diamond, stops })
};

function figmaGradient(raw: string, conic: Conic | null, bounds: Box): SvgGradient | null {
  let paint: FigmaPaint;
  try {
    paint = JSON.parse(decoded(raw));
  } catch {
    return null;
  }
  const make = FIGMA_GRADIENTS[paint.type ?? ''];
  const stops = (paint.stops ?? []).slice(0, MAX_STOPS).map((st) => ({ color: `#${hex2(st.color.r * CHANNEL)}${hex2(st.color.g * CHANNEL)}${hex2(st.color.b * CHANNEL)}`, pos: clamp(st.position, 0, 1) }));
  return make && stops.length > 1 ? make(stops, conic, bounds) : null;
}

const conicOf = (background: string | undefined, matrix: Matrix): Conic | null => {
  const from = background?.match(CONIC_FROM)?.[1];
  return from === undefined ? null : { from: Number(from), matrix };
};

function clipsOf(svg: string): Map<string, Box> {
  const found = new Map<string, Box>();
  for (const c of svg.matchAll(CLIP)) {
    const id = attrsOf(c[1]).id;
    const segments = svgShapes(`<svg>${c[2]}</svg>`).shapes.flatMap((sh) => pathSegments(sh.path));
    if (id && segments.some((s) => s.pts.length)) {
      found.set(id, boundsOfSegments(segments));
    }
  }
  return found;
}

function movedBox(box: Box, m: Matrix): Box {
  const corners: Pt[] = [[box.left, box.top], [box.right, box.top], [box.right, box.bottom], [box.left, box.bottom]];
  return boundsOfSegments([{ cmd: 'L', pts: corners.map((p) => apply(m, p)) }]);
}

const overlap = (a: Box, b: Box): Box => ({ left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) });

const isEmpty = (b: Box) => b.right <= b.left || b.bottom <= b.top;

const inside = (inner: Box, outer: Box) => inner.left >= outer.left && inner.top >= outer.top && inner.right <= outer.right && inner.bottom <= outer.bottom;

function isRect(segments: Segment[]): boolean {
  const pts = segments.flatMap((s) => s.pts);
  return segments.every((s) => s.cmd !== 'C') && new Set(pts.map((p) => p[0])).size <= 2 && new Set(pts.map((p) => p[1])).size <= 2;
}

function clippedTo(segments: Segment[], clip: Box): Segment[] | null {
  const bounds = boundsOfSegments(segments);
  if (isEmpty(overlap(bounds, clip))) {
    return null;
  }
  if (inside(bounds, clip) || !isRect(segments)) {
    return segments;
  }
  return segments.map((s) => ({ cmd: s.cmd, pts: s.pts.map(([x, y]): Pt => [clamp(x, clip.left, clip.right), clamp(y, clip.top, clip.bottom)]) }));
}

const signedArea = (poly: Polygon) => poly.reduce((sum, p, i) => sum + p[0] * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * p[1], 0);

function holds(poly: Polygon, [x, y]: Pt): boolean {
  let odd = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const crosses = poly[i][1] > y !== poly[j][1] > y && x < ((poly[j][0] - poly[i][0]) * (y - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0];
    odd = crosses ? !odd : odd;
  }
  return odd;
}

const FLATTEN_STEP = 3;
const MIN_SAMPLES = 4;

function flattenFine(contour: Contour): Polygon {
  const points: Polygon = [];
  for (const [a, b] of segmentsOf(contour)) {
    const reach = distance(a.p, a.out) + distance(a.out, b.in) + distance(b.in, b.p);
    const samples = reach === distance(a.p, b.p) ? 1 : Math.max(MIN_SAMPLES, Math.ceil(reach / FLATTEN_STEP));
    for (let i = 0; i < samples; i++) {
      points.push([...cubicAt(a.p, a.out, b.in, b.p, i / samples)] as Pt);
    }
  }
  return points;
}

function polygonsOf(path: string, rule: SvgFillRule): Polygon[] {
  const outline = parsePath(path);
  const polys = typeof outline === 'string' ? [] : outline.map(flattenFine).filter((poly) => poly.length > 2);
  if (rule === 'nonzero') {
    return polys;
  }
  return polys.map((poly, i) => {
    const depth = polys.filter((other, j) => j !== i && holds(other, poly[0])).length;
    const wantPositive = depth % 2 === 0;
    return signedArea(poly) > 0 === wantPositive ? poly : [...poly].reverse();
  });
}

const polygonPath = (polys: Polygon[]) => polys.map((poly) => `M${poly.map((p) => p.map(round).join(' ')).join('L')}Z`).join('');

function maskedPath(path: string, rule: SvgFillRule, mask: Polygon[]): { path: string; fillRule: SvgFillRule } | null {
  const cut = clipPolygons(polygonsOf(path, rule), mask, ClipOp.Intersection);
  return cut.length ? { path: polygonPath(cut), fillRule: 'nonzero' } : null;
}

function masksOf(svg: string): Map<string, Polygon[]> {
  const found = new Map<string, Polygon[]>();
  for (const m of svg.matchAll(MASK)) {
    const id = attrsOf(m[1]).id;
    const polygons = svgShapes(`<svg>${m[2]}</svg>`).shapes.flatMap((sh) => polygonsOf(sh.path, sh.fillRule));
    if (id && polygons.length) {
      found.set(id, polygons);
    }
  }
  return found;
}

function referablesOf(svg: string): Map<string, Referable> {
  const found = new Map<string, Referable>();
  for (const m of svg.matchAll(TAG)) {
    const tag = m[2].toLowerCase();
    const attrs = attrsOf(m[3]);
    if (!m[1] && attrs.id && SHAPE_PATH[tag]) {
      found.set(attrs.id, { tag, attrs });
    }
  }
  return found;
}

const hrefOf = (a: Attrs) => (a.href ?? a['xlink:href'])?.trim().replace(/^#/, '');

const decoded = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, name: string) => {
    if (name.startsWith('#')) {
      return String.fromCodePoint(name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });

function textOf(inner: string): string {
  return inner
    .replace(LINE_TSPAN, LINE_BREAK)
    .replace(/<[^>]*>/g, '')
    .split(LINE_BREAK)
    .map((line) => decoded(line).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

const WEIGHTS: Record<string, number> = { normal: REGULAR_WEIGHT, bold: BOLD_WEIGHT };

const weightOf = (raw: string | undefined) => WEIGHTS[raw?.trim().toLowerCase() ?? ''] ?? (num(raw, REGULAR_WEIGHT) || REGULAR_WEIGHT);

const ANCHORS: Record<string, SvgTextAnchor> = { start: 'start', middle: 'middle', end: 'end' };

type TextOrigin = { from: number; attrs: Attrs; matrix: Matrix; fill: string };

function textAt(svg: string, o: TextOrigin): SvgText | null {
  const a = o.attrs;
  const close = svg.toLowerCase().indexOf('</text', o.from);
  const text = close < 0 ? '' : textOf(svg.slice(o.from, close));
  if (!text || a.display === 'none' || a.visibility === 'hidden') {
    return null;
  }
  const [x, y] = apply(o.matrix, [num(a.x), num(a.y)]);
  const scale = Math.sqrt(Math.abs(o.matrix[0] * o.matrix[3] - o.matrix[1] * o.matrix[2]));
  return { text, x: round(x), y: round(y), size: round(num(a['font-size'], DEFAULT_TEXT_SIZE) * scale), fill: o.fill, weight: weightOf(a['font-weight']), anchor: ANCHORS[a['text-anchor']] ?? 'start' };
}

type Frame = { tag: string; matrix: Matrix; paint: Paint; clip: Box | null; mask: Polygon[] | null };

const ROOT_FRAME: Frame = { tag: '', matrix: IDENTITY, paint: { fill: NAMED.black, stroke: null, fillRule: 'nonzero' }, clip: null, mask: null };

export function svgShapes(svg: string): SvgRead {
  const shapes: SvgShape[] = [];
  const texts: SvgText[] = [];
  const empty: SvgRead = { size: { width: DEFAULT_SIDE, height: DEFAULT_SIDE }, shapes, texts };
  const gradients = gradientsOf(svg);
  const clips = clipsOf(svg);
  const masks = masksOf(svg);
  const referables = referablesOf(svg);
  const stack: Frame[] = [];
  let size = empty.size;
  let hidden = 0;
  let conic: Conic | null = null;

  const solid = (paint: string): string => {
    const ref = refOf(paint);
    return ref ? (gradients.get(ref)?.stops[0].color ?? NAMED.black) : paint;
  };

  for (const m of svg.matchAll(TAG)) {
    const [whole, closing, rawTag, rawAttrs, selfClosing] = m;
    const tag = rawTag.toLowerCase().replace(/^svg:/, '');
    if (closing) {
      const at = stack.map((s) => s.tag).lastIndexOf(tag);
      if (at >= 0) {
        stack.length = at;
      }
      hidden = Math.max(0, hidden - (HIDDEN_TAGS.has(tag) ? 1 : 0));
      continue;
    }
    const parent = stack[stack.length - 1] ?? ROOT_FRAME;
    const a = attrsOf(rawAttrs);
    if (tag === 'text' && !hidden && !selfClosing) {
      const paint = paintOf(a, parent.paint);
      const read = textAt(svg, { from: (m.index ?? 0) + whole.length, attrs: a, matrix: multiply(parent.matrix, transformOf(a.transform)), fill: solid(paint.fill ?? NAMED.black) });
      if (read) {
        texts.push(read);
      }
    }
    if (HIDDEN_TAGS.has(tag)) {
      hidden += selfClosing ? 0 : 1;
      continue;
    }
    if (hidden) {
      continue;
    }

    const root = tag === 'svg' && !stack.length ? rootOf(a) : null;
    if (root) {
      size = root.size;
    }
    const matrix = multiply(multiply(parent.matrix, root?.matrix ?? IDENTITY), transformOf(a.transform));
    conic = conicOf(a.background, matrix) ?? conic;
    const paint = paintOf(a, parent.paint);
    const clipBox = clips.get(refOf(a['clip-path']) ?? '');
    const own = clipBox ? movedBox(clipBox, matrix) : null;
    const clip = own && parent.clip ? overlap(own, parent.clip) : (own ?? parent.clip);

    const used = tag === 'use' ? referables.get(hrefOf(a) ?? '') : undefined;
    const drawTag = used?.tag ?? tag;
    const drawAttrs = used?.attrs ?? a;
    const drawMatrix = used ? multiply(multiply(matrix, [1, 0, 0, 1, num(a.x), num(a.y)]), transformOf(used.attrs.transform)) : matrix;
    const drawPaint = used ? paintOf(used.attrs, paint) : paint;

    const maskShape = masks.get(refOf(a.mask) ?? '');
    const ownMask = maskShape ? maskShape.map((poly) => poly.map((p) => apply(matrix, p))) : null;
    const mask = ownMask && parent.mask ? clipPolygons(ownMask, parent.mask, ClipOp.Intersection) : (ownMask ?? parent.mask);

    const make = SHAPE_PATH[drawTag];
    const local = make ? pathSegments(make(drawAttrs)) : [];
    const fill = OPEN_SHAPES.has(drawTag) ? null : drawPaint.fill;
    if (local.length > 1 && (fill || drawPaint.stroke) && drawAttrs.display !== 'none' && drawAttrs.visibility !== 'hidden') {
      const world = local.map((s) => ({ cmd: s.cmd, pts: s.pts.map((p) => apply(drawMatrix, p)) }));
      const kept = clip ? clippedTo(world, clip) : world;
      const ref = refOf(fill);
      const def = ref ? gradients.get(ref) : undefined;
      const figma = drawAttrs[FIGMA_GRADIENT] ? figmaGradient(drawAttrs[FIGMA_GRADIENT], conic, boundsOfSegments(world)) : null;
      const gradient = figma ?? (def ? gradientOf(def, boundsOfSegments(local)) : null);
      conic = null;
      const visible = kept && mask ? maskedPath(placed(kept, IDENTITY), drawPaint.fillRule, mask) : kept && { path: placed(kept, IDENTITY), fillRule: drawPaint.fillRule };
      if (visible) {
        shapes.push({
          path: visible.path,
          fill: figma ? figma.stops[0].color : fill === null ? null : solid(fill),
          stroke: drawPaint.stroke === null ? null : solid(drawPaint.stroke),
          fillRule: visible.fillRule,
          ...(gradient ? { gradient } : {})
        });
      }
    }
    if (!selfClosing && !SHAPE_PATH[tag]) {
      stack.push({ tag, matrix, paint, clip, mask });
    }
  }
  return stack.length || shapes.length || texts.length ? { size, shapes, texts } : empty;
}
