import type { Item } from '$lib/motion/gpu-full/display-list';
import { MOTION_NODE_BAR_H } from '$lib/canvas/motion-node';
import { Surface, type CardFace } from '$lib/canvas/gpu/card-face';
import type { Glyphs } from './chrome';
import type { CoreTheme } from './overlay';
import { circle, rect, solid } from './shapes';
import { emptyItems, pickItems } from './empty-card';
import { personItems, previewItems } from './source-card';
import { genBody, genItems, genMark } from './gen-card';
import { BODY_SIZE, BORDER, CardPart, DONE, ERROR, FOOTER_LINES, Fit, HEAD_H, HEAD_SIZE, PAD, ROW_GAP, ROW_H, ROW_THUMB, DOT_RADIUS, PILL_H, PILL_PAD, PROMPT_HINT, RUNNING, AUTO_MODEL, STAGE, STATUS_RADIUS, STATUS_TEXT_GAP, THUMB_GAP, at, body, image, panel, text, whole, type CardIcons, type CoreCard, type Ctx } from './card-kit';

export { CardPart, type CoreCard };

const statusColour = (f: CardFace, theme: CoreTheme) => (f.error ? ERROR : f.running ? theme.accent : f.media ? DONE : theme.line);

function live(x: Ctx): Item[] | null {
  const { c, icons } = x;
  const gen = c.face.gen;
  if (!gen || !icons) {
    return null;
  }
  const media = c.face.media && gen.state === 'done' ? [image(x, CardPart.Media, c.face.media, genBody(c, gen), Fit.Contain)] : [];
  const kit = { theme: x.theme, glyphs: x.glyphs, bold: x.bold, icons };
  return [...genItems(c, gen, kit), ...media, ...genMark(c, gen, kit)];
}

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

function source(x: Ctx): Item[] {
  const { c, theme } = x;
  const f = c.face;
  if (f.media) {
    return [...panel(x), image(x, CardPart.Media, f.media, { x: 0, y: 0, w: c.w, h: c.h }, Fit.Cover)];
  }
  const below = PAD + BODY_SIZE * 2;
  const title = text(x, CardPart.Title, f.title || f.label || '', BODY_SIZE, theme.ink, PAD, PAD, c.w - PAD * 2);
  const rest = text(x, CardPart.Subtitle, f.subtitle, BODY_SIZE - 1, theme.inkSoft, PAD, below, c.w - PAD * 2);
  return [...panel(x), ...title, ...rest];
}

function frame(x: Ctx): Item[] {
  const { c } = x;
  const stage = { x: 0, y: 0, w: c.w, h: Math.max(1, c.h - MOTION_NODE_BAR_H) };
  const media = c.face.live ? { url: c.face.live, video: true } : c.face.media;
  return [...panel(x, false), solid(x.clip(CardPart.Stage), at(c, [rect(stage.x, stage.y, stage.w, stage.h)]), STAGE), ...(media ? [image(x, CardPart.Media, media, stage, Fit.Contain)] : [])];
}

const markdownText = (md: string) => md.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/^#{1,6}\s+/gm, '').replace(/^\s*[-*]\s+/gm, '• ').replace(/[*_`>]/g, '');

const ROW_STATUS: Record<string, (t: CoreTheme) => string> = {
  done: () => DONE,
  failed: () => ERROR,
  running: (t) => t.accent,
  queued: (t) => t.line
};

function pills(x: Ctx, labels: readonly string[], active: number): Item[] {
  const { c, theme } = x;
  let left = PAD;
  return labels.flatMap((label, i) => {
    const w = x.glyphs(label, HEAD_SIZE).width + PILL_PAD * 2;
    const at0 = left;
    left += w + THUMB_GAP;
    const on = i === active;
    return [solid(x.clip(CardPart.Head), at(c, [rect(at0, (HEAD_H - PILL_H) / 2, w, PILL_H)]), on ? theme.chip : theme.paper), ...text(x, CardPart.Head, label, HEAD_SIZE, on ? theme.chipInk : theme.inkSoft, at0 + PILL_PAD, (HEAD_H - HEAD_SIZE) / 2 - 1, null)];
  });
}

