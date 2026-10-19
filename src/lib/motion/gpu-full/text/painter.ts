import type { Affine } from '../../affine';
import { TYPE, type TextCase } from '../../components';
import { Ease } from '../../design';
import { safeBox } from '../../fit';
import { elementFills } from '../../fill/elements';
import { textPaint } from '../../fill/render';
import { fitSize } from '../../hyperframes/fit-runtime';
import type { Box } from '../../layout';
import { easeCurve } from '../../sample-track';
import { elementStrokes } from '../../stroke/elements';
import { TextSizing } from '../../text-sizing';
import { rgbaOf, type Rgba } from '../rgba';
import type { Face, FaceBook } from './face';
import { layOut, Spaces, type Flow, type Laid, type Type } from './layout';
import { clipped, contoursOf, dilated, type Rect } from './outline';

export type TextComponent = 'Title' | 'Text' | 'Kicker' | 'Caption';

export const TEXT_COMPONENTS: readonly TextComponent[] = ['Title', 'Text', 'Kicker', 'Caption'];

export enum TextGap {
  Font = 'font',
  Glyph = 'glyph',
  Fill = 'fill',
  Stroke = 'stroke'
}

export type Ink = { contours: number[][]; color: Rgba; opacity: number; matrix: Affine };

type Size = { width: number; height: number };

export enum Smoothing {
  Dilated = 'dilated',
  Plain = 'plain'
}

const STEM_DARKENING = 0.0121;
const MAX_DARKENING_PX = 0.3;
const DILATED_RISE_PX = 0.95;

const SMOOTHING: Record<Smoothing, { darken: (size: number) => number; rise: number }> = {
  [Smoothing.Dilated]: { darken: (size) => Math.min(MAX_DARKENING_PX, size * STEM_DARKENING), rise: DILATED_RISE_PX },
  [Smoothing.Plain]: { darken: () => 0, rise: 0 }
};

const DILATING_PLATFORM = /Macintosh|Mac OS X/;

export const smoothingOf = (userAgent: string): Smoothing => (DILATING_PLATFORM.test(userAgent) ? Smoothing.Dilated : Smoothing.Plain);

export type Typeset = { fonts: FaceBook; smoothing: Smoothing };

export const NO_TYPESET: Typeset = { fonts: () => null, smoothing: Smoothing.Plain };

export type TextEnv = {
  component: TextComponent;
  smoothing: Smoothing;
  props: Record<string, unknown>;
  box: Box;
  stage: Size;
  colour: (v: string) => string;
  time: number;
  trim: number;
  fps: number;
  still: number | null;
  fonts: FaceBook;
};

enum Motion {
  None = 'none',
  LinesRise = 'lines-rise',
  FadeUp = 'fade-up'
}

enum Anchor {
  Centre = 'centre',
  Top = 'top'
}

type Frame = { box: Box; anchor: Anchor; hugs: boolean };

type Kind = {
  size: (p: Props, unit: number) => number;
  paragraphs: (text: string) => string[];
  flow: (p: Props) => Flow;
  fits: (p: Props) => boolean;
  upper: boolean;
  inset: number;
  frame: (p: Props, box: Box, stage: Size) => Frame;
  motion: Motion;
};

type Props = Record<string, unknown> & { text: string; size: number; align: keyof typeof ALIGN_SHARE; sizing?: TextSizing; easing: Ease };

const ALIGN_SHARE = { left: 0, center: 0.5, right: 1 } as const;
const PERCENT = 100;
const rounded = (p: Props, unit: number) => Math.round(p.size * unit * PERCENT) / PERCENT;
const lines = (text: string) => text.split('\n');
const whole = (text: string) => [text];
const NORMAL: Flow = { spaces: Spaces.Collapse, wraps: true };
const centred = (_p: Props, box: Box): Frame => ({ box, anchor: Anchor.Centre, hugs: false });

const TEXT_FLOW: Record<TextSizing, Flow> = {
  [TextSizing.Fixed]: { spaces: Spaces.Keep, wraps: true },
  [TextSizing.AutoHeight]: { spaces: Spaces.Keep, wraps: true },
  [TextSizing.AutoWidth]: { spaces: Spaces.Keep, wraps: false }
};

