import { apply2d, mul2d, type Affine } from '../../affine';
import { NO_RULE, ruled, type Rule } from './rules';
import { featuresFor, type Decoration, type DecorationStyle } from '../../decoration';
import { TYPE, type LeadingTrim, type TextAlign, type TextCase, type TextWrap, type VerticalAlign } from '../../components';
import { AUTO, leadingOf, trackingOf, type Leading } from '../../type-units';
import { Ease } from '../../design';
import { safeBox } from '../../fit';
import { elementFills } from '../../fill/elements';
import { FillType, ImageFit, type Fill, type FillOf } from '../../fill/model';
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
import type { Face, FaceBook, Features, Request } from './face';
import type { FaceRule } from './fonts';
import type { FontFace } from '../../fonts/model';
import { caretLines, type CaretLine } from './caret';
import { Justify, layOut, NO_LIMIT, NO_LISTS, PLAIN_PARAGRAPH, Trim, Wrap, NO_EXTRA, Shaping, Spaces, type ListMark, type Paragraph, type Extra, type Flow, type Glyph, type Laid, type Line, type Look as RunLook, type RequestAt, type Type } from './layout';
import { AnimatorUnit, type TextAnimator } from '../../text-animators/model';
import { animation, type Animation, type Look } from './animators';
import { clipped, contoursOf, dilated, type Rect } from './outline';
import { blended } from '../blend-colour';
import { LIST_STEP_EM, MARKER_GAP_EM, markersOf, type ListItem } from '../../text-lists';
import { normalRuns, runAt, type RunCase, type TextRun } from '../../text-runs';

export type TextComponent = 'Title' | 'Text' | 'Kicker' | 'Caption';

export const TEXT_COMPONENTS: readonly TextComponent[] = ['Title', 'Text', 'Kicker', 'Caption'];

export enum TextGap {
  Font = 'font',
  Glyph = 'glyph',
  Fill = 'fill'
}

export type Painted = { inks: Ink[]; frame: Box };

export type GlyphRun = { font: string; coords: [string, number][]; size: number; glyphs: [number, number, number][] };

export type Picture = { src: string; fit: string; focus: [number, number]; area: Rect };

export type Ink = { contours: number[][]; paint: Paint; rule: FillRule; opacity: number; matrix: Affine; blur: number; picture?: Picture; run?: GlyphRun };

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

export enum TextOutput {
  Outlines = 'outlines',
  Glyphs = 'glyphs'
}

export type Typeset = { fonts: FaceBook; smoothing: Smoothing; native?: NativeFaces; output?: TextOutput };

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
  output?: TextOutput;
  asset: (id: string) => string | null;
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

type Props = Record<string, unknown> & { text: string; size: number; align: TextAlign; sizing?: TextSizing; easing: Ease; verticalAlign?: VerticalAlign; paragraphSpacing?: number; paragraphIndent?: number; textWrap?: TextWrap; leadingTrim?: LeadingTrim; maxLines?: number };

const ALIGN_SHARE: Record<TextAlign, number> = { left: 0, center: 0.5, right: 1, justify: 0 };
const JUSTIFY_OF: Record<TextAlign, Justify> = { left: Justify.Off, center: Justify.Off, right: Justify.Off, justify: Justify.On };
const VERTICAL_SHARE: Record<VerticalAlign, number> = { top: 0, center: 0.5, bottom: 1 };

export type Typography = { vertical: number; paragraph: Paragraph; clips: boolean; rule: Rule; ruleColour: Rgba | null; features: Features };

export const coreTypography = ({ leading, typography: { vertical, paragraph, clips, rule, features } }: Pick<TextPlan, 'leading' | 'typography'>) =>
  leading !== AUTO && !clips && rule.line === NO_RULE.line && !Object.keys(features).length && vertical === VERTICAL_SHARE.center && (Object.keys(PLAIN_PARAGRAPH) as (keyof Paragraph)[]).every((key) => paragraph[key] === PLAIN_PARAGRAPH[key]);

