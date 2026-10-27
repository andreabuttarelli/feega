import { z } from 'zod';
import type { Extend } from '$lib/outpaint';

export const ASPECT_PRESETS = ['9:16', '1:1', '4:5', '16:9'] as const;

const ASPECT_PATTERN = /^([1-9]\d{0,2}):([1-9]\d{0,2})$/;

const CENTRE = 0.5;

const EVEN = 2;

export const aspectSchema = z.string().regex(ASPECT_PATTERN, 'aspect is w:h, like 9:16');

const unit = z.number().min(0).max(1);

export const focusSchema = z.object({ x: unit, y: unit }).strict();

export const videoReframeAskSchema = z
  .object({
    nodeId: z.string().min(1).describe('A video node with a result.'),
    aspect: aspectSchema.describe('The target aspect as w:h (9:16, 1:1, 4:5, 16:9 or custom).'),
    focus: focusSchema.optional().describe('Where the subject sits, as fractions 0-1 of the frame (default the centre). The crop is centred on it.')
  })
  .strict();

export type Focus = { x: number; y: number };

export type CropRect = { x: number; y: number; width: number; height: number };

type PixelSize = { width: number; height: number };

export function ratioOf(aspect: string): number {
  const [, width, height] = ASPECT_PATTERN.exec(aspect) ?? [];
  return Number(width) / Number(height);
}

const evenFloor = (value: number) => Math.floor(value / EVEN) * EVEN;

const evenRound = (value: number) => Math.round(value / EVEN) * EVEN;

const ALREADY_THERE = 0.005;

export function reframeExtend(size: PixelSize, ratio: number): Extend | null {
  const current = size.width / size.height;
  if (Math.abs(current - ratio) / ratio < ALREADY_THERE) {
    return null;
  }

  if (ratio < current) {
    const each = (size.width / ratio - size.height) / size.height / EVEN;
    return { top: each, bottom: each };
  }

  const each = (size.height * ratio - size.width) / size.width / EVEN;
  return { left: each, right: each };
}

function within(start: number, length: number, total: number): number {
  return Math.min(Math.max(0, Math.round(start - length / EVEN)), total - length);
}

export function cropRect(size: PixelSize, ratio: number, focus: Focus = { x: CENTRE, y: CENTRE }): CropRect {
  const sourceWidth = evenFloor(size.width);
  const sourceHeight = evenFloor(size.height);

  if (ratio < sourceWidth / sourceHeight) {
    const width = Math.min(sourceWidth, evenRound(sourceHeight * ratio));
    return { x: within(focus.x * size.width, width, size.width), y: 0, width, height: sourceHeight };
  }

  const height = Math.min(sourceHeight, evenRound(sourceWidth / ratio));
  return { x: 0, y: within(focus.y * size.height, height, size.height), width: sourceWidth, height };
}
