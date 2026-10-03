import { FPS } from './design';
import { snapFrame, snapTargets } from './timeline';
import type { MotionClip, MotionDoc } from './doc';
import { ANIMATABLE, Source, sampleTrack, type EaseSpec } from './keyframes';

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

export const HANDLE_PX = 8;
const MIN_BODY_SHARE = 3;

export enum Grip {
  Start = 'start',
  End = 'end'
}

export type Handle = { clipId: string; grip: Grip; left: number; width: number };

type Span = { id: string; from: number; durationInFrames: number };

export function edgeHandles(clips: readonly Span[], ppf: number, selected: readonly string[] = []): Handle[] {
  const topmostLast = [...clips.filter((c) => !selected.includes(c.id)), ...clips.filter((c) => selected.includes(c.id))];
  return topmostLast.flatMap((clip) => {
    const left = clip.from * ppf;
    const right = (clip.from + clip.durationInFrames) * ppf;
    const width = Math.min(HANDLE_PX, (right - left) / MIN_BODY_SHARE);
    return [
      { clipId: clip.id, grip: Grip.Start, left, width },
      { clipId: clip.id, grip: Grip.End, left: right - width, width }
    ];
  });
}

export function stackRows(clips: readonly Span[]): Record<string, number> {
  const rowEnds: number[] = [];
  const rows: Record<string, number> = {};
  for (const clip of [...clips].sort((a, b) => a.from - b.from)) {
    const free = rowEnds.findIndex((end) => end <= clip.from);
    const row = free < 0 ? rowEnds.length : free;
    rowEnds[row] = clip.from + clip.durationInFrames;
    rows[clip.id] = row;
  }
  return rows;
}

export function handleAt(handles: readonly Handle[], x: number): Handle | null {
  return handles.findLast((h) => x >= h.left && x < h.left + h.width) ?? null;
}

export type KeyLane = { prop: string; label: string; source: Source; frames: number[] };

export function keyLanes(clip: MotionClip): KeyLane[] {
  return ANIMATABLE[clip.component]
    .filter((p) => clip.keyframes[p.key]?.length)
    .map((p) => ({ prop: p.key, label: p.label, source: p.source, frames: clip.keyframes[p.key].map((k) => k.frame) }));
}

const CURVE_STEPS = 24;

export function easePath(ease: EaseSpec, size: number): string {
  const track = [
    { frame: 0, value: 0, ease },
    { frame: CURVE_STEPS, value: 1, ease: 'linear' }
  ];
  const point = (i: number) => `${round2((i / CURVE_STEPS) * size)},${round2(size - sampleTrack(track, i) * size)}`;
  return `M${point(0)}${Array.from({ length: CURVE_STEPS }, (_, i) => `L${point(i + 1)}`).join('')}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
