import type { MotionClip } from '../doc';
import type { Box } from '../layout';
import { isText } from '../layout/text-extent';
import { BlendMode, blendStyle } from '../blend';
import { MaskKind, MaskMode, Matte, type Mask } from '../mask';
import { featureCss, featuresOf } from '../decoration';
import { variation } from '../hyperframes/type-style';
import { TYPE } from '../components';
import { FillType, ImageFit, colourAlpha, cssLinearAngle, fillsOf, withAlpha, type Fill, type FillOf, type Stop } from '../fill/model';
import { DIAMOND_CORNERS, QUADRANT, halfway } from '../fill/render';
import { StrokeAlign, dashOf, strokesOf, type Stroke } from '../stroke/model';
import { ShapeKind } from '../shape/schema';
import { EffectKind } from '../effects/registry';
import type { Effect } from '../effects/model';
import { BUILTIN_NAME, isBuiltin } from '../fonts/model';
import { isRef, type CssValue, type Rule } from './ir';
import { px, round } from './place';
import { ColourRole, type TokenBook } from './tokens';

export type Painter = { tokens: TokenBook; unit: number; asset: (id: string) => string; colourVar: (clip: MotionClip, key: string) => string | undefined };

const FULL_OPACITY = 1;
const ROUND_SHAPES: ReadonlySet<string> = new Set([ShapeKind.Circle, ShapeKind.Ellipse]);
const DEGREES = 180;
const SHADOW = 'box-shadow';
const FULLY_ROUND = 0.5;

const IMAGE_SIZE: Record<ImageFit, string> = {
  [ImageFit.Cover]: 'cover',
  [ImageFit.Contain]: 'contain',
  [ImageFit.Fill]: '100% 100%',
  [ImageFit.Crop]: 'cover',
  [ImageFit.Tile]: 'auto'
};

const plain = (value: CssValue): string => (isRef(value) ? value.raw : value);

function colourWith(value: CssValue, opacity: number): CssValue {
  if (opacity >= FULL_OPACITY || isRef(value) || !value.startsWith('#')) {
    return value;
  }
  const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
  return `${value}${alpha}`;
}

type Part = { image: string; size?: string; position?: string; repeat?: string };

type FillCtx = { painter: Painter; box: Box };

const PERCENT = 100;
const at = (p: { x: number; y: number }) => `${round(p.x * PERCENT)}% ${round(p.y * PERCENT)}%`;
function tinted(ctx: FillCtx, colour: string, opacity: number): string {
  const resolved = ctx.painter.tokens.literal(colour);
  return withAlpha(resolved, colourAlpha(resolved).alpha * opacity, (c) => c);
}

const stopList = (stops: Stop[], opacity: number, ctx: FillCtx) =>
  [...stops]
    .sort((a, b) => a.pos - b.pos)
    .map((s) => `${tinted(ctx, s.color, opacity)} ${round(s.pos * PERCENT)}%`)
    .join(', ');

const FILL_PART: { [T in FillType]: (fill: FillOf<T>, ctx: FillCtx) => Part[] } = {
  [FillType.Solid]: (f, ctx) => [{ image: `linear-gradient(${tinted(ctx, f.color, f.opacity)}, ${tinted(ctx, f.color, f.opacity)})` }],
  [FillType.Linear]: (f, ctx) => [{ image: `linear-gradient(${round(cssLinearAngle(f.angle))}deg, ${stopList(f.stops, f.opacity, ctx)})` }],
  [FillType.Radial]: (f, ctx) => [{ image: `radial-gradient(circle ${round((Math.max(ctx.box.width, ctx.box.height) * f.radius) / 2)}px at ${at(f.center)}, ${stopList(f.stops, f.opacity, ctx)})` }],
  [FillType.Angular]: (f, ctx) => [{ image: `conic-gradient(from ${round(f.angle)}deg at ${at(f.center)}, ${stopList(f.stops, f.opacity, ctx)})` }],
  [FillType.Diamond]: (f, ctx) => DIAMOND_CORNERS.map(([to, position]) => ({ image: `linear-gradient(${to}, ${stopList(halfway(f.stops), f.opacity, ctx)})`, size: QUADRANT, position, repeat: 'no-repeat' })),
  [FillType.Image]: (f, ctx) => [{ image: `url("${ctx.painter.asset(f.assetId)}")`, size: IMAGE_SIZE[f.fit], position: at(f.focus), repeat: f.fit === ImageFit.Tile ? 'repeat' : 'no-repeat' }]
};

