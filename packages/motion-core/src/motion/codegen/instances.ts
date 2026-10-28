import { compOf, type MotionClip, type MotionComp, type MotionDoc } from '../doc';
import { overridden } from '../precomp';
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

export type ComponentPlan = {
  compId: string;
  name: string;
  block: string;
  comp: MotionComp;
  bindings: Map<string, Binding[]>;
  values: Map<string, Map<string, string | boolean>>;
};

const layerName = (clip: MotionClip) => clip.name || clip.component;

const effectiveClips = (comp: MotionComp, host: MotionClip): Map<string, MotionClip> =>
  new Map(overridden(comp.tracks, host, comp.component).flatMap((t) => t.clips as MotionClip[]).map((c) => [c.id, c]));

const PROPERTY_KEY: Partial<Record<PropertyDef['kind'], PropKey>> = { text: PropKey.Text, boolean: PropKey.Hidden };

function declaredNames(comp: MotionComp): Map<string, string> {
  const defs = Object.entries((comp.component?.properties ?? {}) as Record<string, PropertyDef>);
  return new Map(defs.flatMap(([name, def]) => (PROPERTY_KEY[def.kind] ? [[`${def.target}:${PROPERTY_KEY[def.kind]}`, camel(name)] as [string, string]] : [])));
}

const same = (a: unknown, b: unknown) => a === b;

function planOne(compId: string, comp: MotionComp, hosts: MotionClip[], names: NameBook, resolve: (key: PropKey, value: string | boolean) => string | boolean): ComponentPlan {
  const name = names.unique(pascal(comp.component?.name ?? comp.name));
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
  return { compId, name, block: kebab(name), comp, bindings, values };
}

export function hostsOf(doc: MotionDoc): MotionClip[] {
  const all = [...doc.tracks, ...Object.values(doc.comps).flatMap((c) => c.tracks)].flatMap((t) => t.clips as MotionClip[]);
  return all.filter((c) => compOf(c) !== null && doc.comps[compOf(c)!]);
}

export function planComponents(doc: MotionDoc, resolve: (key: PropKey, value: string | boolean) => string | boolean): Map<string, ComponentPlan> {
  const hosts = hostsOf(doc);
  const names = new NameBook('');
  const ids = [...new Set(hosts.map((h) => compOf(h)!))].sort((a, b) => doc.comps[a].name.localeCompare(doc.comps[b].name) || a.localeCompare(b));
  return new Map(ids.map((id) => [id, planOne(id, doc.comps[id], hosts.filter((h) => compOf(h) === id), names, resolve)]));
}
