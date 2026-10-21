import type { Item } from '$lib/motion/gpu-full/display-list';
import { BORDER, CardPart, LEADING, UiGlyph, at, box, glyph, measure, panel, write, type Ctx } from './card-kit';
import { rect, solid } from './shapes';

const HEAD = { padX: 9, padY: 7, gap: 6 };
const MODES = { pad: 2, buttonX: 8, buttonY: 3, size: 11.5, labels: ['URL', 'Code'] as const };
const MODES_H = BORDER * 2 + MODES.pad * 2 + MODES.buttonY * 2 + MODES.size * LEADING;
const FIELD = { padX: 7, padY: 3, size: 11.5 };
const FIELD_H = FIELD.padY * 2 + FIELD.size * LEADING + BORDER * 2;
const OPEN = { box: 24, icon: 15, disabled: 0.35 };
const HEAD_H = HEAD.padY * 2 + MODES_H + BORDER;
const FOOT = { top: 8, side: 9, bottom: 9, gap: 6 };
const CODE = { size: 11.5, leading: 1.45, padX: 8, padY: 6, rows: 3 };
const CODE_H = CODE.size * CODE.leading * CODE.rows + CODE.padY * 2 + BORDER * 2;
const SHOW = { size: 12, padX: 12, padY: 4, label: 'Mostra', off: 0.35 };
const NOTE = { size: 10.5, leading: 1.4, padX: 9, top: 5, bottom: 7 };
const HINT_SIZE = 12;
const URL_PLACEHOLDER = 'https://…';
const CODE_PLACEHOLDER = "<iframe src=…> oppure dell'HTML";

const centred = (size: number, line = size * LEADING) => (line - size) / 2 - 1;

function modes(x: Ctx, on: number): { items: Item[]; right: number } {
  const { theme } = x;
  const widths = MODES.labels.map((l) => measure(x, l, MODES.size) + MODES.buttonX * 2);
  const total = widths.reduce((a, b) => a + b, 0) + MODES.pad * 2 + BORDER * 2;
  let left = HEAD.padX + BORDER + MODES.pad;
  const items = [...box(x, CardPart.Head, { x: HEAD.padX, y: HEAD.padY, w: total, h: MODES_H }, theme.paper2, theme.line2)];
  MODES.labels.forEach((label, i) => {
    const b = { x: left, y: HEAD.padY + BORDER + MODES.pad, w: widths[i], h: MODES.buttonY * 2 + MODES.size * LEADING };
    items.push(...(i === on ? box(x, CardPart.Head, b, theme.paper, null) : []), ...write(x, CardPart.Head, label, MODES.size, i === on ? theme.ink : theme.inkSoft, left + MODES.buttonX, b.y + MODES.buttonY + centred(MODES.size), null));
    left += widths[i];
  });
  return { items, right: HEAD.padX + total };
}

function head(x: Ctx): Item[] {
  const { c, theme, icons } = x;
  const e = c.face.embed!;
  const bar = modes(x, e.mode === 'url' ? 0 : 1);
  const line = solid(x.clip(CardPart.Head), at(c, [rect(0, HEAD_H - BORDER, c.w, BORDER)]), theme.line);
  if (e.mode === 'html') {
    return [...bar.items, line];
  }
  const open = c.w - HEAD.padX - OPEN.box;
  const left = bar.right + HEAD.gap;
  const field = { x: left, y: HEAD.padY + (MODES_H - FIELD_H) / 2, w: open - HEAD.gap - left, h: FIELD_H };
  const arrow = icons ? glyph(x, CardPart.Head, icons.ui[UiGlyph.Open], open + (OPEN.box - OPEN.icon) / 2, HEAD.padY + (MODES_H - OPEN.icon) / 2, theme.inkSoft, e.hint === null ? 1 : OPEN.disabled) : [];
  return [
    ...bar.items,
    ...box(x, CardPart.Field, field, theme.paper2, theme.line2),
    ...write(x, CardPart.Field, e.url || URL_PLACEHOLDER, FIELD.size, e.url ? theme.ink : theme.inkSoft, field.x + BORDER + FIELD.padX, field.y + BORDER + FIELD.padY + centred(FIELD.size), field.w - 2 * (BORDER + FIELD.padX), FIELD.size),
    ...arrow,
    line
  ];
}

function code(x: Ctx): { items: Item[]; height: number } {
  const { c, theme } = x;
  const e = c.face.embed!;
  const height = FOOT.top + CODE_H + FOOT.gap + SHOW.padY * 2 + SHOW.size * LEADING + FOOT.bottom + BORDER;
  const top = c.h - height;
  const area = { x: FOOT.side, y: top + BORDER + FOOT.top, w: c.w - FOOT.side * 2, h: CODE_H };
  const label = measure(x, SHOW.label, SHOW.size) + SHOW.padX * 2;
  const button = { x: c.w - FOOT.side - label, y: area.y + CODE_H + FOOT.gap, w: label, h: SHOW.padY * 2 + SHOW.size * LEADING };
  return {
    height,
    items: [
      solid(x.clip(CardPart.Footer), at(c, [rect(0, top, c.w, BORDER)]), theme.line),
      ...box(x, CardPart.Code, area, theme.paper2, theme.line2),
      ...write(x, CardPart.Code, e.code || CODE_PLACEHOLDER, CODE.size, e.code ? theme.ink : theme.inkSoft, area.x + BORDER + CODE.padX, area.y + BORDER + CODE.padY, area.w - 2 * (BORDER + CODE.padX), CODE.size * CODE.leading * CODE.rows),
      ...box(x, CardPart.Button, button, theme.ink, null).map((i) => ({ ...i, opacity: SHOW.off })),
      ...write(x, CardPart.Button, SHOW.label, SHOW.size, theme.paper, button.x + SHOW.padX, button.y + SHOW.padY + centred(SHOW.size), null)
    ]
  };
}

function note(x: Ctx): { items: Item[]; height: number } {
  const { c, theme } = x;
  const text = c.face.embed!.note;
  if (!text) {
    return { items: [], height: 0 };
  }
  const lines = Math.max(1, Math.ceil(measure(x, text, NOTE.size) / (c.w - NOTE.padX * 2)));
  const height = BORDER + NOTE.top + lines * NOTE.size * NOTE.leading + NOTE.bottom;
  return {
    height,
    items: [solid(x.clip(CardPart.Footer), at(c, [rect(0, c.h - height, c.w, BORDER)]), theme.line), ...write(x, CardPart.Footer, text, NOTE.size, theme.inkSoft, NOTE.padX, c.h - height + BORDER + NOTE.top, c.w - NOTE.padX * 2, lines * NOTE.size * NOTE.leading)]
  };
}

export function embedItems(x: Ctx): Item[] {
  const { c, theme } = x;
  const e = c.face.embed!;
  const foot = e.mode === 'html' ? code(x) : note(x);
  const room = c.h - HEAD_H - foot.height;
  const message = e.hint ? write(x, CardPart.Empty, e.hint, HINT_SIZE, theme.inkSoft, Math.max(16, (c.w - measure(x, e.hint, HINT_SIZE)) / 2), HEAD_H + (room - HINT_SIZE * LEADING) / 2, c.w - 32, HINT_SIZE * LEADING) : [];
  return [...panel(x), ...head(x), ...message, ...foot.items];
}
