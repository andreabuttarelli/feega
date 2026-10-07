import { z } from 'zod';
import { parsePath } from './geometry';
import { MODIFIERS, MODIFIER_KINDS, ModifierKind } from './modifiers';

export enum ShapeKind {
  Rect = 'rect',
  Circle = 'circle',
  Line = 'line',
  Ellipse = 'ellipse',
  Polygon = 'polygon',
  Star = 'star',
  Path = 'path'
}

export enum FillKind {
  Solid = 'solid',
  Linear = 'linear',
  Radial = 'radial',
  None = 'none'
}

export enum StrokeKind {
  None = 'none',
  Solid = 'solid',
  Gradient = 'gradient'
}

export const SHAPE_KINDS = Object.values(ShapeKind) as [ShapeKind, ...ShapeKind[]];
export const FILL_KINDS = Object.values(FillKind) as [FillKind, ...FillKind[]];
export const STROKE_KINDS = Object.values(StrokeKind) as [StrokeKind, ...StrokeKind[]];
export const CAPS = ['butt', 'round', 'square'] as const;
export const JOINS = ['miter', 'round', 'bevel'] as const;
export const FILL_RULES = ['nonzero', 'evenodd'] as const;

const GEOMETRY = ['roundness', 'sides', 'points', 'innerRadius'] as const;

export const GEOMETRY_OF: Record<ShapeKind, readonly (typeof GEOMETRY)[number][]> = {
  [ShapeKind.Rect]: ['roundness'],
  [ShapeKind.Line]: [],
  [ShapeKind.Circle]: [],
  [ShapeKind.Ellipse]: [],
  [ShapeKind.Polygon]: ['sides', 'roundness'],
  [ShapeKind.Star]: ['points', 'innerRadius', 'roundness'],
  [ShapeKind.Path]: []
};

export function shapeFieldShown(kind: ShapeKind, key: string): boolean {
  return !(GEOMETRY as readonly string[]).includes(key) || (GEOMETRY_OF[kind] as readonly string[]).includes(key);
}

export const MAX_PATH = 20000;
export const MAX_MORPHS = 16;
export const MAX_MODIFIERS = 12;
export const MODIFIER_PREFIX = 'mod';

export const pathString = z
  .string()
  .max(MAX_PATH)
  .refine((d) => d === '' || typeof parsePath(d) !== 'string', { message: 'expected SVG path data (M L H V C S Q T Z) in 0..1 box coordinates' });

export const modifierSchema = z
  .object({
    id: z.string().min(1).max(40),
    kind: z.enum(MODIFIER_KINDS),
    enabled: z.boolean().default(true),
    params: z.record(z.string(), z.number()).default({})
  })
  .superRefine((m, ctx) => {
    for (const [key, value] of Object.entries(m.params)) {
      const spec = MODIFIERS[m.kind as ModifierKind].params.find((p) => p.key === key);
      if (!spec) {
        ctx.addIssue({ code: 'custom', message: `${m.kind} has no ${key}; it has ${MODIFIERS[m.kind as ModifierKind].params.map((p) => p.key).join(', ')}` });
        continue;
      }
      if (value < spec.min || value > spec.max) {
        ctx.addIssue({ code: 'custom', message: `${m.kind}.${key} takes ${spec.min}..${spec.max}` });
      }
    }
  });

export type Modifier = z.infer<typeof modifierSchema>;

export function modifierKey(id: string, param: string): string {
  return `${MODIFIER_PREFIX}.${id}.${param}`;
}

export function modifierOfKey(key: string): { id: string; param: string } | null {
  const [prefix, id, param, ...rest] = key.split('.');
  return prefix === MODIFIER_PREFIX && id && param && !rest.length ? { id, param } : null;
}

export function modifierValues(m: Pick<Modifier, 'kind' | 'params'>): Record<string, number> {
  return Object.fromEntries(MODIFIERS[m.kind].params.map((p) => [p.key, m.params[p.key] ?? p.fallback]));
}
