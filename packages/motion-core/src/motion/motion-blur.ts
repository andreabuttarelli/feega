import { z } from 'zod';

export const DEGREES = 360;
export const BROWSER_SAMPLES = 2;
export const MAX_SAMPLES = 32;

export const motionBlurSchema = z
  .object({
    enabled: z.boolean().default(false),
    shutterAngle: z.number().min(1).max(DEGREES).default(180),
    shutterPhase: z.number().min(-DEGREES).max(DEGREES).default(-90),
    samples: z.number().int().min(2).max(MAX_SAMPLES).default(8)
  })
  .default({ enabled: false, shutterAngle: 180, shutterPhase: -90, samples: 8 });

export type MotionBlur = z.infer<typeof motionBlurSchema>;

export const DEFAULT_MOTION_BLUR: MotionBlur = motionBlurSchema.parse(undefined);

const centre = (blur: MotionBlur) => (blur.shutterPhase + blur.shutterAngle / 2) / DEGREES;

export function sampleTimes(frame: number, fps: number, blur: MotionBlur, cap: number = MAX_SAMPLES): number[] {
  if (!blur.enabled) {
    return [frame / fps];
  }
  const samples = Math.min(blur.samples, cap);
  const open = blur.shutterPhase / DEGREES;
  const shutter = blur.shutterAngle / DEGREES;
  return Array.from({ length: samples }, (_, k) => Math.max(0, frame + open + ((k + 0.5) / samples) * shutter) / fps);
}

export function frameOfSample(time: number, fps: number, blur: MotionBlur): number {
  return Math.max(0, Math.round(time * fps - centre(blur)));
}