const WRAP_OF: Record<TextWrap, Wrap> = { wrap: Wrap.Greedy, balance: Wrap.Balance, pretty: Wrap.Pretty };
const TRIM_OF: Record<LeadingTrim, Trim> = { none: Trim.None, cap: Trim.Cap };

const truncates = (p: Props) => p.truncate === true;

const ruleOf = (p: Props): Rule => ({
  line: (p.decoration as Decoration | undefined) ?? NO_RULE.line,
  style: (p.decorationStyle as DecorationStyle | undefined) ?? NO_RULE.style,
  thickness: Number(p.decorationThickness ?? NO_RULE.thickness),
  offset: Number(p.decorationOffset ?? NO_RULE.offset),
  skipInk: p.skipInk !== false
});

const listMarks = (lists: readonly ListItem[] | undefined): ListMark[] => {
  const markers = markersOf(lists ?? []);
  return (lists ?? []).map((item, i) => (item ? { inset: (item.level + 1) * LIST_STEP_EM, gap: MARKER_GAP_EM, marker: markers[i]! } : null));
};

const paragraphOf = (p: Props): Paragraph => ({
  indent: Number(p.paragraphIndent ?? 0),
  spacing: Number(p.paragraphSpacing ?? 0),
  justify: JUSTIFY_OF[p.align] ?? Justify.Off,
  wrap: WRAP_OF[p.textWrap ?? 'wrap'],
  limit: truncates(p) ? Number(p.maxLines ?? NO_LIMIT) : NO_LIMIT,
  trim: TRIM_OF[p.leadingTrim ?? 'none'],
  lists: (p.lists as ListItem[] | undefined)?.length ? listMarks(p.lists as ListItem[]) : NO_LISTS
});
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
  Text: { size: rounded, paragraphs: lines, flow: (p) => TEXT_FLOW[sizingOf(p)], fits: (p) => sizingOf(p) === TextSizing.Fixed && !truncates(p), upper: false, inset: 0, frame: (p, box) => ({ box, ...TEXT_FRAME[sizingOf(p)] }), motion: Motion.FadeUp, area: Area.Line },
  Kicker: { size: rounded, paragraphs: whole, flow: () => NORMAL, fits: () => true, upper: true, inset: 0, frame: centred, motion: Motion.None, area: Area.Whole },
  Caption: { size: (p, unit) => p.size * unit, paragraphs: whole, flow: () => NORMAL, fits: () => true, upper: false, inset: 0.5, frame: centred, motion: Motion.None, area: Area.Line }
};

const WORD_START = /(^|\s)(\S)/gu;

const CASE: Record<TextCase, (s: string) => string> = { 'as-typed': (s) => s, upper: (s) => s.toUpperCase(), lower: (s) => s.toLowerCase(), title: (s) => s.replace(WORD_START, (_, gap: string, first: string) => gap + first.toUpperCase()), 'small-caps': (s) => s };

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

export const STILL: Look = { opacity: 1, blur: 0, turn: [1, 0, 0, 1, 0, 0], tint: null, spacing: 0 };

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

type Shade = { paint: Paint; squash: number; picture?: Picture };

export type Colour = (v: string) => Rgba;

const faded = (c: Rgba, opacity: number): Rgba => [c[0], c[1], c[2], c[3] * opacity];

const stopsOf = (f: { stops: { color: string; pos: number }[]; opacity: number }, colour: Colour): Stop[] => [...f.stops].sort((a, b) => a.pos - b.pos).map((s) => ({ at: s.pos, color: faded(colour(s.color), f.opacity) }));

const DEG = Math.PI / 180;
const CSS_TURN = 90;
const HALF = 0.5;
const WHITE: Rgba = [1, 1, 1, 1];

export enum ClippedFill {
  Image = 'image'
}

