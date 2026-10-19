import { apply2d, mul2d, type Affine } from '../../affine';
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
import { layOut, Shaping, Spaces, type Flow, type Glyph, type Laid, type Type } from './layout';
import { AnimatorUnit, type TextAnimator } from '../../text-animators/model';
import { animation, type Animation, type Look, type Slot } from './animators';
import { clipped, contoursOf, dilated, type Rect } from './outline';

export type TextComponent = 'Title' | 'Text' | 'Kicker' | 'Caption';

export const TEXT_COMPONENTS: readonly TextComponent[] = ['Title', 'Text', 'Kicker', 'Caption'];

export enum TextGap {
  Font = 'font',
  Glyph = 'glyph',
  Fill = 'fill',
  Stroke = 'stroke'
}

export type Ink = { contours: number[][]; color: Rgba; opacity: number; matrix: Affine; blur: number };

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
  animators: readonly TextAnimator[];
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

function place(env: TextEnv, kind: Kind, p: Props, paragraphs: string[], shaping: Shaping): Placed {
  const frame = kind.frame(p, env.box, env.stage);
  const requested = kind.size(p, Math.min(env.stage.width, env.stage.height));
  const typeAt = (size: number): Type => ({
    request: { family: String(p.font), weight: Number(p.weight), italic: p.italic === true, axes: axesOf(p) },
    size,
    tracking: Number(p.tracking),
    leading: Number(p.leading),
    inset: kind.inset * size,
    shaping
  });
  const flow = kind.flow(p);
  const lay = (size: number) => layOut(paragraphs, typeAt(size), flow, frame.box.width, env.fonts);
  const size = kind.fits(p) ? fitSize(requested, (s) => lay(s), frame.box) : requested;
  const laid = lay(size);
  return { laid, type: typeAt(size), frame, room: frame.hugs ? laid.width : frame.box.width };
}

type Unit = { slot: Slot | null; contours: number[][]; box: Rect };

const STILL: Look = { opacity: 1, blur: 0, turn: [1, 0, 0, 1, 0, 0], tint: null };

const WORD = /\S+/g;

function slotsOf(text: string, paragraphs: string[]): (paragraph: number, g: Glyph) => Slot {
  const words = text.split('\n').flatMap((line, l) => [...line.matchAll(WORD)].map((m) => ({ line: l, chars: [...m[0]].length })));
  const charsBefore = words.map((_, w) => words.slice(0, w).reduce((n, word) => n + word.chars, 0));
  const wordsBefore = paragraphs.map((_, i) => paragraphs.slice(0, i).reduce((n, para) => n + (para.match(WORD)?.length ?? 0), 0));
  return (paragraph, g) => {
    const word = wordsBefore[paragraph] + g.word;
    return { [AnimatorUnit.Char]: (charsBefore[word] ?? 0) + g.letter, [AnimatorUnit.Word]: word, [AnimatorUnit.Line]: words[word]?.line ?? 0 };
  };
}

function about([left, top, right, bottom]: Rect, turn: Affine, em: number): Affine {
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  const scaled: Affine = [turn[0], turn[1], turn[2], turn[3], turn[4] * em, turn[5] * em];
  return mul2d(mul2d([1, 0, 0, 1, cx, cy], scaled), [1, 0, 0, 1, -cx, -cy]);
}

function transformed(contours: number[][], m: Affine): number[][] {
  return contours.map((c) => c.flatMap((_, i) => (i % 2 === 0 ? apply2d(m, [c[i], c[i + 1]]) : [])));
}

const scaleOf = (m: Affine) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));

function mixed(base: Rgba, tint: Rgba | null, amount: number): Rgba {
  if (!tint) {
    return base;
  }
  const alpha = tint[3] * amount + base[3] * (1 - amount);
  const channel = (k: number) => (alpha === 0 ? 0 : (tint[k] * tint[3] * amount + base[k] * base[3] * (1 - amount)) / alpha);
  return [channel(0), channel(1), channel(2), alpha];
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
  const run = animation(cased, env.animators);
  const paragraphs = kind.paragraphs(cased);
  const { laid, type, frame, room } = place(env, kind, p, paragraphs, run?.finest === AnimatorUnit.Char ? Shaping.Chars : Shaping.Runs);
  const slots = slotsOf(cased, paragraphs);
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
    const units = new Map<number, Unit>();
    block.lines.forEach((line, l) => {
      const x = (room - line.width) * share;
      const top = block.top + l * laid.lineHeight + rise;
      const baseline = block.top + line.baseline + rise - SMOOTHING[env.smoothing].rise;
      if (kind.inset > 0) {
        backdrop.push(rect([x, baseline - laid.ascent - CAPTION_PAD_EM * type.size, x + line.width, baseline + laid.descent + CAPTION_PAD_EM * type.size]));
      }
      for (const g of line.glyphs) {
        const slot = run && g.word >= 0 ? slots(i, g) : null;
        const key = slot && run ? slot[run.finest] : -1;
        const unit = units.get(key) ?? { slot, contours: [], box: [Infinity, Infinity, -Infinity, -Infinity] };
        units.set(key, unit);
        unit.contours.push(...moved(glyphContours(g.face, g.glyph, type.size, g.skew, SMOOTHING[env.smoothing].darken(type.size)), x + g.x, baseline - g.dy));
        unit.box = [Math.min(unit.box[0], x + g.pen), Math.min(unit.box[1], top), Math.max(unit.box[2], x + g.pen + g.advance), Math.max(unit.box[3], top + laid.lineHeight)];
      }
    });
    if (backdrop.length) {
      inks.push({ contours: backdrop, color: rgbaOf(env.colour(String(p.background))) ?? [0, 0, 0, 1], opacity: fade, matrix, blur: 0 });
    }
    for (const unit of units.values()) {
      const look = unit.slot && run ? run.at(unit.slot) : STILL;
      const turned = look === STILL ? unit.contours : transformed(unit.contours, about(unit.box, look.turn, type.size));
      const shown = mask ? clipped(turned, mask) : turned;
      const tinted = look.tint ? mixed(color, rgbaOf(env.colour(look.tint.color)), look.tint.amount) : color;
      if (shown.length && tinted[3] > 0) {
        inks.push({ contours: shown, color: tinted, opacity: fade * look.opacity, matrix, blur: look.blur * scaleOf(look.turn) });
      }
    }
  });
  return inks.filter((i) => i.opacity > 0);
}
