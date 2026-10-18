import { z } from 'zod';
import { MOTION_FORMATS, formatOf, type MotionDoc } from '$lib/motion/doc';
import { reformat, type FormatTarget } from '$lib/motion/reformat';
import { motionNodeSize } from '$lib/canvas/motion-node';
import type { UndoItem } from '$lib/canvas/undo-plan';
import { frameShape } from './start';
import { created, type FrameStore } from './move-element';

export enum FormatsOutcome {
  Done = 'done',
  NotFound = 'motion_node_not_found',
  Invalid = 'invalid'
}

export const FORMATS_STATUS: Record<Exclude<FormatsOutcome, FormatsOutcome.Done>, number> = {
  [FormatsOutcome.NotFound]: 404,
  [FormatsOutcome.Invalid]: 422
};

const MAX_TARGETS = 8;
const FRAME_SPACING = 80;

export const formatTargetSchema = z.union([z.object({ format: z.enum(MOTION_FORMATS) }).strict(), z.object({ size: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }).strict() }).strict()]);

export const formatsAskSchema = z.object({ nodeId: z.string().min(1), targets: z.array(formatTargetSchema).min(1).max(MAX_TARGETS) }).strict();

export type FormatsAsk = z.infer<typeof formatsAskSchema>;

export type Formats = { outcome: FormatsOutcome.Done; frameIds: string[]; undo: UndoItem[] } | { outcome: Exclude<FormatsOutcome, FormatsOutcome.Done>; detail?: string };

const widthOf = (row: Record<string, unknown> | undefined, doc: MotionDoc) => Number((row?.size as { width?: number } | undefined)?.width ?? motionNodeSize(formatOf(doc)).w);

export async function createFormats(store: FrameStore, ask: { nodeId: string; targets: FormatTarget[] }): Promise<Formats> {
  const source = await store.read(ask.nodeId);
  if (!source) {
    return { outcome: FormatsOutcome.NotFound };
  }

  const docs: MotionDoc[] = [];
  for (const target of ask.targets) {
    const made = reformat(source.doc, target);
    if (!made.ok) {
      return { outcome: FormatsOutcome.Invalid, detail: made.error };
    }
    docs.push(made.doc);
  }

  const at = source.at ?? { x: 0, y: 0 };
  let x = at.x + widthOf(source.row, source.doc) + FRAME_SPACING;
  const frameIds: string[] = [];
  const undo: UndoItem[] = [];
  for (const doc of docs) {
    const place = { projectId: source.projectId, canvasId: source.canvasId, x, y: at.y };
    const frameId = await store.create(place, doc);
    frameIds.push(frameId);
    undo.push(created(frameId, place));
    x += frameShape(doc).width + FRAME_SPACING;
  }
  return { outcome: FormatsOutcome.Done, frameIds, undo };
}
