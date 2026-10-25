import { z } from 'zod';
import { COLOR } from '../components';
import { Source, ValueKind, type AnimProp } from '../keyframes';
import { lutSchema } from './lut-model';
import { EFFECTS, EFFECT_KINDS, type EffectKind, type EffectParam, type Values } from './registry';

export const MAX_EFFECTS = 12;
export const EFFECT_PREFIX = 'fx';

export const effectSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(EFFECT_KINDS),
  enabled: z.boolean().default(true),
  params: z.record(z.string(), z.union([z.number(), z.string()])).default({}),
  lut: lutSchema.nullable().optional()
});

export const effectsSchema = z.array(effectSchema).max(MAX_EFFECTS).default([]);

export type Effect = z.infer<typeof effectSchema>;

export function effectKey(effectId: string, param: string): string {
  return `${EFFECT_PREFIX}.${effectId}.${param}`;
}

export function effectOfKey(key: string): { effectId: string; param: string } | null {
  const [prefix, effectId, param, ...rest] = key.split('.');
  return prefix === EFFECT_PREFIX && effectId && param && !rest.length ? { effectId, param } : null;
}

export function paramValues(effect: Pick<Effect, 'kind' | 'params'>): Values {
  return Object.fromEntries(EFFECTS[effect.kind].params.map((p) => [p.key, effect.params[p.key] ?? p.fallback]));
}

export function effectProps(effects: readonly Effect[]): AnimProp[] {
  return effects.flatMap((e) =>
    EFFECTS[e.kind].params.map((p) => ({ key: effectKey(e.id, p.key), label: `${EFFECTS[e.kind].label} · ${p.label}`, kind: p.kind, source: Source.Effect, min: p.min, max: p.max, step: p.step, fallback: Number(p.fallback) || 0, base: paramValues(e)[p.key] }))
  );
}

const VALUE_PROBLEM: Record<ValueKind, (p: EffectParam, v: number | string) => string | null> = {
  [ValueKind.Number]: (p, v) => (typeof v === 'number' && Number.isFinite(v) && v >= p.min && v <= p.max ? null : `${p.key} takes a number in ${p.min}..${p.max}`),
  [ValueKind.Color]: (p, v) => (typeof v === 'string' && COLOR.test(v) ? null : `${p.key} takes #rrggbb or a brand colour`)
};

export function effectProblem(effect: Pick<Effect, 'kind' | 'params'>): string | null {
  const spec = EFFECTS[effect.kind as EffectKind];
  for (const [key, value] of Object.entries(effect.params)) {
    const param = spec.params.find((p) => p.key === key);
    if (!param) {
      return `${spec.label} has no ${key}; it has ${spec.params.map((p) => p.key).join(', ')}`;
    }
    const problem = VALUE_PROBLEM[param.kind](param, value);
    if (problem) {
      return `${spec.label}: ${problem}`;
    }
  }
  return null;
}

export function effectsProblem(effects: readonly Effect[]): string | null {
  const ids = new Set(effects.map((e) => e.id));
  if (ids.size !== effects.length) {
    return 'two effects share an id';
  }
  for (const effect of effects) {
    if (effect.lut && !lutSchema.safeParse(effect.lut).success) {
      return `${effect.id}: the LUT is malformed, load it again`;
    }
    const problem = effectProblem(effect);
    if (problem) {
      return problem;
    }
  }
  return null;
}
