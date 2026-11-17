import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { imageSourceTile } from './free-image';

type Box = { x: number; y: number; w: number; h: number };

type Placeable = { id: string; kind?: string; rotation?: number };

export type Gesture = { overrides: ReadonlyMap<string, Box>; turning: ReadonlyMap<string, number>; images: ReadonlyMap<string, MotionDoc | null> };

type Placing<T> = { from: T; box: Box | undefined; turn: number | undefined; image: MotionDoc | null; placed: T };

export type PlacedMemo<T> = ReadonlyMap<string, Placing<T>>;

const unchanged = <T>(held: Placing<T> | undefined, next: Omit<Placing<T>, 'placed'>) =>
  held !== undefined && held.from === next.from && held.box === next.box && held.turn === next.turn && held.image === next.image;

function place<T extends Placeable>({ from, box, turn, image }: Omit<Placing<T>, 'placed'>): T {
  return imageSourceTile({ ...from, ...(box ?? {}), ...(turn === undefined ? {} : { rotation: turn }) }, image);
}

export function placedTiles<T extends Placeable>(tiles: readonly T[], gesture: Gesture, last: PlacedMemo<T>): { tiles: T[]; memo: PlacedMemo<T> } {
  const memo = new Map<string, Placing<T>>();
  const placed = tiles.map((from) => {
    const next = { from, box: gesture.overrides.get(from.id), turn: gesture.turning.get(from.id), image: gesture.images.get(from.id) ?? null };
    const held = last.get(from.id);
    const kept = unchanged(held, next) ? held! : { ...next, placed: place(next) };
    memo.set(from.id, kept);
    return kept.placed;
  });
  return { tiles: placed, memo };
}
