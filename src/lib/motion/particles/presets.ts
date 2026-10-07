import { findClip, type MotionDoc } from '../doc';
import { setProps, type OpResult } from '../timeline';
import { Emitter, ParticleShape } from './model';

export enum ParticlePreset {
  Sparks = 'sparks',
  Dust = 'dust',
  Confetti = 'confetti',
  Bokeh = 'bokeh',
  Snow = 'snow'
}

export const PARTICLE_PRESETS = Object.values(ParticlePreset) as [ParticlePreset, ...ParticlePreset[]];

type Preset = { about: string; props: Record<string, number | string | boolean> };

export const PRESET_PROPS: Record<ParticlePreset, Preset> = {
  [ParticlePreset.Sparks]: {
    about: 'hot streaks bursting up from a point and falling back',
    props: { emitter: Emitter.Point, shape: ParticleShape.Streak, emitterX: 0.5, emitterY: 0.7, rate: 160, life: 0.9, lifeVariance: 0.4, speed: 1.2, speedVariance: 0.5, direction: -90, spread: 70, gravity: 1.6, drag: 0.6, wobble: 0, spin: 0, sizeStart: 0.008, sizeEnd: 0.002, sizeVariance: 0.4, colorStart: '#fff3c4', colorEnd: '#ff5a1f', opacityStart: 1, opacityEnd: 0, softness: 0, prewarm: false }
  },
  [ParticlePreset.Dust]: {
    about: 'fine motes drifting slowly through the whole frame',
    props: { emitter: Emitter.Box, shape: ParticleShape.Circle, emitterX: 0.5, emitterY: 0.5, emitterWidth: 1.1, emitterHeight: 1.1, rate: 30, life: 6, lifeVariance: 0.5, speed: 0.02, speedVariance: 0.8, direction: 0, spread: 360, gravity: -0.005, drag: 0, wobble: 0.01, wobbleRate: 0.2, spin: 0, sizeStart: 0.003, sizeEnd: 0.003, sizeVariance: 0.6, colorStart: '#ffffff', colorEnd: '#ffffff', opacityStart: 0.6, opacityEnd: 0, softness: 0.6, prewarm: true }
  },
  [ParticlePreset.Confetti]: {
    about: 'colourful paper squares thrown up, tumbling and fluttering down',
    props: { emitter: Emitter.Line, shape: ParticleShape.Square, emitterX: 0.5, emitterY: 1.02, emitterWidth: 0.8, rate: 120, life: 3.5, lifeVariance: 0.3, speed: 1.4, speedVariance: 0.4, direction: -90, spread: 50, gravity: 0.9, drag: 1.1, wobble: 0.02, wobbleRate: 1.5, spin: 540, sizeStart: 0.014, sizeEnd: 0.014, sizeVariance: 0.4, colorStart: '#ff3d71', colorEnd: '#2ec4ff', opacityStart: 1, opacityEnd: 1, softness: 0, prewarm: false }
  },
  [ParticlePreset.Bokeh]: {
    about: 'large soft out-of-focus discs floating gently',
    props: { emitter: Emitter.Box, shape: ParticleShape.Circle, emitterX: 0.5, emitterY: 0.5, emitterWidth: 1.2, emitterHeight: 1.2, rate: 6, life: 7, lifeVariance: 0.4, speed: 0.03, speedVariance: 0.6, direction: -90, spread: 120, gravity: 0, drag: 0, wobble: 0.01, wobbleRate: 0.15, spin: 0, sizeStart: 0.09, sizeEnd: 0.12, sizeVariance: 0.5, colorStart: '#ffd27a', colorEnd: '#ff8fb1', opacityStart: 0.35, opacityEnd: 0, softness: 0.7, prewarm: true }
  },
  [ParticlePreset.Snow]: {
    about: 'flakes falling from above the frame, swaying side to side',
    props: { emitter: Emitter.Line, shape: ParticleShape.Circle, emitterX: 0.5, emitterY: -0.03, emitterWidth: 1.3, rate: 50, life: 8, lifeVariance: 0.2, speed: 0.12, speedVariance: 0.4, direction: 90, spread: 20, gravity: 0, drag: 0, wobble: 0.025, wobbleRate: 0.4, spin: 0, sizeStart: 0.008, sizeEnd: 0.008, sizeVariance: 0.6, colorStart: '#ffffff', colorEnd: '#ffffff', opacityStart: 0.9, opacityEnd: 0.9, softness: 0.4, prewarm: true }
  }
};

export function applyParticlePreset(doc: MotionDoc, clipId: string, preset: ParticlePreset): OpResult {
  const found = findClip(doc, clipId);
  if (found && found.clip.component !== 'Particles') {
    return { ok: false, error: `${clipId} is a ${found.clip.component}, presets are for Particles clips` };
  }
  return setProps(doc, clipId, PRESET_PROPS[preset].props);
}