function head(x: Ctx, labels: readonly string[], active: number): Item[] {
  const { c, theme } = x;
  const right = c.face.count;
  const width = right ? x.glyphs(right, HEAD_SIZE).width : 0;
  return [...pills(x, labels, active), ...text(x, CardPart.Head, right, HEAD_SIZE, theme.inkSoft, c.w - PAD - width, (HEAD_H - HEAD_SIZE) / 2 - 1, null), solid(x.clip(CardPart.Head), at(c, [rect(0, HEAD_H, c.w, BORDER)]), theme.line)];
}

function rows(x: Ctx): Item[] {
  const { c, theme } = x;
  const fits = Math.max(0, Math.floor((c.h - HEAD_H - ROW_GAP) / ROW_H));
  return c.face.rows.slice(0, fits).flatMap((row, i) => {
    const top = HEAD_H + ROW_GAP + i * ROW_H;
    const mid = top + ROW_H / 2;
    const textLeft = PAD + ROW_THUMB + ROW_GAP + (row.thumb ? ROW_THUMB + ROW_GAP : 0);
    const thumb = row.thumb ? [solid(x.clip(CardPart.Thumb), at(c, [rect(PAD + ROW_THUMB + ROW_GAP, mid - ROW_THUMB / 2, ROW_THUMB, ROW_THUMB)]), theme.line), image(x, CardPart.Thumb, { url: row.thumb, video: false }, { x: PAD + ROW_THUMB + ROW_GAP, y: mid - ROW_THUMB / 2, w: ROW_THUMB, h: ROW_THUMB }, Fit.Cover, i)] : [];
    const dot = row.status && ROW_STATUS[row.status] ? [solid(x.clip(CardPart.Status), at(c, circle(c.w - PAD - DOT_RADIUS, mid, DOT_RADIUS)), ROW_STATUS[row.status](theme))] : [];
    return [...text(x, CardPart.Row, row.lead, HEAD_SIZE, theme.inkSoft, PAD, mid - HEAD_SIZE * 0.6, null), ...thumb, ...text(x, CardPart.Row, row.text, HEAD_SIZE, theme.ink, textLeft, mid - HEAD_SIZE * 0.6, c.w - textLeft - PAD - DOT_RADIUS * 2 - ROW_GAP, HEAD_SIZE * 1.3), ...dot];
  });
}

const list = (x: Ctx): Item[] => [...panel(x), ...head(x, x.c.face.pills, 0), ...rows(x)];

const doc = (x: Ctx): Item[] => [...panel(x), ...head(x, x.c.face.pills, 0), ...text(x, CardPart.Body, markdownText(x.c.face.text), BODY_SIZE, x.theme.ink, PAD, HEAD_H + ROW_GAP + PAD / 2, x.c.w - PAD * 2, x.c.h - HEAD_H - ROW_GAP - PAD * 1.5)];

const SURFACES: Record<Surface, (x: Ctx) => Item[]> = {
  [Surface.Media]: (x) => [...panel(x), ...(x.c.face.media ? [image(x, CardPart.Media, x.c.face.media, whole(x.c), Fit.Contain)] : [])],
  [Surface.Frame]: frame,
  [Surface.Graphic]: (x) => (x.c.face.media ? [image(x, CardPart.Media, x.c.face.media, whole(x.c), Fit.Contain)] : []),
  [Surface.Generate]: generate,
  [Surface.Text]: (x) => [...panel(x), ...body(x, x.c.face.text, PAD)],
  [Surface.Source]: source,
  [Surface.Preview]: previewItems,
  [Surface.Person]: personItems,
  [Surface.Empty]: emptyItems,
  [Surface.Pick]: pickItems,
  [Surface.List]: list,
  [Surface.Doc]: doc,
  [Surface.Blank]: (x) => panel(x)
};

export function cardItems(c: CoreCard, theme: CoreTheme, glyphs: Glyphs, bold: Glyphs = glyphs, icons: CardIcons | null = null): Item[] {
  const x: Ctx = { c, theme, glyphs, bold, icons, clip: (p) => `${c.id}:${p}` };
  const drawn = live(x);
  if (drawn) {
    return drawn;
  }
  return SURFACES[c.face.surface](x);
}
