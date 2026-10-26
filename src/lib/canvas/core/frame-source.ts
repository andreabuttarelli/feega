import { FrameKind, MOTION_NODE_BAR_H, docKindOf, frameChrome, holdsDoc } from '$lib/canvas/motion-node';
import { restFrameOf } from '$lib/motion/poster-time';
import { stillFrame as docStill } from '@feega/motion-core/motion/still';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { DisplayList } from '@feega/motion-core/motion/gpu-full/display-list';
import type { Rgba } from '@feega/motion-core/motion/gpu-full/rgba';
import type { Box } from './canvas-scene';

export type FrameTile = { id: string; kind?: string | null; x: number; y: number; w: number; h: number; rotation?: number };
export type FrameData = { kind?: unknown; docHeadRevision?: unknown };
export type FrameAt = { id: string; kind: FrameKind; revision: number; scenes?: string; box: Box; turn?: { degrees: number; about: { x: number; y: number } } };

export function framesOnCanvas(tiles: readonly FrameTile[], dataOf: (id: string) => FrameData): FrameAt[] {
  return tiles.flatMap((t) => {
    const type = t.kind ?? '';
    if (!holdsDoc(type)) {
      return [];
    }
    const data = dataOf(t.id);
    const revision = Number(data.docHeadRevision);
    if (!Number.isInteger(revision) || revision <= 0) {
      return [];
    }
    const kind = docKindOf(type, data.kind);
    const bar = frameChrome(kind).bar ? MOTION_NODE_BAR_H : 0;
    const box = { x: t.x, y: t.y, w: t.w, h: t.h - bar };
    const turn = t.rotation ? { turn: { degrees: t.rotation, about: { x: t.x + t.w / 2, y: t.y + t.h / 2 } } } : {};
    return [{ id: t.id, kind, revision, box, ...turn }];
  });
}

export const stillFrame = (doc: MotionDoc): number => docStill(doc) ?? restFrameOf(doc);

export const frameOfLive = (live: { doc: Parameters<typeof stillFrame>[0]; playhead?: number }): number => live.playhead ?? stillFrame(live.doc);

export const drawsAny = (list: DisplayList): boolean => list.items.length > 0;

export function logGaps(id: string, list: DisplayList) {
  if (!list.unsupported.length) {
    return;
  }
  console.warn('[canvas] core left out of frame', id, list.unsupported.map((g) => `${g.clip} (${g.component}): ${g.detail ?? g.reason}`).join('; '));
}

const STAGE: Record<FrameKind, Rgba | null> = {
  [FrameKind.Frame]: [0, 0, 0, 1],
  [FrameKind.Element]: null,
  [FrameKind.Group]: null
};

export const onStage = (list: DisplayList, kind: FrameKind): DisplayList => ({ ...list, background: list.background ?? STAGE[kind] });
