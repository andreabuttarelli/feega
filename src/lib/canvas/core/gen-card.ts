import type { PathItem } from '$lib/motion/gpu-full/display-list';
import { FillRule } from '$lib/motion/gpu-full/paint';
import type { GenButton, GenTileView } from '$lib/canvas/gen-tile-view';
import type { Box } from '$lib/canvas/gpu/geometry';
import type { Glyphs, TextSet } from './chrome';
import type { CoreTheme } from './overlay';
import { mix } from '$lib/canvas/gpu/theme';
import { line, rect, roundRect, solid } from './shapes';

export enum GenPart {
  Panel = 'gen-panel',
  Body = 'gen-body',
  Hint = 'gen-hint',
  Dots = 'gen-dots',
  Unlock = 'gen-unlock',
  FailTitle = 'gen-fail-title',
  FailWhy = 'gen-fail-why',
  Toggle = 'gen-toggle',
  Output = 'gen-output',
  Mark = 'gen-mark',
  Past = 'gen-past',
  References = 'gen-refs',
  Footer = 'gen-foot',
  Prompt = 'gen-prompt',
  PromptText = 'gen-prompt-text',
  Warn = 'gen-warn',
  Loop = 'gen-loop',
  Run = 'gen-run'
}

export type GenIcons = { references: number[][]; credit: number[][] };

export type GenKit = { theme: CoreTheme; glyphs: Glyphs; bold: Glyphs; icons: GenIcons };

type At = Box & { id: string };

type Ctx = GenKit & { c: At; clip: (p: GenPart, n?: number) => string };

const TRACK = -0.8;
const BORDER = 1;
const SHADOW_DROP = 2;
const SHADOW_OPACITY = 0.06;
const SHADOW = '#000000';
const FOOT_PAD = { top: 8, side: 9, bottom: 9 };
const PROMPT = { size: 12.5, leading: 1.45, padX: 8, padY: 6, rows: 2 };
const ACTIONS_GAP = 13;
const BUTTON = { size: 12, leading: 1.5, padX: 12, height: 28.3, gap: 8 };
const CREDIT = { icon: 12.6, gap: 3.6 };
const WARN = { size: 11, leading: 1.5 };
const FAIL_WARN = '#c0392b';
const DISABLED = 0.35;
const HINT = { size: 12, leading: 1.5 };
const DOTS = { size: 6, gap: 5, below: 10, opacity: 0.25 };
const SMALL = { size: 11.5, leading: 1.5, padX: 12, padY: 4 };
const FAIL = { title: 12.5, titleLeading: 1.5, why: 11, whyLeading: 1.4, gap: 6, whyWidth: 135 };
const REFS = { band: 45, pad: 6, height: 32, padX: 8, gap: 6, icon: 14, size: 12, radius: 4, leading: 16 / 12 };
const PAST = { band: 30.75, padX: 9, padY: 5, size: 10.5, leading: 1.5, padCell: 5, min: 20, gap: 4 };
const TOGGLE = { height: 24.8, size: 10.5, leading: 1.5 };
const OUTPUT = { pad: 12, size: 12, leading: 1.5 };
const MARK = { inset: 7, below: 5, height: 16, padX: 6, size: 10, radius: 4, fill: '#000000', fillAlpha: 0.6, ink: '#ffffff' };
const PLACEHOLDER_ALPHA = 0.55;
const MARK_TEXT = 'AI-generated';
const ADD_REFERENCES = 'Add references';
const UNLOCK = 'Sblocca';
const RETRY = 'Try again';
const TOGGLE_LABELS = ['Markdown', 'Raw'];

const at = (x: Ctx, contours: number[][]) => contours.map((k) => k.map((v, i) => (i % 2 === 0 ? v + x.c.x : v + x.c.y)));
const box = (x: Ctx, b: Box) => at(x, [rect(b.x, b.y, b.w, b.h)]);
const frame = (x: Ctx, b: Box) => at(x, line(rect(b.x + BORDER / 2, b.y + BORDER / 2, b.w - BORDER, b.h - BORDER), BORDER, true));

function words(x: Ctx, s: string, size: number, set: TextSet = {}, font: Glyphs = x.glyphs) {
  return font(s, size, { tracking: TRACK, ...set });
}