export type FillPlan =
  | { kind: PaintKind.Solid; color: Rgba }
  | { kind: PaintKind.Linear; angle: number; stops: Stop[] }
  | { kind: PaintKind.Radial; center: [number, number]; radius: number; stops: Stop[] }
  | { kind: PaintKind.Diamond; stops: Stop[] }
  | { kind: PaintKind.Sweep; angle: number; center: [number, number]; stops: Stop[] }
  | { kind: ClippedFill.Image; src: string; fit: string; focus: [number, number]; opacity: number };

type FillKind = FillPlan['kind'];

const PLANS: Partial<{ [T in FillType]: (f: FillOf<T>, colour: Colour, asset: (id: string) => string | null) => FillPlan | null }> = {
  [FillType.Solid]: (f, colour) => ({ kind: PaintKind.Solid, color: faded(colour(f.color), f.opacity) }),
  [FillType.Linear]: (f, colour) => ({ kind: PaintKind.Linear, angle: f.angle, stops: stopsOf(f, colour) }),
  [FillType.Radial]: (f, colour) => ({ kind: PaintKind.Radial, center: [f.center.x, f.center.y], radius: f.radius, stops: stopsOf(f, colour) }),
  [FillType.Diamond]: (f, colour) => ({ kind: PaintKind.Diamond, stops: stopsOf(f, colour) }),
  [FillType.Angular]: (f, colour) => ({ kind: PaintKind.Sweep, angle: f.angle, center: [f.center.x, f.center.y], stops: stopsOf(f, colour) }),
  [FillType.Image]: (f, _colour, asset) => {
    const src = f.src ?? asset(f.assetId);
    return src && f.fit !== ImageFit.Tile && f.fit !== ImageFit.Crop ? { kind: ClippedFill.Image, src, fit: f.fit, focus: [f.focus.x, f.focus.y], opacity: f.opacity } : null;
  }
};

const unclipped = (paint: Paint, squash = 1): Shade[] => [{ paint, squash }];

const SHADES: { [K in FillKind]: (f: Extract<FillPlan, { kind: K }>, area: Rect) => Shade[] } = {
  [PaintKind.Solid]: (f) => unclipped({ kind: PaintKind.Solid, color: f.color }),
  [PaintKind.Linear]: (f, [l, t, r, b]) => {
    const turn = (f.angle + CSS_TURN) * DEG;
    const [dx, dy] = [Math.sin(turn), -Math.cos(turn)];
    const reach = (Math.abs((r - l) * dx) + Math.abs((b - t) * dy)) * HALF;
    const [cx, cy] = [(l + r) * HALF, (t + b) * HALF];
    return unclipped({ kind: PaintKind.Linear, from: [cx - dx * reach, cy - dy * reach], to: [cx + dx * reach, cy + dy * reach], stops: f.stops });
  },
  [PaintKind.Radial]: (f, [l, t, r, b]) => {
    const [rx, ry] = [f.radius * HALF * (r - l), f.radius * HALF * (b - t)];
    const squash = ry > 0 ? rx / ry : 1;
    return unclipped({ kind: PaintKind.Radial, center: [l + f.center[0] * (r - l), (t + f.center[1] * (b - t)) * squash], radius: rx, stops: f.stops }, squash);
  },
  [PaintKind.Diamond]: (f, [l, t, r, b]) => unclipped({ kind: PaintKind.Diamond, center: [(l + r) * HALF, (t + b) * HALF], half: [(r - l) * HALF, (b - t) * HALF], stops: f.stops }),
  [PaintKind.Sweep]: (f, [l, t, r, b]) => unclipped({ kind: PaintKind.Sweep, center: [l + f.center[0] * (r - l), t + f.center[1] * (b - t)], start: (f.angle - CSS_TURN) * DEG, stops: f.stops }),
  [ClippedFill.Image]: (f, area) => [{ paint: { kind: PaintKind.Solid, color: faded(WHITE, f.opacity) }, squash: 1, picture: { src: f.src, fit: f.fit, focus: f.focus, area } }]
};

