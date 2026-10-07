import { z } from 'zod';
import { FORMATS, MOTION_FORMATS, MotionFormat } from '$lib/motion/doc';

export type MotionNode = {
  id: string;
  format: MotionFormat;
  docHeadRevision: number;
  posterAssetId: string | null;
  lastRenderAssetId: string | null;
};

const FORMAT_NAMES: Record<string, MotionFormat> = {
  landscape: MotionFormat.Landscape,
  vertical: MotionFormat.Vertical,
  square: MotionFormat.Square,
  portrait: MotionFormat.Portrait
};

const formatOf = (value: unknown) => (typeof value === 'string' ? (FORMAT_NAMES[value.trim().toLowerCase()] ?? value) : value);

export const motionNodeSchema = z.object({
  format: z.preprocess(formatOf, z.enum(MOTION_FORMATS)),
  docHeadRevision: z.number().int().min(0),
  posterAssetId: z.string().nullable(),
  lastRenderAssetId: z.string().nullable()
});

export const MOTION_NODE_BAR_H = 44;

const MOTION_STAGE_WIDTH: Record<MotionFormat, number> = {
  [MotionFormat.Landscape]: 420,
  [MotionFormat.Vertical]: 288,
  [MotionFormat.Square]: 320,
  [MotionFormat.Portrait]: 300
};

export function motionNodeSize(format: MotionFormat = MotionFormat.Vertical): { w: number; h: number } {
  const { width, height } = FORMATS[format];
  const w = MOTION_STAGE_WIDTH[format];
  return { w, h: Math.round((w * height) / width) + MOTION_NODE_BAR_H };
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

export function motionSourcePath(input: { projectId: string; canvasId: string; nodeId: string; revision: number }): string {
  return `${motionEditorPath(input)}/source?rev=${input.revision}`;
}

export function motionPreviewPath(input: { projectId: string; canvasId: string; nodeId: string }): string {
  return `${motionEditorPath(input)}/preview`;
}
