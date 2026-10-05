import { esc } from '../hyperframes/html';
import { AnimatorUnit, SelectorShape } from './model';

export type SplitOptions = { unit: AnimatorUnit; seed: number | null; coarser?: AnimatorUnit[] };

export const POSITION_VAR: Record<AnimatorUnit, string> = { [AnimatorUnit.Char]: '--pc', [AnimatorUnit.Word]: '--pw', [AnimatorUnit.Line]: '--pl' };
export const OWN_POSITION = '--p';

const PRECISION = 10000;
const round = (n: number) => Math.round(n * PRECISION) / PRECISION;

function hash(seed: number, n: number): number {
  let h = Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(n | 0, 0x85ebca77);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

function ranks(count: number, seed: number | null): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  if (seed === null) {
    return order;
  }
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(hash(seed, i) * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const rank = new Array<number>(count);
  order.forEach((unit, position) => (rank[unit] = position));
  return rank;
}

type Unit = { line: number; word: number; text: string };

const WORD = /\S+/g;

function unitsOf(lines: string[], unit: AnimatorUnit): Unit[] {
  const units: Unit[] = [];
  lines.forEach((line, l) => {
    if (unit === AnimatorUnit.Line) {
      units.push({ line: l, word: 0, text: line });
      return;
    }
    [...line.matchAll(WORD)].forEach((m, w) => {
      const parts = unit === AnimatorUnit.Word ? [m[0]] : [...m[0]];
      parts.forEach((text) => units.push({ line: l, word: w, text }));
    });
  });
  return units;
}

const span = (classes: string, p: string, text: string) => `<span class="${classes}" style="${p}">${esc(text)}</span>`;

const RENDER: Record<AnimatorUnit, (line: string, own: Unit[], p: (u: Unit) => string) => string> = {
  [AnimatorUnit.Line]: (_line, own, p) => own.map((u) => span('tu tl', p(u), u.text)).join(''),
  [AnimatorUnit.Word]: (line, own, p) => {
    let w = 0;
    return line.replace(WORD, () => span('tu', p(own[w]), own[w++].text));
  },
  [AnimatorUnit.Char]: (line, own, p) => {
    let c = 0;
    return line.replace(WORD, (word) => {
      const chars = [...word].map(() => {
        const u = own[c++];
        return span('tu', p(u), u.text);
      });
      return `<span class="tw">${chars.join('')}</span>`;
    });
  }
};

const LEVEL_KEY: Record<AnimatorUnit, (u: Unit) => string> = {
  [AnimatorUnit.Char]: (u) => `${u.line}:${u.word}:${u.text}`,
  [AnimatorUnit.Word]: (u) => `${u.line}:${u.word}`,
  [AnimatorUnit.Line]: (u) => `${u.line}`
};

function positions(lines: string[], unit: AnimatorUnit, seed: number | null): Map<string, number> {
  const units = unitsOf(lines, unit);
  const rank = ranks(units.length, seed);
  return new Map(units.map((u, i) => [LEVEL_KEY[unit](u), (rank[i] + 0.5) / units.length]));
}

export function splitLines(text: string, options: SplitOptions): string[] {
  const lines = text.split('\n');
  const units = unitsOf(lines, options.unit);
  const rank = ranks(units.length, options.seed);
  const position = new Map(units.map((u, i) => [u, (rank[i] + 0.5) / units.length]));
  const coarser = (options.coarser ?? []).map((level) => ({ level, at: positions(lines, level, null) }));
  const style = (u: Unit) => [`${OWN_POSITION}:${round(position.get(u)!)}`, ...coarser.map(({ level, at }) => `${POSITION_VAR[level]}:${round(at.get(LEVEL_KEY[level](u))!)}`)].join(';');
  return lines.map((line, l) => {
    const own = units.filter((u) => u.line === l);
    return own.length ? RENDER[options.unit](line, own, style) : esc(line);
  });
}

export function charPositions(text: string, seed: number | null): number[] {
  const units = unitsOf(text.split('\n'), AnimatorUnit.Char);
  const rank = ranks(units.length, seed);
  return units.map((_, i) => round((rank[i] + 0.5) / units.length));
}

export function splitText(text: string, options: SplitOptions): string {
  return splitLines(text, options).join('\n');
}

export type Selector = { shape: SelectorShape; start: number; end: number; offset: number; softness: number };

export const HARD_EDGE = 0.0001;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const smooth = (n: number) => n * n * (3 - 2 * n);

export function selection(s: Selector, p: number): number {
  const soft = s.shape === SelectorShape.Square ? HARD_EDGE : Math.max(s.softness, HARD_EDGE);
  const from = (s.start + s.offset) / 100;
  const to = (s.end + s.offset) / 100;
  const enter = clamp01((p - from) / soft);
  const leave = clamp01((to - p) / soft);
  return s.shape === SelectorShape.Smooth ? smooth(enter) * smooth(leave) : enter * leave;
}
