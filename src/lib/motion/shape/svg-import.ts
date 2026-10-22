type Matrix = [a: number, b: number, c: number, d: number, e: number, f: number];
type Pt = [number, number];
type Segment = { cmd: 'M' | 'L' | 'C' | 'Z'; pts: Pt[] };
type Attrs = Record<string, string>;
type Paint = { fill: string | null; stroke: string | null };

export type SvgShape = { path: string; fill: string | null; stroke: string | null };
export type SvgRead = { size: { width: number; height: number }; shapes: SvgShape[] };

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

const SHAPE_PATH: Record<string, (a: Attrs) => string> = {
  path: (a) => a.d ?? '',
  rect: (a) => {
    const [x, y, w, h] = [num(a.x), num(a.y), num(a.width), num(a.height)];
    return w > 0 && h > 0 ? `M${x} ${y} H${x + w} V${y + h} H${x} Z` : '';
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
  return { fill: fill === undefined ? inherited.fill : fill, stroke: stroke === undefined ? inherited.stroke : stroke };
}

export function svgShapes(svg: string): SvgRead {
  const shapes: SvgShape[] = [];
  const empty: SvgRead = { size: { width: DEFAULT_SIDE, height: DEFAULT_SIDE }, shapes };
  const stack: { tag: string; matrix: Matrix; paint: Paint }[] = [];
  let size = empty.size;
  let hidden = 0;

  for (const m of svg.matchAll(TAG)) {
    const [, closing, rawTag, rawAttrs, selfClosing] = m;
    const tag = rawTag.toLowerCase().replace(/^svg:/, '');
    if (closing) {
      const at = stack.map((s) => s.tag).lastIndexOf(tag);
      if (at >= 0) {
        stack.length = at;
      }
      hidden = Math.max(0, hidden - (HIDDEN_TAGS.has(tag) ? 1 : 0));
      continue;
    }
    if (HIDDEN_TAGS.has(tag)) {
      hidden += selfClosing ? 0 : 1;
      continue;
    }
    if (hidden) {
      continue;
    }

    const a = attrsOf(rawAttrs);
    const parent = stack[stack.length - 1] ?? { matrix: IDENTITY, paint: { fill: NAMED.black, stroke: null } };
    const root = tag === 'svg' && !stack.length ? rootOf(a) : null;
    if (root) {
      size = root.size;
    }
    const matrix = multiply(multiply(parent.matrix, root?.matrix ?? IDENTITY), transformOf(a.transform));
    const paint = paintOf(a, parent.paint);

    const make = SHAPE_PATH[tag];
    const segments = make ? pathSegments(make(a)) : [];
    const fill = OPEN_SHAPES.has(tag) ? null : paint.fill;
    if (segments.length > 1 && (fill || paint.stroke) && a.display !== 'none' && a.visibility !== 'hidden') {
      shapes.push({ path: placed(segments, matrix), fill, stroke: paint.stroke });
    }
    if (!selfClosing && !make) {
      stack.push({ tag, matrix, paint });
    }
  }
  return stack.length || shapes.length ? { size, shapes } : empty;
}
