import type { Item } from '$lib/motion/gpu-full/display-list';
import { TileBadge, type SourceTile } from '$lib/canvas/source-thumbs';
import { BORDER, CardPart, Fit, at, image, measure, panel, write, type Ctx } from './card-kit';
import { rect, solid } from './shapes';

const HEAD = { padX: 9, padY: 7, line: 16, title: 11.5, count: 10.5, icon: 13, gap: 6 };
const HEAD_H = HEAD.padY * 2 + HEAD.line + BORDER;
const GRID = { pad: 6, gap: 4, columns: 3 };
const SCRIM = { fill: '#000000', alpha: 0.55, ink: '#ffffff' };
const BADGE = { inset: 4, pad: 2, icon: 11 };
const SALE = { inset: 4, padX: 4, size: 10, height: 14, fill: '#d70015' };
const CAPTION = { size: 10, padX: 4, height: 18 };
const EMPTY = { size: 12, padX: 16 };
const FAIL = { title: 12.5, why: 11, gap: 4, padX: 16 };
const PERSON = { padX: 10, padY: 8, gap: 2, name: 12.5, views: 11, line: 1.4, icon: 28 };
const PERSON_INFO_H = PERSON.padY * 2 + PERSON.name * PERSON.line + PERSON.gap + PERSON.views * PERSON.line + BORDER;
const BADGE_GLYPH: Record<TileBadge, 'layers' | 'play'> = { [TileBadge.Carousel]: 'layers', [TileBadge.Video]: 'play' };
const FAIL_TITLE = 'Sync failed';

const moved = (contours: number[][], dx: number, dy: number) => contours.map((k) => k.map((v, i) => (i % 2 === 0 ? v + dx : v + dy)));

function icon(x: Ctx, part: CardPart, contours: number[][], left: number, top: number, colour: string): Item[] {
  return [solid(x.clip(part), at(x.c, moved(contours, left, top)), colour)];
}

function head(x: Ctx): Item[] {
  const { c, theme, icons } = x;
  const f = c.face;
  const mark = f.kind ? icons?.head.get(f.kind) : undefined;
  const count = f.count ? measure(x, f.count, HEAD.count) : 0;
  const titleLeft = HEAD.padX + (mark ? HEAD.icon + HEAD.gap : 0);
  const titleWidth = c.w - HEAD.padX - titleLeft - (count ? count + HEAD.gap : 0);
  const middle = HEAD.padY + (HEAD.line - HEAD.title) / 2 - 1;
  return [
    ...(mark ? icon(x, CardPart.Head, mark, HEAD.padX, HEAD.padY + (HEAD.line - HEAD.icon) / 2, theme.ink) : []),
    ...write(x, CardPart.Title, f.title, HEAD.title, theme.ink, titleLeft, middle, titleWidth, HEAD.title),
    ...write(x, CardPart.Head, f.count, HEAD.count, theme.inkSoft, c.w - HEAD.padX - count, HEAD.padY + (HEAD.line - HEAD.count) / 2 - 1, null),
    solid(x.clip(CardPart.Head), at(c, [rect(0, HEAD_H - BORDER, c.w, BORDER)]), theme.line)
  ];
}

function centred(x: Ctx, part: CardPart, s: string, size: number, colour: string, top: number, width: number): Item[] {
  const own = measure(x, s, size);
  const left = own < width ? (x.c.w - own) / 2 : (x.c.w - width) / 2;
  return write(x, part, s, size, colour, left, top, width, size * 4);
}

function empty(x: Ctx): Item[] {
  const { c, theme } = x;
  const room = c.h - HEAD_H;
  return centred(x, CardPart.Empty, c.face.empty, EMPTY.size, theme.inkSoft, HEAD_H + room / 2 - EMPTY.size, c.w - EMPTY.padX * 2);
}

function failure(x: Ctx): Item[] {
  const { c, theme } = x;
  const top = HEAD_H + (c.h - HEAD_H) / 2 - FAIL.title - FAIL.gap;
  const width = c.w - FAIL.padX * 2;
  return [...centred(x, CardPart.Title, FAIL_TITLE, FAIL.title, theme.ink, top, width), ...centred(x, CardPart.Empty, c.face.error ?? '', FAIL.why, theme.inkSoft, top + FAIL.title * 1.5 + FAIL.gap, width)];
}

