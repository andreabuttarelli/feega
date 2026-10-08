export enum Detent {
  Peek = 'peek',
  Half = 'half',
  Full = 'full'
}

export type SheetRoom = { viewport: number; stageBottom: number; floor: number };

const PEEK_PX = 160;
const TOP_BAR_PX = 56;

const HEIGHT: Record<Detent, (room: SheetRoom) => number> = {
  [Detent.Peek]: () => PEEK_PX,
  [Detent.Half]: (room) => Math.max(PEEK_PX, room.viewport - room.stageBottom - room.floor),
  [Detent.Full]: (room) => room.viewport - TOP_BAR_PX - room.floor
};

const ORDER: readonly Detent[] = [Detent.Peek, Detent.Half, Detent.Full];

export const sheetHeight = (detent: Detent, room: SheetRoom): number => HEIGHT[detent](room);

export function nearestDetent(height: number, room: SheetRoom): Detent {
  const gap = (d: Detent) => Math.abs(sheetHeight(d, room) - height);
  return ORDER.reduce((best, d) => (gap(d) < gap(best) ? d : best));
}

export const nextDetent = (detent: Detent): Detent => ORDER[(ORDER.indexOf(detent) + 1) % ORDER.length];
