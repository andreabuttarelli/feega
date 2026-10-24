import type { CommentThread } from './comment-threads';

const MS_PER_SECOND = 1000;

export type CommentMark = { id: string; number: number; frame: number };

export const frameOfMs = (ms: number, fps: number): number => Math.round((ms * fps) / MS_PER_SECOND);

export const msOfFrame = (frame: number, fps: number): number => Math.round((frame * MS_PER_SECOND) / fps);

export function marksFor(threads: CommentThread[], nodeId: string, fps: number): CommentMark[] {
  return threads
    .filter((t) => t.nodeId === nodeId && t.timeMs !== null && !t.resolved)
    .map((t) => ({ id: t.id, number: t.number, frame: frameOfMs(t.timeMs ?? 0, fps) }));
}