function write(x: Ctx, part: GenPart, s: string, size: number, colour: string, left: number, top: number, set: TextSet = {}, font: Glyphs = x.glyphs, opacity = 1): PathItem[] {
  if (!s) {
    return [];
  }
  const laid = words(x, s, size, set, font);
  const contours = at(x, laid.contours.map((k) => k.map((v, i) => (i % 2 === 0 ? v + left : v + top))));
  return [{ ...solid(x.clip(part), contours, colour, opacity), scissor: [x.c.x, x.c.y, x.c.x + x.c.w, x.c.y + x.c.h] }];
}

const centred = (x: Ctx, s: string, size: number, set: TextSet, font: Glyphs = x.glyphs) => words(x, s, size, set, font).width;

function buttonWidth(x: Ctx, b: GenButton): number {
  const label = words(x, `${b.label}${b.credits ? ' · ' : ''}`, BUTTON.size, { leading: BUTTON.leading }).width;
  const credits = b.credits ? CREDIT.icon + CREDIT.gap + words(x, b.credits, BUTTON.size, { leading: BUTTON.leading }).width : 0;
  return BUTTON.padX * 2 + label + credits;
}

function button(x: Ctx, part: GenPart, b: GenButton, right: number, mid: number, primary: boolean): { items: PathItem[]; left: number } {
  const { theme } = x;
  const w = buttonWidth(x, b);
  const textH = BUTTON.size * BUTTON.leading;
  const h = BUTTON.height + (primary ? 0 : 2 * BORDER);
  const left = right - w;
  const top = mid - h / 2;
  const tone = (colour: string) => (b.enabled ? colour : mix(colour, theme.paper, DISABLED));
  const ink = tone(primary ? theme.paper : theme.ink);
  const fill = tone(primary ? theme.ink : theme.paper);
  const label = `${b.label}${b.credits ? ' · ' : ''}`;
  const labelW = words(x, label, BUTTON.size, { leading: BUTTON.leading }).width;
  const textTop = mid - textH / 2;
  const iconLeft = left + BUTTON.padX + labelW;
  const credit = b.credits
    ? [
        { ...solid(x.clip(part, 3), at(x, x.icons.credit.map((k) => k.map((v, i) => (i % 2 === 0 ? v + iconLeft : v + mid - CREDIT.icon / 2)))), tone(theme.inkSoft)), rule: FillRule.Union },
        ...write(x, part, b.credits, BUTTON.size, ink, iconLeft + CREDIT.icon + CREDIT.gap, textTop, { leading: BUTTON.leading }).map((i) => ({ ...i, clip: x.clip(part, 4) }))
      ]
    : [];
  const border = primary ? [] : [{ ...solid(x.clip(part, 1), frame(x, { x: left, y: top, w, h }), tone(theme.line2)) }];
  return {
    left,
    items: [solid(x.clip(part), box(x, { x: left, y: top, w, h }), fill), ...border, ...write(x, part, label, BUTTON.size, ink, left + BUTTON.padX, textTop, { leading: BUTTON.leading }).map((i) => ({ ...i, clip: x.clip(part, 2) })), ...credit]
  };
}

function small(x: Ctx, part: GenPart, s: string, cx: number, top: number): PathItem[] {
  const { theme } = x;
  const w = centred(x, s, SMALL.size, { leading: SMALL.leading }) + SMALL.padX * 2;
  const h = SMALL.size * SMALL.leading + SMALL.padY * 2 + 2 * BORDER;
  const left = cx - w / 2;
  return [solid(x.clip(part), box(x, { x: left, y: top, w, h }), theme.paper), solid(x.clip(part, 1), frame(x, { x: left, y: top, w, h }), theme.line2), ...write(x, part, s, SMALL.size, theme.ink, left + SMALL.padX, top + BORDER + SMALL.padY, { leading: SMALL.leading }).map((i) => ({ ...i, clip: x.clip(part, 2) }))];
}

const smallHeight = () => SMALL.size * SMALL.leading + SMALL.padY * 2 + 2 * BORDER;

function hint(x: Ctx, v: GenTileView, b: Box): PathItem[] {
  const w = centred(x, v.hint, HINT.size, { leading: HINT.leading });
  return write(x, GenPart.Hint, v.hint, HINT.size, x.theme.inkSoft, b.x + (b.w - w) / 2, b.y + (b.h - HINT.size * HINT.leading) / 2, { leading: HINT.leading });
}

