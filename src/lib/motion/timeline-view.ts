import { FPS } from './design';
import { snapFrame, snapTargets } from './timeline';
import type { MotionDoc } from './doc';

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 16;
export const BASE_PX_PER_SECOND = 60;
export const SNAP_PX = 8;

export function pxPerFrame(zoom: number): number {
  return (BASE_PX_PER_SECOND * zoom) / FPS;
}

export function frameAt(px: number, zoom: number): number {
  return Math.max(0, Math.round(px / pxPerFrame(zoom)));
}

export function clampZoom(zoom: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

export type Tick = { frame: number; label: string | null };

const TICK_STEPS_S = [0.1, 0.25, 0.5, 1, 2, 5, 10] as const;
const MIN_TICK_PX = 14;
const LABEL_EVERY = 5;

export function rulerTicks(durationInFrames: number, zoom: number): Tick[] {
  const step = TICK_STEPS_S.find((s) => s * FPS * pxPerFrame(zoom) >= MIN_TICK_PX) ?? TICK_STEPS_S.at(-1)!;
  const stepFrames = Math.max(1, Math.round(step * FPS));
  const ticks: Tick[] = [];
  for (let frame = 0, i = 0; frame <= durationInFrames; frame += stepFrames, i++) {
    ticks.push({ frame, label: i % LABEL_EVERY === 0 ? timecode(frame) : null });
  }
  return ticks;
}

export function timecode(frame: number): string {
  const seconds = Math.floor(frame / FPS);
  const rest = frame % FPS;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}.${String(rest).padStart(2, '0')}`;
}

export enum Snap {
  On = 'on',
  Off = 'off'
}

export function snapped(doc: MotionDoc, frame: number, input: { playhead: number; exclude: readonly string[]; zoom: number; snap: Snap }): number {
  if (input.snap === Snap.Off) {
    return frame;
  }
  return snapFrame(frame, snapTargets(doc, input), Math.max(1, Math.round(SNAP_PX / pxPerFrame(input.zoom))));
}
