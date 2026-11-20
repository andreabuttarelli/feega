type Utility = { make: (value: string) => string; owns: (token: string) => boolean };

const NOT_BORDER_COLOUR = /^border-(\d|\[\d|\[length|x-|y-|t-|r-|b-|l-|s-|e-|solid|dashed|dotted|double|none|hidden|collapse|separate|spacing)/;

const NOT_OUTLINE_COLOUR = /^outline-(\d|\[\d|\[length|none|dashed|dotted|double|offset)/;

const prefixed = (prefix: string): Utility => ({ make: (v) => `${prefix}-[${v}]`, owns: (t) => t.replace(/^-/, '').startsWith(`${prefix}-`) });
const keyword = (prefix: string): Utility => ({ make: (v) => `${prefix}-${v}`, owns: (t) => t.startsWith(`${prefix}-`) });
const bare = (...names: string[]): Utility => ({ make: (v) => v, owns: (t) => names.includes(t) });

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
  'min-width': prefixed('min-w'),
  'max-width': prefixed('max-w'),
  'min-height': prefixed('min-h'),
  'max-height': prefixed('max-h'),
  top: prefixed('top'),
  right: prefixed('right'),
  bottom: prefixed('bottom'),
  left: prefixed('left'),
  'z-index': prefixed('z'),
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
