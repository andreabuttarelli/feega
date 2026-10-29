import { z } from 'zod';
import { planCombine } from '$lib/motion/scenes';
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

export const combineAskSchema = z.object({ frameIds: z.array(z.string().uuid()).min(2).max(MAX_SCENES) }).strict();

export type CombineAsk = z.infer<typeof combineAskSchema>;

export type Combined = { outcome: CombineOutcome.Done; frameId: string; undo: UndoItem[] } | { outcome: Exclude<CombineOutcome, CombineOutcome.Done> };

const heightOf = (f: StoredFrame) => Number((f.row?.size as { height?: number } | undefined)?.height ?? f.doc.height);

export async function combineScenes(store: FrameStore, ask: CombineAsk): Promise<Combined> {
  const read = await Promise.all(ask.frameIds.map((id) => store.read(id)));
  const frames = read.filter((f): f is StoredFrame => f !== null);
  if (frames.length !== ask.frameIds.length) {
    return { outcome: CombineOutcome.NotFound };
  }

  const first = frames[0];
  const { doc, at } = planCombine(frames.map((f) => ({ nodeId: f.nodeId, doc: f.doc, at: f.at ?? { x: 0, y: 0 }, height: heightOf(f) })));
  const place = { projectId: first.projectId, canvasId: first.canvasId, ...at };
  const frameId = await store.create(place, doc);
  return { outcome: CombineOutcome.Done, frameId, undo: [created(frameId, place)] };
}
