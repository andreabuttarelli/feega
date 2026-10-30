import { compOf, DEFAULT_VARIANT, type MotionClip, type MotionComp, type MotionDoc } from '@feega/motion-core/motion/doc';
import { FillType, type Fill } from '@feega/motion-core/motion/fill/model';
import { PropertyKind, type PropertyDef } from '@feega/motion-core/motion/property-resolve';
import { DEFAULT_MODE, keyOf, splitKey } from '@feega/motion-core/motion/variables-model';
import type { NewId } from '$lib/motion/main-component';
import { resolveVariables } from '$lib/motion/variables';

const TEXT_COMPONENTS = new Set(['Text', 'Title', 'Kicker', 'Caption']);
const LABELLED = /^(Button|Nav link|Link|List item|Item)\b/;
const STATEFUL = /^(Button|Nav link|Link)\b/;
const FILL_TARGET = 'fill';
const STATE_PROP = 'State';
const MAX_PROPERTY = 40;
const LIGHT = 0.4;

enum State {
  Hover = 'Hover',
  Pressed = 'Pressed'
}

const STATE_SHIFT: Record<State, number> = { [State.Hover]: 0.1, [State.Pressed]: 0.2 };

const STATES = Object.values(State);

const clipsOf = (comp: MotionComp) => comp.tracks.flatMap((t) => t.clips as MotionClip[]);

const fillsOf = (clip: MotionClip) => (clip.props.fills as Fill[] | undefined) ?? [];

const isImage = (clip: MotionClip) => fillsOf(clip).some((f) => f.type === FillType.Image);

const isIcon = (clip: MotionClip, doc: MotionDoc) => {
  const inner = compOf(clip) ? doc.comps[compOf(clip)!] : undefined;
  return Boolean(inner && !inner.component && clipsOf(inner).every((c) => c.component === 'Shape' && !isImage(c)) && clipsOf(inner).length > 0);
};

const top = (clip: MotionClip) => Number(clip.props.y ?? 0);

function textNames(count: number, labelled: boolean): string[] {
  if (count === 1) {
    return [labelled ? 'Label' : 'Title'];
  }
  return Array.from({ length: count }, (_, i) => (i === 0 ? 'Title' : i === 1 ? 'Text' : `Text ${i}`));
}

type Properties = NonNullable<NonNullable<MotionComp['component']>['properties']>;

const stored = (def: PropertyDef): Properties[string] => ({ ...def, kind: `${def.kind}` });

function propertiesOf(comp: MotionComp, doc: MotionDoc): Properties {
  const direct = clipsOf(comp).filter((c) => !c.parent);
  const texts = clipsOf(comp).filter((c) => TEXT_COMPONENTS.has(c.component)).sort((a, b) => top(a) - top(b));
  const names = textNames(texts.length, LABELLED.test(comp.component!.name));
  const text = texts.map((c, i): [string, PropertyDef] => [names[i], { kind: PropertyKind.Text, target: c.id, default: String(c.props.text ?? '') }]);
  const toggles = direct.flatMap((c): [string, PropertyDef][] => (isImage(c) ? [['Show image', { kind: PropertyKind.Boolean, target: c.id, default: true }]] : isIcon(c, doc) ? [['Show icon', { kind: PropertyKind.Boolean, target: c.id, default: true }]] : []));
  const unique = new Map<string, PropertyDef>();
  for (const [name, def] of [...text, ...toggles]) {
    unique.set(unique.has(name) ? `${name} ${unique.size + 1}`.slice(0, MAX_PROPERTY) : name, def);
  }
  return { ...comp.component!.properties, ...Object.fromEntries([...unique].map(([name, def]) => [name, stored(def)])) };
}

function shaded(hex: string, by: number): string {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const light = (Math.max(...rgb) + Math.min(...rgb)) / 2 / 255 > LIGHT;
  const moved = rgb.map((c) => Math.round(light ? c * (1 - by) : c + (255 - c) * by));
  return `#${moved.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function copiedComp(comp: MotionComp, newId: NewId, rebind: (clip: MotionClip) => MotionClip, variant: Record<string, string>): MotionComp {
  const ids = new Map(clipsOf(comp).map((c) => [c.id, newId()]));
  const tracks = comp.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map((c) => ({ ...rebind(c), id: ids.get(c.id)!, parent: c.parent ? (ids.get(c.parent) ?? c.parent) : c.parent })) }));
  const properties = comp.component!.properties ? Object.fromEntries(Object.entries(comp.component!.properties).map(([k, def]) => [k, { ...def, target: ids.get(def.target) ?? def.target }])) : undefined;
  return { ...comp, tracks: tracks as MotionComp['tracks'], component: { ...comp.component!, variant, ...(properties ? { properties } : {}) } };
}

type Painted = { clip: MotionClip; key: string; name: string; hex: string };

function paintedOf(comp: MotionComp, doc: MotionDoc, site: string): Painted | null {
  for (const clip of clipsOf(comp).filter((c) => !c.parent)) {
    const key = clip.bind?.[FILL_TARGET];
    const at = key ? splitKey(key) : null;
    const value = at && at[0] === site ? doc.variables?.[site]?.vars[at[1]]?.values[DEFAULT_MODE] : undefined;
    if (key && at && typeof value === 'string') {
      return { clip, key, name: at[1], hex: value };
    }
  }
  return null;
}

const stateName = (name: string, state: State) => `${name} ${state.toLowerCase()}`;

function withStates(doc: MotionDoc, compId: string, site: string, newId: NewId): MotionDoc {
  const comp = doc.comps[compId];
  const painted = paintedOf(comp, doc, site);
  if (!painted) {
    return doc;
  }
  const collection = doc.variables![site];
  const vars = { ...collection.vars };
  for (const state of STATES) {
    vars[stateName(painted.name, state)] ??= { type: collection.vars[painted.name].type, values: { [DEFAULT_MODE]: shaded(painted.hex, STATE_SHIFT[state]) } };
  }
  const set = comp.component!.set ?? compId;
  const base = { ...comp.component!.variant, [STATE_PROP]: DEFAULT_VARIANT };
  const comps: MotionDoc['comps'] = { ...doc.comps, [compId]: { ...comp, component: { ...comp.component!, set, variant: base } } };
  for (const state of STATES) {
    const key = keyOf(site, stateName(painted.name, state));
    const rebind = (clip: MotionClip) => (clip.id === painted.clip.id ? { ...clip, bind: { ...clip.bind, [FILL_TARGET]: key } } : clip);
    comps[newId()] = copiedComp({ ...comp, component: { ...comp.component!, set } }, newId, rebind, { ...base, [STATE_PROP]: state });
  }
  return { ...doc, comps, variables: { ...doc.variables, [site]: { ...collection, vars } } };
}

export function componentKit(doc: MotionDoc, site: string, newId: NewId): MotionDoc {
  const mains = Object.entries(doc.comps).filter(([, c]) => c.component);
  const propertied: MotionDoc = { ...doc, comps: { ...doc.comps, ...Object.fromEntries(mains.map(([id, c]) => [id, { ...c, component: { ...c.component!, properties: propertiesOf(c, doc) } }])) } };
  const stateful = mains.filter(([, c]) => STATEFUL.test(c.component!.name) && doc.variables?.[site]).map(([id]) => id);
  return resolveVariables(stateful.reduce((next, id) => withStates(next, id, site, newId), propertied));
}
