export enum Emitter {
  Point = 'point',
  Line = 'line',
  Box = 'box',
  Ring = 'ring'
}

export enum ParticleShape {
  Circle = 'circle',
  Square = 'square',
  Triangle = 'triangle',
  Streak = 'streak',
  Sprite = 'sprite'
}

export const EMITTERS = Object.values(Emitter) as [Emitter, ...Emitter[]];
export const PARTICLE_SHAPES = Object.values(ParticleShape) as [ParticleShape, ...ParticleShape[]];

export enum ParticleSection {
  Emitter = 'emitter',
  Motion = 'motion',
  Look = 'look'
}

export type ParticleNumber = { label: string; min: number; max: number; step: number; fallback: number; section: ParticleSection };

const n = (label: string, min: number, max: number, step: number, fallback: number, section: ParticleSection): ParticleNumber => ({ label, min, max, step, fallback, section });

export const PARTICLE_NUMBERS = {
  emitterX: n('Emitter X', -0.5, 1.5, 0.01, 0.5, ParticleSection.Emitter),
  emitterY: n('Emitter Y', -0.5, 1.5, 0.01, 0.5, ParticleSection.Emitter),
  emitterWidth: n('Emitter width', 0, 1.5, 0.01, 0.2, ParticleSection.Emitter),
  emitterHeight: n('Emitter height', 0, 1.5, 0.01, 0.2, ParticleSection.Emitter),
  rate: n('Rate (per s)', 0, 400, 1, 60, ParticleSection.Emitter),
  life: n('Life (s)', 0.1, 10, 0.1, 2, ParticleSection.Motion),
  lifeVariance: n('Life variance', 0, 1, 0.01, 0.3, ParticleSection.Motion),
  speed: n('Speed', 0, 3, 0.01, 0.4, ParticleSection.Motion),
  speedVariance: n('Speed variance', 0, 1, 0.01, 0.3, ParticleSection.Motion),
  direction: n('Direction', -180, 180, 1, -90, ParticleSection.Motion),
  spread: n('Spread', 0, 360, 1, 40, ParticleSection.Motion),
  gravity: n('Gravity', -3, 3, 0.01, 0.3, ParticleSection.Motion),
  drag: n('Drag', 0, 5, 0.01, 0, ParticleSection.Motion),
  wobble: n('Wobble', 0, 0.3, 0.001, 0, ParticleSection.Motion),
  wobbleRate: n('Wobble rate (Hz)', 0, 5, 0.01, 1, ParticleSection.Motion),
  spin: n('Spin (°/s)', -1080, 1080, 1, 0, ParticleSection.Motion),
  sizeStart: n('Size start', 0, 0.2, 0.001, 0.012, ParticleSection.Look),
  sizeEnd: n('Size end', 0, 0.2, 0.001, 0.004, ParticleSection.Look),
  sizeVariance: n('Size variance', 0, 1, 0.01, 0.3, ParticleSection.Look),
  opacityStart: n('Opacity start', 0, 1, 0.01, 1, ParticleSection.Look),
  opacityEnd: n('Opacity end', 0, 1, 0.01, 0, ParticleSection.Look),
  softness: n('Softness', 0, 1, 0.01, 0, ParticleSection.Look)
} as const satisfies Record<string, ParticleNumber>;

export type ParticleNumberKey = keyof typeof PARTICLE_NUMBERS;
export const PARTICLE_NUMBER_KEYS = Object.keys(PARTICLE_NUMBERS) as ParticleNumberKey[];

export const PARTICLE_COLOURS = {
  colorStart: { label: 'Colour start', fallback: '#ffffff' },
  colorEnd: { label: 'Colour end', fallback: '#ffffff' }
} as const;

export type ParticleColourKey = keyof typeof PARTICLE_COLOURS;
export const PARTICLE_COLOUR_KEYS = Object.keys(PARTICLE_COLOURS) as ParticleColourKey[];

export const SEED = { min: 0, max: 9999, fallback: 1 } as const;
