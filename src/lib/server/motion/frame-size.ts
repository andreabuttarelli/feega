import { z } from 'zod';
import { MotionFormat, formatOf } from '$lib/motion/doc';
import { fitToNode } from '$lib/motion/custom-size';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import type { UndoItem } from '$lib/canvas/undo-plan';
import type { FrameStore } from './move-element';

export enum SizeOutcome {
  Done = 'done',
  NotFound = 'motion_node_not_found',
  Preset = 'preset_format',
  Conflict = 'conflict',
  Invalid = 'invalid'
}

export const SIZE_STATUS: Record<Exclude<SizeOutcome, SizeOutcome.Done>, number> = {
  [SizeOutcome.NotFound]: 404,
  [SizeOutcome.Preset]: 409,
  [SizeOutcome.Conflict]: 409,
  [SizeOutcome.Invalid]: 422
};

export const sizeAskSchema = z.object({ nodeId: z.string().min(1), width: z.coerce.number().positive(), height: z.coerce.number().positive() }).strict();

export type SizeAsk = z.infer<typeof sizeAskSchema>;

export type Sized = { outcome: SizeOutcome.Done; width: number; height: number; undo: UndoItem[] } | { outcome: Exclude<SizeOutcome, SizeOutcome.Done>; detail?: string };

const SUMMARY = 'Resized the frame';

export async function sizeFrame(store: FrameStore, ask: SizeAsk): Promise<Sized> {
  const frame = await store.read(ask.nodeId);
  if (!frame) {
    return { outcome: SizeOutcome.NotFound };
  }
  if (formatOf(frame.doc) !== MotionFormat.Custom) {
    return { outcome: SizeOutcome.Preset, detail: 'pick Custom to size the frame from the canvas' };
  }

  const sized = fitToNode(frame.doc, ask);
  if (!sized.ok) {
    return { outcome: SizeOutcome.Invalid, detail: sized.error };
  }

  const write = await store.write(ask.nodeId, frame.version, sized.doc, SUMMARY);
  if (write.outcome === RevisionOutcome.Conflict) {
    return { outcome: SizeOutcome.Conflict };
  }
  if (write.outcome === RevisionOutcome.Invalid) {
    return { outcome: SizeOutcome.Invalid, detail: write.error };
  }
  return { outcome: SizeOutcome.Done, width: sized.doc.width, height: sized.doc.height, undo: [{ kind: 'doc.revision', nodeId: ask.nodeId, before: frame.version, after: write.head.version }] };
}
