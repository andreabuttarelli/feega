import { apply2d, mul2d, type Affine } from '../../affine';
import { TYPE, type TextCase } from '../../components';
import { Ease } from '../../design';
import { safeBox } from '../../fit';
import { elementFills } from '../../fill/elements';
import { FillType, type Fill, type FillOf } from '../../fill/model';
import { BlendMode } from '../../blend';
import { StrokeAlign } from '../../stroke/model';
import { firstColour } from '../../stroke/render';
import { Cap, Join, strokePolygons } from '../stroke';
import { FillRule, PaintKind, type Paint, type Stop } from '../paint';
import { fitSize } from '../../hyperframes/fit-runtime';
import type { Box } from '../../layout';
import { easeCurve } from '../../sample-track';
import { elementStrokes } from '../../stroke/elements';
import { TextSizing } from '../../text-sizing';
import { rgbaOf, type Rgba } from '../rgba';
import type { Face, FaceBook, Request } from './face';
import type { FaceRule } from './fonts';
import type { FontFace } from '../../fonts/model';
import { layOut, Shaping, Spaces, type Flow, type Glyph, type Laid, type Line, type Type } from './layout';
import { AnimatorUnit, type TextAnimator } from '../../text-animators/model';
import { animation, type Animation, type Look } from './animators';
import { clipped, contoursOf, dilated, type Rect } from './outline';

export type TextComponent = 'Title' | 'Text' | 'Kicker' | 'Caption';

export const TEXT_COMPONENTS: readonly TextComponent[] = ['Title', 'Text', 'Kicker', 'Caption'];

export enum TextGap {
  Font = 'font',
  Glyph = 'glyph',
  Fill = 'fill'
}

export type Painted = { inks: Ink[]; frame: Box };

export type Ink = { contours: number[][]; paint: Paint; rule: FillRule; opacity: number; matrix: Affine; blur: number };

type Size = { width: number; height: number };

export enum Smoothing {
  Dilated = 'dilated',
  Plain = 'plain'
}

const STEM_DARKENING = 0.0121;
const MAX_DARKENING_PX = 0.3;
const DILATED_RISE_PX = 0.95;

export const SMOOTHING: Record<Smoothing, { darken: (size: number) => number; rise: number }> = {
  [Smoothing.Dilated]: { darken: (size) => Math.min(MAX_DARKENING_PX, size * STEM_DARKENING), rise: DILATED_RISE_PX },
  [Smoothing.Plain]: { darken: () => 0, rise: 0 }
};

const DILATING_PLATFORM = /Macintosh|Mac OS X/;

export const smoothingOf = (userAgent: string): Smoothing => (DILATING_PLATFORM.test(userAgent) ? Smoothing.Dilated : Smoothing.Plain);

export type NativeFaces = { rules: readonly FaceRule[]; registry: readonly FontFace[] };

export type Typeset = { fonts: FaceBook; smoothing: Smoothing; native?: NativeFaces };

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

export enum Area {
  Line = 'line',
  Block = 'block',
  Whole = 'whole'
}

export enum Anchor {
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
  area: Area;
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
  Title: { size: rounded, paragraphs: lines, flow: () => NORMAL, fits: () => true, upper: false, inset: 0, frame: (_p, box, stage) => ({ box: safeBox(box, stage), anchor: Anchor.Centre, hugs: false }), motion: Motion.LinesRise, area: Area.Block },
  Text: { size: rounded, paragraphs: lines, flow: (p) => TEXT_FLOW[sizingOf(p)], fits: (p) => sizingOf(p) === TextSizing.Fixed, upper: false, inset: 0, frame: (p, box) => ({ box, ...TEXT_FRAME[sizingOf(p)] }), motion: Motion.FadeUp, area: Area.Line },
  Kicker: { size: rounded, paragraphs: whole, flow: () => NORMAL, fits: () => true, upper: true, inset: 0, frame: centred, motion: Motion.None, area: Area.Whole },
  Caption: { size: (p, unit) => p.size * unit, paragraphs: whole, flow: () => NORMAL, fits: () => true, upper: false, inset: 0.5, frame: centred, motion: Motion.None, area: Area.Line }
};

const CASE: Record<TextCase, (s: string) => string> = { 'as-typed': (s) => s, upper: (s) => s.toUpperCase(), lower: (s) => s.toLowerCase() };

export const casedOf = (component: TextComponent, p: Record<string, unknown>) => CASE[KINDS[component].upper ? 'upper' : ((p.textCase as TextCase) ?? 'as-typed')](String(p.text));

