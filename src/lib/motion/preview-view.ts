export type Size = { width: number; height: number };
export type Point = { x: number; y: number };
export type View = { scale: number | null; x: number; y: number };

export const FIT: View = { scale: null, x: 0, y: 0 };
export const ZOOM_PRESETS = [0.1, 0.25, 0.5, 1, 2, 4, 8] as const;
export const ACTUAL_SIZE = 1;

const MIN_SCALE = ZOOM_PRESETS[0];
const MAX_SCALE = ZOOM_PRESETS[ZOOM_PRESETS.length - 1];
const PERCENT = 100;
const EPSILON = 1e-6;

export enum Step {
  In = 1,
  Out = -1
}

const clampScale = (scale: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

export const fitScale = (frame: Size, box: Size): number => Math.min(box.width / frame.width, box.height / frame.height);

export const scaleOf = (view: View, frame: Size, box: Size): number => view.scale ?? fitScale(frame, box);

function reach(frameSide: number, boxSide: number, scale: number): number {
  return Math.max(0, (frameSide * scale - boxSide) / 2);
}

const clampAxis = (offset: number, limit: number) => Math.min(limit, Math.max(-limit, offset)) || 0;

function settle(scale: number, offset: Point, frame: Size, box: Size): View {
  return { scale, x: clampAxis(offset.x, reach(frame.width, box.width, scale)), y: clampAxis(offset.y, reach(frame.height, box.height, scale)) };
}

export function zoomAt(view: View, scale: number, anchor: Point, frame: Size, box: Size): View {
  const from = scaleOf(view, frame, box);
  const to = clampScale(scale);
  const ratio = to / from;
  return settle(to, { x: anchor.x - (anchor.x - view.x) * ratio, y: anchor.y - (anchor.y - view.y) * ratio }, frame, box);
}

export function panBy(view: View, delta: Point, frame: Size, box: Size): View {
  return settle(scaleOf(view, frame, box), { x: view.x + delta.x, y: view.y + delta.y }, frame, box);
}

export function zoomStep(scale: number, step: Step): number {
  const presets: readonly number[] = ZOOM_PRESETS;
  const next = step === Step.In ? presets.find((p) => p > scale + EPSILON) : [...presets].reverse().find((p) => p < scale - EPSILON);
  return next ?? clampScale(scale);
}

export const zoomLabel = (view: View, scale: number): string => (view.scale === null ? 'Fit' : `${Math.round(scale * PERCENT)}%`);
