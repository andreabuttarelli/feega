import type { Item } from '$lib/motion/gpu-full/display-list';
import { BORDER, CardPart, UI_TRACKING, at, box, measure, write, type Ctx } from './card-kit';
import { rect, solid } from './shapes';

const PADDING = 16;
const BADGE = { size: 40, icon: 20 };
const TITLE = { size: 13, line: 18.2, above: 10 };
const HINT = { size: 12, line: 16.8, above: 6, chars: 28 };
const DASH = { on: 3, off: 3 };
const PICK = { icon: 20, gap: 10, size: 12, line: 16.8, underline: 1 };

const moved = (contours: number[][], dx: number, dy: number) => contours.map((k) => k.map((v, i) => (i % 2 === 0 ? v + dx : v + dy)));

function dashed(x: Ctx): Item[] {
  const { c, theme } = x;
  const edge = (from: number, to: number, place: (at: number) => number[]) => {
    const out: number[][] = [];
    for (let at0 = from; at0 < to; at0 += DASH.on + DASH.off) {
      out.push(place(at0));
    }
    return out;
  };
  const run = (at0: number, limit: number) => Math.min(DASH.on, limit - at0);
  const contours = [
    ...edge(0, c.w, (a) => rect(a, 0, run(a, c.w), BORDER)),
    ...edge(0, c.w, (a) => rect(a, c.h - BORDER, run(a, c.w), BORDER)),
    ...edge(BORDER, c.h - BORDER, (a) => rect(0, a, BORDER, run(a, c.h - BORDER))),
    ...edge(BORDER, c.h - BORDER, (a) => rect(c.w - BORDER, a, BORDER, run(a, c.h - BORDER)))
  ];
  return [solid(x.clip(CardPart.Panel), at(c, contours), theme.line2)];
}

function lines(x: Ctx, s: string, width: number): string[] {
  const rows: string[] = [];
  for (const word of s.split(' ')) {
    const last = rows.length - 1;
    const joined = last >= 0 ? `${rows[last]} ${word}` : word;
    if (last >= 0 && measure(x, joined, HINT.size) <= width) {
      rows[last] = joined;
      continue;
    }
    rows.push(word);
  }
  return rows;
}

const centred = (x: Ctx, part: CardPart, s: string, size: number, colour: string, top: number): Item[] => write(x, part, s, size, colour, (x.c.w - measure(x, s, size, part === CardPart.Title ? 'bold' : 'regular')) / 2, top, null);

export function emptyItems(x: Ctx): Item[] {
  const { c, theme, icons } = x;
  const f = c.face;
  const wide = (measure(x, '0', HINT.size) - UI_TRACKING) * HINT.chars;
  const rows = lines(x, f.subtitle, Math.min(c.w - PADDING * 2, wide));
  const total = BADGE.size + TITLE.above + TITLE.line + HINT.above + rows.length * HINT.line;
  const top = (c.h - total) / 2;
  const left = (c.w - BADGE.size) / 2;
  const mark = f.kind ? icons?.badge.get(f.kind) : undefined;
  const titleTop = top + BADGE.size + TITLE.above;
  const hintTop = titleTop + TITLE.line + HINT.above;
  return [
    solid(x.clip(CardPart.Panel), at(c, [rect(0, 0, c.w, c.h)]), theme.paper),
    ...dashed(x),
    solid(x.clip(CardPart.Badge), at(c, [rect(left, top, BADGE.size, BADGE.size)]), theme.line),
    solid(x.clip(CardPart.Badge), at(c, [rect(left + BORDER, top + BORDER, BADGE.size - 2 * BORDER, BADGE.size - 2 * BORDER)]), theme.paper2),
    ...(mark ? [solid(x.clip(CardPart.Badge), at(c, moved(mark, left + (BADGE.size - BADGE.icon) / 2, top + (BADGE.size - BADGE.icon) / 2)), theme.inkSoft)] : []),
    ...centred(x, CardPart.Title, f.title, TITLE.size, theme.ink, titleTop),
    ...rows.flatMap((row, i) => centred(x, CardPart.Empty, row, HINT.size, theme.inkSoft, hintTop + i * HINT.line))
  ];
}

const NO_BATCHES = 'No batches in this project yet.';
const SELECT_LABEL = 'Show a Photo studio batch';
const SELECT_HINT = 'Pick a batch…';
const SELECT = { h: 30, size: 12, padX: 8, gap: 4 };

function pickBody(x: Ctx): { height: number; items: (top: number) => Item[] } {
  const { c, theme } = x;
  const options = c.face.batch?.options ?? null;
  if (options === true) {
    const width = c.w - PADDING * 2;
    const height = PICK.line + SELECT.gap + SELECT.h;
    return {
      height,
      items: (top) => [
        ...write(x, CardPart.Empty, SELECT_LABEL, PICK.size, theme.inkSoft, PADDING, top, null),
        ...box(x, CardPart.Field, { x: PADDING, y: top + PICK.line + SELECT.gap, w: width, h: SELECT.h }, theme.paper, theme.line2),
        ...write(x, CardPart.Field, SELECT_HINT, SELECT.size, theme.ink, PADDING + SELECT.padX, top + PICK.line + SELECT.gap + (SELECT.h - SELECT.size) / 2 - 1, null)
      ]
    };
  }
  if (options === false) {
    return { height: PICK.line, items: (top) => centred(x, CardPart.Empty, NO_BATCHES, PICK.size, theme.inkSoft, top) };
  }
  return { height: 0, items: () => [] };
}

export function pickItems(x: Ctx): Item[] {
  const { c, theme, icons } = x;
  const f = c.face;
  const mark = f.kind ? icons?.badge.get(f.kind) : undefined;
  const middle = pickBody(x);
  const stack = [PICK.icon, middle.height, PICK.line].filter(Boolean);
  const total = stack.reduce((a, b) => a + b, 0) + PICK.gap * (stack.length - 1);
  const top = (c.h - total) / 2;
  const bodyTop = top + PICK.icon + PICK.gap;
  const base = bodyTop + (middle.height ? middle.height + PICK.gap : 0);
  const left = (c.w - measure(x, f.title, PICK.size)) / 2;
  return [
    solid(x.clip(CardPart.Panel), at(c, [rect(0, 0, c.w, c.h)]), theme.paper),
    ...(mark ? [solid(x.clip(CardPart.Badge), at(c, moved(mark, (c.w - PICK.icon) / 2, top)), theme.inkSoft)] : []),
    ...middle.items(bodyTop),
    ...centred(x, CardPart.Empty, f.title, PICK.size, theme.inkSoft, base),
    solid(x.clip(CardPart.Empty), at(c, [rect(left, base + PICK.line - 1, measure(x, f.title, PICK.size), PICK.underline)]), theme.inkSoft)
  ];
}
