import { z } from 'zod';
import { COLOR } from '../components';
import { Source, ValueKind, type AnimProp } from '../keyframes';

export enum AnimatorUnit {
  Char = 'char',
  Word = 'word',
  Line = 'line'
}

export enum SelectorShape {
  Square = 'square',
  Ramp = 'ramp',
  Smooth = 'smooth'
}

export const ANIMATOR_UNITS = Object.values(AnimatorUnit) as [AnimatorUnit, ...AnimatorUnit[]];
export const SELECTOR_SHAPES = Object.values(SelectorShape) as [SelectorShape, ...SelectorShape[]];

type Range = { label: string; min: number; max: number; step: number; fallback: number };

export const SELECTOR = {
  start: { label: 'Start %', min: -100, max: 200, step: 1, fallback: 0 },
  end: { label: 'End %', min: -100, max: 200, step: 1, fallback: 100 },
  offset: { label: 'Offset %', min: -200, max: 200, step: 1, fallback: 0 },
  softness: { label: 'Softness', min: 0, max: 1, step: 0.01, fallback: 0.2 }
} as const satisfies Record<string, Range>;

export const VALUES = {
  opacity: { label: 'Opacity', min: 0, max: 1, step: 0.01, fallback: 1 },
  x: { label: 'Offset X (em)', min: -10, max: 10, step: 0.01, fallback: 0 },
  y: { label: 'Offset Y (em)', min: -10, max: 10, step: 0.01, fallback: 0 },
  scale: { label: 'Scale', min: 0, max: 10, step: 0.01, fallback: 1 },
  rotation: { label: 'Rotation', min: -720, max: 720, step: 1, fallback: 0 },
  blur: { label: 'Blur px', min: 0, max: 100, step: 0.5, fallback: 0 },
  tracking: { label: 'Tracking (em)', min: -1, max: 2, step: 0.005, fallback: 0 }
} as const satisfies Record<string, Range>;

export type SelectorKey = keyof typeof SELECTOR;
export type ValueKey = keyof typeof VALUES;
export const SELECTOR_KEYS = Object.keys(SELECTOR) as SelectorKey[];
export const VALUE_KEYS = Object.keys(VALUES) as ValueKey[];
export const COLOR_VALUE = 'color';

export const ANIMATOR_PREFIX = 'ta';
export const MAX_ANIMATORS = 4;

const ranged = (r: Range) => z.number().min(r.min).max(r.max);

export const animatorSchema = z.object({
  id: z.string().min(1),
  unit: z.enum(ANIMATOR_UNITS),
  shape: z.enum(SELECTOR_SHAPES).default(SelectorShape.Ramp),
  seed: z.number().int().nullable().default(null),
  start: ranged(SELECTOR.start).default(SELECTOR.start.fallback),
  end: ranged(SELECTOR.end).default(SELECTOR.end.fallback),
  offset: ranged(SELECTOR.offset).default(SELECTOR.offset.fallback),
  softness: ranged(SELECTOR.softness).default(SELECTOR.softness.fallback),
  values: z
    .object({
      ...(Object.fromEntries(VALUE_KEYS.map((k) => [k, ranged(VALUES[k]).optional()])) as Record<ValueKey, z.ZodOptional<z.ZodNumber>>),
      [COLOR_VALUE]: z.string().regex(COLOR).optional()
    })
    .strict()
    .default({})
});

export const animatorsSchema = z.array(animatorSchema).max(MAX_ANIMATORS).default([]);

export type TextAnimator = z.infer<typeof animatorSchema>;

export function animatorKey(id: string, field: string): string {
  return `${ANIMATOR_PREFIX}.${id}.${field}`;
}

export function animatorOfKey(key: string): { id: string; field: string } | null {
  const [prefix, id, field, ...rest] = key.split('.');
  return prefix === ANIMATOR_PREFIX && id && field && !rest.length ? { id, field } : null;
}

export function cssName(id: string, field: string): string {
  return `--ta-${id.toLowerCase()}-${field}`;
}

export function animatorProps(animators: readonly TextAnimator[]): AnimProp[] {
  return animators.flatMap((a, i) => {
    const label = (field: string) => `Animator ${i + 1} · ${field}`;
    const selector = SELECTOR_KEYS.map((k) => ({ key: animatorKey(a.id, k), label: label(SELECTOR[k].label), kind: ValueKind.Number, source: Source.Animator, min: SELECTOR[k].min, max: SELECTOR[k].max, step: SELECTOR[k].step, fallback: SELECTOR[k].fallback, base: a[k] }));
    const values = VALUE_KEYS.filter((k) => a.values[k] !== undefined).map((k) => ({ key: animatorKey(a.id, k), label: label(VALUES[k].label), kind: ValueKind.Number, source: Source.Animator, min: VALUES[k].min, max: VALUES[k].max, step: VALUES[k].step, fallback: VALUES[k].fallback, base: a.values[k] }));
    const colour = a.values.color === undefined ? [] : [{ key: animatorKey(a.id, COLOR_VALUE), label: label('Colour'), kind: ValueKind.Color, source: Source.Animator, min: 0, max: 0, step: 0, fallback: 0, base: a.values.color }];
    return [...selector, ...values, ...colour];
  });
}
