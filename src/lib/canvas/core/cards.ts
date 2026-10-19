import { ItemKind, type ImageItem, type Item } from '$lib/motion/gpu-full/display-list';
import { BlendMode } from '$lib/motion/blend';
import { IDENTITY, type Affine } from '$lib/motion/parent';
import { MOTION_NODE_BAR_H } from '$lib/canvas/motion-node';
import { Surface, type CardFace, type Media } from '$lib/canvas/gpu/card-face';
import type { Box } from '$lib/canvas/gpu/geometry';
import type { Glyphs } from './chrome';
import type { CoreTheme } from './overlay';
import { circle, line, rect, solid } from './shapes';

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
  Thumb = 'thumb'
}

enum Fit {
  Cover = 'cover',
  Contain = 'contain'
}

export type CoreCard = Box & { id: string; face: CardFace };

const PAD = 14;
const BODY_SIZE = 13;
const SHADOW_DROP = 2;
const SHADOW_OPACITY = 0.06;
const BORDER = 1;
const FOOTER_LINES = 2.4;
const STATUS_RADIUS = 4;
const STATUS_TEXT_GAP = 12;
const THUMB_COLUMNS = 3;
const THUMB_GAP = 4;
const STAGE = '#000000';
const ERROR = '#c0392b';
const DONE = '#16a34a';
const PROMPT_HINT = 'Describe what to generate…';
const RUNNING = 'Running…';
const AUTO_MODEL = 'Auto';
const CENTRE: [number, number] = [0.5, 0.5];

type Ctx = { c: CoreCard; theme: CoreTheme; glyphs: Glyphs; bold: Glyphs; clip: (p: CardPart) => string };

const at = (c: CoreCard, contours: number[][]) => contours.map((k) => k.map((v, i) => (i % 2 === 0 ? v + c.x : v + c.y)));

const translate = (x: number, y: number): Affine => [IDENTITY[0], IDENTITY[1], IDENTITY[2], IDENTITY[3], x, y];

function image(x: Ctx, part: CardPart, media: Media, b: Box, fit: Fit, nth = 0): ImageItem {
  return { kind: ItemKind.Image, clip: `${x.clip(part)}:${nth}`, src: media.url, video: media.video, mediaTime: 0, size: { width: b.w, height: b.h }, fit, focus: CENTRE, zoom: 1, clipped: true, inner: IDENTITY, opacity: 1, matrix: translate(x.c.x + b.x, x.c.y + b.y), blur: 0, blend: BlendMode.Normal };
}

function panel(x: Ctx, raised = true): Item[] {
  const { c, theme } = x;
  const shadow = raised ? [solid(x.clip(CardPart.Panel), at(c, [rect(0, SHADOW_DROP, c.w, c.h)]), STAGE, SHADOW_OPACITY)] : [];
  return [
    ...shadow,
    solid(x.clip(CardPart.Panel), at(c, [rect(0, 0, c.w, c.h)]), theme.paper),
    solid(x.clip(CardPart.Panel), at(c, line(rect(BORDER / 2, BORDER / 2, c.w - BORDER, c.h - BORDER), BORDER, true)), theme.line)
  ];
}

function text(x: Ctx, part: CardPart, s: string, size: number, colour: string, left: number, top: number, width: number | null, height = size): Item[] {
  if (!s) {
    return [];
  }
  const set = width === null ? undefined : { width, height };
  return [solid(x.clip(part), at(x.c, (part === CardPart.Title ? x.bold : x.glyphs)(s, size, set).contours.map((k) => k.map((v, i) => (i % 2 === 0 ? v + left : v + top)))), colour)];
}

const body = (x: Ctx, s: string, top: number, bottom = PAD) => text(x, CardPart.Body, s, BODY_SIZE, x.theme.ink, PAD, top, x.c.w - PAD * 2, x.c.h - top - bottom);

const statusColour = (f: CardFace, theme: CoreTheme) => (f.error ? ERROR : f.running ? theme.accent : f.media ? DONE : theme.line);

