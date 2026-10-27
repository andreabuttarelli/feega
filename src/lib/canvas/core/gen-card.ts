import type { PathItem } from '@feega/motion-core/motion/gpu-full/display-list';
import { FillRule } from '@feega/motion-core/motion/gpu-full/paint';
import type { GenButton, GenTileView } from '$lib/canvas/gen-tile-view';
import type { Box } from '$lib/canvas/gpu/geometry';
import type { Glyphs, TextSet } from './chrome';
import type { CoreTheme } from './overlay';
import { mix } from '$lib/canvas/gpu/theme';
import { AudioFieldKind } from '$lib/canvas/audio-form';
import { circle, line, rect, roundRect, solid } from './shapes';

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
  Run = 'gen-run',
  Form = 'gen-form'
}

export type GenIcons = { references: number[][]; credit: number[][]; chevron: number[][]; voicePlay: number[][] };

export type GenKit = { theme: CoreTheme; glyphs: Glyphs; bold: Glyphs; icons: GenIcons };

type At = Box & { id: string };

type Ctx = GenKit & { c: At; clip: (p: GenPart, n?: number) => string };

const TRACK = -0.8;
const BORDER = 1;
const SHADOW_DROP = 2;
const SHADOW_OPACITY = 0.06;
const SHADOW = '#000000';
export const CARD_RADIUS = 10;
const INSET = 6;
const WELL_RADIUS = 6;
const FOOT_PAD = { top: 6, side: INSET, bottom: INSET };
const PROMPT = { size: 12.5, leading: 1.45, padX: 10, padY: 8, rows: 2 };
const ACTIONS_GAP = 6;
const BUTTON = { size: 12, leading: 1.5, padX: 10, height: 28, gap: 6, radius: WELL_RADIUS };
const BAR = { inset: 8, height: 40, radius: WELL_RADIUS, pad: 6, textPad: 4, tool: 28, alpha: 0.94 };
const COMPACT_MEDIA: ReadonlySet<GenTileView['medium']> = new Set(['text', 'image', 'video']);

export const cardRadiusOf = (kind: string): number | undefined => (COMPACT_MEDIA.has(kind as GenTileView['medium']) ? CARD_RADIUS : undefined);
const CREDIT = { icon: 12.6, gap: 3.6 };
const CREDIT_ALPHA = 0.75;
const WARN = { size: 11, leading: 1.5 };
const FAIL_WARN = '#c0392b';
const DISABLED = 0.35;
const ON_ACCENT = '#ffffff';
const HINT = { size: 12, leading: 1.5 };
const DOTS = { size: 6, gap: 5, below: 12, opacity: 0.6 };
const SMALL = { size: 11.5, leading: 1.5, padX: 12, padY: 4, radius: WELL_RADIUS };
const FAIL = { title: 12.5, titleLeading: 1.5, why: 11, whyLeading: 1.4, gap: 6, whyWidth: 135 };
const REFS = { band: 44, pad: 6, height: 32, padX: 10, gap: 6, icon: 14, size: 12, radius: WELL_RADIUS, leading: 16 / 12 };
const PAST = { band: 30, padX: INSET, padY: 5, size: 10.5, leading: 1.5, padCell: 7, min: 22, gap: 4 };
const TOGGLE = { height: 24.8, size: 10.5, leading: 1.5 };
const OUTPUT = { pad: 12, size: 12, leading: 1.5 };
const MARK = { inset: 7, below: 5, height: 16, padX: 6, size: 10, radius: 4, fill: '#000000', fillAlpha: 0.6, ink: '#ffffff' };
const FORM = { padX: 9, padY: 7, gapX: 8, gapY: 6, size: 11, leading: 1.5, label: 2, select: { padX: 4, padY: 3 }, play: 24, playGap: 4, track: 4, thumb: 16, slider: 16, disabled: 0.35, trackRest: 0.85, chevron: 12 };
const MORE_VOICES_FALLBACK = 'More voices';
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
  const h = BUTTON.height;
  const left = right - w;
  const top = mid - h / 2;
  const tone = (colour: string) => (b.enabled ? colour : mix(colour, theme.paper, DISABLED));
  const ink = tone(primary ? ON_ACCENT : theme.ink);
  const fill = tone(primary ? theme.accent : theme.paper2);
  const label = `${b.label}${b.credits ? ' · ' : ''}`;
  const labelW = words(x, label, BUTTON.size, { leading: BUTTON.leading }).width;
  const textTop = mid - textH / 2;
  const iconLeft = left + BUTTON.padX + labelW;
  const credit = b.credits
    ? [
        { ...solid(x.clip(part, 3), at(x, x.icons.credit.map((k) => k.map((v, i) => (i % 2 === 0 ? v + iconLeft : v + mid - CREDIT.icon / 2)))), ink, CREDIT_ALPHA), rule: FillRule.Union },
        ...write(x, part, b.credits, BUTTON.size, ink, iconLeft + CREDIT.icon + CREDIT.gap, textTop, { leading: BUTTON.leading }).map((i) => ({ ...i, clip: x.clip(part, 4) }))
      ]
    : [];
  return {
    left,
    items: [solid(x.clip(part), at(x, roundRect(left, top, w, h, BUTTON.radius)), fill), ...write(x, part, label, BUTTON.size, ink, left + BUTTON.padX, textTop, { leading: BUTTON.leading }).map((i) => ({ ...i, clip: x.clip(part, 2) })), ...credit]
  };
}

