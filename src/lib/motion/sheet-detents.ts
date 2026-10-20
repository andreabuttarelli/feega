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

export const SNAP_PX = 40;
const MEMORY_KEY = 'feega:sheet-px:';

const stops = (room: SheetRoom): number[] => ORDER.map((d) => sheetHeight(d, room));

export function fitHeight(height: number, room: SheetRoom): number {
  const [peek, , full] = stops(room);
  return Math.min(full, Math.max(peek, height));
}

export function settleHeight(height: number, room: SheetRoom): number {
  const near = stops(room).find((stop) => Math.abs(stop - height) < SNAP_PX);
  return near ?? fitHeight(height, room);
}

export const tapHeight = (height: number, room: SheetRoom): number => sheetHeight(nextDetent(nearestDetent(height, room)), room);

export function readSheetPx(store: Storage | null, sheet: string): number | null {
  const px = Number(store?.getItem(MEMORY_KEY + sheet) ?? NaN);
  return Number.isFinite(px) ? px : null;
}

export function writeSheetPx(store: Storage | null, sheet: string, px: number) {
  try {
    store?.setItem(MEMORY_KEY + sheet, String(Math.round(px)));
  } catch {
    return;
  }
}
