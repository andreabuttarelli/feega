import { z } from 'zod';
import type { Region } from '$lib/image-mask';

const side = z.number().min(0).max(1).optional();

export const extendSchema = z
  .object({ left: side, top: side, right: side, bottom: side })
  .strict()
  .refine((extend) => Object.values(extend).some((amount) => (amount ?? 0) > 0), 'extend at least one side');

export type Extend = z.infer<typeof extendSchema>;

type PixelSize = { width: number; height: number };

export type OutpaintPlan = { padded: PixelSize; offset: { left: number; top: number }; regions: Region[] };

export function outpaintPlan(size: PixelSize, extend: Extend): OutpaintPlan {
  const left = Math.round((extend.left ?? 0) * size.width);
  const right = Math.round((extend.right ?? 0) * size.width);
  const top = Math.round((extend.top ?? 0) * size.height);
  const bottom = Math.round((extend.bottom ?? 0) * size.height);
  const padded = { width: size.width + left + right, height: size.height + top + bottom };
  const strip = (x: number, y: number, width: number, height: number): Region[] =>
    width > 0 && height > 0 ? [{ left: x / padded.width, top: y / padded.height, width: width / padded.width, height: height / padded.height }] : [];

  return {
    padded,
    offset: { left, top },
    regions: [
      ...strip(0, 0, left, padded.height),
      ...strip(padded.width - right, 0, right, padded.height),
      ...strip(left, 0, size.width, top),
      ...strip(left, padded.height - bottom, size.width, bottom)
    ]
  };
}
