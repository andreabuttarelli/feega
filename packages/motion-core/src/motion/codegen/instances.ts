import { compOf, type MotionClip, type MotionComp, type MotionDoc } from '../doc';
import { MAX_COMP_DEPTH, overridden } from '../precomp';
import { FillType, fillsOf } from '../fill/model';
import type { PropertyDef } from '../property-resolve';
import { camel, kebab, NameBook, pascal } from './naming';
import { PropType, type PropSpec } from './ir';

export enum PropKey {
  Text = 'text',
  Image = 'assetId',
  TextColour = 'color',
  Fill = 'fills',
  Hidden = 'hidden'
}

type Reading = { read: (clip: MotionClip) => string | boolean | undefined; name: (layer: string) => string; type: PropType; css?: string };

const topSolid = (clip: MotionClip): string | undefined => {
  const fill = fillsOf(clip.props).filter((f) => f.visible && f.type === FillType.Solid).at(-1);
  return fill && fill.type === FillType.Solid ? fill.color : undefined;
};

const asText = (value: unknown) => (typeof value === 'string' ? value : undefined);

export const READINGS: Record<PropKey, Reading> = {
  [PropKey.Text]: { read: (c) => asText(c.props.text), name: (l) => camel(l), type: PropType.Text },
  [PropKey.Image]: { read: (c) => asText(c.props.assetId), name: (l) => `${camel(l)}Src`, type: PropType.Text },
  [PropKey.TextColour]: { read: (c) => (c.props.text === undefined ? undefined : asText(c.props.color)), name: (l) => `${camel(l)}Color`, type: PropType.Text, css: 'color' },
  [PropKey.Fill]: { read: (c) => (c.component === 'Shape' ? topSolid(c) : undefined), name: (l) => `${camel(l)}Color`, type: PropType.Text, css: 'background-color' },
  [PropKey.Hidden]: { read: (c) => !c.hidden, name: (l) => `show${pascal(l)}`, type: PropType.Flag }
};

const PROP_KEYS = Object.values(PropKey);

export type Binding = { key: PropKey; spec: PropSpec };

export type Forward = { name: string; prop: string };

export type SetMark = { name: string; variant: Record<string, string> };

export enum PlanExport {
  Component = 'component',
  Inline = 'inline'
}

export type ComponentPlan = {
  compId: string;
  exportAs: PlanExport;
  name: string;
  set: SetMark | null;
  block: string;
  comp: MotionComp;
  bindings: Map<string, Binding[]>;
  values: Map<string, Map<string, string | boolean>>;
  exposed: PropSpec[];
  forwards: Map<string, Forward[]>;
  propNames: NameBook;
};

const NESTED = '/';

const layerName = (clip: MotionClip) => clip.name || clip.component;

const effectiveClips = (comp: MotionComp, host: MotionClip): Map<string, MotionClip> =>
  new Map(overridden(comp.tracks, host, comp.component).flatMap((t) => t.clips as MotionClip[]).map((c) => [c.id, c]));

const PROPERTY_KEY: Partial<Record<PropertyDef['kind'], PropKey>> = { text: PropKey.Text, boolean: PropKey.Hidden };

function declaredNames(comp: MotionComp): Map<string, string> {
  const defs = Object.entries((comp.component?.properties ?? {}) as Record<string, PropertyDef>);
  return new Map(defs.flatMap(([name, def]) => (PROPERTY_KEY[def.kind] ? [[`${def.target}:${PROPERTY_KEY[def.kind]}`, camel(name)] as [string, string]] : [])));
}

const same = (a: unknown, b: unknown) => a === b;

const setOf = (comp: MotionComp): SetMark | null => (comp.component?.set && Object.keys(comp.component.variant ?? {}).length ? { name: pascal(comp.component.set), variant: comp.component.variant! } : null);

const memberName = (comp: MotionComp, set: SetMark | null) => pascal(set ? `${set.name} ${Object.values(set.variant).join(' ')}` : (comp.component?.name ?? comp.name));

