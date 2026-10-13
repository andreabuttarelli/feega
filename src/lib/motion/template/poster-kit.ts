import { FORMATS, MotionFormat, type MotionDoc } from '$lib/motion/doc';
import { EffectKind } from '$lib/motion/effects/registry';
import { addEffect } from '$lib/motion/effects/ops';
import { setStill } from '$lib/motion/still';
import type { OpResult } from '$lib/motion/timeline';
import { customTemplateDoc, type CustomTemplateSpec } from './custom-template';

export const POSTER_SECONDS = 2;
export const POSTER_FORMAT = MotionFormat.Portrait;
export const GRAIN_EFFECT = 'grain';

export const NOISE_DATA_URI =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.4 -0.4'/></filter><rect width='240' height='240' filter='url(%23n)'/></svg>";

const must = (name: string, result: OpResult): MotionDoc => {
  if (!result.ok) {
    throw new Error(`${name}: ${result.error}`);
  }
  return result.doc;
};

export function posterTemplateDoc(spec: Omit<CustomTemplateSpec, 'seconds' | 'fps'>, grain: number): MotionDoc {
  const doc = customTemplateDoc({ ...spec, seconds: POSTER_SECONDS, fps: 30 });
  const { width, height } = FORMATS[POSTER_FORMAT];
  const grained = must(spec.name, addEffect({ ...doc, width, height }, spec.clip, EffectKind.Noise, GRAIN_EFFECT, { amount: grain, size: 1.2, evolve: 0 }));
  return must(spec.name, setStill(grained, 0));
}
