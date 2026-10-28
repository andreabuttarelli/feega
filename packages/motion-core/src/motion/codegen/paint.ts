import type { MotionClip } from '../doc';
import type { Box } from '../layout';
import { FillType, ImageFit, fillsOf, type Fill } from '../fill/model';
import { strokesOf, type Stroke } from '../stroke/model';
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

const stopsOf = (fill: Extract<Fill, { stops: unknown }>) => fill.stops.map((s) => `${s.color} ${round(s.pos * 100)}%`).join(', ');

type FillLayer = (fill: Fill, painter: Painter) => string;

const LAYER: Partial<Record<FillType, FillLayer>> = {
  [FillType.Linear]: (f) => `linear-gradient(${round((f as Extract<Fill, { angle: number }>).angle)}deg, ${stopsOf(f as Extract<Fill, { stops: unknown }>)})`,
  [FillType.Radial]: (f) => `radial-gradient(circle, ${stopsOf(f as Extract<Fill, { stops: unknown }>)})`,
  [FillType.Image]: (f, painter) => `url("${painter.asset((f as Extract<Fill, { type: FillType.Image }>).assetId)}")`
};

export function backgroundRules(clip: MotionClip, painter: Painter, role: ColourRole): Rule[] {
  const fills = fillsOf(clip.props).filter((f) => f.visible);
  const solid = fills.filter((f) => f.type === FillType.Solid).at(-1) as Extract<Fill, { type: FillType.Solid }> | undefined;
  const layers = fills.filter((f) => LAYER[f.type]).reverse();
  const rules: Rule[] = [];
  if (solid) {
    rules.push(['background-color', colourWith(painter.tokens.colour(solid.color, role, painter.colourVar(clip, 'fill')), solid.opacity)]);
  }
  if (layers.length) {
    rules.push(['background-image', layers.map((f) => LAYER[f.type]!(f, painter)).join(', ')]);
  }
  const image = layers.find((f) => f.type === FillType.Image) as Extract<Fill, { type: FillType.Image }> | undefined;
  if (image) {
    rules.push(['background-size', IMAGE_SIZE[image.fit]], ['background-position', `${round(image.focus.x * 100)}% ${round(image.focus.y * 100)}%`]);
  }
  return rules;
}

const strokeStyle = (s: Stroke) => (s.dash > 0 || s.pattern?.some((d) => d > 0) ? 'dashed' : 'solid');

const SIDE_NAMES = ['top', 'right', 'bottom', 'left'] as const;

export function borderRules(clip: MotionClip, painter: Painter): Rule[] {
  const stroke = strokesOf(clip.props).find((s) => s.visible && s.paint.type === FillType.Solid && s.width > 0);
  if (!stroke || stroke.paint.type !== FillType.Solid) {
    return [];
  }
  const colour = colourWith(painter.tokens.colour(stroke.paint.color, ColourRole.Stroke), stroke.paint.opacity);
  const style = strokeStyle(stroke);
  const line = (width: number): CssValue => (isRef(colour) ? { ...colour, before: `${px(width * painter.unit)} ${style} ` } : `${px(width * painter.unit)} ${style} ${colour}`);
  if (!stroke.sides) {
    return [['border', line(stroke.width)]];
  }
  return stroke.sides.flatMap((w, i) => (w > 0 ? [[`border-${SIDE_NAMES[i]}`, line(w)] as Rule] : []));
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

function shadow(params: Record<string, number | string>, inset: string): string {
  const angle = (num(params, 'angle', 135) * Math.PI) / DEGREES;
  const distance = num(params, 'distance', 16);
  const x = round(distance * Math.cos(angle) + num(params, 'x', 0));
  const y = round(distance * Math.sin(angle) + num(params, 'y', 0));
  const colour = colourWith(String(params.color ?? '#000000'), num(params, 'opacity', 0.5));
  return `${inset}${x}px ${y}px ${round(num(params, 'blur', 24))}px ${round(num(params, 'spread', 0))}px ${plain(colour)}`;
}

const EFFECT_CSS: Partial<Record<EffectKind, EffectCss>> = {
  [EffectKind.DropShadow]: (p) => ['box-shadow', shadow(p, '')],
  [EffectKind.InnerShadow]: (p) => ['box-shadow', shadow(p, 'inset ')],
  [EffectKind.GaussianBlur]: (p) => ['filter', `blur(${round(num(p, 'radius', 8))}px)`],
  [EffectKind.BackgroundBlur]: (p) => ['backdrop-filter', `blur(${round(num(p, 'radius', 4))}px)`]
};

export function effectRules(clip: MotionClip): { rules: Rule[]; dropped: string[] } {
  const live = (clip.effects as Effect[]).filter((e) => e.enabled);
  const css = live.flatMap((e) => (EFFECT_CSS[e.kind] ? [EFFECT_CSS[e.kind]!(e.params)] : []));
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
  return { rules, dropped: live.filter((e) => !EFFECT_CSS[e.kind]).map((e) => e.kind) };
}

export const familyOf = (font: unknown): string => {
  const name = typeof font === 'string' && font ? font : 'sans';
  return isBuiltin(name) ? BUILTIN_NAME[name] : name;
};

const TEXT_CASE: Record<string, string | null> = { 'as-typed': null, upper: 'uppercase', lower: 'lowercase', title: 'capitalize', 'small-caps': null };

const DEFAULT_ALIGN = 'left';

export function typeRules(clip: MotionClip, painter: Painter, multiline: boolean): Rule[] {
  const p = clip.props as { font?: string; size?: number; weight?: number; leading?: number; tracking?: number; color?: string; align?: string; italic?: boolean; textCase?: string };
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
  if (transform) {
    rules.push(['text-transform', transform]);
  }
  if (multiline) {
    rules.push(['white-space', 'pre-line']);
  }
  return rules;
}