const AXIS = /'([A-Za-z0-9]{4})' (-?\d+(?:\.\d+)?)/g;

export function axesOf(p: Record<string, unknown>): Record<string, number> {
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

export function glyphContours(face: Face, glyph: number, size: number, skew: number, darken: number): number[][] {
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

export const moved = (contours: number[][], dx: number, dy: number) => contours.map((c) => c.map((v, i) => v + (i % 2 === 0 ? dx : dy)));

const rect = ([l, t, r, b]: Rect) => [l, t, r, t, r, b, l, b];

export const STILL: Look = { opacity: 1, blur: 0, turn: [1, 0, 0, 1, 0, 0], tint: null };

const WORD = /\S+/g;

export function about([left, top, right, bottom]: Rect, turn: Affine, em: number): Affine {
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  const scaled: Affine = [turn[0], turn[1], turn[2], turn[3], turn[4] * em, turn[5] * em];
  return mul2d(mul2d([1, 0, 0, 1, cx, cy], scaled), [1, 0, 0, 1, -cx, -cy]);
}

export function transformed(contours: number[][], m: Affine): number[][] {
  return contours.map((c) => c.flatMap((_, i) => (i % 2 === 0 ? apply2d(m, [c[i], c[i + 1]]) : [])));
}

export const scaleOf = (m: Affine) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));

const inkedWidth = (line: Line) => (line.glyphs.length ? line.glyphs.at(-1)!.pen + line.glyphs.at(-1)!.advance - line.glyphs[0].pen : 0);

function mixed(base: Rgba, tint: Rgba, amount: number): Rgba {
  const alpha = tint[3] * amount + base[3] * (1 - amount);
  const channel = (k: number) => (alpha === 0 ? 0 : (tint[k] * tint[3] * amount + base[k] * base[3] * (1 - amount)) / alpha);
  return [channel(0), channel(1), channel(2), alpha];
}

type Shade = { paint: Paint; squash: number };

export type Colour = (v: string) => Rgba;

const faded = (c: Rgba, opacity: number): Rgba => [c[0], c[1], c[2], c[3] * opacity];

const stopsOf = (f: { stops: { color: string; pos: number }[]; opacity: number }, colour: Colour): Stop[] => [...f.stops].sort((a, b) => a.pos - b.pos).map((s) => ({ at: s.pos, color: faded(colour(s.color), f.opacity) }));

const DEG = Math.PI / 180;
const CSS_TURN = 90;
const HALF = 0.5;

export type FillPlan = { kind: PaintKind.Solid; color: Rgba } | { kind: PaintKind.Linear; angle: number; stops: Stop[] } | { kind: PaintKind.Radial; center: [number, number]; radius: number; stops: Stop[] };

const PLANS: Partial<{ [T in FillType]: (f: FillOf<T>, colour: Colour) => FillPlan }> = {
  [FillType.Solid]: (f, colour) => ({ kind: PaintKind.Solid, color: faded(colour(f.color), f.opacity) }),
  [FillType.Linear]: (f, colour) => ({ kind: PaintKind.Linear, angle: f.angle, stops: stopsOf(f, colour) }),
  [FillType.Radial]: (f, colour) => ({ kind: PaintKind.Radial, center: [f.center.x, f.center.y], radius: f.radius, stops: stopsOf(f, colour) })
};

const SHADES: { [K in PaintKind]: (f: Extract<FillPlan, { kind: K }>, area: Rect) => Shade } = {
  [PaintKind.Solid]: (f) => ({ paint: { kind: PaintKind.Solid, color: f.color }, squash: 1 }),
  [PaintKind.Linear]: (f, [l, t, r, b]) => {
    const turn = (f.angle + CSS_TURN) * DEG;
    const [dx, dy] = [Math.sin(turn), -Math.cos(turn)];
    const reach = (Math.abs((r - l) * dx) + Math.abs((b - t) * dy)) * HALF;
    const [cx, cy] = [(l + r) * HALF, (t + b) * HALF];
    return { paint: { kind: PaintKind.Linear, from: [cx - dx * reach, cy - dy * reach], to: [cx + dx * reach, cy + dy * reach], stops: f.stops }, squash: 1 };
  },
  [PaintKind.Radial]: (f, [l, t, r, b]) => {
    const [rx, ry] = [f.radius * HALF * (r - l), f.radius * HALF * (b - t)];
    const squash = ry > 0 ? rx / ry : 1;
    return { paint: { kind: PaintKind.Radial, center: [l + f.center[0] * (r - l), (t + f.center[1] * (b - t)) * squash], radius: rx, stops: f.stops }, squash };
  }
};

