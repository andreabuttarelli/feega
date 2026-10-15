import { z } from 'zod';
import { FORMATS, MOTION_FORMATS, MotionFormat, formatOf as docFormat } from '$lib/motion/doc';
import { NodeMode } from './inline-motion';
import { FrameFormat } from '$lib/motion/hyperframes/capture';

export enum FrameKind {
  Frame = 'frame',
  Element = 'element'
}

type Chrome = { bar: boolean; ports: boolean; label: boolean; takesDrops: boolean; poster: FrameFormat };

const CHROME: Record<FrameKind, Chrome> = {
  [FrameKind.Frame]: { bar: true, ports: true, label: true, takesDrops: true, poster: FrameFormat.Jpeg },
  [FrameKind.Element]: { bar: false, ports: false, label: false, takesDrops: false, poster: FrameFormat.Png }
};

export const frameChrome = (kind: FrameKind): Chrome => CHROME[kind];

export type MotionNode = {
  id: string;
  kind: FrameKind;
  format: MotionFormat;
  docHeadRevision: number;
  posterAssetId: string | null;
  lastRenderAssetId: string | null;
  storyboard?: StoryboardLink;
  budgetRaisedUsd?: number;
};

const FORMAT_NAMES: Record<string, MotionFormat> = {
  landscape: MotionFormat.Landscape,
  vertical: MotionFormat.Vertical,
  square: MotionFormat.Square,
  portrait: MotionFormat.Portrait
};

const formatOf = (value: unknown) => (typeof value === 'string' ? (FORMAT_NAMES[value.trim().toLowerCase()] ?? value) : value);

export type StoryboardLink = { canvasId: string; placed: string[] };

const linkSchema = z.object({ canvasId: z.string().min(1), placed: z.array(z.string()) });

export const motionNodeSchema = z.object({
  format: z.preprocess(formatOf, z.enum(MOTION_FORMATS)),
  docHeadRevision: z.number().int().min(0),
  posterAssetId: z.string().nullable(),
  lastRenderAssetId: z.string().nullable(),
  storyboard: linkSchema.optional(),
  budgetRaisedUsd: z.number().min(0).optional(),
  kind: z.enum(FrameKind).optional()
});

export function storyboardOf(data: Record<string, unknown>): StoryboardLink | null {
  const parsed = linkSchema.safeParse(data.storyboard);
  return parsed.success ? parsed.data : null;
}

export const MOTION_NODE_BAR_H = 44;

const BAR_H: Record<FrameKind, Record<NodeMode, number>> = {
  [FrameKind.Frame]: { [NodeMode.Preview]: MOTION_NODE_BAR_H, [NodeMode.Edit]: 0 },
  [FrameKind.Element]: { [NodeMode.Preview]: 0, [NodeMode.Edit]: 0 }
};

const MOTION_STAGE_WIDTH: Record<MotionFormat, number> = {
  [MotionFormat.Landscape]: 420,
  [MotionFormat.Vertical]: 288,
  [MotionFormat.Square]: 320,
  [MotionFormat.Portrait]: 300,
  [MotionFormat.SquareLarge]: 320,
  [MotionFormat.Poster]: 280
};

export function motionNodeSize(format: MotionFormat = MotionFormat.Vertical): { w: number; h: number } {
  const { width, height } = FORMATS[format];
  const w = MOTION_STAGE_WIDTH[format];
  return { w, h: Math.round((w * height) / width) + MOTION_NODE_BAR_H };
}

export function frameNodeSize(width: number, picture: { width: number; height: number }, mode: NodeMode = NodeMode.Preview, kind: FrameKind = FrameKind.Frame): { w: number; h: number } {
  const w = Math.round(width);
  return { w, h: Math.round((w * picture.height) / picture.width) + BAR_H[kind][mode] };
}

export function elementNodeOf(box: { width: number; height: number }): { data: Record<string, unknown>; w: number; h: number } {
  return { data: { ...newMotionData(docFormat(box)), kind: FrameKind.Element }, w: Math.round(box.width), h: Math.round(box.height) };
}

export function frameNodeOf(picture: { width: number; height: number }): { data: Record<string, unknown>; w: number; h: number } {
  const format = docFormat(picture);
  return { data: newMotionData(format), ...frameNodeSize(MOTION_STAGE_WIDTH[format], picture) };
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
  return { id: row.id, ...data, kind: data.kind ?? FrameKind.Frame };
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

export function storyboardPath(projectId: string, data: Record<string, unknown>): string | null {
  const link = storyboardOf(data);
  return link ? `/p/${projectId}/c/${link.canvasId}` : null;
}

const ELEMENT_MIN_SIZE = { w: 8, h: 8 };

export const tileChromeOf = (row: { id: string; type: string; data: Record<string, unknown> }): Chrome => frameChrome(motionOf(row)?.kind ?? FrameKind.Frame);

const DEFAULT_SIZE: Record<FrameKind, (node: MotionNode) => { w: number; h: number }> = {
  [FrameKind.Frame]: (node) => motionNodeSize(node.format),
  [FrameKind.Element]: () => ELEMENT_MIN_SIZE
};

export function frameDefaultSize(data: Record<string, unknown>): { w: number; h: number } {
  const node = motionOf({ id: '', type: 'motion', data })!;
  return DEFAULT_SIZE[node.kind](node);
}

const OPENING_SELECTION: Record<FrameKind, (clipIds: string[]) => string[]> = {
  [FrameKind.Frame]: () => [],
  [FrameKind.Element]: (clipIds) => clipIds
};

export const openingSelection = (kind: FrameKind, clipIds: string[]): string[] => OPENING_SELECTION[kind](clipIds);