const LAYER_DEFAULT = { size: 'auto', position: '0% 0%', repeat: 'repeat' };
const LAYER_PROPERTY = { size: 'background-size', position: 'background-position', repeat: 'background-repeat' } as const;

const partsOf = (fill: Fill, ctx: FillCtx): Part[] => (FILL_PART[fill.type] as (f: Fill, c: FillCtx) => Part[])(fill, ctx);

export function backgroundRules(clip: MotionClip, painter: Painter, role: ColourRole, box: Box): Rule[] {
  const fills = fillsOf(clip.props).filter((f) => f.visible);
  const only = fills[0];
  if (fills.length === 1 && only.type === FillType.Solid) {
    return [['background-color', colourWith(painter.tokens.colour(only.color, role, painter.colourVar(clip, 'fill')), only.opacity)]];
  }
  const ctx = { painter, box };
  const layers = [...fills].reverse().flatMap((fill) => partsOf(fill, ctx).map((part) => ({ ...part, blend: blendStyle(fill.blend) ?? BlendMode.Normal })));
  if (!layers.length) {
    return [];
  }
  const rules: Rule[] = [['background-image', layers.map((l) => l.image).join(', ')]];
  for (const key of Object.keys(LAYER_PROPERTY) as (keyof typeof LAYER_PROPERTY)[]) {
    if (layers.some((l) => l[key])) {
      rules.push([LAYER_PROPERTY[key], layers.map((l) => l[key] ?? LAYER_DEFAULT[key]).join(', ')]);
    }
  }
  if (layers.some((l) => l.blend !== BlendMode.Normal)) {
    rules.push(['background-blend-mode', layers.map((l) => l.blend).join(', ')]);
  }
  return rules;
}

const strokeStyle = (s: Stroke) => (dashOf(s).length ? 'dashed' : 'solid');

const SIDE_NAMES = ['top', 'right', 'bottom', 'left'] as const;

enum Slot {
  Border = 'border',
  Outline = 'outline',
  Ring = 'ring'
}

const SOLID_SLOT: Record<StrokeAlign, Slot> = { [StrokeAlign.Inside]: Slot.Border, [StrokeAlign.Center]: Slot.Ring, [StrokeAlign.Outside]: Slot.Ring };
const DASHED_SLOT: Record<StrokeAlign, Slot> = { [StrokeAlign.Inside]: Slot.Border, [StrokeAlign.Center]: Slot.Outline, [StrokeAlign.Outside]: Slot.Outline };
const OUTLINE_OFFSET: Record<StrokeAlign, (width: number) => number> = { [StrokeAlign.Inside]: (w) => -w, [StrokeAlign.Center]: (w) => -w / 2, [StrokeAlign.Outside]: () => 0 };
const RING: Record<StrokeAlign, (width: number, colour: string) => string[]> = {
  [StrokeAlign.Inside]: (w, c) => [`inset 0 0 0 ${round(w)}px ${c}`],
  [StrokeAlign.Center]: (w, c) => [`0 0 0 ${round(w / 2)}px ${c}`, `inset 0 0 0 ${round(w / 2)}px ${c}`],
  [StrokeAlign.Outside]: (w, c) => [`0 0 0 ${round(w)}px ${c}`]
};

const drawn = (s: Stroke) => s.visible && s.width > 0;
const solidStroke = (s: Stroke) => s.paint.type === FillType.Solid;

type Placed = { stroke: Stroke; slot: Slot };

