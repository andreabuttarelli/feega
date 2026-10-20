import { ItemKind, type ImageItem, type Item } from '$lib/motion/gpu-full/display-list';
import { BlendMode } from '$lib/motion/blend';
import { IDENTITY, type Affine } from '$lib/motion/parent';
import type { CardFace, Media } from '$lib/canvas/gpu/card-face';
import type { Box } from '$lib/canvas/gpu/geometry';
import type { Glyphs } from './chrome';
import type { CoreTheme } from './overlay';
import { line, rect, solid } from './shapes';
import type { NodeType } from '$lib/canvas/node-data';
import type { GenIcons } from './gen-card';

export enum CardPart {
  Panel = 'panel',
  Media = 'media',
  Stage = 'stage',
  Body = 'body',
  Title = 'title',
  Subtitle = 'subtitle',
  Footer = 'footer',
  Status = 'status',
  Model = 'model',
  Thumb = 'thumb',
  Head = 'head',
  Row = 'row',
  Badge = 'badge',
  Sale = 'sale',
  Caption = 'caption',
  Empty = 'empty',
  Info = 'info'
}

export enum Fit {
  Cover = 'cover',
  Contain = 'contain'
}

export type CoreCard = Box & { id: string; face: CardFace };

export const PAD = 14;
export const BODY_SIZE = 13;
export const SHADOW_DROP = 2;
export const SHADOW_OPACITY = 0.06;
export const BORDER = 1;
export const FOOTER_LINES = 2.4;
export const STATUS_RADIUS = 4;
export const STATUS_TEXT_GAP = 12;
export const THUMB_COLUMNS = 3;
export const THUMB_GAP = 4;
export const HEAD_H = 34;
export const HEAD_SIZE = 12;
export const ROW_H = 28;
export const ROW_THUMB = 20;
export const ROW_GAP = 6;
export const PILL_PAD = 8;
export const PILL_H = 20;
export const DOT_RADIUS = 3;
export const STAGE = '#000000';
export const ERROR = '#c0392b';
export const DONE = '#16a34a';
export const PROMPT_HINT = 'Describe what to generate…';
export const RUNNING = 'Running…';
export const AUTO_MODEL = 'Auto';
export const CENTRE: [number, number] = [0.5, 0.5];

export type SourceIcons = { head: ReadonlyMap<NodeType, number[][]>; layers: number[][]; play: number[][]; person: number[][] };

export type CardIcons = GenIcons & SourceIcons;

const BOLD_PARTS: ReadonlySet<CardPart> = new Set([CardPart.Title, CardPart.Sale]);

export type Ctx = { c: CoreCard; theme: CoreTheme; glyphs: Glyphs; bold: Glyphs; icons: CardIcons | null; clip: (p: CardPart) => string };

export const at = (c: CoreCard, contours: number[][]) => contours.map((k) => k.map((v, i) => (i % 2 === 0 ? v + c.x : v + c.y)));

export const translate = (x: number, y: number): Affine => [IDENTITY[0], IDENTITY[1], IDENTITY[2], IDENTITY[3], x, y];

export function image(x: Ctx, part: CardPart, media: Media, b: Box, fit: Fit, nth = 0): ImageItem {
  return { kind: ItemKind.Image, clip: `${x.clip(part)}:${nth}`, src: media.url, video: media.video, mediaTime: 0, size: { width: b.w, height: b.h }, fit, focus: CENTRE, zoom: 1, clipped: true, inner: IDENTITY, opacity: 1, matrix: translate(x.c.x + b.x, x.c.y + b.y), blur: 0, blend: BlendMode.Normal };
}

export function panel(x: Ctx, raised = true): Item[] {
  const { c, theme } = x;
  const shadow = raised ? [solid(x.clip(CardPart.Panel), at(c, [rect(0, SHADOW_DROP, c.w, c.h)]), STAGE, SHADOW_OPACITY)] : [];
  return [
    ...shadow,
    solid(x.clip(CardPart.Panel), at(c, [rect(0, 0, c.w, c.h)]), theme.paper),
    solid(x.clip(CardPart.Panel), at(c, line(rect(BORDER / 2, BORDER / 2, c.w - BORDER, c.h - BORDER), BORDER, true)), theme.line)
  ];
}

export function text(x: Ctx, part: CardPart, s: string, size: number, colour: string, left: number, top: number, width: number | null, height = size): Item[] {
  if (!s) {
    return [];
  }
  const set = width === null ? undefined : { width, height };
  const contours = at(x.c, (BOLD_PARTS.has(part) ? x.bold : x.glyphs)(s, size, set).contours.map((k) => k.map((v, i) => (i % 2 === 0 ? v + left : v + top))));
  return [{ ...solid(x.clip(part), contours, colour), scissor: [x.c.x, x.c.y, x.c.x + x.c.w, x.c.y + x.c.h] }];
}

export const body = (x: Ctx, s: string, top: number, bottom = PAD) => text(x, CardPart.Body, s, BODY_SIZE, x.theme.ink, PAD, top, x.c.w - PAD * 2, x.c.h - top - bottom);

export const whole = (c: CoreCard): Box => ({ x: 0, y: 0, w: c.w, h: c.h });
