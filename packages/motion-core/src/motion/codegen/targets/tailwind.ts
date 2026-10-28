import { isRef, type CssValue, type Ref, type Rule } from '../ir';
import { tokenKey } from '../tokens';
import type { TokenLookup } from './css';

const SPACING_STEP = 4;
const PX = /^(-?\d+(?:\.\d+)?)px$/;

const arbitrary = (value: string) => value.trim().replace(/\s*,\s*/g, ',').replace(/\s+/g, '_');

function scale(prefix: string, value: string): string {
  const match = PX.exec(value);
  if (match) {
    const n = Number(match[1]);
    if (n === 0) {
      return `${prefix}-0`;
    }
    const sign = n < 0 ? '-' : '';
    return Number.isInteger(n / SPACING_STEP) ? `${sign}${prefix}-${Math.abs(n) / SPACING_STEP}` : `${prefix}-[${value}]`;
  }
  if (value === '100%') {
    return `${prefix}-full`;
  }
  return value === '0' ? `${prefix}-0` : `${prefix}-[${arbitrary(value)}]`;
}

type Mapper = (value: CssValue, tokens: TokenLookup) => string;

const tokenName = (ref: Ref, tokens: TokenLookup) => tokens.get(tokenKey(ref.token, ref.raw))?.name;

const plain = (value: CssValue) => (isRef(value) ? value.raw : value);

const spaced =
  (prefix: string): Mapper =>
  (value) =>
    scale(prefix, plain(value));

const colour =
  (prefix: string): Mapper =>
  (value, tokens) => {
    if (isRef(value)) {
      const name = tokenName(value, tokens);
      return name ? `${prefix}-${name}` : `${prefix}-[${value.raw}]`;
    }
    return `${prefix}-[${arbitrary(value)}]`;
  };

const keyword =
  (table: Record<string, string>, fallbackProperty: string): Mapper =>
  (value) =>
    table[plain(value)] ?? `[${fallbackProperty}:${arbitrary(plain(value))}]`;

const exact =
  (prefix: string): Mapper =>
  (value) =>
    `${prefix}-[${arbitrary(plain(value))}]`;

const WEIGHTS: Record<string, string> = { '100': 'font-thin', '200': 'font-extralight', '300': 'font-light', '400': 'font-normal', '500': 'font-medium', '600': 'font-semibold', '700': 'font-bold', '800': 'font-extrabold', '900': 'font-black' };

const SPAN = /^span (\d+)$/;
const START_SPAN = /^(\d+) \/ span (\d+)$/;
const REPEAT = /^repeat\((\d+), minmax\(0, 1fr\)\)$/;

const placement =
  (axis: 'col' | 'row'): Mapper =>
  (value) => {
    const text = plain(value);
    const span = SPAN.exec(text);
    if (span) {
      return `${axis}-span-${span[1]}`;
    }
    const start = START_SPAN.exec(text);
    return start ? `${axis}-start-${start[1]} ${axis}-span-${start[2]}` : `${axis}-[${arbitrary(text)}]`;
  };

const template =
  (axis: 'cols' | 'rows'): Mapper =>
  (value) => {
    const text = plain(value);
    const repeat = REPEAT.exec(text);
    return repeat ? `grid-${axis}-${repeat[1]}` : `grid-${axis}-[${arbitrary(text)}]`;
  };

const BORDER_LINE = /^(\d+(?:\.\d+)?)px (solid|dashed) $/;

const border =
  (side: string): Mapper =>
  (value, tokens) => {
    if (!isRef(value)) {
      return `[border${side ? `-${side}` : ''}:${arbitrary(value)}]`;
    }
    const line = BORDER_LINE.exec(value.before ?? '');
    const suffix = side ? `-${side[0]}` : '';
    const width = line && line[1] !== '1' ? `border${suffix}-[${line[1]}px]` : `border${suffix}`;
    const style = line?.[2] === 'dashed' ? ' border-dashed' : '';
    return `${width}${style} ${colour('border')(value, tokens)}`;
  };

const radius: Mapper = (value, tokens) => {
  if (isRef(value)) {
    const name = tokenName(value, tokens);
    return name ? `rounded-${name}` : `rounded-[${value.raw}]`;
  }
  return value === '50%' || value === '9999px' ? 'rounded-full' : `rounded-[${arbitrary(value)}]`;
};

