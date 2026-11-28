import type { Point } from './canvas-view';
import { SIZES, type Size } from './sizes';

export type FrameSize = { width: number; height: number };

export type Limits = { min: FrameSize; max: FrameSize };

export const FRAME_LIMITS: Limits = { min: { width: 160, height: 120 }, max: { width: 3840, height: 15000 } };

export enum Handle {
  North = 'n',
  NorthEast = 'ne',
  East = 'e',
  SouthEast = 'se',
  South = 's',
  SouthWest = 'sw',
  West = 'w',
  NorthWest = 'nw'
}

export const HANDLES = Object.values(Handle);

const PULL: Record<Handle, Point> = {
  [Handle.North]: { x: 0, y: -1 },
  [Handle.NorthEast]: { x: 1, y: -1 },
  [Handle.East]: { x: 1, y: 0 },
  [Handle.SouthEast]: { x: 1, y: 1 },
  [Handle.South]: { x: 0, y: 1 },
  [Handle.SouthWest]: { x: -1, y: 1 },
  [Handle.West]: { x: -1, y: 0 },
  [Handle.NorthWest]: { x: -1, y: -1 }
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const clampSize = (size: FrameSize, limits: Limits): FrameSize => ({
  width: clamp(Math.round(size.width), limits.min.width, limits.max.width),
  height: clamp(Math.round(size.height), limits.min.height, limits.max.height)
});

export function resizeBy(start: FrameSize, handle: Handle, delta: Point, scale: number, limits: Limits): FrameSize {
  const pull = PULL[handle];

  return clampSize({ width: start.width + (pull.x * delta.x) / scale, height: start.height + (pull.y * delta.y) / scale }, limits);
}

export function typedSize(current: FrameSize, side: keyof FrameSize, text: string, limits: Limits): FrameSize | null {
  const value = Number(text);
  if (text.trim() === '' || !Number.isFinite(value)) {
    return null;
  }

  return clampSize({ ...current, [side]: value }, limits);
}

export function presetSize(size: Size): FrameSize | null {
  const { width, height } = SIZES[size];

  return width === null || height === null ? null : { width, height };
}

export function afterEscape(selected: string | null): { selected: string | null; close: boolean } {
  return { selected: null, close: selected === null };
}
