import type { FrameRect } from '$lib/motion/gpu/pick';

export type FrameStep = { back: () => void; forward: () => void };

export function toggleId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

export const primaryOf = (ids: readonly string[]): string | null => ids.at(-1) ?? null;

const overlaps = (a: FrameRect, b: FrameRect) => a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

export function marqueeIds(rects: Record<string, FrameRect>, marquee: FrameRect): string[] {
  return Object.entries(rects)
    .filter(([, rect]) => overlaps(rect, marquee))
    .map(([id]) => id);
}

export const spanOf = (a: [number, number], b: [number, number]): FrameRect => ({ left: Math.min(a[0], b[0]), top: Math.min(a[1], b[1]), width: Math.abs(a[0] - b[0]), height: Math.abs(a[1] - b[1]) });
