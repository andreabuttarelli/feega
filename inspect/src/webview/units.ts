export enum Unit {
  Px = 'px',
  Rem = 'rem',
  Em = 'em',
  Percent = '%',
  Vw = 'vw',
  Vh = 'vh',
  Dvh = 'dvh',
  Ch = 'ch',
  None = '',
  Auto = 'auto',
  Unlimited = 'none',
  FitContent = 'fit-content',
  MinContent = 'min-content',
  MaxContent = 'max-content'
}

const KEYWORDS: Unit[] = [Unit.Auto, Unit.Unlimited, Unit.FitContent, Unit.MinContent, Unit.MaxContent];

export const isKeyword = (unit: Unit): boolean => KEYWORDS.includes(unit);

export type Length = { value: number; unit: Unit };

export type UnitContext = { rem: number; em: number; parent: number; viewport: { w: number; h: number } };

const BOX = [Unit.Px, Unit.Rem, Unit.Em, Unit.Percent];
const SIZE = [Unit.Px, Unit.Rem, Unit.Percent, Unit.Vw, Unit.Vh, Unit.Auto, Unit.FitContent];
const LIMIT = [Unit.Px, Unit.Percent, Unit.Rem, Unit.Em, Unit.Vw, Unit.Vh, Unit.Dvh, Unit.Ch, Unit.FitContent, Unit.MinContent, Unit.MaxContent];

export const UNITS_OF: Record<string, Unit[]> = {
  padding: BOX,
  margin: [...BOX, Unit.Auto],
  gap: [Unit.Px, Unit.Rem, Unit.Em],
  width: SIZE,
  height: SIZE,
  'min-width': [...LIMIT, Unit.Auto],
  'max-width': [...LIMIT, Unit.Unlimited],
  'min-height': [...LIMIT, Unit.Auto],
  'max-height': [...LIMIT, Unit.Unlimited],
  radius: [Unit.Px, Unit.Rem, Unit.Percent],
  'font-size': [Unit.Px, Unit.Rem, Unit.Em],
  'line-height': [Unit.None, Unit.Px, Unit.Rem, Unit.Em],
  'letter-spacing': [Unit.Em, Unit.Px, Unit.Rem],
  border: [Unit.Px, Unit.Rem],
  offset: [Unit.Px, Unit.Percent, Unit.Auto]
};

const STEP: Record<Unit, number> = {
  [Unit.Px]: 1,
  [Unit.Rem]: 0.125,
  [Unit.Em]: 0.125,
  [Unit.Percent]: 1,
  [Unit.Vw]: 1,
  [Unit.Vh]: 1,
  [Unit.Dvh]: 1,
  [Unit.Ch]: 1,
  [Unit.None]: 0.05,
  [Unit.Auto]: 1,
  [Unit.Unlimited]: 1,
  [Unit.FitContent]: 1,
  [Unit.MinContent]: 1,
  [Unit.MaxContent]: 1
};

const PX_PER: Record<Unit, (c: UnitContext) => number> = {
  [Unit.Px]: () => 1,
  [Unit.Rem]: (c) => c.rem,
  [Unit.Em]: (c) => c.em,
  [Unit.Percent]: (c) => c.parent / 100,
  [Unit.Vw]: (c) => c.viewport.w / 100,
  [Unit.Vh]: (c) => c.viewport.h / 100,
  [Unit.Dvh]: (c) => c.viewport.h / 100,
  [Unit.Ch]: (c) => c.em / 2,
  [Unit.None]: (c) => c.em,
  [Unit.Auto]: () => 0,
  [Unit.Unlimited]: () => 0,
  [Unit.FitContent]: () => 0,
  [Unit.MinContent]: () => 0,
  [Unit.MaxContent]: () => 0
};

const TYPED = /^(-?[\d.]+)\s*(px|rem|em|%|vw|vh|dvh|ch)?$/;
const DECIMALS = 3;

export const stepOf = (unit: Unit): number => STEP[unit];

export function parseLength(text: string, current: Unit): Length | null {
  const trimmed = text.trim().toLowerCase();
  const keyword = KEYWORDS.find((k) => k === trimmed);
  if (keyword) {
    return { value: 0, unit: keyword };
  }
  const m = trimmed.match(TYPED);
  if (!m) {
    return null;
  }
  return { value: Number(m[1]), unit: (m[2] as Unit | undefined) ?? current };
}

export function convert(length: Length, to: Unit, context: UnitContext): Length {
  if (isKeyword(to) || isKeyword(length.unit)) {
    return { value: 0, unit: to };
  }
  const px = length.value * PX_PER[length.unit](context);
  const per = PX_PER[to](context);
  return { value: per ? Number((px / per).toFixed(DECIMALS)) : 0, unit: to };
}

export const cssOf = (length: Length): string => (isKeyword(length.unit) ? length.unit : `${length.value}${length.unit}`);

export const keywordOf = (css: string, allowed: Unit[] = []): Unit | null => allowed.find((u) => isKeyword(u) && u === css.trim()) ?? null;