const shadeOf = (f: FillPlan, area: Rect): Shade => (SHADES[f.kind] as (f: FillPlan, area: Rect) => Shade)(f, area);

const plain = (fills: Fill[]) => fills.length === 1 && fills[0].type === FillType.Solid && fills[0].opacity === 1;

function fillPlans(fills: Fill[], colour: Colour, animated: boolean): FillPlan[] | null {
  const drawable = fills.every((f) => PLANS[f.type] && f.blend === BlendMode.Normal);
  if (!drawable || (animated && fills.length > 0 && !plain(fills))) {
    return null;
  }
  return fills.map((f) => (PLANS[f.type] as (f: Fill, c: Colour) => FillPlan)(f, colour));
}

const STROKE_STRETCH: Record<StrokeAlign, { stretch: number; under: boolean }> = {
  [StrokeAlign.Center]: { stretch: 1, under: false },
  [StrokeAlign.Inside]: { stretch: 1, under: false },
  [StrokeAlign.Outside]: { stretch: 2, under: true }
};

type Outline = { width: number; colour: Rgba; under: boolean };

function outlineOf(env: TextEnv, colour: Colour): Outline | null {
  const s = elementStrokes(env.component, env.props).find((x) => x.visible && x.width > 0);
  if (!s) {
    return null;
  }
  const align = STROKE_STRETCH[s.align];
  return { width: s.width * Math.min(env.stage.width, env.stage.height) * align.stretch, colour: colour(firstColour(s.paint as Fill)), under: align.under };
}

const squashed = (contours: number[][], squash: number) => (squash === 1 ? contours : contours.map((c) => c.map((v, i) => (i % 2 === 0 ? v : v * squash))));

const unsquashed = (m: Affine, squash: number): Affine => (squash === 1 ? m : mul2d(m, [1, 0, 0, 1 / squash, 0, 0]));

const visible = (paint: Paint) => paint.kind !== PaintKind.Solid || paint.color[3] > 0;

export const tintedPaint = (paint: Paint, look: Look, colour: Colour): Paint => (look.tint && paint.kind === PaintKind.Solid ? { kind: PaintKind.Solid, color: mixed(paint.color, colour(look.tint.color), look.tint.amount) } : paint);

export type Tinted = { opacity: number; blur: number; turn: Affine; tint: { color: Rgba; amount: number } | null };

const UNTINTED: Tinted = { ...STILL, tint: null };

const tinted = (paint: Paint, look: Tinted): Paint => (look.tint && paint.kind === PaintKind.Solid ? { kind: PaintKind.Solid, color: mixed(paint.color, look.tint.color, look.tint.amount) } : paint);

export type PlanFrame = { left: number; top: number; width: number; height: number; anchor: Anchor; hugs: boolean };

export type TextPlan = {
  text: string;
  paragraphs: string[];
  request: Omit<Request, 'size'>;
  size: number;
  fits: boolean;
  tracking: number;
  leading: number;
  inset: number;
  shaping: Shaping;
  flow: Flow;
  frame: PlanFrame;
  align: number;
  fade: number;
  rises: number[] | null;
  area: Area;
  backdrop: Rgba | null;
  fills: FillPlan[];
  outline: Outline | null;
  animation: { finest: AnimatorUnit; looks: Tinted[] } | null;
  smoothing: Smoothing;
};

type Word = { line: number; chars: number };

const wordsOf = (text: string): Word[] => text.split('\n').flatMap((line, l) => [...line.matchAll(WORD)].map((m) => ({ line: l, chars: [...m[0]].length })));

const charsBeforeOf = (words: Word[]) => words.map((_, w) => words.slice(0, w).reduce((n, word) => n + word.chars, 0));

function looksOf(text: string, run: Animation, colour: Colour): Tinted[] {
  const words = wordsOf(text);
  const before = charsBeforeOf(words);
  return words.flatMap((word, w) =>
    Array.from({ length: word.chars }, (_, letter) => {
      const look = run.at({ [AnimatorUnit.Char]: before[w] + letter, [AnimatorUnit.Word]: w, [AnimatorUnit.Line]: word.line });
      return { ...look, tint: look.tint ? { color: colour(look.tint.color), amount: look.tint.amount } : null };
    })
  );
}

