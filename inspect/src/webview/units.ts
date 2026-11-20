export enum Unit {
  Px = 'px',
  Rem = 'rem',
  Em = 'em',
  Percent = '%',
  Vw = 'vw',
  Vh = 'vh',
  None = '',
  Auto = 'auto'
}

export type Length = { value: number; unit: Unit };

export type UnitContext = { rem: number; em: number; parent: number; viewport: { w: number; h: number } };

const BOX = [Unit.Px, Unit.Rem, Unit.Em, Unit.Percent];
const SIZE = [Unit.Px, Unit.Rem, Unit.Percent, Unit.Vw, Unit.Vh, Unit.Auto];

export const UNITS_OF: Record<string, Unit[]> = {
  padding: BOX,
  margin: [...BOX, Unit.Auto],
  gap: [Unit.Px, Unit.Rem, Unit.Em],
  width: SIZE,
  height: SIZE,
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
  [Unit.None]: 0.05,
  [Unit.Auto]: 1
};

const PX_PER: Record<Unit, (c: UnitContext) => number> = {
  [Unit.Px]: () => 1,
  [Unit.Rem]: (c) => c.rem,
  [Unit.Em]: (c) => c.em,
  [Unit.Percent]: (c) => c.parent / 100,
  [Unit.Vw]: (c) => c.viewport.w / 100,
  [Unit.Vh]: (c) => c.viewport.h / 100,
  [Unit.None]: (c) => c.em,
  [Unit.Auto]: () => 0
};

const TYPED = /^(-?[\d.]+)\s*(px|rem|em|%|vw|vh)?$/;
const DECIMALS = 3;

export const stepOf = (unit: Unit): number => STEP[unit];

export function parseLength(text: string, current: Unit): Length | null {
  const trimmed = text.trim().toLowerCase();
  if (trimmed === Unit.Auto) {
    return { value: 0, unit: Unit.Auto };
  }
  const m = trimmed.match(TYPED);
  if (!m) {
    return null;
  }
  return { value: Number(m[1]), unit: (m[2] as Unit | undefined) ?? current };
}

export function convert(length: Length, to: Unit, context: UnitContext): Length {
  if (to === Unit.Auto || length.unit === Unit.Auto) {
    return { value: 0, unit: to };
  }
  const px = length.value * PX_PER[length.unit](context);
  const per = PX_PER[to](context);
  return { value: per ? Number((px / per).toFixed(DECIMALS)) : 0, unit: to };
}

export const cssOf = (length: Length): string => (length.unit === Unit.Auto ? Unit.Auto : `${length.value}${length.unit}`);