function small(x: Ctx, part: GenPart, s: string, cx: number, top: number): PathItem[] {
  const { theme } = x;
  const w = centred(x, s, SMALL.size, { leading: SMALL.leading }) + SMALL.padX * 2;
  const h = SMALL.size * SMALL.leading + SMALL.padY * 2 + 2 * BORDER;
  const left = cx - w / 2;
  return [solid(x.clip(part), at(x, roundRect(left, top, w, h, SMALL.radius)), theme.line2), solid(x.clip(part, 1), at(x, roundRect(left + BORDER, top + BORDER, w - 2 * BORDER, h - 2 * BORDER, SMALL.radius - BORDER)), theme.paper), ...write(x, part, s, SMALL.size, theme.ink, left + SMALL.padX, top + BORDER + SMALL.padY, { leading: SMALL.leading }).map((i) => ({ ...i, clip: x.clip(part, 2) }))];
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
  const dots = [0, 1, 2].map((i) => solid(x.clip(GenPart.Dots, i), at(x, circle(cx - row / 2 + i * (DOTS.size + DOTS.gap) + DOTS.size / 2, top + DOTS.size / 2, DOTS.size / 2)), x.theme.accent, DOTS.opacity));
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
  const items: PathItem[] = [];
  let left = PAST.padX;
  const cellTop = top + PAST.padY;
  const cellH = PAST.size * PAST.leading + 2 * BORDER + 2;
  for (let i = 0; i < v.runs; i++) {
    const label = String(i + 1);
    const tw = words(x, label, PAST.size, { leading: PAST.leading }).width;
    const w = Math.max(PAST.min, tw + 2 * PAST.padCell + 2 * BORDER);
    const on = i === v.shown;
    items.push(
      solid(x.clip(GenPart.Past, 3 * i + 1), at(x, roundRect(left, cellTop, w, cellH, cellH / 2)), on ? theme.ink : theme.paper2),
      ...write(x, GenPart.Past, label, PAST.size, on ? theme.paper : theme.inkSoft, left + (w - tw) / 2, cellTop + BORDER + 1, { leading: PAST.leading }).map((it) => ({ ...it, clip: x.clip(GenPart.Past, 3 * i + 3) }))
    );
    left += w + PAST.gap;
  }
  return items;
}

