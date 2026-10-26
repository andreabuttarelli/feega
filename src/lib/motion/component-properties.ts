import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
import { componentOf, innerClips, instanceOf } from './main-component';
import { PropertyKind, type PropertyDef, type PropertyValue, type PropertyValues } from '@feega/motion-core/motion/property-resolve';
import { setProps, type OpResult } from '@feega/motion-core/motion/timeline';
import { compOf } from '@feega/motion-core/motion/doc';

const fail = (error: string): OpResult => ({ ok: false, error });

const notInstance = (id: string) => fail(`${id} is not an instance of a component`);

const definitionsOf = (doc: MotionDoc, compId: string) => (doc.comps[compId]?.component?.properties ?? {}) as Record<string, PropertyDef>;

const withDefs = (doc: MotionDoc, compId: string, defs: Record<string, PropertyDef>): OpResult => {
  const comp = doc.comps[compId];
  const { properties: _old, ...main } = comp.component!;
  const component = Object.keys(defs).length ? { ...main, properties: defs } : main;
  return { ok: true, doc: { ...doc, comps: { ...doc.comps, [compId]: { ...comp, component } } } };
};

const typeMatches = (kind: PropertyKind, value: unknown) => (kind === PropertyKind.Boolean ? typeof value === 'boolean' : typeof value === 'string');

function targetProblem(doc: MotionDoc, target: MotionClip, def: PropertyDef): string | null {
  if (def.kind === PropertyKind.Text) {
    return typeof target.props.text === 'string' ? null : `${target.id} has no text`;
  }
  if (def.kind === PropertyKind.Boolean) {
    return null;
  }
  const nestedMain = target.component === 'Precomp' ? componentOf(doc, target) : null;
  if (!nestedMain) {
    return `${target.id} is not an instance of a component`;
  }
  if (def.kind === PropertyKind.Swap) {
    return null;
  }
  return def.nested && nestedMain.properties?.[def.nested] ? null : `${nestedMain.name} has no property ${def.nested ?? ''}`.trim();
}

export function defineProperty(doc: MotionDoc, compId: string, key: string, def: PropertyDef): OpResult {
  const comp = doc.comps[compId];
  if (!comp?.component) {
    return fail(`${compId} is not a component`);
  }
  const target = innerClips(comp).find((c) => c.id === def.target);
  if (!target) {
    return fail(`the component ${comp.component.name} has no element ${def.target}`);
  }
  const problem = targetProblem(doc, target, def);
  if (problem) {
    return fail(problem);
  }
  if (def.default !== undefined && def.kind !== PropertyKind.Nested && !typeMatches(def.kind, def.default)) {
    return fail(`the default of ${key} must be a ${def.kind === PropertyKind.Boolean ? 'boolean' : 'string'}`);
  }
  return withDefs(doc, compId, { ...definitionsOf(doc, compId), [key]: def });
}

export function removeProperty(doc: MotionDoc, compId: string, key: string): OpResult {
  if (!doc.comps[compId]?.component) {
    return fail(`${compId} is not a component`);
  }
  const { [key]: _gone, ...kept } = definitionsOf(doc, compId);
  const withoutValue = (clip: MotionClip): MotionClip => {
    const values = clip.props.propValues as PropertyValues | undefined;
    if (clip.component !== 'Precomp' || compOf(clip) !== compId || !values || !(key in values)) {
      return clip;
    }
    const { [key]: _value, ...rest } = values;
    return { ...clip, props: { ...clip.props, propValues: Object.keys(rest).length ? rest : undefined } };
  };
  const cleaned = { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map(withoutValue) })) };
  return withDefs(cleaned, compId, kept);
}

export function setProperty(doc: MotionDoc, instanceId: string, key: string, value: PropertyValue): OpResult {
  const instance = instanceOf(doc, instanceId);
  if (!instance) {
    return notInstance(instanceId);
  }
  const def = definitionsOf(doc, instance.compId)[key];
  if (!def) {
    return fail(`${instance.comp.component!.name} has no property ${key}`);
  }
  if (def.kind !== PropertyKind.Nested && !typeMatches(def.kind, value)) {
    return fail(`${key} takes a ${def.kind === PropertyKind.Boolean ? 'boolean' : 'string'}`);
  }
  if (def.kind === PropertyKind.Swap && !doc.comps[String(value)]?.component) {
    return fail(`${String(value)} is not a component`);
  }
  const values = { ...(instance.clip.props.propValues as PropertyValues | undefined), [key]: value };
  return setProps(doc, instanceId, { propValues: values });
}

export function resetProperty(doc: MotionDoc, instanceId: string, key: string): OpResult {
  const instance = instanceOf(doc, instanceId);
  if (!instance) {
    return notInstance(instanceId);
  }
  const { [key]: _gone, ...rest } = (instance.clip.props.propValues as PropertyValues | undefined) ?? {};
  return setProps(doc, instanceId, { propValues: Object.keys(rest).length ? rest : undefined });
}

export type InstanceProperty = { key: string; control: PropertyKind.Boolean | PropertyKind.Text | PropertyKind.Swap; value: PropertyValue; overridden: boolean };

function controlOf(doc: MotionDoc, compId: string, def: PropertyDef): InstanceProperty['control'] {
  if (def.kind !== PropertyKind.Nested) {
    return def.kind;
  }
  const target = innerClips(doc.comps[compId]).find((c) => c.id === def.target);
  const nestedMain = target && componentOf(doc, target);
  const nestedDef = nestedMain?.properties?.[def.nested ?? ''] as PropertyDef | undefined;
  return target && nestedDef ? controlOf(doc, compOf(target)!, nestedDef) : PropertyKind.Text;
}

function defaultOf(def: PropertyDef, control: InstanceProperty['control']): PropertyValue {
  const fallback: Record<InstanceProperty['control'], PropertyValue> = { [PropertyKind.Boolean]: true, [PropertyKind.Text]: '', [PropertyKind.Swap]: '' };
  return def.default ?? fallback[control];
}

export function instanceProperties(doc: MotionDoc, instanceId: string): InstanceProperty[] {
  const instance = instanceOf(doc, instanceId);
  if (!instance) {
    return [];
  }
  const values = (instance.clip.props.propValues as PropertyValues | undefined) ?? {};
  return Object.entries(definitionsOf(doc, instance.compId)).map(([key, def]) => {
    const control = controlOf(doc, instance.compId, def);
    return { key, control, value: values[key] ?? defaultOf(def, control), overridden: key in values };
  });
}

export type Exposure = { label: string; def: Omit<PropertyDef, 'target'> };

export function exposable(doc: MotionDoc, compId: string, innerId: string): Exposure[] {
  const target = innerClips(doc.comps[compId]).find((c) => c.id === innerId);
  if (!target) {
    return [];
  }
  const text = typeof target.props.text === 'string' ? [{ label: 'Text', def: { kind: PropertyKind.Text, default: target.props.text } }] : [];
  const nestedMain = target.component === 'Precomp' ? componentOf(doc, target) : null;
  const swap = nestedMain ? [{ label: 'Swap', def: { kind: PropertyKind.Swap, default: compOf(target)! } }] : [];
  const nested = Object.keys(nestedMain?.properties ?? {}).map((key) => ({ label: key, def: { kind: PropertyKind.Nested, nested: key } }));
  return [{ label: 'Visible', def: { kind: PropertyKind.Boolean, default: true } }, ...text, ...swap, ...nested];
}
