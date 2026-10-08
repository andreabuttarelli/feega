import { z } from 'zod';
import { shaderParam, type ShaderParam } from '@feega/shader-fx';
import { Source, ValueKind, type AnimProp } from '../keyframes';
import { effectKey } from '../effects/model';

export const MAX_SHADERS_PER_CLIP = 1;
export const RASTER_COMPONENTS = ['Image', 'Video'];
export const MAX_FRAG = 12288;

export const shaderSnapshotSchema = z.object({
  name: z.string().min(1).max(48),
  version: z.number().int().min(1),
  frag: z.string().min(1).max(MAX_FRAG),
  params: z.array(shaderParam).max(12)
});

export type ShaderSnapshot = z.infer<typeof shaderSnapshotSchema>;

export const shadersSchema = z.record(z.string().min(1), shaderSnapshotSchema).default({});

export const clipShaderSchema = z.object({
  id: z.string().min(1),
  ref: z.string().min(1),
  enabled: z.boolean().default(true),
  params: z.record(z.string(), z.union([z.number(), z.string()])).default({})
});

export type ClipShader = z.infer<typeof clipShaderSchema>;

export const clipShadersSchema = z.array(clipShaderSchema).max(MAX_SHADERS_PER_CLIP).default([]);

export type ShaderDefs = Record<string, ShaderSnapshot>;

const HEX = /^#[0-9a-f]{6}$/i;

const VALUE_PROBLEM: Record<ShaderParam['kind'], (p: ShaderParam, v: number | string) => string | null> = {
  number: (p, v) => (p.kind === 'number' && typeof v === 'number' && v >= p.min && v <= p.max ? null : `${p.key} takes a number in ${p.kind === 'number' ? `${p.min}..${p.max}` : ''}`),
  color: (p, v) => (typeof v === 'string' && HEX.test(v) ? null : `${p.key} takes #rrggbb`),
  seed: (p, v) => (typeof v === 'number' && Number.isFinite(v) ? null : `${p.key} takes a number`)
};

export function shaderValues(shader: ClipShader, def: ShaderSnapshot): Record<string, number | string> {
  return Object.fromEntries(def.params.map((p) => [p.key, shader.params[p.key] ?? p.default]));
}

export function clipShadersProblem(component: string, shaders: readonly ClipShader[], defs: ShaderDefs): string | null {
  if (shaders.length && !RASTER_COMPONENTS.includes(component)) {
    return `custom effects apply to ${RASTER_COMPONENTS.join(' and ')} clips, not ${component}`;
  }

  for (const shader of shaders) {
    const def = defs[shader.ref];
    if (!def) {
      return `custom effect ${shader.ref} is not in this video: apply it again`;
    }

    for (const [key, value] of Object.entries(shader.params)) {
      const param = def.params.find((p) => p.key === key);
      if (!param) {
        return `${def.name} has no ${key}; it has ${def.params.map((p) => p.key).join(', ') || 'no params'}`;
      }

      const problem = VALUE_PROBLEM[param.kind](param, value);
      if (problem) {
        return `${def.name}: ${problem}`;
      }
    }
  }

  return null;
}

const ANIMATABLE: Partial<Record<ShaderParam['kind'], ValueKind>> = { number: ValueKind.Number, color: ValueKind.Color };

export function shaderProps(shaders: readonly ClipShader[], defs: ShaderDefs): AnimProp[] {
  return shaders.flatMap((shader) => {
    const def = defs[shader.ref];
    if (!def) {
      return [];
    }

    const values = shaderValues(shader, def);
    return def.params.flatMap((p) => {
      const kind = ANIMATABLE[p.kind];
      if (!kind) {
        return [];
      }

      const [min, max, step] = p.kind === 'number' ? [p.min, p.max, p.step] : [0, 0, 0];
      return [{ key: effectKey(shader.id, p.key), label: `${def.name} · ${p.label}`, kind, source: Source.Effect, min, max, step, fallback: p.kind === 'number' ? p.default : 0, base: values[p.key] }];
    });
  });
}

type WithClips = { tracks: { clips: { shaders?: ClipShader[] }[] }[] };

function rewireTracks<T extends WithClips>(holder: T, refs: Record<string, string>): T {
  return {
    ...holder,
    tracks: holder.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.shaders?.length ? { ...c, shaders: c.shaders.map((s) => ({ ...s, ref: refs[s.ref] ?? s.ref })) } : c)) }))
  };
}

export function rewireShaders<D extends WithClips & { shaders: ShaderDefs; comps: Record<string, WithClips> }>(doc: D, refs: Record<string, string>, renamed: Record<string, string> = {}): D {
  const shaders = Object.fromEntries(Object.entries(doc.shaders).map(([ref, def]) => [refs[ref] ?? ref, { ...def, name: renamed[ref] ?? def.name }]));
  const comps = Object.fromEntries(Object.entries(doc.comps).map(([id, comp]) => [id, rewireTracks(comp, refs)]));
  return { ...rewireTracks(doc, refs), shaders, comps };
}

export function freeName(name: string, taken: ReadonlySet<string>): string {
  if (!taken.has(name)) {
    return name;
  }

  let n = 2;
  while (taken.has(`${name}-${n}`)) {
    n += 1;
  }
  return `${name}-${n}`;
}
