import { z } from 'zod';
import { keyframeSchema, type Keyframe } from './keyframes';

export enum LightKind {
  Directional = 'directional',
  Point = 'point',
  Spot = 'spot',
  Area = 'area'
}

export const LIGHT_KINDS = [LightKind.Directional, LightKind.Point, LightKind.Spot, LightKind.Area] as const;

type Range = { min: number; max: number; fallback: number };

export const LIGHT = {
  intensity: { min: 0, max: 50, fallback: 1.5 },
  x: { min: -20, max: 20, fallback: 3 },
  y: { min: -20, max: 20, fallback: 4 },
  z: { min: -20, max: 20, fallback: 5 }
} as const satisfies Record<string, Range>;

export type LightKey = keyof typeof LIGHT;
export const LIGHT_KEYS = Object.keys(LIGHT) as [LightKey, ...LightKey[]];

export enum EnvPreset {
  None = 'none',
  Room = 'room',
  Overpass = 'overpass',
  Sunset = 'sunset',
  Sunrise = 'sunrise',
  Quarry = 'quarry',
  Night = 'night'
}

export const ENV_PRESETS = Object.values(EnvPreset) as [EnvPreset, ...EnvPreset[]];

const ENV_ALIASES: Record<string, EnvPreset> = { studio: EnvPreset.Room };

export const envPresetInput = z.preprocess((value) => (typeof value === 'string' ? (ENV_ALIASES[value] ?? value) : value), z.enum(ENV_PRESETS));

const HDRI_BASE = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r181/examples/textures/equirectangular/';

export const HDRI: Record<EnvPreset, { file: string | null; about: string }> = {
  [EnvPreset.None]: { file: null, about: 'no image-based light' },
  [EnvPreset.Room]: { file: null, about: 'neutral procedural studio room, soft and even (the studio look)' },
  [EnvPreset.Overpass]: { file: 'pedestrian_overpass_1k.hdr', about: 'soft overcast city light' },
  [EnvPreset.Sunset]: { file: 'venice_sunset_1k.hdr', about: 'warm low sun over a city' },
  [EnvPreset.Sunrise]: { file: 'spruit_sunrise_1k.hdr', about: 'cool morning sky, open field' },
  [EnvPreset.Quarry]: { file: 'quarry_01_1k.hdr', about: 'bright outdoor daylight' },
  [EnvPreset.Night]: { file: 'moonless_golf_1k.hdr', about: 'dark night sky, low key' }
};

export function hdriUrl(preset: EnvPreset): string | null {
  const file = HDRI[preset].file;
  return file ? HDRI_BASE + file : null;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
export const MAX_LIGHTS = 8;

const lightValue = (key: LightKey) => z.number().min(LIGHT[key].min).max(LIGHT[key].max);

export const lightSchema = z.object({
  id: z.string().min(1).max(40),
  kind: z.enum(LIGHT_KINDS),
  color: z.string().regex(HEX).default('#ffffff'),
  intensity: lightValue('intensity').default(LIGHT.intensity.fallback),
  x: lightValue('x').default(LIGHT.x.fallback),
  y: lightValue('y').default(LIGHT.y.fallback),
  z: lightValue('z').default(LIGHT.z.fallback),
  castShadow: z.boolean().default(true),
  keyframes: z.object(Object.fromEntries(LIGHT_KEYS.map((k) => [k, z.array(keyframeSchema).min(1).optional()]))).default({}) as z.ZodType<Partial<Record<LightKey, Keyframe[]>>>
});

export type Light = z.infer<typeof lightSchema>;

export const ENVIRONMENT = {
  intensity: { min: 0, max: 5, fallback: 1 },
  rotation: { min: -180, max: 180, fallback: 0 }
} as const satisfies Record<string, Range>;

export const lookSchema = z.object({
  lights: z.array(lightSchema).max(MAX_LIGHTS).default([]),
  environment: z
    .object({
      preset: z.enum(ENV_PRESETS).default(EnvPreset.Room),
      intensity: z.number().min(ENVIRONMENT.intensity.min).max(ENVIRONMENT.intensity.max).default(ENVIRONMENT.intensity.fallback),
      rotation: z.number().min(ENVIRONMENT.rotation.min).max(ENVIRONMENT.rotation.max).default(ENVIRONMENT.rotation.fallback)
    })
    .default({ preset: EnvPreset.Room, intensity: ENVIRONMENT.intensity.fallback, rotation: ENVIRONMENT.rotation.fallback }),
  softShadows: z.boolean().default(true),
  contactShadow: z.boolean().default(true)
});

export type Look = z.infer<typeof lookSchema>;

export function newLook(): Look {
  return lookSchema.parse({});
}