export function planOf(env: TextEnv): TextPlan | TextGap {
  const kind = KINDS[env.component];
  const p = env.props as Props;
  const colour: Colour = (v) => rgbaOf(env.colour(v)) ?? [0, 0, 0, 1];
  const fills = fillPlans(elementFills(env.component, p).filter((f) => f.visible), colour, env.animators.length > 0);
  if (!fills) {
    return TextGap.Fill;
  }
  const cased = casedOf(env.component, p);
  const run = animation(cased, env.animators);
  const paragraphs = kind.paragraphs(cased);
  const frame = kind.frame(p, env.box, env.stage);
  return {
    text: cased,
    paragraphs,
    request: { family: String(p.font), weight: Number(p.weight), italic: p.italic === true, axes: axesOf(p) },
    size: kind.size(p, Math.min(env.stage.width, env.stage.height)),
    fits: kind.fits(p),
    tracking: Number(p.tracking),
    leading: Number(p.leading),
    inset: kind.inset,
    shaping: run?.finest === AnimatorUnit.Char ? Shaping.Chars : Shaping.Runs,
    flow: kind.flow(p),
    frame: { left: frame.box.left - env.box.left, top: frame.box.top - env.box.top, width: frame.box.width, height: frame.box.height, anchor: frame.anchor, hugs: frame.hugs },
    align: ALIGN_SHARE[p.align] ?? 0,
    fade: kind.motion === Motion.FadeUp ? progress(env, { at: 0, duration: FADE_FRAMES / env.fps }, p.easing) : 1,
    rises: kind.motion === Motion.LinesRise ? paragraphs.map((_, i) => progress(env, { at: (i * LINE_STAGGER) / env.fps, duration: REVEAL_FRAMES / env.fps }, p.easing)) : null,
    area: kind.area,
    backdrop: kind.inset > 0 ? colour(String(p.background)) : null,
    fills,
    outline: outlineOf(env, colour),
    animation: run ? { finest: run.finest, looks: looksOf(cased, run, colour) } : null,
    smoothing: env.smoothing
  };
}

type Placed = { laid: Laid; type: Type; room: number };

function place(plan: TextPlan, fonts: FaceBook): Placed {
  const typeAt = (size: number): Type => ({ request: plan.request, size, tracking: plan.tracking, leading: plan.leading, inset: plan.inset * size, shaping: plan.shaping });
  const lay = (size: number) => layOut(plan.paragraphs, typeAt(size), plan.flow, plan.frame.width, fonts);
  const size = plan.fits ? fitSize(plan.size, (s) => lay(s), plan.frame) : plan.size;
  const laid = lay(size);
  return { laid, type: typeAt(size), room: plan.frame.hugs ? laid.width : plan.frame.width };
}

type Slotted = { key: number; look: number };

function slotsOf(text: string, paragraphs: string[], finest: AnimatorUnit): (paragraph: number, g: Glyph) => Slotted {
  const words = wordsOf(text);
  const charsBefore = charsBeforeOf(words);
  const wordsBefore = paragraphs.map((_, i) => paragraphs.slice(0, i).reduce((n, para) => n + (para.match(WORD)?.length ?? 0), 0));
  return (paragraph, g) => {
    const word = wordsBefore[paragraph] + g.word;
    const char = (charsBefore[word] ?? 0) + g.letter;
    const slot = { [AnimatorUnit.Char]: char, [AnimatorUnit.Word]: word, [AnimatorUnit.Line]: words[word]?.line ?? 0 };
    return { key: slot[finest], look: char };
  };
}

type Unit = { look: Tinted; contours: number[][]; outlines: number[][]; box: Rect; area: Rect };