function busy(x: Ctx, b: Box): PathItem[] {
  const total = DOTS.size + DOTS.below + smallHeight();
  const top = b.y + (b.h - total) / 2;
  const cx = b.x + b.w / 2;
  const row = 3 * DOTS.size + 2 * DOTS.gap;
  const dots = [0, 1, 2].map((i) => solid(x.clip(GenPart.Dots, i), box(x, { x: cx - row / 2 + i * (DOTS.size + DOTS.gap), y: top, w: DOTS.size, h: DOTS.size }), x.theme.accent, DOTS.opacity));
  return [...dots, ...small(x, GenPart.Unlock, UNLOCK, cx, top + DOTS.size + DOTS.below)];
}

function failed(x: Ctx, v: GenTileView, b: Box): PathItem[] {
  const { theme } = x;
  const why = v.error ? words(x, v.error, FAIL.why, { leading: FAIL.whyLeading, width: FAIL.whyWidth }) : null;
  const titleH = FAIL.title * FAIL.titleLeading;
  const total = titleH + (why ? FAIL.gap + why.height : 0) + FAIL.gap + smallHeight();
  const top = b.y + (b.h - total) / 2;
  const cx = b.x + b.w / 2;
  const titleW = centred(x, 'Failed', FAIL.title, { leading: FAIL.titleLeading }, x.bold);
  const title = write(x, GenPart.FailTitle, 'Failed', FAIL.title, theme.ink, cx - titleW / 2, top, { leading: FAIL.titleLeading }, x.bold);
  const whyTop = top + titleH + FAIL.gap;
  const reason = why && v.error ? write(x, GenPart.FailWhy, v.error, FAIL.why, theme.inkSoft, cx - why.width / 2, whyTop, { leading: FAIL.whyLeading, width: FAIL.whyWidth }) : [];
  const buttonTop = (why ? whyTop + why.height : top + titleH) + FAIL.gap;
  return [...title, ...reason, ...small(x, GenPart.Unlock, RETRY, cx, buttonTop)];
}

function output(x: Ctx, text: string, b: Box): PathItem[] {
  const { theme } = x;
  const half = b.w / 2;
  const toggle = [
    solid(x.clip(GenPart.Toggle), box(x, { x: b.x, y: b.y, w: b.w, h: TOGGLE.height }), theme.paper),
    solid(x.clip(GenPart.Toggle, 1), box(x, { x: b.x, y: b.y, w: half, h: TOGGLE.height - BORDER }), theme.paper2),
    ...TOGGLE_LABELS.flatMap((l, i) => {
      const w = centred(x, l, TOGGLE.size, { leading: TOGGLE.leading }, x.bold);
      return write(x, GenPart.Toggle, l, TOGGLE.size, i ? theme.inkSoft : theme.ink, b.x + i * half + (half - w) / 2, b.y + (TOGGLE.height - BORDER - TOGGLE.size * TOGGLE.leading) / 2, { leading: TOGGLE.leading }, x.bold).map((it) => ({ ...it, clip: x.clip(GenPart.Toggle, 2 + i) }));
    })
  ];
  const top = b.y + TOGGLE.height + OUTPUT.pad;
  const body = write(x, GenPart.Output, text, OUTPUT.size, theme.ink, b.x + OUTPUT.pad, top, { leading: OUTPUT.leading, width: b.w - 2 * OUTPUT.pad, height: b.y + b.h - top });
  return [...toggle, ...body];
}

function mark(x: Ctx, b: Box): PathItem[] {
  const markW = centred(x, MARK_TEXT, MARK.size, { leading: MARK.height / MARK.size }) + 2 * MARK.padX;
  const markTop = b.y + b.h - MARK.below - MARK.height;
  return [
    solid(x.clip(GenPart.Mark), at(x, roundRect(b.x + MARK.inset - BORDER, markTop, markW, MARK.height, MARK.radius)), MARK.fill, MARK.fillAlpha),
    ...write(x, GenPart.Mark, MARK_TEXT, MARK.size, MARK.ink, b.x + MARK.inset - BORDER + MARK.padX, markTop, { leading: MARK.height / MARK.size }).map((i) => ({ ...i, clip: x.clip(GenPart.Mark, 1) }))
  ];
}

