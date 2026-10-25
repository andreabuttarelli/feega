import { RULE, type Decoration, type DecorationStyle } from '../../decoration';

export type Rule = { line: Decoration; style: DecorationStyle; thickness: number; offset: number; skipInk: boolean };

export const NO_RULE: Rule = { line: 'none', style: 'solid', thickness: RULE.thickness.fallback, offset: RULE.offset.fallback, skipInk: true };

type Span = [number, number];
type Placed = { pen: number; advance: number; size: number };

const DASH_PERIOD = 6;
const DASH_ON = 3;
const DOT_PERIOD = 2;
const DOT_ON = 1;
const WAVE_LENGTH = 4;
const WAVE_SAMPLES = 8;
const DOUBLE_GAP = 2;

const bar = ([l, r]: Span, top: number, height: number) => [l, top, r, top, r, top + height, l, top + height];

function dashes([l, r]: Span, period: number, on: number): Span[] {
  const spans: Span[] = [];
  for (let at = Math.floor(l / period) * period; at < r; at += period) {
    const from = Math.max(l, at);
    const to = Math.min(r, at + on);
    if (to > from) {
      spans.push([from, to]);
    }
  }
  return spans;
}

function wave([l, r]: Span, top: number, t: number): number[] {
  const length = WAVE_LENGTH * t;
  const step = length / WAVE_SAMPLES;
  const xs: number[] = [];
  for (let x = l; x < r; x += step) {
    xs.push(x);
  }
  xs.push(r);
  const y = (x: number) => top + t * Math.sin((2 * Math.PI * x) / length);
  return [...xs.flatMap((x) => [x, y(x)]), ...xs.reverse().flatMap((x) => [x, y(x) + t])];
}

const STYLE: Record<DecorationStyle, (span: Span, top: number, t: number) => number[][]> = {
  solid: (span, top, t) => [bar(span, top, t)],
  double: (span, top, t) => [bar(span, top, t), bar(span, top + DOUBLE_GAP * t, t)],
  dashed: (span, top, t) => dashes(span, DASH_PERIOD * t, DASH_ON * t).map((s) => bar(s, top, t)),
  dotted: (span, top, t) => dashes(span, DOT_PERIOD * t, DOT_ON * t).map((s) => bar(s, top, t)),
  wavy: (span, top, t) => [wave(span, top, t)]
};

function crossing(contours: number[][], top: number, bottom: number): Span | null {
  const xs: number[] = [];
  for (const c of contours) {
    for (let i = 0; i < c.length; i += 2) {
      const j = (i + 2) % c.length;
      const [ax, ay, bx, by] = [c[i], c[i + 1], c[j], c[j + 1]];
      if (Math.max(ay, by) < top || Math.min(ay, by) > bottom) {
        continue;
      }
      const at = (y: number) => (ay === by ? ax : ax + ((bx - ax) * (Math.min(Math.max(y, Math.min(ay, by)), Math.max(ay, by)) - ay)) / (by - ay));
      xs.push(at(top), at(bottom));
    }
  }
  return xs.length ? [Math.min(...xs), Math.max(...xs)] : null;
}

function skipped(span: Span, gap: Span | null): Span[] {
  if (!gap || gap[1] <= span[0] || gap[0] >= span[1]) {
    return [span];
  }
  return [[span[0], gap[0]], [gap[1], span[1]]].filter(([l, r]) => r > l) as Span[];
}

const TOP: Record<Exclude<Decoration, 'none'>, (rule: Rule) => number> = {
  underline: (rule) => rule.offset,
  strikethrough: (rule) => RULE.strike - rule.thickness / 2
};

export function ruled(rule: Rule, g: Placed, x: number, baseline: number, glyph: number[][]): number[][] {
  if (rule.line === 'none') {
    return [];
  }
  const t = rule.thickness * g.size;
  const top = baseline + TOP[rule.line](rule) * g.size;
  const span: Span = [x + g.pen, x + g.pen + g.advance];
  const gap = rule.skipInk && rule.line === 'underline' ? crossing(glyph, top - t, top + 2 * t) : null;
  const padded: Span | null = gap ? [gap[0] - t, gap[1] + t] : null;
  return skipped(span, padded).flatMap((s) => STYLE[rule.style](s, top, t));
}