export function inksOf(plan: TextPlan, fonts: FaceBook): Painted | TextGap {
  const { laid, type, room } = place(plan, fonts);
  const run = plan.animation;
  const slots = run ? slotsOf(plan.text, plan.paragraphs, run.finest) : null;
  if (!laid.blocks.some((b) => b.lines.length) || laid.ascent + laid.descent === 0) {
    return TextGap.Font;
  }
  if (laid.missing) {
    return TextGap.Glyph;
  }
  const smoothing = SMOOTHING[plan.smoothing];
  const { left } = plan.frame;
  const top = plan.frame.top + (plan.frame.anchor === Anchor.Centre ? (plan.frame.height - laid.height) / 2 : 0);
  const matrix: Affine = [1, 0, 0, 1, left, top + FADE_RISE_PX * (1 - plan.fade)];
  const inks: Ink[] = [];
  const stripWidth = laid.blocks.reduce((n, b) => n + b.lines.reduce((m, line) => m + inkedWidth(line), 0), 0);
  let strip = 0;
  laid.blocks.forEach((block, i) => {
    const rise = plan.rises ? (RISE_PERCENT / PERCENT) * block.height * (1 - plan.rises[i]) : 0;
    const mask: Rect | null = plan.rises ? [0, block.top, room, block.top + block.height + DESCENDER_EM * type.size] : null;
    const backdrop: number[][] = [];
    const units = new Map<string, Unit>();
    block.lines.forEach((line, l) => {
      const x = (room - line.width) * plan.align;
      const top = block.top + l * laid.lineHeight + rise;
      const baseline = block.top + line.baseline + rise - smoothing.rise;
      const start = x + (line.glyphs[0]?.pen ?? 0);
      const areas: Record<Area, Rect> = {
        [Area.Line]: [start - strip, block.top + line.baseline + rise - laid.ascent, start - strip + stripWidth, block.top + line.baseline + rise + laid.descent],
        [Area.Block]: [0, block.top + rise, room, block.top + rise + block.height],
        [Area.Whole]: [0, 0, room, laid.height]
      };
      strip += inkedWidth(line);
      if (plan.backdrop) {
        backdrop.push(rect([x, baseline - laid.ascent - CAPTION_PAD_EM * type.size, x + line.width, baseline + laid.descent + CAPTION_PAD_EM * type.size]));
      }
      for (const g of line.glyphs) {
        const slot = slots && g.word >= 0 ? slots(i, g) : null;
        const key = `${slot ? slot.key : -1}:${plan.area === Area.Line ? l : 0}`;
        const unit = units.get(key) ?? { look: slot && run ? (run.looks[slot.look] ?? UNTINTED) : UNTINTED, contours: [], outlines: [], box: [Infinity, Infinity, -Infinity, -Infinity], area: areas[plan.area] };
        units.set(key, unit);
        unit.contours.push(...moved(glyphContours(g.face, g.glyph, type.size, g.skew, smoothing.darken(type.size)), x + g.x, baseline - g.dy));
        unit.outlines.push(...(plan.outline ? moved(glyphContours(g.face, g.glyph, type.size, g.skew, 0), x + g.x, baseline - g.dy + smoothing.rise) : []));
        unit.box = [Math.min(unit.box[0], x + g.pen), Math.min(unit.box[1], top), Math.max(unit.box[2], x + g.pen + g.advance), Math.max(unit.box[3], top + laid.lineHeight)];
      }
    });
    if (plan.backdrop) {
      inks.push({ contours: backdrop, paint: { kind: PaintKind.Solid, color: plan.backdrop }, rule: FillRule.NonZero, opacity: plan.fade, matrix, blur: 0 });
    }
    for (const unit of units.values()) {
      const { look } = unit;
      const turn = about(unit.box, look.turn, type.size);
      const placed = (contours: number[][]) => {
        const turned = look === UNTINTED ? contours : transformed(contours, turn);
        return mask ? clipped(turned, mask) : turned;
      };
      const ink = (contours: number[][], paint: Paint, rule: FillRule, squash = 1): Ink => ({ contours: squashed(contours, squash), paint, rule, opacity: plan.fade * look.opacity, matrix: unsquashed(matrix, squash), blur: look.blur * scaleOf(look.turn) });
      const shown = placed(unit.contours);
      const filled = plan.fills.map((f) => shadeOf(f, unit.area)).map((shade) => ink(shown, tinted(shade.paint, look), FillRule.NonZero, shade.squash));
      const outline = plan.outline;
      const stroked = outline ? [ink(placed(unit.outlines.flatMap((c) => strokePolygons(c, true, outline.width, Cap.Butt, Join.Miter))), tinted({ kind: PaintKind.Solid, color: outline.colour }, look), FillRule.Union)] : [];
      inks.push(...(outline?.under ? [...stroked, ...filled] : [...filled, ...stroked]).filter((i) => i.contours.length && visible(i.paint)));
    }
  });
  const rendered = { left, top: plan.frame.top, width: plan.frame.hugs ? laid.width : plan.frame.width, height: plan.frame.anchor === Anchor.Top ? laid.height : plan.frame.height };
  return { inks: inks.filter((i) => i.opacity > 0), frame: rendered };
}

export function paintText(env: TextEnv): Painted | TextGap {
  const plan = planOf(env);
  return typeof plan === 'string' ? plan : inksOf(plan, env.fonts);
}