const BODIES: Record<GenTileView['state'], (x: Ctx, v: GenTileView, b: Box) => PathItem[]> = {
  empty: (x, v, b) => hint(x, v, b),
  ready: (x, v, b) => hint(x, v, b),
  running: (x, _v, b) => busy(x, b),
  failed: (x, v, b) => failed(x, v, b),
  done: (x, v, b) => (v.medium === 'text' ? output(x, v.output ?? '', b) : [])
};

function past(x: Ctx, v: GenTileView, top: number): PathItem[] {
  const { theme } = x;
  const items: PathItem[] = [solid(x.clip(GenPart.Past), box(x, { x: BORDER, y: top, w: x.c.w - 2 * BORDER, h: BORDER }), theme.line)];
  let left = BORDER + PAST.padX;
  const cellTop = top + BORDER + PAST.padY;
  const cellH = PAST.size * PAST.leading + 2 * BORDER;
  for (let i = 0; i < v.runs; i++) {
    const label = String(i + 1);
    const tw = words(x, label, PAST.size, { leading: PAST.leading }).width;
    const w = Math.max(PAST.min, tw + 2 * PAST.padCell + 2 * BORDER);
    const on = i === v.shown;
    items.push(
      solid(x.clip(GenPart.Past, 3 * i + 1), box(x, { x: left, y: cellTop, w, h: cellH }), on ? theme.ink : theme.paper2),
      solid(x.clip(GenPart.Past, 3 * i + 2), frame(x, { x: left, y: cellTop, w, h: cellH }), on ? theme.ink : theme.line2),
      ...write(x, GenPart.Past, label, PAST.size, on ? theme.paper : theme.inkSoft, left + (w - tw) / 2, cellTop + BORDER, { leading: PAST.leading }).map((it) => ({ ...it, clip: x.clip(GenPart.Past, 3 * i + 3) }))
    );
    left += w + PAST.gap;
  }
  return items;
}

function references(x: Ctx, top: number): PathItem[] {
  const { theme } = x;
  const label = words(x, ADD_REFERENCES, REFS.size, { leading: REFS.leading }, x.bold);
  const w = REFS.padX * 2 + REFS.icon + REFS.gap + label.width;
  const b = { x: BORDER + REFS.pad, y: top + BORDER + REFS.pad, w, h: REFS.height };
  const iconTop = b.y + (REFS.height - REFS.icon) / 2;
  return [
    solid(x.clip(GenPart.References), box(x, { x: BORDER, y: top, w: x.c.w - 2 * BORDER, h: BORDER }), theme.line),
    solid(x.clip(GenPart.References, 1), at(x, roundRect(b.x, b.y, b.w, b.h, REFS.radius)), theme.chip),
    { ...solid(x.clip(GenPart.References, 2), at(x, x.icons.references.map((k) => k.map((v, i) => (i % 2 === 0 ? v + b.x + REFS.padX : v + iconTop)))), theme.chipInk), rule: FillRule.Union },
    ...write(x, GenPart.References, ADD_REFERENCES, REFS.size, theme.chipInk, b.x + REFS.padX + REFS.icon + REFS.gap, b.y + (REFS.height - REFS.size * REFS.leading) / 2, { leading: REFS.leading }, x.bold).map((i) => ({ ...i, clip: x.clip(GenPart.References, 3) }))
  ];
}

const actionsHeight = (v: GenTileView) => BUTTON.height + (v.loop ? 2 * BORDER : 0);

function actions(x: Ctx, v: GenTileView, top: number): PathItem[] {
  const right = x.c.w - BORDER - FOOT_PAD.side;
  const mid = top + actionsHeight(v) / 2;
  const run = button(x, GenPart.Run, v.run, right, mid, true);
  const loop = v.loop ? button(x, GenPart.Loop, v.loop, run.left - BUTTON.gap, mid, false) : null;
  const edge = (loop ?? run).left - BUTTON.gap;
  const warn = v.warn ? words(x, v.warn.text, WARN.size, { leading: WARN.leading }) : null;
  const warned = v.warn && warn ? write(x, GenPart.Warn, v.warn.text, WARN.size, v.warn.soft ? x.theme.inkSoft : FAIL_WARN, edge - warn.width, mid - (WARN.size * WARN.leading) / 2, { leading: WARN.leading }) : [];
  return [...warned, ...(loop?.items ?? []), ...run.items];
}