function generate(x: Ctx): Item[] {
  const { c, theme } = x;
  const f = c.face;
  const footer = BODY_SIZE * FOOTER_LINES;
  const content = f.media ? [image(x, CardPart.Media, f.media, { x: BORDER, y: BORDER, w: c.w - 2 * BORDER, h: c.h - footer - BORDER }, Fit.Cover)] : body(x, f.text || f.prompt || PROMPT_HINT, PAD, footer + PAD);
  const mid = c.h - footer / 2;
  return [
    ...panel(x),
    ...content,
    solid(x.clip(CardPart.Footer), at(c, [rect(0, c.h - footer, c.w, BORDER)]), theme.line),
    solid(x.clip(CardPart.Status), at(c, circle(PAD, mid, STATUS_RADIUS)), statusColour(f, theme)),
    ...text(x, CardPart.Model, f.error ?? (f.running ? RUNNING : (f.model ?? AUTO_MODEL)), BODY_SIZE - 1, theme.inkSoft, PAD + STATUS_TEXT_GAP, mid - BODY_SIZE * 0.7, null)
  ];
}

function thumbs(x: Ctx, top: number): Item[] {
  const { c, theme } = x;
  const cell = (c.w - PAD * 2 - THUMB_GAP * (THUMB_COLUMNS - 1)) / THUMB_COLUMNS;
  const rows = Math.max(0, Math.floor((c.h - top - PAD + THUMB_GAP) / (cell + THUMB_GAP)));
  return c.face.thumbs.slice(0, rows * THUMB_COLUMNS).flatMap((url, i) => {
    const b = { x: PAD + (i % THUMB_COLUMNS) * (cell + THUMB_GAP), y: top + Math.floor(i / THUMB_COLUMNS) * (cell + THUMB_GAP), w: cell, h: cell };
    return [solid(x.clip(CardPart.Thumb), at(c, [rect(b.x, b.y, b.w, b.h)]), theme.line), image(x, CardPart.Thumb, { url, video: false }, b, Fit.Cover, i)];
  });
}

function source(x: Ctx): Item[] {
  const { c, theme } = x;
  const f = c.face;
  if (f.media) {
    return [...panel(x), image(x, CardPart.Media, f.media, { x: 0, y: 0, w: c.w, h: c.h }, Fit.Cover)];
  }
  const below = PAD + BODY_SIZE * 2;
  const title = text(x, CardPart.Title, f.title || f.label || '', BODY_SIZE, theme.ink, PAD, PAD, c.w - PAD * 2);
  const rest = f.thumbs.length ? thumbs(x, below) : text(x, CardPart.Subtitle, f.subtitle, BODY_SIZE - 1, theme.inkSoft, PAD, below, c.w - PAD * 2);
  return [...panel(x), ...title, ...rest];
}

function frame(x: Ctx): Item[] {
  const { c } = x;
  const stage = { x: 0, y: 0, w: c.w, h: Math.max(1, c.h - MOTION_NODE_BAR_H) };
  const media = c.face.live ? { url: c.face.live, video: true } : c.face.media;
  return [...panel(x, false), solid(x.clip(CardPart.Stage), at(c, [rect(stage.x, stage.y, stage.w, stage.h)]), STAGE), ...(media ? [image(x, CardPart.Media, media, stage, Fit.Contain)] : [])];
}

const whole = (c: CoreCard): Box => ({ x: 0, y: 0, w: c.w, h: c.h });

const SURFACES: Record<Surface, (x: Ctx) => Item[]> = {
  [Surface.Media]: (x) => [...panel(x), ...(x.c.face.media ? [image(x, CardPart.Media, x.c.face.media, whole(x.c), Fit.Contain)] : [])],
  [Surface.Frame]: frame,
  [Surface.Graphic]: (x) => (x.c.face.media ? [image(x, CardPart.Media, x.c.face.media, whole(x.c), Fit.Contain)] : []),
  [Surface.Generate]: generate,
  [Surface.Text]: (x) => [...panel(x), ...body(x, x.c.face.text, PAD)],
  [Surface.Source]: source,
  [Surface.Blank]: (x) => panel(x)
};

export const cardItems = (c: CoreCard, theme: CoreTheme, glyphs: Glyphs, bold: Glyphs = glyphs): Item[] => SURFACES[c.face.surface]({ c, theme, glyphs, bold, clip: (p) => `${c.id}:${p}` });
