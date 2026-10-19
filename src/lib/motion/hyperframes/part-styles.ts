import { resolveFills, textPaint, type FillPaint } from '../fill/render';
import { FillType, type Fill } from '../fill/model';
import { GEOMETRY_TAGS, ShapePaint, shapePaint } from '../part-shapes';
import { parsePart } from '../poster-parts';
import type { MotionClip } from '../doc';

type PartRule = (at: string, fills: readonly Fill[], color: FillPaint['color'], asset: FillPaint['asset']) => string;

const kebab = (prop: string) => prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const quoted = (value: string) => value.replace(/["\\]/g, '\\$&');
const inert = (value: string) => value.replace(/[{}<>;]/g, '');
const declarations = (style: Record<string, string>) => Object.entries(style).map(([prop, value]) => `${kebab(prop)}:${inert(value)} !important`).join(';');
const GEOMETRY = `:is(${GEOMETRY_TAGS.join(',')})`;
const TEXT_ONLY = /^(WebkitBackgroundClip|backgroundClip|WebkitTextFillColor|color)$/;
const UNPAINTED = 'transparent';

function topColour(fills: readonly Fill[], color: FillPaint['color'], asset: FillPaint['asset']): string {
  const top = resolveFills(fills, color, asset).filter((f) => f.visible && f.type !== FillType.Image).at(-1);
  if (!top || top.type === FillType.Image) {
    return UNPAINTED;
  }
  return top.type === FillType.Solid ? top.color : top.stops[0].color;
}

const textRule: PartRule = (at, fills, color, asset) => {
  const paint = textPaint(fills, color, asset);
  const colour = inert(paint.color);
  const inner = paint.backgroundClip ? '' : `${at} *{color:${colour} !important}${at} :is(text,tspan),${at}:is(text,tspan){fill:${colour} !important}`;
  return `${at}{${declarations(paint)}}${inner}`;
};

const fillRule: PartRule = (at, fills, color, asset) => `${at}${GEOMETRY},${at} ${GEOMETRY}{fill:${inert(topColour(fills, color, asset))} !important}`;

const backgroundRule: PartRule = (at, fills, color, asset) => {
  const paint = textPaint(fills, color, asset);
  const layers = Object.fromEntries(Object.entries(paint).filter(([prop]) => !TEXT_ONLY.test(prop)));
  const style = paint.backgroundImage ? layers : { backgroundColor: paint.color, backgroundImage: 'none' };
  return `${at}{${declarations(style)}}`;
};

const PAINT_RULE: Record<ShapePaint, PartRule> = {
  [ShapePaint.Fill]: fillRule,
  [ShapePaint.Background]: backgroundRule
};

const ruleOf = (clip: MotionClip, part: string): PartRule => {
  const paint = shapePaint(String(clip.props.name), parsePart(part).field);
  return paint ? PAINT_RULE[paint] : textRule;
};

export function partStyleCss(clips: readonly MotionClip[], color: FillPaint['color'], asset: FillPaint['asset']): string {
  return clips
    .flatMap((clip) =>
      Object.entries(clip.partStyles ?? {}).map(([part, { fills }]) => ruleOf(clip, part)(`[data-clip="${quoted(clip.id)}"] [data-part="${quoted(part)}"]`, fills, color, asset))
    )
    .join('');
}

export function partStyleTag(clips: readonly MotionClip[], color: FillPaint['color'], asset: FillPaint['asset']): string {
  const css = partStyleCss(clips, color, asset);
  return css ? `<style>${css.replace(/<\//g, '<\\/')}</style>` : '';
}