const promptRows = () => PROMPT.size * PROMPT.leading * PROMPT.rows + PROMPT.padY * 2 + 2 * BORDER;

function footer(x: Ctx, v: GenTileView, top: number): PathItem[] {
  const { c, theme } = x;
  const inner = { x: BORDER + FOOT_PAD.side, w: c.w - 2 * BORDER - 2 * FOOT_PAD.side };
  const promptTop = top + BORDER + FOOT_PAD.top;
  const promptH = v.hasBody ? promptRows() : c.h - BORDER - FOOT_PAD.bottom - actionsHeight(v) - ACTIONS_GAP - promptTop;
  const p = { x: inner.x, y: promptTop, w: inner.w, h: promptH };
  const typed = !!v.prompt;
  const textTop = p.y + BORDER + PROMPT.padY;
  const text = write(x, GenPart.PromptText, typed ? v.prompt : v.placeholder, PROMPT.size, theme.ink, p.x + BORDER + PROMPT.padX, textTop, { leading: PROMPT.leading, width: p.w - 2 * (BORDER + PROMPT.padX), height: p.y + p.h - BORDER - textTop }, x.glyphs, typed ? 1 : PLACEHOLDER_ALPHA);
  const rule = [solid(x.clip(GenPart.Footer), box(x, { x: BORDER, y: top, w: c.w - 2 * BORDER, h: BORDER }), theme.line)];
  return [...rule, solid(x.clip(GenPart.Prompt), box(x, p), theme.paper2), solid(x.clip(GenPart.Prompt, 1), frame(x, p), theme.line2), ...text, ...actions(x, v, p.y + p.h + ACTIONS_GAP)];
}

const footHeight = (v: GenTileView) => BORDER + FOOT_PAD.top + promptRows() + ACTIONS_GAP + actionsHeight(v) + FOOT_PAD.bottom;

function panel(x: Ctx, running: boolean): PathItem[] {
  const { c, theme } = x;
  const border = running ? [] : [solid(x.clip(GenPart.Panel, 2), frame(x, { x: 0, y: 0, w: c.w, h: c.h }), theme.line)];
  return [solid(x.clip(GenPart.Panel), box(x, { x: 0, y: SHADOW_DROP, w: c.w, h: c.h }), SHADOW, SHADOW_OPACITY), solid(x.clip(GenPart.Panel, 1), box(x, { x: 0, y: 0, w: c.w, h: c.h }), theme.paper), ...border];
}

function bands(c: Box, v: GenTileView) {
  const refs = v.hasBody && v.medium !== 'text' ? REFS.band : 0;
  const strip = v.runs > 1 ? PAST.band : 0;
  const foot = c.h - BORDER - footHeight(v);
  return { refs, strip, foot, body: { x: BORDER, y: BORDER, w: c.w - 2 * BORDER, h: foot - strip - refs - BORDER } };
}

export const genBody = (c: Box, v: GenTileView): Box => bands(c, v).body;

export function genMark(c: At, v: GenTileView, kit: GenKit): PathItem[] {
  if (v.state !== 'done') {
    return [];
  }
  const x: Ctx = { ...kit, c, clip: (p, n) => (n ? `${c.id}:${p}:${n}` : `${c.id}:${p}`) };
  return mark(x, bands(c, v).body);
}

export function genItems(c: At, v: GenTileView, kit: GenKit): PathItem[] {
  const x: Ctx = { ...kit, c, clip: (p, n) => (n ? `${c.id}:${p}:${n}` : `${c.id}:${p}`) };
  const { refs, strip, foot, body: bodyBox } = bands(c, v);
  const body = v.hasBody ? [solid(x.clip(GenPart.Body), box(x, bodyBox), kit.theme.paper2), ...BODIES[v.state](x, v, bodyBox)] : [];
  const history = strip ? past(x, v, foot - strip - refs) : [];
  const refsBand = refs ? references(x, foot - refs) : [];
  return [...panel(x, v.state === 'running'), ...body, ...history, ...refsBand, ...footer(x, v, v.hasBody ? foot : BORDER)];
}
