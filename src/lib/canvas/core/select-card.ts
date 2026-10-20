import type { Item } from '$lib/motion/gpu-full/display-list';
import { SelectBody, type SelectRow } from '$lib/canvas/node-view';
import { BORDER, CardPart, Fit, LEADING, UiGlyph, at, box, glyph, image, measure, panel, write, type Ctx } from './card-kit';
import { rect, solid } from './shapes';

const HEAD = { padX: 8, padY: 6, gap: 4 };
const NAV = 20;
const NAV_ICON = 14;
const HELP = { box: 18, icon: 13 };
const INDEX = { w: 44, size: 12, padY: 2 };
const INDEX_H = INDEX.padY * 2 + INDEX.size * LEADING + BORDER * 2;
const TOTAL_SIZE = 11;
const HEAD_H = HEAD.padY * 2 + INDEX_H + BORDER;
const DISABLED = 0.4;
const ROW = { padX: 8, padY: 4, size: 11, gap: 6, swatch: 8, label: 84, thumb: 18 };
const OUTPUTS_MAX = 120;
const ADD = { margin: [4, 8, 6] as const, padX: 6, padY: 2, size: 11, gap: 4, icon: 12, label: 'Output' };
const TEXT = { size: 12.5, pad: 12 };
const EMPTY = { size: 11.5, pad: 10, lines: ['Picks one item from a connected list, by number.', 'Connect a list, products or a feed'] };
const ICON_SIZE = 22;

const rowH = (r: SelectRow) => ROW.padY * 2 + Math.max(ROW.size * LEADING, r.thumb ? ROW.thumb : 0);
const baseline = (size: number) => ((size * LEADING) - size) / 2 - 1;

function nav(x: Ctx, glyphKind: UiGlyph, left: number, off: boolean): Item[] {
  const { theme, icons } = x;
  const top = HEAD.padY + (INDEX_H - NAV) / 2;
  const frame = box(x, CardPart.Head, { x: left, y: top, w: NAV, h: NAV }, theme.paper, theme.line2);
  const mark = icons ? glyph(x, CardPart.Head, icons.ui[glyphKind], left + (NAV - NAV_ICON) / 2, top + (NAV - NAV_ICON) / 2, theme.inkSoft) : [];
  return [...frame, ...mark].map((i) => (off ? { ...i, opacity: DISABLED } : i));
}

function head(x: Ctx): Item[] {
  const { c, theme, icons } = x;
  const v = c.face.select!;
  let left = HEAD.padX;
  const items: Item[] = [...nav(x, UiGlyph.Left, left, !v.total || v.index <= 1)];
  left += NAV + HEAD.gap;
  const index = { x: left, y: HEAD.padY, w: INDEX.w, h: INDEX_H };
  const label = String(v.index);
  items.push(...box(x, CardPart.Field, index, theme.paper2, theme.line2), ...write(x, CardPart.Field, label, INDEX.size, theme.ink, left + (INDEX.w - measure(x, label, INDEX.size)) / 2, HEAD.padY + BORDER + INDEX.padY + baseline(INDEX.size), null));
  left += INDEX.w + HEAD.gap;
  if (v.total) {
    const total = `/ ${v.total}`;
    items.push(...write(x, CardPart.Head, total, TOTAL_SIZE, theme.inkSoft, left, HEAD.padY + (INDEX_H - TOTAL_SIZE * LEADING) / 2 + baseline(TOTAL_SIZE), null));
    left += measure(x, total, TOTAL_SIZE) + HEAD.gap;
  }
  items.push(...nav(x, UiGlyph.Right, left, !v.total || v.index >= v.total));
  if (icons) {
    items.push(...glyph(x, CardPart.Head, icons.ui[UiGlyph.Help], c.w - HEAD.padX - HELP.box + (HELP.box - HELP.icon) / 2, HEAD.padY + (INDEX_H - HELP.icon) / 2, theme.inkSoft));
  }
  return [...items, solid(x.clip(CardPart.Head), at(c, [rect(0, HEAD_H - BORDER, c.w, BORDER)]), theme.line)];
}

