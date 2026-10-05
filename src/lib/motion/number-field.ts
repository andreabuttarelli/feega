import { parseDecimal } from './inspector';

export enum Precision {
  Normal = 'normal',
  Coarse = 'coarse',
  Fine = 'fine'
}

export enum FieldFill {
  Range = 'range',
  None = 'none'
}

export enum FieldKind {
  Glyph = 'glyph',
  Named = 'named'
}

export enum Nudge {
  Up = 1,
  Down = -1
}

export type Range = { min: number; max: number; step: number };

const FACTOR: Record<Precision, number> = {
  [Precision.Normal]: 1,
  [Precision.Coarse]: 10,
  [Precision.Fine]: 0.1
};

const decimals = (step: number): number => Math.max(0, -Math.floor(Math.log10(step)));

function settle(value: number, range: Range, step: number): number {
  const places = 10 ** decimals(step);
  return Math.min(range.max, Math.max(range.min, Math.round(value * places) / places));
}

export function precisionOf(e: { shiftKey: boolean; altKey: boolean }): Precision {
  if (e.shiftKey) {
    return Precision.Coarse;
  }
  return e.altKey ? Precision.Fine : Precision.Normal;
}

export function scrubbed(start: number, dx: number, range: Range, precision: Precision): number {
  const step = range.step * FACTOR[precision];
  return settle(start + dx * step, range, step);
}

export function nudged(value: number, direction: Nudge, precision: Precision, range: Range): number {
  const step = range.step * FACTOR[precision];
  return settle(value + direction * step, range, step);
}

export const formatValue = (value: number, step: number): string => value.toFixed(decimals(step));

export const fillShare = (value: number, range: Range): number => Math.min(1, Math.max(0, (value - range.min) / (range.max - range.min)));

const pad = (n: number) => String(n).padStart(2, '0');

export const clockText = (frames: number, fps: number): string => `${pad(Math.floor(frames / fps))}:${pad(frames % fps)}`;

const CLOCK = /^(\d+):(\d+)$/;
const FRAMES = /^(\d+)f$/i;

export function parseClock(text: string, fps: number): number | null {
  const trimmed = text.trim();
  const clock = CLOCK.exec(trimmed);
  if (clock) {
    return Number(clock[1]) * fps + Number(clock[2]);
  }
  const frames = FRAMES.exec(trimmed);
  if (frames) {
    return Number(frames[1]);
  }
  const seconds = parseDecimal(trimmed);
  return seconds === null ? null : Math.round(seconds * fps);
}
