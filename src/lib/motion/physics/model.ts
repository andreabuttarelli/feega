import { z } from 'zod';

export enum Bounds {
  Floor = 'floor',
  Box = 'box',
  None = 'none'
}

export const BOUNDS = Object.values(Bounds) as [Bounds, ...Bounds[]];

type Range = { label: string; min: number; max: number; step: number; fallback: number };

export const PHYSICS = {
  gravity: { label: 'Gravity', min: -10000, max: 10000, step: 10, fallback: 2400 },
  restitution: { label: 'Bounce', min: 0, max: 1, step: 0.01, fallback: 0.6 },
  friction: { label: 'Friction', min: 0, max: 1, step: 0.01, fallback: 0.2 },
  velocityX: { label: 'Start speed X', min: -20000, max: 20000, step: 10, fallback: 0 },
  velocityY: { label: 'Start speed Y', min: -20000, max: 20000, step: 10, fallback: 0 },
  mass: { label: 'Mass', min: 0.1, max: 100, step: 0.1, fallback: 1 }
} as const satisfies Record<string, Range>;

export type PhysicsKey = keyof typeof PHYSICS;
export const PHYSICS_KEYS = Object.keys(PHYSICS) as PhysicsKey[];

const ranged = (key: PhysicsKey) => z.number().min(PHYSICS[key].min).max(PHYSICS[key].max).default(PHYSICS[key].fallback);

export const physicsSchema = z.object({
  ...(Object.fromEntries(PHYSICS_KEYS.map((k) => [k, ranged(k)])) as Record<PhysicsKey, ReturnType<typeof ranged>>),
  bounds: z.enum(BOUNDS).default(Bounds.Floor),
  collide: z.boolean().default(false)
});

export type Physics = z.infer<typeof physicsSchema>;

export enum PhysicsPreset {
  Drop = 'drop',
  Throw = 'throw',
  Float = 'float'
}

export const PHYSICS_PRESETS = Object.values(PhysicsPreset) as [PhysicsPreset, ...PhysicsPreset[]];

export const PHYSICS_PRESET: Record<PhysicsPreset, { label: string; about: string; physics: Physics }> = {
  [PhysicsPreset.Drop]: {
    label: 'Drop & bounce',
    about: 'falls and bounces on the bottom of the frame until it rests',
    physics: { gravity: 2400, restitution: 0.55, friction: 0.3, velocityX: 0, velocityY: 0, mass: 1, bounds: Bounds.Floor, collide: false }
  },
  [PhysicsPreset.Throw]: {
    label: 'Throw',
    about: 'thrown up and sideways, it arcs and bounces off the edges of the frame',
    physics: { gravity: 2400, restitution: 0.6, friction: 0.25, velocityX: 900, velocityY: -1600, mass: 1, bounds: Bounds.Box, collide: false }
  },
  [PhysicsPreset.Float]: {
    label: 'Float',
    about: 'drifts slowly as in water and nudges off the edges',
    physics: { gravity: -40, restitution: 0.9, friction: 0, velocityX: 120, velocityY: -60, mass: 1, bounds: Bounds.Box, collide: false }
  }
};
