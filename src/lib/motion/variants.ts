import type { MotionComp, MotionDoc } from '@feega/motion-core/motion/doc';
import { innerClips, instanceOf, type MainComponent, type NewId } from './main-component';
import { setProps, type OpResult } from '@feega/motion-core/motion/timeline';

export type Variant = Record<string, string>;

const DEFAULT_VALUE = 'Default';

const MAX_VARIANTS = 64;

const fail = (error: string): OpResult => ({ ok: false, error });

const setOf = (compId: string, main: MainComponent) => main.set ?? compId;

const sameVariant = (a: Variant, b: Variant) => Object.keys({ ...a, ...b }).every((k) => a[k] === b[k]);

export function setMembers(doc: MotionDoc, compId: string): [string, MotionComp][] {
  const main = doc.comps[compId]?.component;
  if (!main) {
    return [];
  }
  const set = setOf(compId, main);
  return Object.entries(doc.comps).filter(([id, c]) => c.component && setOf(id, c.component) === set);
}

export function variantProps(doc: MotionDoc, compId: string): Record<string, string[]> {
  const props: Record<string, string[]> = {};
  for (const [, comp] of setMembers(doc, compId)) {
    for (const [key, value] of Object.entries(comp.component!.variant ?? {})) {
      props[key] = props[key]?.includes(value) ? props[key] : [...(props[key] ?? []), value];
    }
  }
  return props;
}

export function addVariant(doc: MotionDoc, compId: string, variant: Variant, newId: NewId): OpResult {
  const main = doc.comps[compId];
  if (!main?.component) {
    return fail(`${compId} is not a component`);
  }
  const set = setOf(compId, main.component);
  const base = { ...Object.fromEntries(Object.keys(variant).map((k) => [k, DEFAULT_VALUE])), ...main.component.variant };
  const wanted = { ...base, ...variant };
  if (setMembers(doc, compId).some(([, c]) => sameVariant(c.component!.variant ?? {}, wanted))) {
    return fail(`the set already has the variant ${JSON.stringify(wanted)}`);
  }
  const id = newId();
  const marked = { ...main, component: { ...main.component, set, variant: base } };
  const copy = { ...main, component: { name: main.component.name, set, variant: wanted } };
  return { ok: true, doc: { ...doc, comps: { ...doc.comps, [compId]: marked, [id]: copy } } };
}

export function swapInstance(doc: MotionDoc, instanceId: string, compId: string): OpResult {
  const instance = instanceOf(doc, instanceId);
  const target = doc.comps[compId];
  if (!instance) {
    return fail(`${instanceId} is not an instance of a component`);
  }
  if (!target?.component) {
    return fail(`${compId} is not a component`);
  }
  const inner = new Set(innerClips(target).map((c) => c.id));
  const kept = Object.fromEntries(Object.entries(instance.overrides).filter(([id]) => inner.has(id)));
  return setProps(doc, instanceId, { comp: compId, overrides: Object.keys(kept).length ? kept : undefined });
}

export function setVariant(doc: MotionDoc, instanceId: string, picked: Variant): OpResult {
  const instance = instanceOf(doc, instanceId);
  if (!instance) {
    return fail(`${instanceId} is not an instance of a component`);
  }
  const wanted = { ...instance.comp.component!.variant, ...picked };
  const match = setMembers(doc, instance.compId).find(([, c]) => sameVariant(c.component!.variant ?? {}, wanted));
  return match ? swapInstance(doc, instanceId, match[0]) : fail(`no variant ${JSON.stringify(wanted)} in ${instance.comp.component!.name}`);
}

export const pickVariant = (doc: MotionDoc, instanceId: string, prop: string, value: string): OpResult => setVariant(doc, instanceId, { [prop]: value });

const combinations = (axes: Record<string, string[]>): Variant[] =>
  Object.entries(axes).reduce<Variant[]>((rows, [key, values]) => rows.flatMap((row) => values.map((value) => ({ ...row, [key]: value }))), [{}]);

export type MatrixCell = { variant: Variant; compId: string | null };

export function variantMatrix(doc: MotionDoc, compId: string): { axes: Record<string, string[]>; cells: MatrixCell[] } {
  const axes = variantProps(doc, compId);
  const members = setMembers(doc, compId);
  const cells = combinations(axes).map((variant) => ({ variant, compId: members.find(([, c]) => sameVariant(c.component!.variant ?? {}, variant))?.[0] ?? null }));
  return { axes, cells };
}

export function defineVariantProp(doc: MotionDoc, compId: string, key: string, values: string[], newId: NewId): OpResult {
  const main = doc.comps[compId];
  if (!main?.component) {
    return fail(`${compId} is not a component`);
  }
  const wanted = [...new Set(values)];
  if (!wanted.length) {
    return fail('a variant property needs at least one value');
  }
  const set = setOf(compId, main.component);
  const members = setMembers(doc, compId);
  const marked = Object.fromEntries(
    members.map(([id, c]) => [id, { ...c, component: { ...c.component!, set, variant: { ...c.component!.variant, [key]: c.component!.variant?.[key] ?? wanted[0] } } }])
  );
  const withAxis = { ...doc, comps: { ...doc.comps, ...marked } };
  const current = variantProps(withAxis, compId);
  const axes = { ...current, [key]: [...new Set([...(current[key] ?? []), ...wanted])] };
  const missing = combinations(axes).filter((variant) => !members.some(([id]) => sameVariant(withAxis.comps[id].component!.variant ?? {}, variant)));
  if (members.length + missing.length > MAX_VARIANTS) {
    return fail(`a set holds at most ${MAX_VARIANTS} variants`);
  }
  const base = withAxis.comps[compId];
  const copies = Object.fromEntries(missing.map((variant) => [newId(), { ...base, component: { ...base.component!, variant } }]));
  return { ok: true, doc: { ...withAxis, comps: { ...withAxis.comps, ...copies } } };
}