function rows(x: Ctx, top: number, list: SelectRow[]): Item[] {
  const { c, theme } = x;
  let y = top;
  return list.flatMap((r) => {
    const h = rowH(r);
    const mid = y + h / 2;
    let left = ROW.padX;
    const out: Item[] = [];
    if (y + h <= top + OUTPUTS_MAX) {
      out.push(solid(x.clip(CardPart.Row), at(c, [rect(left, mid - ROW.swatch / 2, ROW.swatch, ROW.swatch)]), r.color));
      left += ROW.swatch + ROW.gap;
      const ink = r.flagged ? theme.inkSoft : theme.ink;
      out.push(...write(x, CardPart.Title, r.label, ROW.size, ink, left, mid - (ROW.size * LEADING) / 2 + baseline(ROW.size), ROW.label, ROW.size));
      left += ROW.label + ROW.gap;
      if (r.thumb) {
        out.push(...[image(x, CardPart.Thumb, { url: r.thumb, video: false }, { x: left, y: mid - ROW.thumb / 2, w: ROW.thumb, h: ROW.thumb }, Fit.Cover, list.indexOf(r))]);
        left += ROW.thumb + ROW.gap;
      }
      out.push(...write(x, CardPart.Row, r.value, ROW.size, theme.inkSoft, left, mid - (ROW.size * LEADING) / 2 + baseline(ROW.size), c.w - left - ROW.padX, ROW.size));
    }
    y += h;
    return out;
  });
}

function outputs(x: Ctx): { items: Item[]; height: number } {
  const { c, theme, icons } = x;
  const v = c.face.select!;
  if (!v.rows.length && !v.canAdd) {
    return { items: [], height: 0 };
  }
  const list = Math.min(OUTPUTS_MAX, v.rows.reduce((a, r) => a + rowH(r), 0));
  const add = v.canAdd ? ADD.margin[0] + ADD.padY * 2 + ADD.size * LEADING + BORDER * 2 + ADD.margin[2] : 0;
  const height = BORDER + list + add;
  const top = c.h - height - BORDER;
  const items: Item[] = [solid(x.clip(CardPart.Info), at(c, [rect(0, top, c.w, BORDER)]), theme.line), ...rows(x, top + BORDER, v.rows)];
  if (v.canAdd) {
    const label = measure(x, ADD.label, ADD.size);
    const w = BORDER * 2 + ADD.padX * 2 + ADD.icon + ADD.gap + label;
    const b = { x: ADD.margin[1], y: top + BORDER + list + ADD.margin[0], w, h: ADD.padY * 2 + ADD.size * LEADING + BORDER * 2 };
    items.push(...box(x, CardPart.Button, b, theme.paper, theme.line2));
    if (icons) {
      items.push(...glyph(x, CardPart.Button, icons.ui[UiGlyph.Plus], b.x + BORDER + ADD.padX, b.y + (b.h - ADD.icon) / 2, theme.ink));
    }
    items.push(...write(x, CardPart.Button, ADD.label, ADD.size, theme.ink, b.x + BORDER + ADD.padX + ADD.icon + ADD.gap, b.y + BORDER + ADD.padY + baseline(ADD.size), null));
  }
  return { items, height };
}

function body(x: Ctx, top: number, h: number): Item[] {
  const { c, theme, icons } = x;
  const v = c.face.select!;
  const mid = top + h / 2;
  const centred = (s: string, size: number, y: number) => write(x, CardPart.Empty, s, size, theme.inkSoft, Math.max(EMPTY.pad, (c.w - measure(x, s, size)) / 2), y, c.w - 2 * EMPTY.pad, size * LEADING);
  switch (v.body) {
    case SelectBody.Photo:
      return [image(x, CardPart.Media, { url: v.url!, video: false }, { x: BORDER, y: top, w: c.w - 2 * BORDER, h }, Fit.Cover)];
    case SelectBody.PhotoMissing:
      return [...box(x, CardPart.Media, { x: BORDER, y: top, w: c.w - 2 * BORDER, h }, theme.paper2, null), ...(icons ? glyph(x, CardPart.Media, icons.ui[UiGlyph.Image], (c.w - ICON_SIZE) / 2, mid - ICON_SIZE / 2, theme.inkSoft) : [])];
    case SelectBody.Text:
      return write(x, CardPart.Body, v.text, TEXT.size, theme.ink, TEXT.pad, top + TEXT.pad, c.w - 2 * TEXT.pad, h - 2 * TEXT.pad);
    case SelectBody.Empty:
      return centred('Empty list', EMPTY.size, mid - (EMPTY.size * LEADING) / 2);
    default:
      return EMPTY.lines.flatMap((line, i) => centred(line, EMPTY.size, mid - EMPTY.size * LEADING + i * EMPTY.size * LEADING));
  }
}

export function selectItems(x: Ctx): Item[] {
  const { c } = x;
  const foot = outputs(x);
  return [...panel(x), ...head(x), ...body(x, HEAD_H, c.h - HEAD_H - BORDER - foot.height), ...foot.items];
}
