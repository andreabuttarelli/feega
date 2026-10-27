export enum StageLightKind {
  Ambient = 'ambient',
  Point = 'point',
  Spot = 'spot',
  Parallel = 'parallel'
}

export const STAGE_LIGHT_KINDS = [StageLightKind.Ambient, StageLightKind.Point, StageLightKind.Spot, StageLightKind.Parallel] as const;

export const STAGE_LIGHT_ABOUT: Record<StageLightKind, string> = {
  [StageLightKind.Ambient]: 'lights every layer evenly from everywhere, no direction',
  [StageLightKind.Point]: 'a bulb at x, y, depth: layers facing it are brighter, dimmer with distance (falloff)',
  [StageLightKind.Spot]: 'a point light aimed by rotateX/rotateY inside a cone (coneAngle, softened by coneFeather)',
  [StageLightKind.Parallel]: 'a sun: parallel rays aimed by rotateX/rotateY, the same everywhere, position ignored'
};

type Range = { label: string; min: number; max: number; step: number; fallback: number };

export const STAGE_LIGHT = {
  intensity: { label: 'Intensity', min: 0, max: 3, step: 0.01, fallback: 1 },
  falloff: { label: 'Falloff radius', min: 0, max: 8000, step: 10, fallback: 0 },
  coneAngle: { label: 'Cone angle', min: 1, max: 180, step: 1, fallback: 90 },
  coneFeather: { label: 'Cone feather', min: 0, max: 1, step: 0.01, fallback: 0.5 }
} as const satisfies Record<string, Range>;

export type StageLightKey = keyof typeof STAGE_LIGHT;
export const STAGE_LIGHT_KEYS = Object.keys(STAGE_LIGHT) as [StageLightKey, ...StageLightKey[]];

export const STAGE_LIGHT_COLOUR = { key: 'color', label: 'Colour', pattern: /^#[0-9a-fA-F]{6}$/, fallback: '#ffffff' } as const;

export const NEW_LIGHT_DEPTH = -600;
