import { findClip, type MotionClip, type MotionDoc } from '../doc';
import { resolveColor, type BrandTokens } from '../brand';
import { isText } from '../layout/text-extent';
import { pivotBox } from '../parent';
import type { Box } from '../layout';

export enum TokenRole {
  Colour = 'colour',
  Font = 'font',
  Style = 'style',
  Variable = 'variable'
}

export type DevToken = { role: TokenRole; name: string; value: string | null };

export type Declaration = [property: string, value: string];

export type DevLayer = { id: string; name: string; component: string; box: Box; declarations: Declaration[]; tokens: DevToken[] };

type Paint = { props: Record<string, unknown>; box: Box; unit: number; brand: BrandTokens | null; tokens: DevToken[] };

type Painter = (paint: Paint) => Declaration[];

const BRAND_PREFIX = 'brand.';
const DEFAULT_ROTATION = 0;
const FULL_OPACITY = 1;

const rounded = (n: number) => Math.round(n * 100) / 100;

const px = (n: number) => `${rounded(n)}px`;

const asNumber = (value: unknown, fallback: number) => (typeof value === 'number' ? value : fallback);

function colourOf(value: unknown, paint: Paint): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  if (!value.startsWith(BRAND_PREFIX)) {
    return value;
  }
  const resolved = paint.brand ? resolveColor(value, paint.brand) : null;
  paint.tokens.push({ role: TokenRole.Colour, name: value, value: resolved });
  return resolved ?? `var(--${value.replace('.', '-')})`;
}

function solidFill(props: Record<string, unknown>, paint: Paint): string | null {
  const fills = Array.isArray(props.fills) ? (props.fills as { type?: string; color?: string; visible?: boolean }[]) : [];
  const top = fills.filter((f) => f.visible !== false && f.type === 'solid').at(-1);
  return colourOf(top ? top.color : props.fill, paint);
}

const shape: Painter = (paint) => {
  const { props, box } = paint;
  const fill = solidFill(props, paint);
  const radius = asNumber(props.roundness, 0) * Math.min(box.width, box.height);
  return [
    ...(fill ? [['background', fill] as Declaration] : []),
    ...(radius > 0 ? [['border-radius', px(radius)] as Declaration] : [])
  ];
};

const TEXT_ALIGN_KEY = 'align';

function typeTokens(props: Record<string, unknown>, paint: Paint) {
  const family = String(props.font ?? '');
  if (family) {
    paint.tokens.push({ role: TokenRole.Font, name: family, value: String(props.weight ?? '') });
  }
}

const text: Painter = (paint) => {
  const { props, unit } = paint;
  const colour = colourOf(props.color, paint);
  typeTokens(props, paint);
  const declarations: Declaration[] = [
    ...(colour ? [['color', colour] as Declaration] : []),
    ...(props.font ? [['font-family', String(props.font)] as Declaration] : []),
    ['font-size', px(asNumber(props.size, 0) * unit)],
    ['font-weight', String(props.weight ?? 400)],
    ['letter-spacing', `${asNumber(props.tracking, 0)}em`],
    ['line-height', String(asNumber(props.leading, 1))],
    ['text-align', String(props[TEXT_ALIGN_KEY] ?? 'center')]
  ];
  return props.italic ? [...declarations, ['font-style', 'italic']] : declarations;
};

const PAINTERS: Partial<Record<string, Painter>> = { Shape: shape };

const painterOf = (component: string): Painter | undefined => PAINTERS[component] ?? (isText(component as never) ? text : undefined);

function boxDeclarations(box: Box): Declaration[] {
  return [
    ['position', 'absolute'],
    ['left', px(box.left)],
    ['top', px(box.top)],
    ['width', px(box.width)],
    ['height', px(box.height)]
  ];
}

function effectDeclarations(props: Record<string, unknown>): Declaration[] {
  const opacity = asNumber(props.opacity, FULL_OPACITY);
  const rotation = asNumber(props.rotation, DEFAULT_ROTATION);
  return [
    ...(opacity !== FULL_OPACITY ? [['opacity', String(opacity)] as Declaration] : []),
    ...(rotation !== DEFAULT_ROTATION ? [['transform', `rotate(${rotation}deg)`] as Declaration] : [])
  ];
}

function referenceTokens(clip: MotionClip): DevToken[] {
  const binds = Object.entries(clip.bind ?? {}).map(([key, ref]) => ({ role: TokenRole.Variable, name: ref, value: String(clip.props[key] ?? '') }));
  return clip.styleRef ? [{ role: TokenRole.Style, name: clip.styleRef, value: null }, ...binds] : binds;
}

export function devLayer(doc: MotionDoc, clipId: string, brand: BrandTokens | null): DevLayer | null {
  const found = findClip(doc, clipId);
  if (!found) {
    return null;
  }
  const { clip } = found;
  const box = pivotBox(clip.props, doc);
  const tokens: DevToken[] = [];
  const paint: Paint = { props: clip.props, box, unit: Math.min(doc.width, doc.height), brand, tokens };
  const painted = painterOf(clip.component)?.(paint) ?? [];
  return {
    id: clip.id,
    name: clip.name ?? clip.component,
    component: clip.component,
    box,
    declarations: [...boxDeclarations(box), ...painted, ...effectDeclarations(clip.props)],
    tokens: [...tokens, ...referenceTokens(clip)]
  };
}

export const cssText = (layer: DevLayer): string => layer.declarations.map(([property, value]) => `${property}: ${value};`).join('\n');

type TailwindRule = (value: string) => string;

const TAILWIND_RULES: Record<string, TailwindRule> = {
  position: (v) => v,
  left: (v) => `left-[${v}]`,
  top: (v) => `top-[${v}]`,
  width: (v) => `w-[${v}]`,
  height: (v) => `h-[${v}]`,
  background: (v) => `bg-[${v}]`,
  'border-radius': (v) => `rounded-[${v}]`,
  opacity: (v) => `opacity-[${v}]`,
  transform: (v) => `[transform:${v}]`,
  color: (v) => `text-[${v}]`,
  'font-family': (v) => `font-['${v.replace(/ /g, '_')}']`,
  'font-size': (v) => `text-[${v}]`,
  'font-weight': (v) => `font-[${v}]`,
  'letter-spacing': (v) => `tracking-[${v}]`,
  'line-height': (v) => `leading-[${v}]`,
  'text-align': (v) => `text-${v}`,
  'font-style': (v) => v
};

export const tailwindClasses = (layer: DevLayer): string => layer.declarations.map(([property, value]) => TAILWIND_RULES[property]?.(value) ?? '').filter(Boolean).join(' ');