const MAPPERS: Record<string, Mapper> = {
  position: (v) => plain(v),
  display: (v) => plain(v),
  left: spaced('left'),
  right: spaced('right'),
  top: spaced('top'),
  bottom: spaced('bottom'),
  width: spaced('w'),
  height: spaced('h'),
  'min-width': spaced('min-w'),
  'max-width': spaced('max-w'),
  'min-height': spaced('min-h'),
  'max-height': spaced('max-h'),
  gap: spaced('gap'),
  'row-gap': spaced('gap-y'),
  'column-gap': spaced('gap-x'),
  padding: spaced('p'),
  'padding-block': spaced('py'),
  'padding-inline': spaced('px'),
  'padding-top': spaced('pt'),
  'padding-right': spaced('pr'),
  'padding-bottom': spaced('pb'),
  'padding-left': spaced('pl'),
  'margin-inline': keyword({ auto: 'mx-auto' }, 'margin-inline'),
  'flex-direction': keyword({ column: 'flex-col', row: 'flex-row' }, 'flex-direction'),
  'flex-wrap': keyword({ wrap: 'flex-wrap' }, 'flex-wrap'),
  'justify-content': keyword({ center: 'justify-center', 'flex-end': 'justify-end', 'space-between': 'justify-between', 'space-around': 'justify-around', 'space-evenly': 'justify-evenly' }, 'justify-content'),
  'align-items': keyword({ 'flex-start': 'items-start', center: 'items-center', 'flex-end': 'items-end', baseline: 'items-baseline' }, 'align-items'),
  'align-self': keyword({ stretch: 'self-stretch', start: 'self-start', center: 'self-center', end: 'self-end', baseline: 'self-baseline' }, 'align-self'),
  'justify-self': keyword({ start: 'justify-self-start', center: 'justify-self-center', end: 'justify-self-end' }, 'justify-self'),
  flex: keyword({ '1 1 0': 'flex-1' }, 'flex'),
  'flex-shrink': keyword({ '0': 'shrink-0' }, 'flex-shrink'),
  'grid-template-columns': template('cols'),
  'grid-template-rows': template('rows'),
  'grid-column': placement('col'),
  'grid-row': placement('row'),
  overflow: keyword({ hidden: 'overflow-hidden' }, 'overflow'),
  'object-fit': keyword({ cover: 'object-cover', contain: 'object-contain', fill: 'object-fill' }, 'object-fit'),
  'background-color': colour('bg'),
  'background-image': exact('bg'),
  'background-size': keyword({ cover: 'bg-cover', contain: 'bg-contain' }, 'background-size'),
  'background-position': (v) => `[background-position:${arbitrary(plain(v))}]`,
  border: border(''),
  'border-top': border('top'),
  'border-right': border('right'),
  'border-bottom': border('bottom'),
  'border-left': border('left'),
  'border-radius': radius,
  color: colour('text'),
  'font-family': (v, tokens) => (isRef(v) && tokenName(v, tokens) ? `font-${tokenName(v, tokens)}` : `font-[${arbitrary(plain(v))}]`),
  'font-size': exact('text'),
  'font-weight': (v) => WEIGHTS[plain(v)] ?? `font-[${plain(v)}]`,
  'line-height': exact('leading'),
  'letter-spacing': exact('tracking'),
  'text-align': (v) => `text-${plain(v)}`,
  'font-style': keyword({ italic: 'italic' }, 'font-style'),
  'text-transform': keyword({ uppercase: 'uppercase', lowercase: 'lowercase', capitalize: 'capitalize' }, 'text-transform'),
  'white-space': keyword({ 'pre-line': 'whitespace-pre-line', nowrap: 'whitespace-nowrap' }, 'white-space'),
  opacity: exact('opacity'),
  'box-shadow': exact('shadow'),
  transform: (v) => `[transform:${arbitrary(plain(v))}]`
};

export function tailwindOf(rules: readonly Rule[], tokens: TokenLookup): string {
  const classes = rules.map(([property, value]) => MAPPERS[property]?.(value, tokens) ?? `[${property}:${arbitrary(plain(value))}]`);
  return [...new Set(classes.join(' ').split(' ').filter(Boolean))].join(' ');
}
