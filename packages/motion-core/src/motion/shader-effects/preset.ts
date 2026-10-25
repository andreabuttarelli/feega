import { SHADER_EFFECTS, ShaderSource, type ShaderEffectId, type ShaderEffectSpec } from './catalogue';

export type ShaderValues = Record<string, number | string>;
export type ShaderNode = { id: string; type: string; props: Record<string, unknown>; children: ShaderNode[] };

export const EFFECT_NODE = 'fx';
export const SOURCE_NODE = 'src';

const COLOUR = /^(#[0-9a-fA-F]{6}|brand\.(primary|secondary|accent|background|text)|transparent)$/;

export function effectValues(effect: ShaderEffectId, given: ShaderValues): ShaderValues {
  const spec = SHADER_EFFECTS[effect];
  const numbers = Object.entries(spec.numbers).map(([key, n]) => [key, given[key] ?? n.fallback]);
  const colours = Object.entries(spec.colours).map(([key, fallback]) => [key, given[key] ?? fallback]);
  return Object.fromEntries([...numbers, ...colours]);
}

export function effectProblem(effect: ShaderEffectId, given: Record<string, unknown>): string | null {
  const spec = SHADER_EFFECTS[effect];
  for (const [key, value] of Object.entries(given)) {
    const number = spec.numbers[key];
    if (number) {
      if (typeof value !== 'number' || value < number.min || value > number.max) {
        return `${effect}: ${key} takes ${number.min}..${number.max}`;
      }
      continue;
    }
    if (key in spec.colours) {
      if (typeof value !== 'string' || !COLOUR.test(value)) {
        return `${effect}: ${key} takes #rrggbb or a brand colour`;
      }
      continue;
    }
    return `${effect} has no ${key}; it has ${[...Object.keys(spec.numbers), ...Object.keys(spec.colours)].join(', ')}`;
  }
  return null;
}

export function libraryProps(spec: ShaderEffectSpec, given: ShaderValues): Record<string, unknown> {
  const values: Record<string, unknown> = { ...Object.fromEntries(Object.entries(spec.colours)), ...given };
  if (!spec.stops) {
    return values;
  }
  const last = spec.stops.length - 1;
  return { ...values, stops: spec.stops.map((key, i) => ({ color: values[key], position: i / last })) };
}

const sourceOf = (image: string | null): ShaderNode =>
  image ? { id: SOURCE_NODE, type: 'ImageTexture', props: { url: image, objectFit: 'cover' }, children: [] } : { id: SOURCE_NODE, type: 'MeshGradient', props: {}, children: [] };

export function shaderTree(effect: ShaderEffectId, given: ShaderValues, image: string | null): ShaderNode {
  const spec = SHADER_EFFECTS[effect];
  const children = spec.source === ShaderSource.Filter ? [sourceOf(image)] : [];
  return { id: EFFECT_NODE, type: spec.type, props: libraryProps(spec, effectValues(effect, given)), children };
}
