import type { MotionComp, MotionDoc } from './doc';
import { innerClips, instanceOf, type MainComponent, type NewId } from './main-component';
import { setProps, type OpResult } from './timeline';

export type Variant = Record<string, string>;

const DEFAULT_VALUE = 'Default';

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

export function pickVariant(doc: MotionDoc, instanceId: string, prop: string, value: string): OpResult {
  const instance = instanceOf(doc, instanceId);
  if (!instance) {
    return fail(`${instanceId} is not an instance of a component`);
  }
  const wanted = { ...instance.comp.component!.variant, [prop]: value };
  const match = setMembers(doc, instance.compId).find(([, c]) => sameVariant(c.component!.variant ?? {}, wanted));
  return match ? swapInstance(doc, instanceId, match[0]) : fail(`no variant ${JSON.stringify(wanted)} in ${instance.comp.component!.name}`);
}