function selectBox(x: Ctx, part: GenPart, b: Box, label: string, nth: number, withArrow = true): PathItem[] {
  const { theme } = x;
  const arrow = withArrow ? [{ ...solid(x.clip(part, nth + 3), at(x, x.icons.chevron.map((k) => k.map((v, i) => (i % 2 === 0 ? v + b.x + b.w - FORM.select.padX - FORM.chevron : v + b.y + (b.h - FORM.chevron) / 2)))), theme.ink), rule: FillRule.Union }] : [];
  return [
    solid(x.clip(part, nth), box(x, b), theme.paper2),
    solid(x.clip(part, nth + 1), frame(x, b), theme.line2),
    ...write(x, part, label, FORM.size, theme.ink, b.x + BORDER + FORM.select.padX, b.y + BORDER + FORM.select.padY, { leading: FORM.leading, width: b.w - 2 * (BORDER + FORM.select.padX) - (withArrow ? FORM.chevron : 0), height: FORM_LINE }).map((i) => ({ ...i, clip: x.clip(part, nth + 2) })),
    ...arrow
  ];
}

function slider(x: Ctx, b: Box, ratio: number, nth: number): PathItem[] {
  const { theme } = x;
  const mid = b.y + b.h / 2;
  const track = { x: b.x, y: mid - FORM.track / 2, w: b.w, h: FORM.track };
  const knob = b.x + FORM.thumb / 2 + (b.w - FORM.thumb) * Math.min(1, Math.max(0, ratio));
  return [
    solid(x.clip(GenPart.Form, nth), at(x, roundRect(track.x, track.y, track.w, track.h, FORM.track / 2)), theme.ink, FORM.trackRest),
    solid(x.clip(GenPart.Form, nth + 1), at(x, roundRect(track.x, track.y, knob - track.x, track.h, FORM.track / 2)), theme.accent),
    solid(x.clip(GenPart.Form, nth + 2), at(x, circle(knob, mid, FORM.thumb / 2)), theme.accent)
  ];
}

function form(x: Ctx, v: GenTileView, top: number): PathItem[] {
  const { c, theme } = x;
  const colW = (c.w - 2 * BORDER - 2 * FORM.padX - FORM.gapX) / 2;
  const items: PathItem[] = [solid(x.clip(GenPart.Form), box(x, { x: BORDER, y: top, w: c.w - 2 * BORDER, h: BORDER }), theme.line)];
  let y = top + BORDER + FORM.padY;
  formRows(v).forEach((row, r) => {
    const h = Math.max(...row.map(formCellHeight));
    row.forEach((f, i) => {
      const left = BORDER + FORM.padX + i * (colW + FORM.gapX);
      const nth = 10 * (2 * r + i + 1);
      const labelled = f.kind !== AudioFieldKind.More;
      const body = labelled ? y + FORM_LINE + FORM.label : y + h - FORM_SELECT_H;
      if (labelled) {
        items.push(...write(x, GenPart.Form, f.label, FORM.size, theme.inkSoft, left, y, { leading: FORM.leading }).map((it) => ({ ...it, clip: x.clip(GenPart.Form, nth) })));
      }
      if (f.kind === AudioFieldKind.Slider) {
        items.push(...slider(x, { x: left, y: body, w: colW, h: FORM.slider }, f.ratio, nth + 1));
      } else if (f.kind === AudioFieldKind.More) {
        items.push(solid(x.clip(GenPart.Form, nth + 1), box(x, { x: left, y: body, w: colW, h: FORM_SELECT_H }), theme.paper), solid(x.clip(GenPart.Form, nth + 2), frame(x, { x: left, y: body, w: colW, h: FORM_SELECT_H }), theme.line2), ...write(x, GenPart.Form, f.value || MORE_VOICES_FALLBACK, FORM.size, theme.ink, left + (colW - words(x, f.value || MORE_VOICES_FALLBACK, FORM.size, { leading: FORM.leading }).width) / 2, body + BORDER + FORM.select.padY, { leading: FORM.leading }).map((it) => ({ ...it, clip: x.clip(GenPart.Form, nth + 3) })));
      } else if (f.kind === AudioFieldKind.Voice) {
        const select = { x: left, y: body, w: colW - FORM.play - FORM.playGap, h: FORM_SELECT_H };
        const play = { x: left + colW - FORM.play, y: body, w: FORM.play, h: FORM_SELECT_H };
        items.push(...selectBox(x, GenPart.Form, select, f.value, nth + 1), solid(x.clip(GenPart.Form, nth + 6), box(x, play), theme.paper), solid(x.clip(GenPart.Form, nth + 7), frame(x, play), theme.line2), { ...solid(x.clip(GenPart.Form, nth + 8), at(x, x.icons.voicePlay.map((k) => k.map((p, j) => (j % 2 === 0 ? p + play.x + (FORM.play - 12) / 2 : p + play.y + (FORM_SELECT_H - 12) / 2)))), theme.ink, FORM.disabled), rule: FillRule.Union });
      } else {
        items.push(...selectBox(x, GenPart.Form, { x: left, y: body, w: colW, h: FORM_SELECT_H }, f.value, nth + 1, f.kind === AudioFieldKind.Select));
      }
    });
    y += h + FORM.gapY;
  });
  return items;
}

