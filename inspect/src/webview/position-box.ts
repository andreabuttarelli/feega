export enum OffsetSide {
  Top = 'top',
  Right = 'right',
  Bottom = 'bottom',
  Left = 'left'
}

export type Offsets = Record<OffsetSide, boolean>;

export const OFFSET_SIDES = Object.values(OffsetSide);

const CLASS_SIDES: Record<string, OffsetSide[]> = {
  inset: OFFSET_SIDES,
  'inset-x': [OffsetSide.Left, OffsetSide.Right],
  'inset-y': [OffsetSide.Top, OffsetSide.Bottom],
  top: [OffsetSide.Top],
  right: [OffsetSide.Right],
  bottom: [OffsetSide.Bottom],
  left: [OffsetSide.Left]
};

const OPPOSITE: Record<OffsetSide, OffsetSide> = {
  [OffsetSide.Top]: OffsetSide.Bottom,
  [OffsetSide.Bottom]: OffsetSide.Top,
  [OffsetSide.Left]: OffsetSide.Right,
  [OffsetSide.Right]: OffsetSide.Left
};

export const flipOffset = (side: { on: boolean; px: number }): string => (side.on ? '' : `${side.px}px`);

export function initialOffsets(classes: string, styles: Record<string, string>): Offsets {
  const fromClasses = new Set(
    classes
      .split(/\s+/)
      .map((c) => c.replace(/^-/, '').replace(/-[^-]+$/, ''))
      .flatMap((family) => CLASS_SIDES[family] ?? [])
  );
  const set = (s: OffsetSide) => (parseFloat(styles[s] ?? '0') || 0) !== 0;
  const alone = (s: OffsetSide) => set(s) && !set(OPPOSITE[s]);
  return Object.fromEntries(OFFSET_SIDES.map((s) => [s, fromClasses.has(s) || alone(s)])) as Offsets;
}
