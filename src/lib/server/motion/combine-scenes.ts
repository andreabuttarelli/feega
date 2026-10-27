import { z } from 'zod';
import { newMotionDoc, MotionFormat } from '@feega/motion-core/motion/doc';
import { scenesLeftToRight, sequenceScenes } from '$lib/motion/scenes';
import type { UndoItem } from '$lib/canvas/undo-plan';
import { created, type FrameStore, type StoredFrame } from './move-element';

export enum CombineOutcome {
  Done = 'done',
  NotFound = 'motion_node_not_found'
}

export const COMBINE_STATUS: Record<Exclude<CombineOutcome, CombineOutcome.Done>, number> = {
  [CombineOutcome.NotFound]: 404
};

export const MAX_SCENES = 40;
const FRAME_SPACING = 80;

export const combineAskSchema = z.object({ frameIds: z.array(z.string().uuid()).min(2).max(MAX_SCENES) }).strict();

export type CombineAsk = z.infer<typeof combineAskSchema>;

export type Combined = { outcome: CombineOutcome.Done; frameId: string; undo: UndoItem[] } | { outcome: Exclude<CombineOutcome, CombineOutcome.Done> };

const bottomOf = (f: StoredFrame) => (f.at?.y ?? 0) + Number((f.row?.size as { height?: number } | undefined)?.height ?? f.doc.height);

export async function combineScenes(store: FrameStore, ask: CombineAsk): Promise<Combined> {
  const read = await Promise.all(ask.frameIds.map((id) => store.read(id)));
  const frames = read.filter((f): f is StoredFrame => f !== null);
  if (frames.length !== ask.frameIds.length) {
    return { outcome: CombineOutcome.NotFound };
  }

  const byId = new Map(frames.map((f) => [f.nodeId, f]));
  const order = scenesLeftToRight(frames.map((f) => ({ id: f.nodeId, x: f.at?.x ?? 0, y: f.at?.y ?? 0 })));
  const first = byId.get(order[0])!;
  const host = { ...newMotionDoc(MotionFormat.Landscape), width: first.doc.width, height: first.doc.height, fps: first.doc.fps };
  const doc = sequenceScenes(host, order.map((id) => ({ nodeId: id, durationInFrames: byId.get(id)!.doc.durationInFrames })));

  const place = { projectId: first.projectId, canvasId: first.canvasId, x: Math.min(...frames.map((f) => f.at?.x ?? 0)), y: Math.max(...frames.map(bottomOf)) + FRAME_SPACING };
  const frameId = await store.create(place, doc);
  return { outcome: CombineOutcome.Done, frameId, undo: [created(frameId, place)] };
}