function planOne(compId: string, comp: MotionComp, hosts: MotionClip[], resolve: (key: PropKey, value: string | boolean) => string | boolean): ComponentPlan {
  const set = setOf(comp);
  const masters = comp.tracks.flatMap((t) => t.clips as MotionClip[]);
  const effective = hosts.map((h) => [h.id, effectiveClips(comp, h)] as const);
  const declared = declaredNames(comp);
  const propNames = new NameBook('');
  const bindings = new Map<string, Binding[]>();
  const values = new Map<string, Map<string, string | boolean>>(hosts.map((h) => [h.id, new Map()]));
  for (const master of masters) {
    for (const key of PROP_KEYS) {
      const reading = READINGS[key];
      const fallback = reading.read(master);
      if (fallback === undefined) {
        continue;
      }
      const seen = effective.map(([id, clips]) => [id, clips.get(master.id) ? reading.read(clips.get(master.id)!) : undefined] as const);
      const declaredName = declared.get(`${master.id}:${key}`);
      const varies = seen.some(([, v]) => v !== undefined && !same(v, fallback));
      if (!varies && !declaredName) {
        continue;
      }
      const spec: PropSpec = { name: propNames.unique(declaredName ?? reading.name(layerName(master))), type: reading.type, fallback: reading.css ? null : resolve(key, fallback) };
      bindings.set(master.id, [...(bindings.get(master.id) ?? []), { key, spec }]);
      for (const [id, value] of seen) {
        if (value !== undefined && !same(resolve(key, value), resolve(key, fallback))) {
          values.get(id)!.set(spec.name, resolve(key, value));
        }
      }
    }
  }
  return { compId, exportAs: PlanExport.Component, name: '', set, block: '', comp, bindings, values, exposed: [], forwards: new Map(), propNames };
}

export const specsOf = (plan: ComponentPlan): PropSpec[] => [...[...plan.bindings.values()].flat().map((b) => b.spec), ...plan.exposed];

const isHost = (doc: MotionDoc, clip: MotionClip) => compOf(clip) !== null && Boolean(doc.comps[compOf(clip)!]);

function nestedHosts(doc: MotionDoc, hosts: MotionClip[]): MotionClip[] {
  const out: MotionClip[] = [];
  let frontier = hosts;
  for (let depth = 0; frontier.length && depth < MAX_COMP_DEPTH; depth += 1) {
    frontier = frontier.flatMap((h) => [...effectiveClips(doc.comps[compOf(h)!], h).values()].filter((c) => isHost(doc, c)).map((c) => ({ ...c, id: `${h.id}${NESTED}${c.id}` })));
    out.push(...frontier);
  }
  return out;
}

function expose(outer: ComponentPlan, plans: Map<string, ComponentPlan>, done: Set<string>) {
  if (done.has(outer.compId)) {
    return;
  }
  done.add(outer.compId);
  const nested = outer.comp.tracks.flatMap((t) => t.clips as MotionClip[]).filter((c) => plans.has(compOf(c) ?? ''));
  for (const master of nested) {
    const inner = plans.get(compOf(master)!)!;
    expose(inner, plans, done);
    for (const spec of specsOf(inner)) {
      const own = inner.values.get(master.id)?.get(spec.name);
      const seen = [...outer.values.keys()].map((id) => [id, inner.values.get(`${id}${NESTED}${master.id}`)?.get(spec.name)] as const);
      if (!seen.some(([, v]) => v !== undefined && !same(v, own))) {
        continue;
      }
      const name = outer.propNames.unique(`${camel(layerName(master))}${pascal(spec.name)}`);
      const fallback = own ?? spec.fallback;
      outer.exposed.push({ name, type: spec.type, fallback });
      outer.forwards.set(master.id, [...(outer.forwards.get(master.id) ?? []), { name: spec.name, prop: name }]);
      for (const [id, value] of seen) {
        if (value !== undefined && !same(value, fallback)) {
          outer.values.get(id)!.set(name, value);
        }
      }
    }
  }
}

export function hostsOf(doc: MotionDoc): MotionClip[] {
  const all = [...doc.tracks, ...Object.values(doc.comps).flatMap((c) => c.tracks)].flatMap((t) => t.clips as MotionClip[]);
  return all.filter((c) => compOf(c) !== null && doc.comps[compOf(c)!]);
}

export function planComponents(doc: MotionDoc, resolve: (key: PropKey, value: string | boolean) => string | boolean): Map<string, ComponentPlan> {
  const real = hostsOf(doc);
  const hosts = [...real, ...nestedHosts(doc, real)];
  const names = new NameBook('');
  const ids = [...new Set(hosts.map((h) => compOf(h)!))].sort((a, b) => doc.comps[a].name.localeCompare(doc.comps[b].name) || a.localeCompare(b));
  new Set(ids.flatMap((id) => setOf(doc.comps[id])?.name ?? [])).forEach((set) => names.unique(set));
  const plans = new Map(ids.map((id) => [id, planOne(id, doc.comps[id], hosts.filter((h) => compOf(h) === id), resolve)]));
  const done = new Set<string>();
  plans.forEach((plan) => expose(plan, plans, done));
  plans.forEach((plan) => {
    if (!plan.comp.component && !specsOf(plan).length) {
      plan.exportAs = PlanExport.Inline;
      return;
    }
    plan.name = names.unique(memberName(plan.comp, plan.set));
    plan.block = kebab(plan.name);
  });
  return plans;
}