function badge(x: Ctx, kind: TileBadge, left: number, top: number): Item[] {
  const glyph = x.icons?.[BADGE_GLYPH[kind]];
  const size = BADGE.icon + BADGE.pad * 2;
  return [solid(x.clip(CardPart.Badge), at(x.c, [rect(left, top, size, size)]), SCRIM.fill, SCRIM.alpha), ...(glyph ? icon(x, CardPart.Badge, glyph, left + BADGE.pad, top + BADGE.pad, SCRIM.ink) : [])];
}

function sale(x: Ctx, label: string, left: number, top: number): Item[] {
  const width = measure(x, label, SALE.size, 'bold') + SALE.padX * 2;
  return [solid(x.clip(CardPart.Sale), at(x.c, [rect(left, top, width, SALE.height)]), SALE.fill), ...write(x, CardPart.Sale, label, SALE.size, SCRIM.ink, left + SALE.padX, top + (SALE.height - SALE.size) / 2 - 1, null)];
}

function caption(x: Ctx, label: string, left: number, top: number, cell: number): Item[] {
  const band = top + cell - CAPTION.height;
  return [solid(x.clip(CardPart.Caption), at(x.c, [rect(left, band, cell, CAPTION.height)]), SCRIM.fill, SCRIM.alpha), ...write(x, CardPart.Caption, label, CAPTION.size, SCRIM.ink, left + CAPTION.padX, band + (CAPTION.height - CAPTION.size) / 2 - 1, cell - CAPTION.padX * 2, CAPTION.size)];
}

function tile(x: Ctx, t: SourceTile, i: number, at0: { left: number; top: number; cell: number }): Item[] {
  const { left, top, cell } = at0;
  const room = Math.min(cell, x.c.h - BORDER - top);
  const box = { x: left, y: top, w: cell, h: room };
  const pictured = t.thumb ? [image(x, CardPart.Thumb, { url: t.thumb, video: false }, box, Fit.Cover, i)] : [];
  const whole = room >= cell;
  const over = whole ? [...(t.badge ? badge(x, t.badge, left + cell - BADGE.inset - BADGE.icon - BADGE.pad * 2, top + BADGE.inset) : []), ...(t.sale ? sale(x, t.sale, left + SALE.inset, top + SALE.inset) : []), ...(t.caption ? caption(x, t.caption, left, top, cell) : [])] : [];
  return [solid(x.clip(CardPart.Thumb), at(x.c, [rect(left, top, cell, room)]), x.theme.paper2), ...pictured, ...over];
}

function grid(x: Ctx): Item[] {
  const { c } = x;
  const cell = (c.w - GRID.pad * 2 - GRID.gap * (GRID.columns - 1)) / GRID.columns;
  const first = HEAD_H + GRID.pad;
  return c.face.tiles.flatMap((t, i) => {
    const top = first + Math.floor(i / GRID.columns) * (cell + GRID.gap);
    if (top >= c.h - BORDER) {
      return [];
    }
    return tile(x, t, i, { left: GRID.pad + (i % GRID.columns) * (cell + GRID.gap), top, cell });
  });
}

export function previewItems(x: Ctx): Item[] {
  const f = x.c.face;
  const body = f.error ? failure(x) : f.tiles.length ? grid(x) : empty(x);
  return [...panel(x), ...head(x), ...body];
}

export function personItems(x: Ctx): Item[] {
  const { c, theme, icons } = x;
  const f = c.face;
  const top = c.h - PERSON_INFO_H;
  const cover = f.tiles[0]?.thumb;
  const views = Number(f.count);
  const photo = cover
    ? [image(x, CardPart.Media, { url: cover, video: false }, { x: BORDER, y: BORDER, w: c.w - BORDER * 2, h: top - BORDER }, Fit.Cover)]
    : [solid(x.clip(CardPart.Media), at(c, [rect(BORDER, BORDER, c.w - BORDER * 2, top - BORDER)]), theme.paper2), ...(icons ? icon(x, CardPart.Media, icons.person, (c.w - PERSON.icon) / 2, (top - PERSON.icon) / 2, theme.inkSoft) : [])];
  return [
    ...panel(x),
    ...photo,
    solid(x.clip(CardPart.Info), at(c, [rect(0, top, c.w, BORDER)]), theme.line),
    ...write(x, CardPart.Title, f.title || f.label || '', PERSON.name, theme.ink, PERSON.padX, top + BORDER + PERSON.padY, c.w - PERSON.padX * 2, PERSON.name),
    ...write(x, CardPart.Subtitle, `${views} ${views === 1 ? 'view' : 'views'}`, PERSON.views, theme.inkSoft, PERSON.padX, top + BORDER + PERSON.padY + PERSON.name * PERSON.line + PERSON.gap, c.w - PERSON.padX * 2, PERSON.views)
  ];
}