function place(strokes: readonly Stroke[]): { placed: Placed[]; left: Stroke[] } {
  const placed: Placed[] = [];
  const left: Stroke[] = [];
  const taken = new Set<Slot>();
  for (const stroke of strokes) {
    const wanted = stroke.sides ? Slot.Border : dashOf(stroke).length ? DASHED_SLOT[stroke.align] : SOLID_SLOT[stroke.align];
    const spare = wanted === Slot.Border && !stroke.sides && !dashOf(stroke).length;
    const slot = wanted !== Slot.Ring && taken.has(wanted) ? (spare ? Slot.Ring : null) : wanted;
    if (!slot) {
      left.push(stroke);
      continue;
    }
    taken.add(slot);
    placed.push({ stroke, slot });
  }
  return { placed, left };
}

const solids = (clip: MotionClip) => strokesOf(clip.props).filter((s) => drawn(s) && solidStroke(s));

export function borderRules(clip: MotionClip, painter: Painter): Rule[] {
  const rules: Rule[] = [];
  const rings: string[][] = [];
  for (const { stroke, slot } of place(solids(clip)).placed) {
    const paint = stroke.paint as FillOf<FillType.Solid>;
    const width = stroke.width * painter.unit;
    if (slot === Slot.Ring) {
      rings.push(RING[stroke.align](width, plain(colourWith(painter.tokens.literal(paint.color), paint.opacity))));
      continue;
    }
    const colour = colourWith(painter.tokens.colour(paint.color, ColourRole.Stroke), paint.opacity);
    const line = (w: number): CssValue => (isRef(colour) ? { ...colour, before: `${px(w)} ${strokeStyle(stroke)} ` } : `${px(w)} ${strokeStyle(stroke)} ${colour}`);
    if (slot === Slot.Outline) {
      rules.push(['outline', line(width)], ['outline-offset', px(OUTLINE_OFFSET[stroke.align](width))]);
      continue;
    }
    rules.push(...(stroke.sides ? stroke.sides.flatMap((w, i) => (w > 0 ? [[`border-${SIDE_NAMES[i]}`, line(w * painter.unit)] as Rule] : [])) : [['border', line(width)] as Rule]));
  }
  return rings.length ? [...rules, ['box-shadow', [...rings].reverse().flat().join(', ')]] : rules;
}

export function paintNotes(clip: MotionClip): string[] {
  const notes: string[] = [];
  for (const fill of fillsOf(clip.props).filter((f) => f.visible && f.blend !== BlendMode.Normal && !blendStyle(f.blend))) {
    notes.push(`the ${fill.blend} blend on a fill has no CSS equivalent and was left out.`);
  }
  const strokes = strokesOf(clip.props).filter(drawn);
  if (strokes.some((s) => !solidStroke(s))) {
    notes.push('a gradient stroke has no CSS equivalent and was left out.');
  }
  if (strokes.some((s) => s.sides && s.align !== StrokeAlign.Inside)) {
    notes.push('a per-side stroke is drawn inside the box: its centred or outside alignment was left out.');
  }
  if (place(solids(clip)).left.length) {
    notes.push('a box carries one border and one outline: the strokes beyond them were left out.');
  }
  return notes;
}

export function radiusRules(clip: MotionClip, box: Box, painter: Painter): Rule[] {
  const props = clip.props as { shape?: string; roundness?: number; corners?: number[] };
  if (ROUND_SHAPES.has(props.shape ?? '')) {
    return [['border-radius', '50%']];
  }
  const side = Math.min(box.width, box.height);
  const corners = props.corners?.length === 4 ? props.corners : null;
  if (corners && new Set(corners).size > 1) {
    return [['border-radius', corners.map((c) => px(c * side)).join(' ')]];
  }
  const roundness = corners?.[0] ?? props.roundness ?? 0;
  if (roundness >= FULLY_ROUND) {
    return [['border-radius', '9999px']];
  }
  return roundness > 0 ? [['border-radius', painter.tokens.radius(Math.round(roundness * side))]] : [];
}

type EffectCss = (params: Record<string, number | string>) => Rule;

const num = (params: Record<string, number | string>, key: string, fallback: number) => (typeof params[key] === 'number' ? (params[key] as number) : fallback);

