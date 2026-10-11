import { TYPE, type TextCase } from '../components';
import { px } from './html';

type Keyed = number | string;

export type TypeProps = { font: string; weight: Keyed; italic: boolean; tracking: Keyed; leading: Keyed; stretch: Keyed; slant: Keyed; axes: string; textCase?: TextCase };

const TRANSFORM: Record<TextCase, string | undefined> = { 'as-typed': undefined, upper: 'uppercase', lower: 'lowercase' };

type TypeCtx = { font: (family: string) => string; weight: (family: string, weight: number) => number };

const em = (v: Keyed) => (typeof v === 'number' ? `${v}em` : `calc(${v} * 1em)`);

function variation(p: TypeProps): string | undefined {
  const plain = p.stretch === TYPE.stretch.fallback && p.slant === TYPE.slant.fallback && !p.axes;
  return plain ? undefined : [`'wdth' ${p.stretch}`, `'slnt' ${p.slant}`, ...(p.axes ? [p.axes] : [])].join(', ');
}

export function typeStyle(ctx: TypeCtx, p: TypeProps, size: number): Record<string, string | number | undefined> {
  return {
    fontFamily: ctx.font(p.font),
    fontWeight: typeof p.weight === 'number' ? ctx.weight(p.font, p.weight) : p.weight,
    fontStyle: p.italic ? 'italic' : undefined,
    fontSize: px(size),
    letterSpacing: em(p.tracking),
    lineHeight: p.leading,
    textTransform: TRANSFORM[p.textCase ?? 'as-typed'],
    fontVariationSettings: variation(p)
  };
}
