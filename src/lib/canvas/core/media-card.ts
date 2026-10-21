import type { Item } from '$lib/motion/gpu-full/display-list';
import { BatchState } from '$lib/canvas/node-view';
import { BORDER, CardPart, Fit, LEADING, UiGlyph, at, box, glyph, image, measure, panel, write, type Ctx } from './card-kit';
import { pickItems } from './empty-card';
import { rect, solid } from './shapes';

const BADGE = { inset: 8, padX: 6, padY: 2, size: 10.5, fill: '#000000', alpha: 0.6 };
const ACTION = { inset: 8, padX: 8, padY: 3, size: 11, gap: 4 };
const PROMPT = { size: 11.5, gap: 6, icon: 22 };
const GRID = { columns: 3, gap: 1 };
const FOOT = { h: 44, padX: 10, size: 12, gap: 8 };
const OPEN = { padX: 12, padY: 6, label: 'Open batch' };
const CHANGE = 'Change';
const UNREACHABLE = 'This batch is not reachable.';
const PICK_ANOTHER = 'Pick another';

const lift = (size: number) => (size * LEADING - size) / 2 - 1;

function actions(x: Ctx): Item[] {
  const { c, theme } = x;
  let right = c.w - ACTION.inset;
  return [...c.face.actions].reverse().flatMap((label) => {
    const w = measure(x, label, ACTION.size) + ACTION.padX * 2 + BORDER * 2;
    const b = { x: right - w, y: ACTION.inset, w, h: ACTION.padY * 2 + ACTION.size * LEADING + BORDER * 2 };
    right = b.x - ACTION.gap;
    return [...box(x, CardPart.Button, b, theme.paper, theme.line), ...write(x, CardPart.Button, label, ACTION.size, theme.ink, b.x + BORDER + ACTION.padX, b.y + BORDER + ACTION.padY + lift(ACTION.size), null)];
  });
}

export function effectsItems(x: Ctx): Item[] {
  const { c, theme, icons } = x;
  const f = c.face;
  const mark = icons ? (f.kind === 'effects' ? icons.ui[UiGlyph.Image] : f.kind && icons.badge.get(f.kind)) : null;
  if (!f.media) {
    const top = (c.h - PROMPT.icon - PROMPT.gap - PROMPT.size * LEADING) / 2;
    return [
      ...panel(x),
      ...(mark ? glyph(x, CardPart.Media, mark, (c.w - PROMPT.icon) / 2, top, theme.inkSoft) : []),
      ...actions(x),
      ...write(x, CardPart.Empty, f.empty, PROMPT.size, theme.inkSoft, (c.w - measure(x, f.empty, PROMPT.size)) / 2, top + PROMPT.icon + PROMPT.gap, null)
    ];
  }
  const tag = f.subtitle ? measure(x, f.subtitle, BADGE.size) + BADGE.padX * 2 : 0;
  const tagH = BADGE.padY * 2 + BADGE.size * LEADING;
  return [
    ...panel(x),
    image(x, CardPart.Media, f.media, { x: BORDER, y: BORDER, w: c.w - 2 * BORDER, h: c.h - 2 * BORDER }, Fit.Contain),
    ...(f.subtitle ? [solid(x.clip(CardPart.Badge), at(c, [rect(BADGE.inset, c.h - BADGE.inset - tagH, tag, tagH)]), BADGE.fill, BADGE.alpha), ...write(x, CardPart.Badge, f.subtitle, BADGE.size, '#ffffff', BADGE.inset + BADGE.padX, c.h - BADGE.inset - tagH + BADGE.padY + lift(BADGE.size), null)] : []),
    ...actions(x)
  ];
}

function link(x: Ctx, label: string, left: number, top: number): Item[] {
  const width = measure(x, label, FOOT.size);
  return [...write(x, CardPart.Footer, label, FOOT.size, x.theme.inkSoft, left, top, null), solid(x.clip(CardPart.Footer), at(x.c, [rect(left, top + FOOT.size * LEADING - 1, width, 1)]), x.theme.inkSoft)];
}

function card(x: Ctx): Item[] {
  const { c, theme, icons } = x;
  const b = c.face.batch!;
  const gridH = c.h - FOOT.h - BORDER * 2;
  const rows = Math.max(1, Math.ceil(b.thumbs.length / GRID.columns));
  const cell = { w: (c.w - BORDER * 2 - GRID.gap * (GRID.columns - 1)) / GRID.columns, h: (gridH - GRID.gap * (rows - 1)) / rows };
  const tiles = b.thumbs.length
    ? b.thumbs.flatMap((url, i) => {
        const at0 = { x: BORDER + (i % GRID.columns) * (cell.w + GRID.gap), y: BORDER + Math.floor(i / GRID.columns) * (cell.h + GRID.gap), w: cell.w, h: cell.h };
        return [...box(x, CardPart.Thumb, at0, theme.line, null), image(x, CardPart.Thumb, { url, video: false }, at0, Fit.Cover, i)];
      })
    : [...box(x, CardPart.Thumb, { x: BORDER, y: BORDER, w: c.w - 2 * BORDER, h: gridH }, theme.paper2, null), ...(icons ? glyph(x, CardPart.Thumb, icons.ui[UiGlyph.Camera], (c.w - PROMPT.icon) / 2, BORDER + (gridH - PROMPT.icon) / 2, theme.inkSoft) : [])];
  const top = c.h - BORDER - FOOT.h;
  const mid = top + FOOT.h / 2 - (FOOT.size * LEADING) / 2 + lift(FOOT.size);
  const open = { w: measure(x, OPEN.label, FOOT.size) + OPEN.padX * 2, h: OPEN.padY * 2 + FOOT.size * LEADING };
  const openAt = { x: c.w - FOOT.padX - open.w, y: top + (FOOT.h - open.h) / 2, ...open };
  const change = measure(x, CHANGE, FOOT.size);
  const counts = measure(x, b.approved, FOOT.size);
  return [
    ...panel(x),
    ...tiles,
    solid(x.clip(CardPart.Footer), at(c, [rect(0, top, c.w, BORDER)]), theme.line),
    ...write(x, CardPart.Title, b.approved, FOOT.size, theme.ink, FOOT.padX, mid, null),
    ...write(x, CardPart.Footer, b.rest, FOOT.size, theme.inkSoft, FOOT.padX + counts, mid, openAt.x - FOOT.gap * 2 - change - FOOT.padX - counts, FOOT.size),
    ...link(x, CHANGE, openAt.x - FOOT.gap - change, mid),
    ...box(x, CardPart.Button, openAt, theme.ink, null),
    ...write(x, CardPart.Button, OPEN.label, FOOT.size, theme.paper, openAt.x + OPEN.padX, openAt.y + OPEN.padY + lift(FOOT.size), null)
  ];
}

function failed(x: Ctx): Item[] {
  const { c, theme } = x;
  const stack = FOOT.size * LEADING * 2 + 10;
  const top = (c.h - stack) / 2;
  const centre = (s: string) => (c.w - measure(x, s, FOOT.size)) / 2;
  return [...panel(x), ...write(x, CardPart.Empty, UNREACHABLE, FOOT.size, theme.inkSoft, centre(UNREACHABLE), top, null), ...link(x, PICK_ANOTHER, centre(PICK_ANOTHER), top + FOOT.size * LEADING + 10)];
}

export function batchItems(x: Ctx): Item[] {
  const state = x.c.face.batch?.state;
  if (state === BatchState.Card) {
    return card(x);
  }
  return state === BatchState.Failed ? failed(x) : pickItems(x);
}
