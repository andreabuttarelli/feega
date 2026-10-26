import type { LiveDoc } from './core/live-docs.svelte';

export type Advance = { frame: number; ms: number; fps: number; duration: number };

const MS_PER_SECOND = 1000;

export function withPlayhead(live: LiveDoc, frame: number | null): LiveDoc {
  if (frame === null) {
    const { playhead: _off, ...rest } = live;
    return rest;
  }
  return { ...live, playhead: Math.min(Math.max(0, Math.round(frame)), live.doc.durationInFrames - 1) };
}

export const advance = ({ frame, ms, fps, duration }: Advance): number => Math.round(frame + (ms * fps) / MS_PER_SECOND) % duration;
