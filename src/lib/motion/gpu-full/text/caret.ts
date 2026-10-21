import { Spaces, type Flow, type Laid } from './layout';

export type Stop = { offset: number; x: number };

export type CaretLine = { start: number; end: number; shown: number; top: number; height: number; ink: number; inkHeight: number; stops: Stop[] };

export type CaretPlace = { x: number; top: number; height: number };

export type Box = { left: number; right: number; top: number; height: number };

export enum Step {
  Back = -1,
  Forward = 1
}

export type Shape = { room: number; align: number; top: number; space: number };

export function caretLines(laid: Laid, paragraphs: string[], shape: Shape): CaretLine[] {
  let first = 0;
  return laid.blocks.flatMap((block, p) => {
    const length = [...(paragraphs[p] ?? '')].length;
    const base = first;
    first += length + 1;
    const starts = block.lines.map((line, j) => (j === 0 ? 0 : (line.glyphs[0]?.char ?? length)));
    return block.lines.map((line, j) => {
      const start = starts[j];
      const end = j + 1 < starts.length ? starts[j + 1] : length;
      const origin = (shape.room - line.width) * shape.align;
      const stops: Stop[] = [];
      line.glyphs.forEach((g, i) => {
        const next = line.glyphs[i + 1];
        const to = next ? next.char : Math.min(end, g.char + 1);
        const span = Math.max(to - g.char, 1);
        for (let k = 0; k < span && g.char + k < end; k++) {
          stops.push({ offset: base + g.char + k, x: origin + g.pen + (g.advance * k) / span });
        }
      });
      const last = line.glyphs.at(-1);
      const right = last ? origin + last.pen + last.advance : origin;
      const reached = stops.at(-1)?.offset ?? base + start - 1;
      const shown = Math.max(reached + 1, base + start);
      const chars = [...(paragraphs[p] ?? '')];
      const closing = j === block.lines.length - 1;
      let x = right;
      for (let o = shown; o <= base + end; o++) {
        stops.push({ offset: o, x });
        x += closing && chars[o - base] === ' ' ? shape.space : 0;
      }
      const top = shape.top + block.top + j * laid.lineHeight;
      return { start: base + start, end: base + end, shown, top, height: laid.lineHeight, ink: shape.top + block.top + line.baseline - laid.ascent, inkHeight: laid.ascent + laid.descent, stops };
    });
  });
}

const lineOf = (lines: CaretLine[], offset: number): CaretLine => {
  const inside = lines.find((l) => l.start <= offset && offset < l.end);
  if (inside) {
    return inside;
  }
  const closing = lines.filter((l) => l.start <= offset && offset <= l.end);
  return closing.at(-1) ?? (offset < (lines[0]?.start ?? 0) ? lines[0] : lines.at(-1)!);
};

const xAt = (line: CaretLine, offset: number): number => {
  const hit = line.stops.find((s) => s.offset === offset);
  if (hit) {
    return hit.x;
  }
  return offset < line.start ? line.stops[0].x : line.stops.at(-1)!.x;
};

export function caretRect(lines: CaretLine[], offset: number): CaretPlace {
  const line = lineOf(lines, offset);
  return { x: xAt(line, offset), top: line.ink, height: line.inkHeight };
}

export function hitTest(lines: CaretLine[], x: number, y: number): number {
  const line = lines.find((l) => y < l.top + l.height) ?? lines.at(-1)!;
  return line.stops.reduce((best, s) => (Math.abs(s.x - x) < Math.abs(best.x - x) ? s : best), line.stops[0]).offset;
}

export function charUnder(lines: CaretLine[], x: number, y: number): number {
  const line = lines.find((l) => y < l.top + l.height) ?? lines.at(-1)!;
  const under = line.stops.filter((s) => s.x <= x && s.offset < line.shown);
  return under.at(-1)?.offset ?? line.start;
}

export function selectionBoxes(lines: CaretLine[], from: number, to: number): Box[] {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  return lines.flatMap((l) => {
    const left = xAt(l, Math.max(lo, l.start));
    const right = xAt(l, Math.min(hi, l.end));
    return lo < l.end && hi > l.start && right > left ? [{ left, right, top: l.ink, height: l.inkHeight }] : [];
  });
}

export function nextLine(lines: CaretLine[], offset: number, step: Step, goal: number): number {
  const line = lineOf(lines, offset);
  const at = lines.indexOf(line) + step;
  if (at < 0) {
    return line.start;
  }
  if (at >= lines.length) {
    return line.end;
  }
  return hitTest(lines, goal, lines[at].top + lines[at].height / 2);
}

export function lineEdge(lines: CaretLine[], offset: number, step: Step): number {
  const line = lineOf(lines, offset);
  return step === Step.Back ? line.start : line.shown;
}

const WORD = /[\p{L}\p{N}_]+|[^\p{L}\p{N}_\s]+|\s+/gu;

export function wordRange(text: string, offset: number): [number, number] {
  const chars = [...text];
  const at = Math.min(offset, chars.length);
  let from = 0;
  for (const m of text.matchAll(WORD)) {
    const size = [...m[0]].length;
    if (at < from + size || (at === chars.length && from + size === chars.length)) {
      return [from, from + size];
    }
    from += size;
  }
  return [at, at];
}

export function lineRange(lines: CaretLine[], offset: number): [number, number] {
  const line = lineOf(lines, offset);
  return [line.start, line.shown];
}

export const unitsOf = (text: string, codePoints: number): number => [...text].slice(0, codePoints).join('').length;

export const codePointsOf = (text: string, units: number): number => [...text.slice(0, units)].length;

const COLLAPSIBLE = /^\s|\s$|[ \t]{2}|[\t]/;

export function laidAsTyped(raw: string, text: string, paragraphs: string[], flow: Flow): boolean {
  const collapsing = flow.spaces === Spaces.Collapse && paragraphs.some((p) => COLLAPSIBLE.test(p) || p.includes('\n'));
  return raw === text && paragraphs.join('\n') === text && !collapsing;
}

export enum Grain {
  Char = 'char',
  Word = 'word',
  Line = 'line'
}

export type Pick = { anchor: number; focus: number };

const GRAIN: Record<Grain, (text: string, lines: CaretLine[], offset: number) => [number, number]> = {
  [Grain.Char]: (_text, _lines, offset) => [offset, offset],
  [Grain.Word]: (text, _lines, offset) => wordRange(text, offset),
  [Grain.Line]: (_text, lines, offset) => lineRange(lines, offset)
};

export const CLICK_GRAINS: readonly Grain[] = [Grain.Char, Grain.Word, Grain.Line];

export function pressed(grain: Grain, text: string, lines: CaretLine[], offset: number): Pick {
  const [anchor, focus] = GRAIN[grain](text, lines, offset);
  return { anchor, focus };
}

export function dragged(grain: Grain, text: string, lines: CaretLine[], base: Pick, offset: number): Pick {
  const [from, to] = GRAIN[grain](text, lines, offset);
  const start = Math.min(base.anchor, base.focus);
  const stop = Math.max(base.anchor, base.focus);
  return offset < start ? { anchor: stop, focus: from } : { anchor: start, focus: Math.max(to, stop) };
}