function shadow(params: Record<string, number | string>, inset: string, spread: boolean): string {
  const angle = (num(params, 'angle', 135) * Math.PI) / DEGREES;
  const distance = num(params, 'distance', 16);
  const x = round(distance * Math.cos(angle) + num(params, 'x', 0));
  const y = round(distance * Math.sin(angle) + num(params, 'y', 0));
  const colour = colourWith(String(params.color ?? '#000000'), num(params, 'opacity', 0.5));
  const reach = spread ? ` ${round(num(params, 'spread', 0))}px` : '';
  return `${inset}${x}px ${y}px ${round(num(params, 'blur', 24))}px${reach} ${plain(colour)}`;
}

enum LayerKind {
  Box = 'box',
  Text = 'text'
}

const BLURS: Partial<Record<EffectKind, EffectCss>> = {
  [EffectKind.GaussianBlur]: (p) => ['filter', `blur(${round(num(p, 'radius', 8))}px)`],
  [EffectKind.BackgroundBlur]: (p) => ['backdrop-filter', `blur(${round(num(p, 'radius', 4))}px)`]
};

const EFFECT_CSS: Record<LayerKind, Partial<Record<EffectKind, EffectCss>>> = {
  [LayerKind.Box]: {
    ...BLURS,
    [EffectKind.DropShadow]: (p) => ['box-shadow', shadow(p, '', true)],
    [EffectKind.InnerShadow]: (p) => ['box-shadow', shadow(p, 'inset ', true)]
  },
  [LayerKind.Text]: {
    ...BLURS,
    [EffectKind.DropShadow]: (p) => ['text-shadow', shadow(p, '', false)]
  }
};

export type Area = { box: Box; frame: { width: number; height: number } };

type MaskCss = (mask: Mask, area: Area) => Rule;

const local = (mask: Mask, { box, frame }: Area) => {
  const half = { x: (mask.width * frame.width) / 2, y: (mask.height * frame.height) / 2 };
  const centre = { x: mask.x * frame.width - box.left, y: mask.y * frame.height - box.top };
  return { half, centre, box };
};

const MASK_CSS: Partial<Record<MaskKind, MaskCss>> = {
  [MaskKind.Rect]: (mask, area) => {
    const { half, centre, box } = local(mask, area);
    return ['clip-path', `inset(${px(centre.y - half.y)} ${px(box.width - centre.x - half.x)} ${px(box.height - centre.y - half.y)} ${px(centre.x - half.x)})`];
  },
  [MaskKind.Ellipse]: (mask, area) => {
    const { half, centre } = local(mask, area);
    return ['clip-path', `ellipse(${px(half.x)} ${px(half.y)} at ${px(centre.x)} ${px(centre.y)})`];
  }
};

const plainMask = (m: Mask) => m.mode === MaskMode.Add && !m.rotation && !m.feather && !m.expansion && m.opacity === FULL_OPACITY && !m.invert;

const MASK_SPAN = 'a mask stack';

function maskRule(clip: MotionClip, area: Area): { rules: Rule[]; dropped: string[] } {
  if (clip.maskStack.length) {
    return { rules: [], dropped: [`${MASK_SPAN} has no CSS equivalent and was left out.`] };
  }
  const mask = clip.mask;
  const css = mask ? MASK_CSS[mask.kind] : undefined;
  if (mask && css && plainMask(mask)) {
    return { rules: [css(mask, area)], dropped: [] };
  }
  return { rules: [], dropped: mask ? [`the ${mask.kind} mask, as set, has no CSS equivalent and was left out.`] : [] };
}

