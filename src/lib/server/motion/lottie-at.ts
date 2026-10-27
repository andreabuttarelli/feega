import { drawnFrameNodeOf } from '$lib/canvas/motion-node';
import type { UndoItem } from '$lib/canvas/undo-plan';
import { importLottie } from '$lib/motion/import-lottie';
import type { NewId, Point } from '$lib/motion/move-element';
import { MoveOutcome, created, type FrameStore, type Place } from './move-element';

const DEFAULT_NAME = 'Lottie';
const MAX_NAME = 60;

export type LottiePlaced = { outcome: MoveOutcome.Done; frameId: string; undo: UndoItem[]; skipped: string[] } | { error: string };

const nameOf = (json: unknown): string => {
  const given = (json as { nm?: unknown } | null)?.nm;
  return typeof given === 'string' && given.trim() ? given.trim().slice(0, MAX_NAME) : DEFAULT_NAME;
};

export async function importLottieAt(store: FrameStore, place: Place, json: unknown, centre: Point, newId: NewId): Promise<LottiePlaced> {
  const imported = importLottie(json, newId);
  if (typeof imported === 'string') {
    return { error: imported };
  }

  const { doc, skipped } = imported;
  const shaped = drawnFrameNodeOf({ width: doc.width, height: doc.height });
  const at = { x: Math.round(centre.x - doc.width / 2), y: Math.round(centre.y - doc.height / 2) };
  const frameId = await store.create({ ...place, ...at }, doc, { type: shaped.type, data: shaped.data, width: shaped.w, height: shaped.h, displayName: nameOf(json) });
  return { outcome: MoveOutcome.Done, frameId, undo: [created(frameId, at)], skipped };
}