function references(x: Ctx, top: number): PathItem[] {
  const { theme } = x;
  const label = words(x, ADD_REFERENCES, REFS.size, { leading: REFS.leading }, x.bold);
  const w = REFS.padX * 2 + REFS.icon + REFS.gap + label.width;
  const b = { x: INSET, y: top + REFS.pad, w, h: REFS.height };
  const iconTop = b.y + (REFS.height - REFS.icon) / 2;
  return [
    solid(x.clip(GenPart.References), at(x, roundRect(b.x, b.y, b.w, b.h, REFS.radius)), theme.line2),
    solid(x.clip(GenPart.References, 1), at(x, roundRect(b.x + BORDER, b.y + BORDER, b.w - 2 * BORDER, b.h - 2 * BORDER, REFS.radius - BORDER)), theme.paper2),
    { ...solid(x.clip(GenPart.References, 2), at(x, x.icons.references.map((k) => k.map((v, i) => (i % 2 === 0 ? v + b.x + REFS.padX : v + iconTop)))), theme.inkSoft), rule: FillRule.Union },
    ...write(x, GenPart.References, ADD_REFERENCES, REFS.size, theme.ink, b.x + REFS.padX + REFS.icon + REFS.gap, b.y + (REFS.height - REFS.size * REFS.leading) / 2, { leading: REFS.leading }, x.bold).map((i) => ({ ...i, clip: x.clip(GenPart.References, 3) }))
  ];
}

const actionsHeight = () => BUTTON.height;

function actions(x: Ctx, v: GenTileView, top: number): PathItem[] {
  const right = x.c.w - FOOT_PAD.side;
  const mid = top + actionsHeight() / 2;
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
  const inner = { x: FOOT_PAD.side, w: c.w - 2 * FOOT_PAD.side };
  const promptTop = top + FOOT_PAD.top;
  const promptH = v.hasBody ? promptRows() : c.h - FOOT_PAD.bottom - actionsHeight() - ACTIONS_GAP - promptTop;
  const p = { x: inner.x, y: promptTop, w: inner.w, h: promptH };
  const typed = !!v.prompt;
  const textTop = p.y + BORDER + PROMPT.padY;
  const text = write(x, GenPart.PromptText, typed ? v.prompt : v.placeholder, PROMPT.size, typed ? theme.ink : theme.inkSoft, p.x + BORDER + PROMPT.padX, textTop, { leading: PROMPT.leading, width: p.w - 2 * (BORDER + PROMPT.padX), height: p.y + p.h - BORDER - textTop }, x.glyphs, typed ? 1 : PLACEHOLDER_ALPHA);
  return [solid(x.clip(GenPart.Prompt), at(x, roundRect(p.x, p.y, p.w, p.h, WELL_RADIUS)), theme.line), solid(x.clip(GenPart.Prompt, 1), at(x, roundRect(p.x + BORDER, p.y + BORDER, p.w - 2 * BORDER, p.h - 2 * BORDER, WELL_RADIUS - BORDER)), theme.paper2), ...text, ...actions(x, v, p.y + p.h + ACTIONS_GAP)];
}

const footHeight = () => FOOT_PAD.top + promptRows() + ACTIONS_GAP + actionsHeight() + FOOT_PAD.bottom;

