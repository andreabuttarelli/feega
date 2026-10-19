import { FrameKind, MOTION_NODE_BAR_H, frameChrome } from '$lib/canvas/motion-node';
import { posterSecond } from '$lib/motion/poster-capture';
import type { DisplayList } from '$lib/motion/gpu-full/display-list';
import type { Box } from './canvas-scene';

const MOTION = 'motion';

export type FrameTile = { id: string; kind?: string | null; x: number; y: number; w: number; h: number };
export type FrameData = { kind?: unknown; docHeadRevision?: unknown };
export type FrameAt = { id: string; revision: number; box: Box };

const kindOf = (raw: unknown): FrameKind => (Object.values(FrameKind).includes(raw as FrameKind) ? (raw as FrameKind) : FrameKind.Frame);

export function framesOnCanvas(tiles: readonly FrameTile[], dataOf: (id: string) => FrameData): FrameAt[] {
  return tiles.flatMap((t) => {
    if (t.kind !== MOTION) {
      return [];
    }
    const data = dataOf(t.id);
    const revision = Number(data.docHeadRevision);
    if (!Number.isInteger(revision) || revision <= 0) {
      return [];
    }
    const bar = frameChrome(kindOf(data.kind)).bar ? MOTION_NODE_BAR_H : 0;
    return [{ id: t.id, revision, box: { x: t.x, y: t.y, w: t.w, h: t.h - bar } }];
  });
}

export const stillFrame = (doc: { fps: number; durationInFrames: number }): number => Math.round(posterSecond(doc) * doc.fps);

export const drawsWhole = (list: DisplayList): boolean => list.unsupported.length === 0;
