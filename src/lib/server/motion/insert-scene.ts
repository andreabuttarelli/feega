import { z } from 'zod';
import { planInsert } from '$lib/motion/scenes';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import type { UndoItem } from '$lib/canvas/undo-plan';
import type { FrameStore } from './move-element';

export enum InsertOutcome {
  Done = 'done',
  NotFound = 'motion_node_not_found',
  Conflict = 'conflict',
  Invalid = 'invalid'
}

export const INSERT_STATUS: Record<Exclude<InsertOutcome, InsertOutcome.Done>, number> = {
  [InsertOutcome.NotFound]: 404,
  [InsertOutcome.Conflict]: 409,
  [InsertOutcome.Invalid]: 422
};

export const insertAskSchema = z.object({ targetId: z.string().uuid(), sourceId: z.string().uuid(), at: z.coerce.number().min(0).max(1) }).strict();

export type InsertAsk = z.infer<typeof insertAskSchema>;

export type Inserted = { outcome: InsertOutcome.Done; undo: UndoItem[] } | { outcome: Exclude<InsertOutcome, InsertOutcome.Done>; detail?: string };

const SUMMARY = 'Inserted a scene';

export async function insertScene(store: FrameStore, ask: InsertAsk): Promise<Inserted> {
  const [target, source] = await Promise.all([store.read(ask.targetId), store.read(ask.sourceId)]);
  if (!target || !source) {
    return { outcome: InsertOutcome.NotFound };
  }
  const doc = planInsert(target, source, ask.at);
  if (!doc) {
    return { outcome: InsertOutcome.Invalid, detail: 'drop a frame that is not a sequence onto a sequence' };
  }

  const write = await store.write(target.nodeId, target.version, doc, SUMMARY);
  if (write.outcome === RevisionOutcome.Conflict) {
    return { outcome: InsertOutcome.Conflict };
  }
  if (write.outcome === RevisionOutcome.Invalid) {
    return { outcome: InsertOutcome.Invalid, detail: write.error };
  }
  return { outcome: InsertOutcome.Done, undo: [{ kind: 'doc.revision', nodeId: target.nodeId, before: target.version, after: write.head.version }] };
}