function panel(x: Ctx, running: boolean): PathItem[] {
  const { c, theme } = x;
  const edge = running ? theme.accent : theme.line;
  return [
    solid(x.clip(GenPart.Panel), at(x, roundRect(0, SHADOW_DROP, c.w, c.h, CARD_RADIUS)), SHADOW, SHADOW_OPACITY),
    solid(x.clip(GenPart.Panel, 2), at(x, roundRect(0, 0, c.w, c.h, CARD_RADIUS)), edge),
    solid(x.clip(GenPart.Panel, 1), at(x, roundRect(BORDER, BORDER, c.w - 2 * BORDER, c.h - 2 * BORDER, CARD_RADIUS - BORDER)), theme.paper)
  ];
}

const FORM_LINE = FORM.size * FORM.leading;
const FORM_SELECT_H = FORM.select.padY * 2 + FORM_LINE + 2 * BORDER;

function formCellHeight(f: GenTileView['form'][number]): number {
  if (f.kind === AudioFieldKind.More) {
    return FORM_SELECT_H;
  }
  const control = f.kind === AudioFieldKind.Slider ? FORM.slider : FORM_SELECT_H;
  return FORM_LINE + FORM.label + control;
}

function formRows(v: GenTileView): GenTileView['form'][] {
  const rows: GenTileView['form'][] = [];
  v.form.forEach((f, i) => (i % 2 ? rows[rows.length - 1].push(f) : rows.push([f])));
  return rows;
}

const formHeight = (v: GenTileView) => (v.form.length ? BORDER + FORM.padY * 2 + formRows(v).reduce((a, r, i) => a + Math.max(...r.map(formCellHeight)) + (i ? FORM.gapY : 0), 0) : 0);

function bands(c: Box, v: GenTileView) {
  const refs = v.hasBody && v.medium !== 'text' ? (v.form.length ? formHeight(v) : REFS.band) : 0;
  const strip = v.runs > 1 ? PAST.band : 0;
  const foot = c.h - footHeight();
  return { refs, strip, foot, body: { x: INSET, y: INSET, w: c.w - 2 * INSET, h: foot - strip - refs - INSET } };
}

const isCompact = (v: GenTileView) => COMPACT_MEDIA.has(v.medium);

const showsBar = (v: GenTileView) => v.state !== 'done' || v.medium === 'text';

const barBox = (c: Box): Box => ({ x: BAR.inset, y: c.h - BAR.inset - BAR.height, w: c.w - 2 * BAR.inset, h: BAR.height });

const fullBody = (c: Box): Box => ({ x: BORDER, y: BORDER, w: c.w - 2 * BORDER, h: c.h - 2 * BORDER });

const aboveBar = (c: Box, v: GenTileView): Box => ({ ...fullBody(c), h: (showsBar(v) ? barBox(c).y : c.h - BORDER) - BORDER });

const PROMPT_LINE = PROMPT.size * PROMPT.leading;

function bar(x: Ctx, v: GenTileView): PathItem[] {
  const { c, theme } = x;
  const b = barBox(c);
  const mid = b.y + b.h / 2;
  const run = button(x, GenPart.Run, v.run, b.x + b.w - BAR.pad, mid, true);
  const loop = v.loop ? button(x, GenPart.Loop, v.loop, run.left - BUTTON.gap, mid, false) : null;
  const edge = (loop ?? run).left - BUTTON.gap;
  const typed = !!v.prompt;
  const takesRefs = v.medium !== 'text';
  const tool = { x: b.x + BAR.pad, y: mid - BAR.tool / 2, w: BAR.tool, h: BAR.tool };
  const refs = takesRefs
    ? [
        solid(x.clip(GenPart.References), at(x, roundRect(tool.x, tool.y, tool.w, tool.h, BAR.radius)), theme.paper2),
        { ...solid(x.clip(GenPart.References, 1), at(x, x.icons.references.map((k) => k.map((p, i) => (i % 2 === 0 ? p + tool.x + (BAR.tool - REFS.icon) / 2 : p + tool.y + (BAR.tool - REFS.icon) / 2)))), theme.inkSoft), rule: FillRule.Union }
      ]
    : [];
  const textLeft = (takesRefs ? tool.x + tool.w + BAR.pad : b.x + BAR.pad) + BAR.textPad;
  const prompt = v.hasBody
    ? write(x, GenPart.PromptText, typed ? v.prompt : v.placeholder, PROMPT.size, typed ? theme.ink : theme.inkSoft, textLeft, mid - PROMPT_LINE / 2, { leading: PROMPT.leading, width: edge - textLeft, height: PROMPT_LINE }, x.glyphs, typed ? 1 : PLACEHOLDER_ALPHA)
    : [];
  return [
    solid(x.clip(GenPart.Footer), at(x, roundRect(b.x, b.y, b.w, b.h, BAR.radius)), theme.line),
    solid(x.clip(GenPart.Prompt), at(x, roundRect(b.x + BORDER, b.y + BORDER, b.w - 2 * BORDER, b.h - 2 * BORDER, BAR.radius - BORDER)), theme.paper, BAR.alpha),
    ...refs,
    ...prompt,
    ...(loop?.items ?? []),
    ...run.items
  ];
}

