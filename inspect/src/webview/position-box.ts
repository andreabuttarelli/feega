import { OFFSET_SIDES, OffsetSide, offsetSidesOfClasses } from '@feega/live-edit/authored-offsets';

export { OFFSET_SIDES, OffsetSide };

export type Offsets = Record<OffsetSide, boolean>;

const OPPOSITE: Record<OffsetSide, OffsetSide> = {
  [OffsetSide.Top]: OffsetSide.Bottom,
  [OffsetSide.Bottom]: OffsetSide.Top,
  [OffsetSide.Left]: OffsetSide.Right,
  [OffsetSide.Right]: OffsetSide.Left
};

export const offsetsFromHost = (authored: OffsetSide[]): Offsets => Object.fromEntries(OFFSET_SIDES.map((s) => [s, authored.includes(s)])) as Offsets;

export const flipOffset = (side: { on: boolean; px: number }): string => (side.on ? '' : `${side.px}px`);

export function initialOffsets(classes: string, styles: Record<string, string>): Offsets {
  const fromClasses = new Set(offsetSidesOfClasses(classes));
  const set = (s: OffsetSide) => (parseFloat(styles[s] ?? '0') || 0) !== 0;
  const alone = (s: OffsetSide) => set(s) && !set(OPPOSITE[s]);
  return Object.fromEntries(OFFSET_SIDES.map((s) => [s, fromClasses.has(s) || alone(s)])) as Offsets;
}
