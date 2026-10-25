import { z } from 'zod';
import { Source, ValueKind, type AnimProp, type KeyValue } from '../keyframes';

export enum PathPreset {
  Circle = 'circle',
  Ellipse = 'ellipse',
  Arc = 'arc',
  Wave = 'wave',
  Line = 'line'
}

export enum PathSourceKind {
  Preset = 'preset',
  Clip = 'clip'
}

export enum PathAlign {
  Start = 'start',
  Center = 'center',
  End = 'end'
}

export const PATH_PRESETS = Object.values(PathPreset) as [PathPreset, ...PathPreset[]];
export const PATH_ALIGNS = Object.values(PathAlign) as [PathAlign, ...PathAlign[]];

export const ALIGN_AT: Record<PathAlign, number> = { [PathAlign.Start]: 0, [PathAlign.Center]: 0.5, [PathAlign.End]: 1 };

type Range = { label: string; min: number; max: number; step: number; fallback: number };

const SWITCH = { min: 0, max: 1, step: 1 } as const;

export const TEXT_PATH = {
  firstMargin: { label: 'First margin %', min: -1000, max: 1000, step: 0.1, fallback: 0 },
  lastMargin: { label: 'Last margin %', min: -1000, max: 1000, step: 0.1, fallback: 0 },
  align: { label: 'Alignment', min: 0, max: 1, step: 0.5, fallback: 0 },
  reverse: { label: 'Reverse path', ...SWITCH, fallback: 0 },
  perpendicular: { label: 'Perpendicular', ...SWITCH, fallback: 1 },
  forceAlign: { label: 'Force alignment', ...SWITCH, fallback: 0 },
  radius: { label: 'Radius px', min: 1, max: 4000, step: 1, fallback: 300 },
  arc: { label: 'Arc °', min: 1, max: 3600, step: 1, fallback: 180 }
} as const satisfies Record<string, Range>;

export type TextPathKey = keyof typeof TEXT_PATH;
export const TEXT_PATH_KEYS = Object.keys(TEXT_PATH) as TextPathKey[];
export const TEXT_PATH_PREFIX = 'tp';

const ranged = (r: Range) => z.number().min(r.min).max(r.max);

export const pathSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal(PathSourceKind.Preset), preset: z.enum(PATH_PRESETS) }),
  z.object({ kind: z.literal(PathSourceKind.Clip), clip: z.string().min(1) })
]);

export const textPathSchema = z.object({
  source: pathSourceSchema,
  align: z.enum(PATH_ALIGNS).default(PathAlign.Start),
  reverse: z.boolean().default(false),
  perpendicular: z.boolean().default(true),
  forceAlign: z.boolean().default(false),
  firstMargin: ranged(TEXT_PATH.firstMargin).default(TEXT_PATH.firstMargin.fallback),
  lastMargin: ranged(TEXT_PATH.lastMargin).default(TEXT_PATH.lastMargin.fallback),
  radius: ranged(TEXT_PATH.radius).default(TEXT_PATH.radius.fallback),
  arc: ranged(TEXT_PATH.arc).default(TEXT_PATH.arc.fallback)
});

export type PathSource = z.infer<typeof pathSourceSchema>;
export type TextPath = z.infer<typeof textPathSchema>;

type Field = { read: (p: TextPath) => number; write: (value: number) => Partial<TextPath> };

export const isOn = (value: number) => value >= 0.5;
const nearestAlign = (value: number) => PATH_ALIGNS.reduce((best, a) => (Math.abs(ALIGN_AT[a] - value) < Math.abs(ALIGN_AT[best] - value) ? a : best));
const flag = (key: 'reverse' | 'perpendicular' | 'forceAlign'): Field => ({ read: (p) => Number(p[key]), write: (v) => ({ [key]: isOn(v) }) });
const number = (key: 'firstMargin' | 'lastMargin' | 'radius' | 'arc'): Field => ({ read: (p) => p[key], write: (v) => ({ [key]: v }) });

export const FIELDS: Record<TextPathKey, Field> = {
  firstMargin: number('firstMargin'),
  lastMargin: number('lastMargin'),
  align: { read: (p) => ALIGN_AT[p.align], write: (v) => ({ align: nearestAlign(v) }) },
  reverse: flag('reverse'),
  perpendicular: flag('perpendicular'),
  forceAlign: flag('forceAlign'),
  radius: number('radius'),
  arc: number('arc')
};

export function textPathKey(field: TextPathKey): string {
  return `${TEXT_PATH_PREFIX}.${field}`;
}

export function textPathField(key: string): TextPathKey | null {
  const [prefix, field, ...rest] = key.split('.');
  return prefix === TEXT_PATH_PREFIX && field in TEXT_PATH && !rest.length ? (field as TextPathKey) : null;
}

export function textPathPatch(key: string, value: KeyValue): Partial<TextPath> | null {
  const field = textPathField(key);
  return field ? FIELDS[field].write(Number(value)) : null;
}

export function textPathProps(path: TextPath | null): AnimProp[] {
  if (!path) {
    return [];
  }
  return TEXT_PATH_KEYS.map((k) => ({ key: textPathKey(k), kind: ValueKind.Number, source: Source.TextPath, ...TEXT_PATH[k], base: FIELDS[k].read(path) }));
}
