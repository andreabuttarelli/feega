import type { LiveDoc } from './core/live-docs.svelte';

export enum Wrap {
  Loop = 'loop',
  Stop = 'stop'
}

export type Range = { from: number; to: number };

export type Advance = { head: number; ms: number; fps: number; range: Range; wrap: Wrap };

const MS_PER_SECOND = 1000;

export function withPlayhead(live: LiveDoc, frame: number | null): LiveDoc {
  if (frame === null) {
    const { playhead: _off, ...rest } = live;
    return rest;
  }
  return { ...live, playhead: Math.min(Math.max(0, Math.round(frame)), live.doc.durationInFrames - 1) };
}

export function advance({ head, ms, fps, range, wrap }: Advance): number | null {
  const next = head + (ms * fps) / MS_PER_SECOND;
  if (next < range.to) {
    return next;
  }
  if (wrap === Wrap.Stop) {
    return null;
  }
  return range.from + ((next - range.from) % (range.to - range.from));
}