function fullPrompt(x: Ctx, v: GenTileView): PathItem[] {
  const { c, theme } = x;
  const typed = !!v.prompt;
  const left = BAR.inset + BAR.pad + BAR.textPad;
  const top = BAR.inset + PROMPT.padY;
  return write(x, GenPart.PromptText, typed ? v.prompt : v.placeholder, PROMPT.size, typed ? theme.ink : theme.inkSoft, left, top, { leading: PROMPT.leading, width: c.w - 2 * left, height: barBox(c).y - top - BAR.inset }, x.glyphs, typed ? 1 : PLACEHOLDER_ALPHA);
}

function compactItems(x: Ctx, v: GenTileView): PathItem[] {
  const { c, theme } = x;
  const b = fullBody(c);
  const room = aboveBar(c, v);
  const body = v.hasBody ? [solid(x.clip(GenPart.Body), at(x, roundRect(b.x, b.y, b.w, b.h, CARD_RADIUS - BORDER)), theme.paper2), ...BODIES[v.state](x, v, room)] : [];
  const history = v.runs > 1 ? past(x, v, BAR.inset - PAST.padY) : [];
  const prompt = v.hasBody ? [] : fullPrompt(x, v);
  return [...panel(x, v.state === 'running'), ...body, ...prompt, ...history, ...(showsBar(v) ? bar(x, v) : [])];
}

export const genBody = (c: Box, v: GenTileView): Box => (isCompact(v) ? fullBody(c) : bands(c, v).body);

const MATTE_INK = '#000000';

export function genMatte(c: At, v: GenTileView): PathItem {
  const b = genBody(c, v);
  const radius = isCompact(v) ? CARD_RADIUS - BORDER : WELL_RADIUS;
  return solid(`${c.id}:${GenPart.Body}:matte`, roundRect(c.x + b.x, c.y + b.y, b.w, b.h, radius), MATTE_INK);
}

export function genMark(c: At, v: GenTileView, kit: GenKit): PathItem[] {
  if (v.state !== 'done') {
    return [];
  }
  const x: Ctx = { ...kit, c, clip: (p, n) => (n ? `${c.id}:${p}:${n}` : `${c.id}:${p}`) };
  return mark(x, genBody(c, v));
}

export function genItems(c: At, v: GenTileView, kit: GenKit): PathItem[] {
  const x: Ctx = { ...kit, c, clip: (p, n) => (n ? `${c.id}:${p}:${n}` : `${c.id}:${p}`) };
  if (isCompact(v)) {
    return compactItems(x, v);
  }
  const { refs, strip, foot, body: bodyBox } = bands(c, v);
  const body = v.hasBody ? [solid(x.clip(GenPart.Body), at(x, roundRect(bodyBox.x, bodyBox.y, bodyBox.w, bodyBox.h, WELL_RADIUS)), kit.theme.paper2), ...BODIES[v.state](x, v, bodyBox)] : [];
  const history = strip ? past(x, v, foot - strip - refs) : [];
  const refsBand = refs ? (v.form.length ? form(x, v, foot - refs) : references(x, foot - refs)) : [];
  return [...panel(x, v.state === 'running'), ...body, ...history, ...refsBand, ...footer(x, v, v.hasBody ? foot : 0)];
}