const TEXT_FRAME: Record<TextSizing, Omit<Frame, 'box'>> = {
  [TextSizing.Fixed]: { anchor: Anchor.Centre, hugs: false },
  [TextSizing.AutoHeight]: { anchor: Anchor.Top, hugs: false },
  [TextSizing.AutoWidth]: { anchor: Anchor.Top, hugs: true }
};

const sizingOf = (p: Props) => p.sizing ?? TextSizing.Fixed;

const KINDS: Record<TextComponent, Kind> = {
  Title: { size: rounded, paragraphs: lines, flow: () => NORMAL, fits: () => true, upper: false, inset: 0, frame: (_p, box, stage) => ({ box: safeBox(box, stage), anchor: Anchor.Centre, hugs: false }), motion: Motion.LinesRise },
  Text: { size: rounded, paragraphs: lines, flow: (p) => TEXT_FLOW[sizingOf(p)], fits: (p) => sizingOf(p) === TextSizing.Fixed, upper: false, inset: 0, frame: (p, box) => ({ box, ...TEXT_FRAME[sizingOf(p)] }), motion: Motion.FadeUp },
  Kicker: { size: rounded, paragraphs: whole, flow: () => NORMAL, fits: () => true, upper: true, inset: 0, frame: centred, motion: Motion.None },
  Caption: { size: (p, unit) => p.size * unit, paragraphs: whole, flow: () => NORMAL, fits: () => true, upper: false, inset: 0.5, frame: centred, motion: Motion.None }
};

const CASE: Record<TextCase, (s: string) => string> = { 'as-typed': (s) => s, upper: (s) => s.toUpperCase(), lower: (s) => s.toLowerCase() };

const AXIS = /'([A-Za-z0-9]{4})' (-?\d+(?:\.\d+)?)/g;

function axesOf(p: Record<string, unknown>): Record<string, number> {
  const stretch = Number(p.stretch ?? TYPE.stretch.fallback);
  const slant = Number(p.slant ?? TYPE.slant.fallback);
  const extra = String(p.axes ?? '');
  if (stretch === TYPE.stretch.fallback && slant === TYPE.slant.fallback && !extra) {
    return {};
  }
  return { wdth: stretch, slnt: slant, ...Object.fromEntries([...extra.matchAll(AXIS)].map((m) => [m[1], Number(m[2])])) };
}

const REVEAL_FRAMES = 16;
const LINE_STAGGER = 5;
const FADE_FRAMES = 18;
const RISE_PERCENT = 105;
const FADE_RISE_PX = 16;
const DESCENDER_EM = 0.08;
const CAPTION_PAD_EM = 0.25;

type Tween = { at: number; duration: number };

function progress(env: TextEnv, tween: Tween, ease: Ease): number {
  const at = tween.at - env.trim;
  const end = at + tween.duration;
  if (end <= 0 || (env.still !== null && end > env.still)) {
    return 1;
  }
  const from = Math.max(0, at);
  return easeCurve(ease)(Math.min(1, Math.max(0, (env.time - from) / (end - from))));
}

const outlines = new WeakMap<Face, Map<string, number[][]>>();

function glyphContours(face: Face, glyph: number, size: number, skew: number, darken: number): number[][] {
  const cache = outlines.get(face) ?? new Map<string, number[][]>();
  outlines.set(face, cache);
  const key = `${glyph}:${size}:${skew}:${darken}`;
  const hit = cache.get(key);
  if (hit) {
    return hit;
  }
  const outline = contoursOf(face.outline(glyph), size / face.unitsPerEm, skew);
  const made = darken > 0 ? dilated(outline, darken) : outline;
  cache.set(key, made);
  return made;
}

const moved = (contours: number[][], dx: number, dy: number) => contours.map((c) => c.map((v, i) => v + (i % 2 === 0 ? dx : dy)));

const rect = ([l, t, r, b]: Rect) => [l, t, r, t, r, b, l, b];

type Placed = { laid: Laid; type: Type; frame: Frame; room: number };