export function effectRules(clip: MotionClip, area: Area): { rules: Rule[]; dropped: string[] } {
  const live = (clip.effects as Effect[]).filter((e) => e.enabled);
  const table = EFFECT_CSS[isText(clip.component) ? LayerKind.Text : LayerKind.Box];
  const css = live.flatMap((e) => (table[e.kind] ? [table[e.kind]!(e.params)] : []));
  const merged = new Map<string, string>();
  for (const [property, value] of css) {
    merged.set(property, merged.has(property) ? `${merged.get(property)}, ${plain(value)}` : plain(value));
  }
  const props = clip.props as { opacity?: number; rotation?: number };
  const rules: Rule[] = [...merged.entries()];
  if (typeof props.opacity === 'number' && props.opacity < FULL_OPACITY) {
    rules.push(['opacity', String(round(props.opacity))]);
  }
  if (props.rotation) {
    rules.push(['transform', `rotate(${round(props.rotation)}deg)`]);
  }
  const blend = blendStyle(clip.blend);
  const dropped = live.filter((e) => !table[e.kind]).map((e) => `the ${e.kind} effect has no CSS equivalent and was left out.`);
  if (blend) {
    rules.push(['mix-blend-mode', blend]);
  }
  if (clip.blend !== BlendMode.Normal && !blend) {
    dropped.push(`the ${clip.blend} blend has no CSS equivalent and was left out.`);
  }
  if (clip.matte !== Matte.None) {
    dropped.push(`the ${clip.matte} matte has no CSS equivalent and was left out.`);
  }
  const masked = maskRule(clip, area);
  return { rules: [...rules, ...masked.rules], dropped: [...dropped, ...masked.dropped] };
}

export function mergeShadows(rules: Rule[]): Rule[] {
  const joined = new Map<string, string[]>();
  for (const [property, value] of rules) {
    if (property === SHADOW) {
      joined.set(property, [...(joined.get(property) ?? []), plain(value)]);
    }
  }
  const seen = new Set<string>();
  return rules.flatMap(([property, value]) => {
    if (property !== SHADOW) {
      return [[property, value] as Rule];
    }
    return seen.has(property) ? [] : (seen.add(property), [[property, joined.get(property)!.join(', ')] as Rule]);
  });
}

export const familyOf = (font: unknown): string => {
  const name = typeof font === 'string' && font ? font : 'sans';
  return isBuiltin(name) ? BUILTIN_NAME[name] : name;
};

const TEXT_CASE: Record<string, string | null> = { 'as-typed': null, upper: 'uppercase', lower: 'lowercase', title: 'capitalize', 'small-caps': null };

const DEFAULT_ALIGN = 'left';

export function typeRules(clip: MotionClip, painter: Painter, multiline: boolean): Rule[] {
  const p = clip.props as { font?: string; size?: number; weight?: number; leading?: number; tracking?: number; color?: string; align?: string; italic?: boolean; textCase?: string; stretch?: number; slant?: number; axes?: string; features?: string };
  const stack = (clip.props as { fills?: unknown }).fills;
  const fills = Array.isArray(stack) ? fillsOf({ fills: stack }) : [];
  const solid = fills.filter((f) => f.visible && f.type === FillType.Solid).at(-1) as Extract<Fill, { type: FillType.Solid }> | undefined;
  const colour = solid?.color ?? p.color;
  const transform = TEXT_CASE[p.textCase ?? 'as-typed'];
  const rules: Rule[] = [
    ['font-family', painter.tokens.font(familyOf(p.font))],
    ['font-size', px((p.size ?? 0) * painter.unit)],
    ['font-weight', String(p.weight ?? 400)],
    ['line-height', String(round(p.leading ?? 1.2))]
  ];
  if (p.tracking) {
    rules.push(['letter-spacing', `${round(p.tracking)}em`]);
  }
  if (colour) {
    rules.push(['color', painter.tokens.colour(colour, ColourRole.Text, painter.colourVar(clip, 'color'), (p.size ?? 0) * painter.unit)]);
  }
  if (p.align && p.align !== DEFAULT_ALIGN) {
    rules.push(['text-align', p.align]);
  }
  if (p.italic) {
    rules.push(['font-style', 'italic']);
  }
  if (p.textCase === 'small-caps') {
    rules.push(['font-variant', 'small-caps']);
  }
  const axes = variation({ stretch: p.stretch ?? TYPE.stretch.fallback, slant: p.slant ?? TYPE.slant.fallback, axes: p.axes ?? '' });
  if (axes) {
    rules.push(['font-variation-settings', axes]);
  }
  const features = featureCss(featuresOf(p.features));
  if (features) {
    rules.push(['font-feature-settings', features]);
  }
  if (transform) {
    rules.push(['text-transform', transform]);
  }
  if (multiline) {
    rules.push(['white-space', 'pre-line']);
  }
  return rules;
}
