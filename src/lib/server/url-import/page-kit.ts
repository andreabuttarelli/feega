export type KitRgba = { r: number; g: number; b: number; a: number };
export type KitVec = { x: number; y: number };
export type KitGradient = { type: 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR'; gradientHandlePositions: KitVec[]; gradientStops: { position: number; color: KitRgba }[] };
export type KitRect = { left: number; top: number; right: number; bottom: number };
export type KitMatrix = [number, number, number, number, number, number];
export type KitOp = [string, ...number[]];

export function pageKit() {
  const DIGITS = 1e4;
  const PATH_DIGITS = 100;
  const QUARTER = Math.PI / 2;
  const FULL_TURN = 360;
  const LINE_OVERLAP = 0.5;

  const round = (n: number, digits = DIGITS) => Math.round(n * digits) / digits || 0;

  const splitTop = (value: string, separator: string): string[] => {
    const parts: string[] = [];
    let depth = 0;
    let quote = '';
    let start = 0;
    for (let i = 0; i < value.length; i++) {
      const c = value[i];
      if (quote) {
        quote = c === quote ? '' : quote;
        continue;
      }
      if (c === '"' || c === "'") {
        quote = c;
        continue;
      }
      if (c === '(') {
        depth++;
        continue;
      }
      if (c === ')') {
        depth--;
        continue;
      }
      const splits = separator === ' ' ? /\s/.test(c) : c === separator;
      if (depth === 0 && splits) {
        parts.push(value.slice(start, i));
        start = i + 1;
      }
    }
    parts.push(value.slice(start));
    return parts.map((p) => p.trim()).filter(Boolean);
  };

  const ANGLE_UNITS: Record<string, number> = { deg: 1, grad: 0.9, rad: 180 / Math.PI, turn: FULL_TURN };
  const angleOf = (token: string): number | null => {
    const m = token.match(/^(-?[\d.]+)(deg|grad|rad|turn)$/);
    return m ? Number(m[1]) * ANGLE_UNITS[m[2]] : null;
  };

  const SIDES: Record<string, [number, number]> = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };

  const directionOf = (arg: string, w: number, h: number): number | null => {
    const angle = angleOf(arg);
    if (angle !== null) {
      return angle;
    }
    if (!arg.startsWith('to ')) {
      return null;
    }
    const [sx, sy] = arg.slice(3).split(/\s+/).reduce(([x, y], word) => [x + (SIDES[word]?.[0] ?? 0), y + (SIDES[word]?.[1] ?? 0)], [0, 0]);
    const [dx, dy] = sx && sy ? [sx * h, sy * w] : [sx, sy];
    return (Math.atan2(dx, -dy) * 180) / Math.PI;
  };

  const LENGTH = /^(-?[\d.]+)(%|px|deg|turn|rad|grad)?$/;

  const POSITION_WORDS: Record<string, number> = { left: 0, top: 0, center: 0.5, right: 1, bottom: 1 };

  const lengthIn = (token: string, span: number): number | null => {
    if (token in POSITION_WORDS) {
      return POSITION_WORDS[token] * span;
    }
    const m = token.match(LENGTH);
    if (!m) {
      return null;
    }
    return m[2] === '%' ? (Number(m[1]) / 100) * span : Number(m[1]);
  };

  const positionOf = (tokens: string[], w: number, h: number): KitVec => {
    if (!tokens.length) {
      return { x: w / 2, y: h / 2 };
    }
    const vertical = (t: string) => t === 'top' || t === 'bottom';
    const horizontal = (t: string) => t === 'left' || t === 'right';
    const [a, b = 'center'] = tokens;
    const swapped = vertical(a) || horizontal(b);
    const [x, y] = swapped ? [b, a] : [a, b];
    return { x: lengthIn(x, w) ?? w / 2, y: lengthIn(y, h) ?? h / 2 };
  };

  type RawStop = { color: KitRgba; at: number | null };

  const stopsOf = (args: string[], span: number, colour: (raw: string) => KitRgba | null, turn: boolean): RawStop[] => {
    const raw: RawStop[] = [];
    for (const arg of args) {
      const tokens = splitTop(arg, ' ');
      const places = tokens.filter((t) => LENGTH.test(t));
      const paint = tokens.filter((t) => !LENGTH.test(t)).join(' ');
      const color = paint ? colour(paint) : null;
      if (!color) {
        continue;
      }
      const at = (t: string) => {
        const angle = angleOf(t);
        if (turn && angle !== null) {
          return angle / FULL_TURN;
        }
        const m = t.match(LENGTH)!;
        return m[2] === '%' ? Number(m[1]) / 100 : Number(m[1]) / (span || 1);
      };
      if (!places.length) {
        raw.push({ color, at: null });
        continue;
      }
      places.forEach((p) => raw.push({ color, at: at(p) }));
    }
    return raw;
  };

  const placed = (raw: RawStop[]) => {
    if (raw.length < 2) {
      return [];
    }
    const at = raw.map((s) => s.at);
    at[0] ??= 0;
    at[at.length - 1] ??= 1;
    for (let i = 1; i < at.length; i++) {
      if (at[i] !== null) {
        at[i] = Math.max(at[i]!, at[i - 1]!);
        continue;
      }
      const next = at.findIndex((v, j) => j > i && v !== null);
      const span = next - (i - 1);
      at[i] = at[i - 1]! + ((at[next]! - at[i - 1]!) * 1) / span;
    }
    return raw.map((s, i) => ({ position: round(Math.max(0, Math.min(1, at[i]!))), color: s.color }));
  };

  const unit = (p: KitVec, w: number, h: number): KitVec => ({ x: round(p.x / w), y: round(p.y / h) });

  const linear = (args: string[], w: number, h: number, colour: (raw: string) => KitRgba | null): KitGradient | null => {
    const turned = directionOf(args[0], w, h);
    const degrees = turned ?? 180;
    const stops = turned === null ? args : args.slice(1);
    const rad = (degrees * Math.PI) / 180;
    const [dx, dy] = [Math.sin(rad), -Math.cos(rad)];
    const length = Math.abs(w * dx) + Math.abs(h * dy);
    const start = { x: w / 2 - (dx * length) / 2, y: h / 2 - (dy * length) / 2 };
    const end = { x: w / 2 + (dx * length) / 2, y: h / 2 + (dy * length) / 2 };
    const side = { x: start.x - dy * (length / 2), y: start.y + dx * (length / 2) };
    const gradientStops = placed(stopsOf(stops, length, colour, false));
    return gradientStops.length ? { type: 'GRADIENT_LINEAR', gradientHandlePositions: [unit(start, w, h), unit(end, w, h), unit(side, w, h)], gradientStops } : null;
  };

  const SHAPE_WORDS = /^(circle|ellipse|closest-side|closest-corner|farthest-side|farthest-corner|at)$/;

  const radiiOf = (words: string[], c: KitVec, w: number, h: number): KitVec => {
    const circle = words.includes('circle') || (words.filter((t) => LENGTH.test(t)).length === 1 && !words.includes('ellipse'));
    const lengths = words.filter((t) => LENGTH.test(t));
    if (lengths.length) {
      const rx = lengthIn(lengths[0], w) ?? w / 2;
      return { x: rx, y: circle ? rx : (lengthIn(lengths[1] ?? lengths[0], h) ?? h / 2) };
    }
    const [near, far] = [{ x: Math.min(c.x, w - c.x), y: Math.min(c.y, h - c.y) }, { x: Math.max(c.x, w - c.x), y: Math.max(c.y, h - c.y) }];
    const sizing = words.find((t) => /side|corner/.test(t)) ?? 'farthest-corner';
    const side = sizing.startsWith('closest') ? near : far;
    if (circle) {
      const r = sizing.endsWith('corner') ? Math.hypot(side.x, side.y) : sizing.startsWith('closest') ? Math.min(side.x, side.y) : Math.max(side.x, side.y);
      return { x: r, y: r };
    }
    const k = sizing.endsWith('corner') ? Math.SQRT2 : 1;
    return { x: side.x * k, y: side.y * k };
  };

  const radial = (args: string[], w: number, h: number, colour: (raw: string) => KitRgba | null): KitGradient | null => {
    const head = splitTop(args[0], ' ');
    const shaped = head.some((t) => SHAPE_WORDS.test(t)) || (head.every((t) => LENGTH.test(t)) && !colour(args[0]));
    const words = shaped ? head : [];
    const atIndex = words.indexOf('at');
    const centre = positionOf(atIndex >= 0 ? words.slice(atIndex + 1) : [], w, h);
    const radii = radiiOf(atIndex >= 0 ? words.slice(0, atIndex) : words, centre, w, h);
    const gradientStops = placed(stopsOf(shaped ? args.slice(1) : args, radii.x, colour, false));
    const handles = [centre, { x: centre.x + radii.x, y: centre.y }, { x: centre.x, y: centre.y + radii.y }];
    return gradientStops.length ? { type: 'GRADIENT_RADIAL', gradientHandlePositions: handles.map((p) => unit(p, w, h)), gradientStops } : null;
  };

  const conic = (args: string[], w: number, h: number, colour: (raw: string) => KitRgba | null): KitGradient | null => {
    const head = splitTop(args[0], ' ');
    const shaped = head[0] === 'from' || head[0] === 'at';
    const words = shaped ? head : [];
    const from = words[0] === 'from' ? (angleOf(words[1]) ?? 0) : 0;
    const atIndex = words.indexOf('at');
    const centre = positionOf(atIndex >= 0 ? words.slice(atIndex + 1) : [], w, h);
    const rad = (from * Math.PI) / 180;
    const reach = Math.min(w, h) / 2;
    const start = { x: centre.x + Math.sin(rad) * reach, y: centre.y - Math.cos(rad) * reach };
    const side = { x: centre.x + Math.cos(rad) * reach, y: centre.y + Math.sin(rad) * reach };
    const gradientStops = placed(stopsOf(shaped ? args.slice(1) : args, 1, colour, true));
    return gradientStops.length ? { type: 'GRADIENT_ANGULAR', gradientHandlePositions: [centre, start, side].map((p) => unit(p, w, h)), gradientStops } : null;
  };

  const GRADIENTS: Record<string, typeof linear> = { linear, radial, conic };

  const gradientOf = (value: string, w: number, h: number, colour: (raw: string) => KitRgba | null): KitGradient | null => {
    const m = value.trim().match(/^(repeating-)?(linear|radial|conic)-gradient\(([\s\S]*)\)$/);
    if (!m || m[1] || w <= 0 || h <= 0) {
      return null;
    }
    return GRADIENTS[m[2]](splitTop(m[3], ','), w, h, colour);
  };

  const pathTokens = (d: string) => d.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];

  const angleBetween = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);

  const arcCurves = (x1: number, y1: number, rxIn: number, ryIn: number, degrees: number, large: number, sweep: number, x2: number, y2: number): number[][] => {
    let [rx, ry] = [Math.abs(rxIn), Math.abs(ryIn)];
    if (!rx || !ry || (x1 === x2 && y1 === y2)) {
      return [[x1, y1, x2, y2, x2, y2]];
    }
    const phi = (degrees * Math.PI) / 180;
    const [sin, cos] = [Math.sin(phi), Math.cos(phi)];
    const [dx, dy] = [(x1 - x2) / 2, (y1 - y2) / 2];
    const [xp, yp] = [cos * dx + sin * dy, -sin * dx + cos * dy];
    const lambda = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
    if (lambda > 1) {
      [rx, ry] = [rx * Math.sqrt(lambda), ry * Math.sqrt(lambda)];
    }
    const num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
    const den = rx * rx * yp * yp + ry * ry * xp * xp;
    const coef = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
    const [cxp, cyp] = [(coef * rx * yp) / ry, (-coef * ry * xp) / rx];
    const [cx, cy] = [cos * cxp - sin * cyp + (x1 + x2) / 2, sin * cxp + cos * cyp + (y1 + y2) / 2];
    const start = angleBetween(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
    let delta = angleBetween((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
    if (!sweep && delta > 0) {
      delta -= 2 * Math.PI;
    }
    if (sweep && delta < 0) {
      delta += 2 * Math.PI;
    }
    const count = Math.max(1, Math.ceil(Math.abs(delta) / QUARTER - 1e-9));
    const step = delta / count;
    const t = (4 / 3) * Math.tan(step / 4);
    const point = (a: number) => [cx + rx * Math.cos(a) * cos - ry * Math.sin(a) * sin, cy + rx * Math.cos(a) * sin + ry * Math.sin(a) * cos];
    const slope = (a: number) => [-rx * Math.sin(a) * cos - ry * Math.cos(a) * sin, -rx * Math.sin(a) * sin + ry * Math.cos(a) * cos];
    const curves: number[][] = [];
    for (let i = 0; i < count; i++) {
      const [a1, a2] = [start + i * step, start + (i + 1) * step];
      const [p1, p2, d1, d2] = [point(a1), point(a2), slope(a1), slope(a2)];
      curves.push([p1[0] + t * d1[0], p1[1] + t * d1[1], p2[0] - t * d2[0], p2[1] - t * d2[1], p2[0], p2[1]]);
    }
    curves[curves.length - 1][4] = x2;
    curves[curves.length - 1][5] = y2;
    return curves;
  };

  const ARITY: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

  const pathOps = (d: string): KitOp[] => {
    const tokens = pathTokens(d);
    const ops: KitOp[] = [];
    let at = 0;
    let command = '';
    let [x, y, sx, sy] = [0, 0, 0, 0];
    let control: number[] | null = null;
    let quad: number[] | null = null;
    const isLetter = (t: string | undefined) => t !== undefined && /^[a-zA-Z]$/.test(t);
    const num = () => Number(tokens[at++]);
    const flag = () => {
      const t = tokens[at];
      if (t.length > 1) {
        tokens[at] = t.slice(1);
        return Number(t[0]);
      }
      at++;
      return Number(t);
    };
    while (at < tokens.length) {
      if (isLetter(tokens[at])) {
        command = tokens[at++];
      } else if (!command) {
        break;
      }
      const upper = command.toUpperCase();
      const relative = command !== upper;
      if (upper === 'Z') {
        ops.push(['Z']);
        [x, y] = [sx, sy];
        control = quad = null;
        command = '';
        continue;
      }
      if (at + ARITY[upper] > tokens.length + (upper === 'A' ? 2 : 0) || ARITY[upper] === undefined) {
        break;
      }
      const [ox, oy] = relative ? [x, y] : [0, 0];
      if (upper === 'M') {
        [x, y] = [ox + num(), oy + num()];
        [sx, sy] = [x, y];
        ops.push(['M', x, y]);
        command = relative ? 'l' : 'L';
        control = quad = null;
        continue;
      }
      if (upper === 'L' || upper === 'H' || upper === 'V') {
        x = upper === 'V' ? x : (upper === 'H' && relative ? x : ox) + num();
        y = upper === 'H' ? y : (upper === 'V' && relative ? y : oy) + num();
        ops.push(['L', x, y]);
        control = quad = null;
        continue;
      }
      if (upper === 'C' || upper === 'S') {
        const first: number[] = upper === 'C' ? [ox + num(), oy + num()] : control ? [2 * x - control[0], 2 * y - control[1]] : [x, y];
        const second = [ox + num(), oy + num()];
        [x, y] = [ox + num(), oy + num()];
        ops.push(['C', first[0], first[1], second[0], second[1], x, y]);
        control = second;
        quad = null;
        continue;
      }
      if (upper === 'Q' || upper === 'T') {
        const middle: number[] = upper === 'Q' ? [ox + num(), oy + num()] : quad ? [2 * x - quad[0], 2 * y - quad[1]] : [x, y];
        [x, y] = [ox + num(), oy + num()];
        ops.push(['Q', middle[0], middle[1], x, y]);
        quad = middle;
        control = null;
        continue;
      }
      const [rx, ry, rotation] = [num(), num(), num()];
      const [large, sweep] = [flag(), flag()];
      const [ex, ey] = [ox + num(), oy + num()];
      for (const curve of arcCurves(x, y, rx, ry, rotation, large, sweep, ex, ey)) {
        ops.push(['C', ...curve]);
      }
      [x, y] = [ex, ey];
      control = quad = null;
    }
    return ops;
  };

  const pathText = (ops: KitOp[], m: KitMatrix): string =>
    ops
      .map(([command, ...values]) => {
        const points: string[] = [];
        for (let i = 0; i < values.length; i += 2) {
          points.push(`${round(m[0] * values[i] + m[2] * values[i + 1] + m[4], PATH_DIGITS)} ${round(m[1] * values[i] + m[3] * values[i + 1] + m[5], PATH_DIGITS)}`);
        }
        return points.length ? `${command} ${points.join(' ')}` : command;
      })
      .join(' ');

  const pointsOf = (raw: string) => (raw.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []).map(Number);

  const SHAPES: Record<string, (n: (name: string) => number, raw: (name: string) => string) => string | null> = {
    rect: (n) => {
      const [x, y, w, h] = [n('x'), n('y'), n('width'), n('height')];
      if (!(w > 0 && h > 0)) {
        return null;
      }
      const rx = Math.min(w / 2, n('rx') || n('ry') || 0);
      const ry = Math.min(h / 2, n('ry') || n('rx') || 0);
      if (!rx || !ry) {
        return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
      }
      const arc = (ex: number, ey: number) => `A ${rx} ${ry} 0 0 1 ${ex} ${ey}`;
      return `M ${x + rx} ${y} L ${x + w - rx} ${y} ${arc(x + w, y + ry)} L ${x + w} ${y + h - ry} ${arc(x + w - rx, y + h)} L ${x + rx} ${y + h} ${arc(x, y + h - ry)} L ${x} ${y + ry} ${arc(x + rx, y)} Z`;
    },
    circle: (n) => {
      const [cx, cy, r] = [n('cx'), n('cy'), n('r')];
      return r > 0 ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z` : null;
    },
    ellipse: (n) => {
      const [cx, cy, rx, ry] = [n('cx'), n('cy'), n('rx'), n('ry')];
      return rx > 0 && ry > 0 ? `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z` : null;
    },
    line: (n) => `M ${n('x1')} ${n('y1')} L ${n('x2')} ${n('y2')}`,
    polyline: (_, raw) => {
      const p = pointsOf(raw('points'));
      return p.length >= 4 ? `M ${p[0]} ${p[1]}${p.slice(2).reduce((s, v, i) => s + (i % 2 ? ` ${v}` : ` L ${v}`), '')}` : null;
    },
    polygon: (n, raw) => {
      const open = SHAPES.polyline(n, raw);
      return open ? `${open} Z` : null;
    }
  };

  const shapeD = (tag: string, attr: (name: string) => number | string): string | null => {
    const make = SHAPES[tag];
    return make ? make((name) => Number(attr(name)) || 0, (name) => String(attr(name) ?? '')) : null;
  };

  const linesOf = (rects: KitRect[]): KitRect[] => {
    const lines: KitRect[] = [];
    for (const r of [...rects].sort((a, b) => a.top - b.top || a.left - b.left)) {
      const line = lines.find((l) => Math.min(l.bottom, r.bottom) - Math.max(l.top, r.top) >= LINE_OVERLAP * Math.min(l.bottom - l.top, r.bottom - r.top));
      if (!line) {
        lines.push({ ...r });
        continue;
      }
      line.left = Math.min(line.left, r.left);
      line.right = Math.max(line.right, r.right);
      line.top = Math.min(line.top, r.top);
      line.bottom = Math.max(line.bottom, r.bottom);
    }
    return lines;
  };

  return { splitTop, gradientOf, pathOps, pathText, shapeD, linesOf, angleOf };
}

export type PageKit = ReturnType<typeof pageKit>;
