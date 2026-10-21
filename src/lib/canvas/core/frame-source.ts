import { FrameKind, MOTION_NODE_BAR_H, frameChrome } from '$lib/canvas/motion-node';
import { posterSecond } from '$lib/motion/poster-time';
import { stillFrame as docStill } from '$lib/motion/still';
import type { DisplayList } from '$lib/motion/gpu-full/display-list';
import type { Rgba } from '$lib/motion/gpu-full/rgba';
import type { Box } from './canvas-scene';

const MOTION = 'motion';

export type FrameTile = { id: string; kind?: string | null; x: number; y: number; w: number; h: number; rotation?: number };
export type FrameData = { kind?: unknown; docHeadRevision?: unknown };
export type FrameAt = { id: string; kind: FrameKind; revision: number; box: Box; turn?: { degrees: number; about: { x: number; y: number } } };

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
    const kind = kindOf(data.kind);
    const bar = frameChrome(kind).bar ? MOTION_NODE_BAR_H : 0;
    const box = { x: t.x, y: t.y, w: t.w, h: t.h - bar };
    const turn = t.rotation ? { turn: { degrees: t.rotation, about: { x: t.x + t.w / 2, y: t.y + t.h / 2 } } } : {};
    return [{ id: t.id, kind, revision, box, ...turn }];
  });
}

export const stillFrame = (doc: { fps: number; durationInFrames: number; still?: { frame: number } }): number => docStill(doc) ?? Math.round(posterSecond(doc) * doc.fps);

export const frameOfLive = (live: { doc: Parameters<typeof stillFrame>[0]; playhead?: number }): number => live.playhead ?? stillFrame(live.doc);

export const drawsWhole = (list: DisplayList): boolean => list.unsupported.length === 0 && list.items.length > 0;

const STAGE: Record<FrameKind, Rgba | null> = {
  [FrameKind.Frame]: [0, 0, 0, 1],
  [FrameKind.Element]: null,
  [FrameKind.Group]: null
};

export const onStage = (list: DisplayList, kind: FrameKind): DisplayList => ({ ...list, background: list.background ?? STAGE[kind] });
