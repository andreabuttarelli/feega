import { clipsOf, type MotionDoc } from './doc';
import type { OpResult } from './timeline';
import { setExpression } from './expression/ops';

export enum PulseProp {
  Scale = 'scale',
  Opacity = 'opacity',
  Blur = 'blur'
}

export const PULSE_PROPS = Object.values(PulseProp);

const SMOOTHING_FRAMES = 3;
const MAX_BLUR_PX = 40;

const PULSE: Record<PulseProp, { strength: number; source: (ref: string, k: number) => string }> = {
  [PulseProp.Scale]: { strength: 0.3, source: (ref, k) => `value * (1 + ${k} * audio.amp(${ref}, ${SMOOTHING_FRAMES}))` },
  [PulseProp.Opacity]: { strength: 0.5, source: (ref, k) => `value * (${1 - k} + ${k} * audio.amp(${ref}, ${SMOOTHING_FRAMES}))` },
  [PulseProp.Blur]: { strength: 0.3, source: (ref, k) => `value + ${k * MAX_BLUR_PX} * audio.beat(${ref})` }
};

function longestAudio(doc: MotionDoc) {
  const audio = clipsOf(doc).filter((c) => c.component === 'Audio');
  return audio.reduce<(typeof audio)[number] | null>((longest, c) => (!longest || c.durationInFrames > longest.durationInFrames ? c : longest), null);
}

export function pulseWithMusic(doc: MotionDoc, clipId: string, prop: PulseProp, options: { strength?: number; source?: string } = {}): OpResult {
  const pulse = PULSE[prop];
  const source = options.source ?? longestAudio(doc)?.id;
  if (!source) {
    return { ok: false, error: 'add a music clip first: the pulse follows an audio clip' };
  }
  return setExpression(doc, clipId, prop, pulse.source(JSON.stringify(source), options.strength ?? pulse.strength));
}
