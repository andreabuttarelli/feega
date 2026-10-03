import { z } from 'zod';
import { MOTION_FORMATS, MotionFormat } from '$lib/motion/doc';

export type MotionNode = {
  id: string;
  format: MotionFormat;
  docHeadRevision: number;
  posterAssetId: string | null;
  lastRenderAssetId: string | null;
};

export const motionNodeSchema = z.object({
  format: z.enum(MOTION_FORMATS),
  docHeadRevision: z.number().int().min(0),
  posterAssetId: z.string().nullable(),
  lastRenderAssetId: z.string().nullable()
});

const MOTION_NODE_SIZE = { w: 420, h: 320 };

export function motionNodeSize(): { w: number; h: number } {
  return MOTION_NODE_SIZE;
}

export function newMotionData(format: MotionFormat = MotionFormat.Vertical): Record<string, unknown> {
  return { format, docHeadRevision: 0, posterAssetId: null, lastRenderAssetId: null };
}

export function motionOf(row: { id: string; type: string; data: Record<string, unknown> }): MotionNode | null {
  if (row.type !== 'motion') {
    return null;
  }

  const parsed = motionNodeSchema.safeParse({ ...newMotionData(), ...row.data });
  const data = parsed.success ? parsed.data : motionNodeSchema.parse(newMotionData());
  return { id: row.id, ...data };
}

export function motionEditorPath(input: { projectId: string; canvasId: string; nodeId: string }): string {
  return `/p/${input.projectId}/c/${input.canvasId}/motion/${input.nodeId}`;
}