function place(env: TextEnv, kind: Kind, p: Props, paragraphs: string[]): Placed {
  const frame = kind.frame(p, env.box, env.stage);
  const requested = kind.size(p, Math.min(env.stage.width, env.stage.height));
  const typeAt = (size: number): Type => ({
    request: { family: String(p.font), weight: Number(p.weight), italic: p.italic === true, axes: axesOf(p) },
    size,
    tracking: Number(p.tracking),
    leading: Number(p.leading),
    inset: kind.inset * size
  });
  const flow = kind.flow(p);
  const lay = (size: number) => layOut(paragraphs, typeAt(size), flow, frame.box.width, env.fonts);
  const size = kind.fits(p) ? fitSize(requested, (s) => lay(s), frame.box) : requested;
  const laid = lay(size);
  return { laid, type: typeAt(size), frame, room: frame.hugs ? laid.width : frame.box.width };
}

export function paintText(env: TextEnv): Ink[] | TextGap {
  const kind = KINDS[env.component];
  const p = env.props as Props;
  if (elementStrokes(env.component, p).some((s) => s.visible !== false)) {
    return TextGap.Stroke;
  }
  const paint = textPaint(elementFills(env.component, p), env.colour, () => null);
  const color = paint.backgroundImage ? null : rgbaOf(paint.color);
  if (!color) {
    return TextGap.Fill;
  }
  const cased = CASE[kind.upper ? 'upper' : ((p.textCase as TextCase) ?? 'as-typed')](p.text);
  const { laid, type, frame, room } = place(env, kind, p, kind.paragraphs(cased));
  if (!laid.blocks.some((b) => b.lines.length) || laid.ascent + laid.descent === 0) {
    return TextGap.Font;
  }
  if (laid.missing) {
    return TextGap.Glyph;
  }
  const left = frame.box.left - env.box.left;
  const top = frame.box.top - env.box.top + (frame.anchor === Anchor.Centre ? (frame.box.height - laid.height) / 2 : 0);
  const share = ALIGN_SHARE[p.align] ?? 0;
  const fade = kind.motion === Motion.FadeUp ? progress(env, { at: 0, duration: FADE_FRAMES / env.fps }, p.easing) : 1;
  const lift = kind.motion === Motion.FadeUp ? FADE_RISE_PX * (1 - fade) : 0;
  const matrix: Affine = [1, 0, 0, 1, left, top + lift];
  const inks: Ink[] = [];
  laid.blocks.forEach((block, i) => {
    const rise = kind.motion === Motion.LinesRise ? (RISE_PERCENT / PERCENT) * block.height * (1 - progress(env, { at: (i * LINE_STAGGER) / env.fps, duration: REVEAL_FRAMES / env.fps }, p.easing)) : 0;
    const mask: Rect | null = kind.motion === Motion.LinesRise ? [0, block.top, room, block.top + block.height + DESCENDER_EM * type.size] : null;
    const backdrop: number[][] = [];
    const glyphs: number[][] = [];
    for (const line of block.lines) {
      const x = (room - line.width) * share;
      const baseline = block.top + line.baseline + rise - SMOOTHING[env.smoothing].rise;
      if (kind.inset > 0) {
        backdrop.push(rect([x, baseline - laid.ascent - CAPTION_PAD_EM * type.size, x + line.width, baseline + laid.descent + CAPTION_PAD_EM * type.size]));
      }
      for (const g of line.glyphs) {
        glyphs.push(...moved(glyphContours(g.face, g.glyph, type.size, g.skew, SMOOTHING[env.smoothing].darken(type.size)), x + g.x, baseline - g.dy));
      }
    }
    const shown = mask ? clipped(glyphs, mask) : glyphs;
    if (backdrop.length) {
      inks.push({ contours: backdrop, color: rgbaOf(env.colour(String(p.background))) ?? [0, 0, 0, 1], opacity: fade, matrix });
    }
    if (shown.length && color[3] > 0) {
      inks.push({ contours: shown, color, opacity: fade, matrix });
    }
  });
  return inks.filter((i) => i.opacity > 0);
}