const shadesOf = (f: FillPlan, area: Rect): Shade[] => (SHADES[f.kind] as (f: FillPlan, area: Rect) => Shade[])(f, area);

const throughText = (fills: Fill[]) => !(fills.length === 1 && fills[0].type === FillType.Solid && fills[0].opacity === 1 && fills[0].blend === BlendMode.Normal);

function fillPlans(fills: Fill[], colour: Colour, asset: (id: string) => string | null): FillPlan[] | null {
  if (!fills.every((f) => f.blend === BlendMode.Normal)) {
    const solids = fills.every((f) => f.type === FillType.Solid) ? (fills as FillOf<FillType.Solid>[]) : null;
    return solids && [{ kind: PaintKind.Solid, color: solids.reduce<Rgba>((under, f) => blended(under, faded(colour(f.color), f.opacity), f.blend), [0, 0, 0, 0]) }];
  }
  const plans = fills.map((f) => (PLANS[f.type] as ((f: Fill, c: Colour, a: typeof asset) => FillPlan | null) | undefined)?.(f, colour, asset) ?? null);
  return plans.every((plan) => plan !== null) ? (plans as FillPlan[]) : null;
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

export type Tinted = { opacity: number; blur: number; turn: Affine; tint: { color: Rgba; amount: number } | null; spacing?: number };

const UNTINTED: Tinted = { opacity: 1, blur: 0, turn: STILL.turn, tint: null };

const tinted = (paint: Paint, look: Tinted): Paint => (look.tint && paint.kind === PaintKind.Solid ? { kind: PaintKind.Solid, color: mixed(paint.color, look.tint.color, look.tint.amount) } : paint);

export type PlanFrame = { left: number; top: number; width: number; height: number; anchor: Anchor; hugs: boolean };

export type TextPlan = {
  text: string;
  paragraphs: string[];
  request: Omit<Request, 'size'>;
  size: number;
  fits: boolean;
  tracking: number;
  leading: Leading;
  inset: number;
  shaping: Shaping;
  flow: Flow;
  frame: PlanFrame;
  align: number;
  typography: Typography;
  fade: number;
  rises: number[] | null;
  area: Area;
  backdrop: Rgba | null;
  fills: FillPlan[];
  outline: Outline | null;
  animation: { finest: AnimatorUnit; looks: Tinted[] } | null;
  smoothing: Smoothing;
  runs: TextRun[];
  starts: number[];
  tints: Record<string, Rgba>;
  gradients: Record<number, FillPlan[]>;
  share: number;
};

export type UniformPlan = Omit<TextPlan, 'runs' | 'starts' | 'tints' | 'gradients' | 'share' | 'typography'>;

type Word = { line: number; chars: number };

const wordsOf = (text: string): Word[] => text.split('\n').flatMap((line, l) => [...line.matchAll(WORD)].map((m) => ({ line: l, chars: [...m[0]].length })));

const charsBeforeOf = (words: Word[]) => words.map((_, w) => words.slice(0, w).reduce((n, word) => n + word.chars, 0));

function looksOf(text: string, run: Animation, colour: Colour, hiddenWhenIsolated: boolean, tracking: number): Tinted[] {
  const words = wordsOf(text);
  const before = charsBeforeOf(words);
  return words.flatMap((word, w) =>
    Array.from({ length: word.chars }, (_, letter) => {
      const look = run.at({ [AnimatorUnit.Char]: before[w] + letter, [AnimatorUnit.Word]: w, [AnimatorUnit.Line]: word.line });
      const skipped = hiddenWhenIsolated && (run.isolates || look.opacity < 1);
      const { spacing, ...own } = look;
      return { ...own, ...(run.tracks ? { spacing: spacing - tracking } : {}), opacity: skipped ? 0 : look.opacity, tint: look.tint ? { color: colour(look.tint.color), amount: look.tint.amount } : null };
    })
  );
}

export function planOf(env: TextEnv): TextPlan | TextGap {
  const kind = KINDS[env.component];
  const p = env.props as Props;
  const colour: Colour = (v) => rgbaOf(env.colour(v)) ?? [0, 0, 0, 1];
  const visibleFills = elementFills(env.component, p).filter((f) => f.visible);
  const fills = fillPlans(visibleFills, colour, env.asset);
  if (!fills) {
    return TextGap.Fill;
  }
  const whole = casedOf(env.component, p);
  const runs = normalRuns(p.runs as TextRun[] | undefined, [...whole].length);
  const gradients = gradientPlans(runs, colour, env.asset);
  if (!gradients) {
    return TextGap.Fill;
  }
  const cased = runCased(whole, runs);
  const run = animation(cased, env.animators);
  const paragraphs = kind.paragraphs(cased);
  const frame = kind.frame(p, env.box, env.stage);
  const size = kind.size(p, Math.min(env.stage.width, env.stage.height));
  return {
    text: cased,
    paragraphs,
    request: { family: String(p.font), weight: Number(p.weight), italic: p.italic === true, axes: axesOf(p) },
    size,
    fits: kind.fits(p),
    tracking: trackingOf(p, size),
    leading: leadingOf(p, size),
    inset: kind.inset,
    shaping: run?.finest === AnimatorUnit.Char ? Shaping.Chars : Shaping.Runs,
    flow: kind.flow(p),
    frame: { left: frame.box.left - env.box.left, top: frame.box.top - env.box.top, width: frame.box.width, height: frame.box.height, anchor: frame.anchor, hugs: frame.hugs },
    align: ALIGN_SHARE[p.align] ?? 0,
    typography: { vertical: VERTICAL_SHARE[p.verticalAlign ?? 'center'], paragraph: paragraphOf(p), clips: truncates(p) && sizingOf(p) === TextSizing.Fixed, rule: ruleOf(p), ruleColour: p.decorationColor ? colour(String(p.decorationColor)) : null, features: featuresFor(p) },
    fade: kind.motion === Motion.FadeUp ? progress(env, { at: 0, duration: FADE_FRAMES / env.fps }, p.easing) : 1,
    rises: kind.motion === Motion.LinesRise ? paragraphs.map((_, i) => progress(env, { at: (i * LINE_STAGGER) / env.fps, duration: REVEAL_FRAMES / env.fps }, p.easing)) : null,
    area: kind.area,
    backdrop: kind.inset > 0 ? colour(String(p.background)) : null,
    fills,
    outline: outlineOf(env, colour),
    animation: run ? { finest: run.finest, looks: looksOf(cased, run, colour, throughText(visibleFills), trackingOf(p, size)) } : null,
    smoothing: env.smoothing,
    runs,
    starts: startsOf(paragraphs),
    tints: Object.fromEntries(runs.flatMap((r) => (r.color ? [[r.color, faded(colour(r.color), 1)]] : []))),
    gradients,
    share: Number(p.size)
  };
}

function gradientPlans(runs: readonly TextRun[], colour: Colour, asset: (id: string) => string | null): Record<number, FillPlan[]> | null {
  const plans = runs.flatMap((r) => (r.fill ? [[r.start, fillPlans([r.fill], colour, asset)] as const] : []));
  return plans.every(([, plan]) => plan !== null) ? Object.fromEntries(plans as [number, FillPlan[]][]) : null;
}

const RUN_CASE: Record<RunCase, (c: string) => string> = { 'as-typed': (c) => c, upper: (c) => [...c.toUpperCase()][0] ?? c, lower: (c) => [...c.toLowerCase()][0] ?? c };

function runCased(text: string, runs: readonly TextRun[]): string {
  if (!runs.some((r) => r.textCase)) {
    return text;
  }
  return [...text].map((c, i) => RUN_CASE[runAt(runs, i)?.textCase ?? 'as-typed'](c)).join('');
}

const startsOf = (paragraphs: string[]) => paragraphs.map((_, i) => paragraphs.slice(0, i).reduce((n, para) => n + [...para].length + 1, 0));

const runOf = (plan: TextPlan, paragraph: number, char: number) => (plan.runs.length ? runAt(plan.runs, (plan.starts[paragraph] ?? 0) + char) : null);

function requestAtOf(plan: TextPlan, size: number): RequestAt | undefined {
  if (!plan.runs.length) {
    return undefined;
  }
  const plain: RunLook = { request: plan.request, size, tracking: plan.tracking, leading: plan.leading };
  return (paragraph, char) => {
    const run = runOf(plan, paragraph, char);
    if (!run) {
      return plain;
    }
    const request = { ...plan.request, family: run.font ?? plan.request.family, weight: run.weight ?? plan.request.weight, italic: run.italic ?? plan.request.italic };
    return { request, size: run.size === undefined || !plan.share ? size : (size * run.size) / plan.share, tracking: run.tracking ?? plan.tracking, leading: run.leading ?? plan.leading };
  };
}

const UNDERLINE_EM = 0.1;
const STRIKE_EM = -0.3;
const RULE_EM = 0.06;

function decorations(run: TextRun | null, g: Glyph, x: number, baseline: number): number[][] {
  const bar = (at: number) => rect([x + g.pen, baseline + at * g.size, x + g.pen + g.advance, baseline + (at + RULE_EM) * g.size]);
  return [...(run?.underline || run?.link ? [bar(UNDERLINE_EM)] : []), ...(run?.strike ? [bar(STRIKE_EM)] : [])];
}

type Placed = { laid: Laid; type: Type; room: number };

const topOf = (plan: TextPlan, laid: Laid) => plan.frame.top + (plan.frame.anchor === Anchor.Centre ? (plan.frame.height - laid.height) * plan.typography.vertical : 0);

function place(plan: TextPlan, fonts: FaceBook): Placed {
  const typeAt = (size: number, limit = plan.typography.paragraph.limit): Type => {
    const requestAt = requestAtOf(plan, size);
    const own = plan.typography.paragraph;
    const paragraph = { ...own, limit, indent: own.indent * size, spacing: own.spacing * size, lists: own.lists.map((m) => (m ? { ...m, inset: m.inset * size, gap: m.gap * size } : null)) };
    return { request: plan.request, size, tracking: plan.tracking, leading: plan.leading, inset: plan.inset * size, shaping: plan.shaping, paragraph, features: plan.typography.features, ...(requestAt ? { requestAt } : {}) };
  };
  const looks = plan.animation?.looks;
  const words = wordsOf(plan.text);
  const before = charsBeforeOf(words);
  const wordsBefore = plan.paragraphs.map((_, i) => plan.paragraphs.slice(0, i).reduce((n, para) => n + (para.match(WORD)?.length ?? 0), 0));
  const extra: Extra = looks ? (paragraph, word, letter) => looks[(before[wordsBefore[paragraph] + word] ?? 0) + letter]?.spacing ?? 0 : NO_EXTRA;
  const lay = (size: number, limit?: number) => layOut(plan.paragraphs, typeAt(size, limit), plan.flow, plan.frame.width, fonts, extra);
  const size = plan.fits ? fitSize(plan.size, (s) => lay(s), plan.frame) : plan.size;
  const whole = lay(size);
  const overflows = plan.typography.clips && plan.typography.paragraph.limit === NO_LIMIT && whole.height > plan.frame.height;
  const laid = overflows ? lay(size, Math.max(1, Math.floor(plan.frame.height / whole.lineHeight))) : whole;
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

type Positioned = { face: Face; skew: number; glyph: number; x: number; y: number };

type Unit = { look: Tinted; contours: number[][]; outlines: number[][]; glyphs: Positioned[]; box: Rect; area: Rect; colour: string | null; gradient: number | null; opacity: number };

function runsOf(glyphs: Positioned[], size: number): GlyphRun[] | null {
  if (!glyphs.every((g) => g.face.key && g.skew === 0)) {
    return null;
  }
  const byFace = new Map<Face, Positioned[]>();
  glyphs.forEach((g) => byFace.set(g.face, [...(byFace.get(g.face) ?? []), g]));
  return [...byFace].map(([face, own]) => ({ font: face.key!.font, coords: face.key!.coords, size, glyphs: own.map((g): [number, number, number] => [g.glyph, g.x, g.y]) }));
}

export function inksOf(plan: TextPlan, fonts: FaceBook, output: TextOutput = TextOutput.Outlines): Painted | TextGap {
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
  const top = topOf(plan, laid);
  const matrix: Affine = [1, 0, 0, 1, left, top + FADE_RISE_PX * (1 - plan.fade)];
  const inks: Ink[] = [];
  const stripWidth = laid.blocks.reduce((n, b) => n + b.lines.reduce((m, line) => m + inkedWidth(line), 0), 0);
  let strip = 0;
  laid.blocks.forEach((block, i) => {
    const rise = plan.rises ? (RISE_PERCENT / PERCENT) * block.height * (1 - plan.rises[i]) : 0;
    const mask: Rect | null = plan.rises ? [0, block.top, room, block.top + block.height + DESCENDER_EM * type.size] : null;
    const backdrop: number[][] = [];
    const ruleInk: number[][] = [];
    const units = new Map<string, Unit>();
    block.lines.forEach((line, l) => {
      const x = block.inset + (room - block.inset - line.width) * plan.align;
      const top = block.top + line.top + rise;
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
      const drawn = [...(l === 0 ? block.marker.map((g) => ({ g, at: 0, marked: true })) : []), ...line.glyphs.map((g) => ({ g, at: x, marked: false }))];
      for (const { g, at, marked } of drawn) {
        const slot = slots && g.word >= 0 ? slots(i, g) : null;
        const style = marked ? null : runOf(plan, i, g.char);
        const gradient = style?.fill ? style.start : null;
        const colour = gradient === null ? (style?.color ?? null) : null;
        const key = `${slot ? slot.key : -1}:${plan.area === Area.Line ? l : 0}:${colour}:${gradient}:${style?.opacity ?? 1}`;
        const unit = units.get(key) ?? { look: slot && run ? (run.looks[slot.look] ?? UNTINTED) : UNTINTED, contours: [], outlines: [], glyphs: [], box: [Infinity, Infinity, -Infinity, -Infinity], area: areas[plan.area], colour, gradient, opacity: style?.opacity ?? 1 };
        units.set(key, unit);
        const shape = moved(glyphContours(g.face, g.glyph, g.size, g.skew, smoothing.darken(g.size)), at + g.x, baseline - g.dy);
        const rules = ruled(plan.typography.rule, g, at, baseline, shape);
        unit.contours.push(...shape, ...decorations(style, g, at, baseline), ...(plan.typography.ruleColour ? [] : rules));
        ruleInk.push(...(plan.typography.ruleColour ? rules : []));
        unit.glyphs.push({ face: g.face, skew: g.skew, glyph: g.glyph, x: at + g.x, y: baseline - g.dy });
        unit.outlines.push(...(plan.outline ? moved(glyphContours(g.face, g.glyph, g.size, g.skew, 0), at + g.x, baseline - g.dy + smoothing.rise) : []));
        unit.box = [Math.min(unit.box[0], at + g.pen), Math.min(unit.box[1], top), Math.max(unit.box[2], at + g.pen + g.advance), Math.max(unit.box[3], top + line.height)];
      }
    });
    if (plan.typography.ruleColour && ruleInk.length) {
      inks.push({ contours: ruleInk, paint: { kind: PaintKind.Solid, color: plan.typography.ruleColour }, rule: FillRule.NonZero, opacity: plan.fade, matrix, blur: 0 });
    }
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
      const ink = (contours: number[][], paint: Paint, rule: FillRule, squash = 1, picture?: Picture): Ink => ({ contours: squashed(contours, squash), paint, rule, opacity: plan.fade * look.opacity * unit.opacity, matrix: unsquashed(matrix, squash), blur: look.blur * scaleOf(look.turn), ...(picture ? { picture } : {}) });
      const shown = placed(unit.contours);
      const runs = output === TextOutput.Glyphs && rise === 0 ? runsOf(unit.glyphs, type.size) : null;
      const asRuns = (paint: Paint) => runs!.map((run): Ink => ({ contours: [], paint, rule: FillRule.NonZero, opacity: plan.fade * look.opacity * unit.opacity, matrix: look === UNTINTED ? matrix : mul2d(matrix, turn), blur: look.blur * scaleOf(look.turn), run }));
      const fills: FillPlan[] = unit.gradient !== null ? plan.gradients[unit.gradient] : unit.colour ? [{ kind: PaintKind.Solid, color: plan.tints[unit.colour] }] : plan.fills;
      const area: Rect = unit.gradient !== null ? unit.box : unit.area;
      const filled = fills.flatMap((f) => shadesOf(f, area)).flatMap((shade) => (runs && shade.squash === 1 && !shade.picture ? asRuns(tinted(shade.paint, look)) : [ink(shown, tinted(shade.paint, look), FillRule.NonZero, shade.squash, shade.picture)]));
      const outline = plan.outline;
      const stroked = outline ? [ink(placed(unit.outlines.flatMap((c) => strokePolygons(c, true, outline.width, Cap.Butt, Join.Miter))), tinted({ kind: PaintKind.Solid, color: outline.colour }, look), FillRule.Union)] : [];
      inks.push(...(outline?.under ? [...stroked, ...filled] : [...filled, ...stroked]).filter((i) => (i.contours.length || i.run) && visible(i.paint)));
    }
  });
  const rendered = { left, top: plan.frame.top, width: plan.frame.hugs ? laid.width : plan.frame.width, height: plan.frame.anchor === Anchor.Top ? laid.height : plan.frame.height };
  return { inks: inks.filter((i) => i.opacity > 0), frame: rendered };
}

export function paintText(env: TextEnv): Painted | TextGap {
  const plan = planOf(env);
  return typeof plan === 'string' ? plan : inksOf(plan, env.fonts, env.output);
}

const SPACE_EM = 0.25;

function spaceOf(laid: Laid, paragraphs: string[], size: number): number {
  const glyphs = laid.blocks.flatMap((b, p) => b.lines.flatMap((l) => l.glyphs.filter((g) => [...(paragraphs[p] ?? '')][g.char] === ' ')));
  return glyphs[0]?.advance ?? size * SPACE_EM;
}

export type Caret = { lines: CaretLine[]; left: number; top: number; width: number; height: number; size: number; vertical: number };

export function caretOf(plan: TextPlan, fonts: FaceBook): Caret | TextGap {
  const { laid, room, type } = place(plan, fonts);
  if (!laid.blocks.some((b) => b.lines.length) || laid.ascent + laid.descent === 0) {
    return TextGap.Font;
  }
  if (laid.missing) {
    return TextGap.Glyph;
  }
  const top = topOf(plan, laid);
  return {
    lines: caretLines(laid, plan.paragraphs, { room, align: plan.align, top: 0, space: spaceOf(laid, plan.paragraphs, type.size) }),
    left: plan.frame.left,
    top,
    width: plan.frame.hugs ? laid.width : plan.frame.width,
    height: plan.frame.anchor === Anchor.Top ? laid.height : plan.frame.height,
    size: type.size,
    vertical: plan.frame.anchor === Anchor.Centre ? plan.typography.vertical : 0
  };
}
