type Utility = { make: (value: string) => string; owns: (token: string) => boolean };

const NOT_BORDER_COLOUR = /^border-(\d|\[\d|\[length|x-|y-|t-|r-|b-|l-|s-|e-|solid|dashed|dotted|double|none|hidden|collapse|separate|spacing)/;

const NOT_OUTLINE_COLOUR = /^outline-(\d|\[\d|\[length|none|dashed|dotted|double|offset)/;

const prefixed = (prefix: string): Utility => ({ make: (v) => `${prefix}-[${v}]`, owns: (t) => t.replace(/^-/, '').startsWith(`${prefix}-`) });
const keyword = (prefix: string): Utility => ({ make: (v) => `${prefix}-${v}`, owns: (t) => t.startsWith(`${prefix}-`) });
const bare = (...names: string[]): Utility => ({ make: (v) => v, owns: (t) => names.includes(t) });

const SPACING_STEPS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96];
const PX_PER_STEP = 4;
const PX_PER_REM = 16;
const LENGTH = /^(-?[\d.]+)(px|rem|%)?$/;
const FRACTIONS: Record<string, string> = { '50%': '1/2', '100%': 'full', '25%': '1/4', '75%': '3/4' };
const Z_STEPS = ['0', '10', '20', '30', '40', '50'];

function offsetClass(prefix: string, value: string): string {
  const arbitrary = value.startsWith('-') ? `-${prefix}-[${value.slice(1)}]` : `${prefix}-[${value}]`;
  if (value === 'auto') {
    return `${prefix}-auto`;
  }
  const m = LENGTH.exec(value);
  if (!m) {
    return arbitrary;
  }
  const negative = m[1].startsWith('-');
  const sign = negative ? '-' : '';
  const amount = Math.abs(Number(m[1]));
  if (m[2] === '%') {
    const fraction = FRACTIONS[`${amount}%`];
    return fraction && (!negative || fraction !== 'full') ? `${sign}${prefix}-${fraction}` : arbitrary;
  }
  const px = m[2] === 'rem' ? amount * PX_PER_REM : amount;
  if (px === 1) {
    return `${sign}${prefix}-px`;
  }
  const step = px / PX_PER_STEP;
  return SPACING_STEPS.includes(step) && !(negative && step === 0) ? `${sign}${prefix}-${step}` : arbitrary;
}

function zClass(value: string): string {
  if (value === 'auto') {
    return 'z-auto';
  }
  const negative = value.startsWith('-');
  const digits = negative ? value.slice(1) : value;
  return Z_STEPS.includes(digits) ? `${negative ? '-' : ''}z-${digits}` : `z-[${value}]`;
}

const REM_STEPS: Record<number, string> = { 20: 'xs', 24: 'sm', 28: 'md', 32: 'lg', 36: 'xl', 42: '2xl', 48: '3xl', 56: '4xl', 64: '5xl', 72: '6xl', 80: '7xl' };

const MAX_WIDTH_SCALE: Record<string, string> = {
  ...Object.fromEntries(Object.entries(REM_STEPS).map(([rem, name]) => [`${Number(rem) * PX_PER_REM}px`, name])),
  '65ch': 'prose',
  '640px': 'screen-sm',
  '1536px': 'screen-2xl'
};

const CONTENT: Record<string, string> = { '100%': 'full', 'fit-content': 'fit', 'min-content': 'min', 'max-content': 'max' };
const NO_LIMIT: Record<string, string> = { none: 'none' };
const HEIGHT_VIEWPORT: Record<string, string> = { '100vh': 'screen', '100dvh': 'dvh', '100svh': 'svh', '100lvh': 'lvh' };
const SPACING_SCALE: Record<string, string> = Object.fromEntries([...SPACING_STEPS.filter((step) => step > 0 && step !== 0.5).map((step) => [`${step * PX_PER_STEP}px`, String(step)]), ['1px', 'px']]);
const ZERO = { '0px': '0' };

const SIZE_SCALES: Record<string, Record<string, string>> = {
  w: { ...CONTENT, auto: 'auto', '100vw': 'screen', ...ZERO },
  h: { ...CONTENT, auto: 'auto', ...HEIGHT_VIEWPORT, ...ZERO },
  'min-w': { ...CONTENT, ...ZERO },
  'max-w': { ...CONTENT, ...NO_LIMIT, ...MAX_WIDTH_SCALE, ...ZERO },
  'min-h': { ...CONTENT, ...HEIGHT_VIEWPORT, ...ZERO },
  'max-h': { ...CONTENT, ...NO_LIMIT, ...HEIGHT_VIEWPORT, ...SPACING_SCALE, ...ZERO }
};

const LENGTH_TEXT = /^(-?[\d.]+)(px|rem)?$/;

function pxKey(value: string): string {
  const m = LENGTH_TEXT.exec(value);
  if (!m) {
    return value;
  }
  return `${Number(m[1]) * (m[2] === 'rem' ? PX_PER_REM : 1)}px`;
}

const sized = (prefix: string): Utility => ({
  make: (v) => {
    const name = SIZE_SCALES[prefix][pxKey(v)];
    return name ? `${prefix}-${name}` : `${prefix}-[${v}]`;
  },
  owns: prefixed(prefix).owns
});

const offset = (prefix: string): Utility => ({ make: (v) => offsetClass(prefix, v), owns: prefixed(prefix).owns });

const POSITIONS = ['static', 'relative', 'absolute', 'fixed', 'sticky'];

const UTILITIES: Record<string, Utility> = {
  cursor: keyword('cursor'),
  position: bare(...POSITIONS),
  'overflow-x': keyword('overflow-x'),
  'overflow-y': keyword('overflow-y'),
  'object-fit': keyword('object'),
  'mix-blend-mode': keyword('mix-blend'),
  'background-clip': keyword('bg-clip'),
  'background-image': { make: (v) => `bg-[${v}]`, owns: (t) => t.startsWith('bg-[url(') },
  width: sized('w'),
  height: sized('h'),
  'min-width': sized('min-w'),
  'max-width': sized('max-w'),
  'min-height': sized('min-h'),
  'max-height': sized('max-h'),
  top: offset('top'),
  right: offset('right'),
  bottom: offset('bottom'),
  left: offset('left'),
  'z-index': { make: zClass, owns: prefixed('z').owns },
  order: prefixed('order'),
  'grid-template-columns': prefixed('grid-cols'),
  'grid-template-rows': prefixed('grid-rows'),
  'row-gap': prefixed('gap-y'),
  'column-gap': prefixed('gap-x'),
  'border-color': { make: (v) => `border-[${v}]`, owns: (t) => t.startsWith('border-') && !NOT_BORDER_COLOUR.test(t) },
  'outline-color': { make: (v) => `outline-[${v}]`, owns: (t) => t.startsWith('outline-') && !NOT_OUTLINE_COLOUR.test(t) }
};

const spaced = (value: string) => value.replace(/\s+/g, '_');

const arbitrary = (property: string, value: string) => `[${property}:${spaced(value)}]`;

export function tailwindToken(property: string, value: string): string {
  const utility = UTILITIES[property];
  if (!value) {
    return '';
  }
  return utility ? utility.make(spaced(value)) : arbitrary(property, value);
}

export const ownsStandardUtility = (property: string, token: string): boolean => UTILITIES[property]?.owns(token) ?? false;
