import { Source, ValueKind, type AnimProp } from '../keyframes';
import { MODIFIERS } from './modifiers';
import { modifierKey, modifierValues, type Modifier } from './schema';

export function modifierProps(modifiers: readonly Modifier[]): AnimProp[] {
  return modifiers.flatMap((m) =>
    MODIFIERS[m.kind].params.map((p) => ({
      key: modifierKey(m.id, p.key),
      label: `${MODIFIERS[m.kind].label} · ${p.label}`,
      kind: ValueKind.Number,
      source: Source.Modifier,
      min: p.min,
      max: p.max,
      step: p.step,
      fallback: p.fallback,
      base: modifierValues(m)[p.key]
    }))
  );
}

export function withModifierParam(modifiers: readonly Modifier[], id: string, param: string, value: number): Modifier[] | string {
  const found = modifiers.find((m) => m.id === id);
  if (!found) {
    return `no modifier ${id}`;
  }
  return modifiers.map((m) => (m.id === id ? { ...m, params: { ...m.params, [param]: value } } : m));
}
