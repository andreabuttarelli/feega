import { compOf, findClip, type MotionClip, type MotionComp, type MotionDoc } from './doc';
import { precompose, withOverride } from './precomp';
import { setProps, type OpResult } from './timeline';

export type NewId = () => string;

export enum ComponentAction {
  Create = 'create',
  Override = 'override',
  Reset = 'reset',
  ResetProp = 'reset-prop',
  Push = 'push',
  Detach = 'detach',
  AddVariant = 'add-variant',
  Swap = 'swap'
}

export const COMPONENT_ACTIONS = Object.values(ComponentAction) as [ComponentAction, ...ComponentAction[]];
export type Overrides = Record<string, Record<string, unknown>>;
export type MainComponent = NonNullable<MotionComp['component']>;
export type Instance = { clip: MotionClip; compId: string; comp: MotionComp; overrides: Overrides };

const fail = (error: string): OpResult => ({ ok: false, error });

export const componentOf = (doc: MotionDoc, clip: Pick<MotionClip, 'component' | 'props'>): MainComponent | null => {
  const id = clip.component === 'Precomp' ? compOf(clip) : null;
  return (id && doc.comps[id]?.component) || null;
};

export function instanceOf(doc: MotionDoc, clipId: string): Instance | null {
  const clip = findClip(doc, clipId)?.clip as MotionClip | undefined;
  const compId = clip && componentOf(doc, clip) ? compOf(clip) : null;
  return clip && compId ? { clip, compId, comp: doc.comps[compId], overrides: (clip.props.overrides as Overrides | undefined) ?? {} } : null;
}

export const innerClips = (comp: MotionComp): MotionClip[] => comp.tracks.flatMap((t) => t.clips as MotionClip[]);

export function createComponent(doc: MotionDoc, clipIds: readonly string[], newId: NewId, name: string): OpResult {
  const ids = { comp: newId(), clip: newId() };
  const made = precompose(doc, clipIds, ids, name);
  if (!made.ok) {
    return made;
  }
  const comp = made.doc.comps[ids.comp];
  return { ok: true, doc: { ...made.doc, comps: { ...made.doc.comps, [ids.comp]: { ...comp, component: { name: comp.name } } } } };
}

export function overrideInstance(doc: MotionDoc, instanceId: string, innerId: string, props: Record<string, unknown>): OpResult {
  const instance = instanceOf(doc, instanceId);
  if (!instance) {
    return fail(`${instanceId} is not an instance of a component`);
  }
  if (!innerClips(instance.comp).some((c) => c.id === innerId)) {
    return fail(`the component ${instance.comp.component!.name} has no element ${innerId}`);
  }
  const overrides = { ...instance.overrides, [innerId]: { ...instance.overrides[innerId], ...props } };
  return setProps(doc, instanceId, { overrides });
}

export function resetOverrides(doc: MotionDoc, instanceId: string): OpResult {
  return instanceOf(doc, instanceId) ? setProps(doc, instanceId, { overrides: undefined }) : fail(`${instanceId} is not an instance of a component`);
}

export function resetOverride(doc: MotionDoc, instanceId: string, innerId: string, key: string): OpResult {
  const instance = instanceOf(doc, instanceId);
  if (!instance) {
    return fail(`${instanceId} is not an instance of a component`);
  }
  const { [key]: _dropped, ...kept } = instance.overrides[innerId] ?? {};
  const { [innerId]: _inner, ...others } = instance.overrides;
  const overrides = Object.keys(kept).length ? { ...others, [innerId]: kept } : others;
  return setProps(doc, instanceId, { overrides: Object.keys(overrides).length ? overrides : undefined });
}

const baked = (comp: MotionComp, overrides: Overrides) => comp.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map((c) => (overrides[c.id] ? withOverride(c, overrides[c.id]) : c)) }));

export function pushOverrides(doc: MotionDoc, instanceId: string): OpResult {
  const instance = instanceOf(doc, instanceId);
  if (!instance) {
    return fail(`${instanceId} is not an instance of a component`);
  }
  const main = { ...instance.comp, tracks: baked(instance.comp, instance.overrides) };
  const withMain = { ...doc, comps: { ...doc.comps, [instance.compId]: main } };
  return setProps(withMain, instanceId, { overrides: undefined });
}

export function detachInstance(doc: MotionDoc, instanceId: string, newId: NewId): OpResult {
  const instance = instanceOf(doc, instanceId);
  if (!instance) {
    return fail(`${instanceId} is not an instance of a component`);
  }
  const { component: _main, ...plain } = instance.comp;
  const tracks = baked(plain, instance.overrides);
  const compId = newId();
  const withComp = { ...doc, comps: { ...doc.comps, [compId]: { ...plain, tracks } } };
  return setProps(withComp, instanceId, { comp: compId, overrides: undefined });
}

export type InstanceText = { innerId: string; value: string; main: string; overridden: boolean };

export function instanceTexts(doc: MotionDoc, instanceId: string): InstanceText[] {
  const instance = instanceOf(doc, instanceId);
  if (!instance) {
    return [];
  }
  return innerClips(instance.comp)
    .filter((c) => typeof c.props.text === 'string')
    .map((c) => {
      const own = instance.overrides[c.id]?.text;
      return { innerId: c.id, value: String(own ?? c.props.text), main: String(c.props.text), overridden: own !== undefined };
    });
}

export type InstanceElement = {
  innerId: string;
  component: MotionClip['component'];
  fill: string | null;
  stroke: string | null;
  hidden: boolean;
  effects: number;
  assetId: string | null;
  overridden: string[];
};

const solidColor = (paints: unknown): string | null => {
  const first = (paints as { color?: string; paint?: { color?: string } }[] | undefined)?.[0];
  return first?.color ?? first?.paint?.color ?? null;
};

export function instanceElements(doc: MotionDoc, instanceId: string): InstanceElement[] {
  const instance = instanceOf(doc, instanceId);
  if (!instance) {
    return [];
  }
  return innerClips(instance.comp).map((main) => {
    const own = instance.overrides[main.id] ?? {};
    const shown = withOverride(main, own);
    return {
      innerId: main.id,
      component: main.component,
      fill: solidColor(shown.props.fills),
      stroke: solidColor(shown.props.strokes),
      hidden: shown.hidden === true,
      effects: shown.effects.length,
      assetId: typeof shown.props.assetId === 'string' ? shown.props.assetId : null,
      overridden: Object.keys(own)
    };
  });
}

export enum Paint {
  Fill = 'fills',
  Stroke = 'strokes'
}

export function recolorInstance(doc: MotionDoc, instanceId: string, innerId: string, paint: Paint, color: string): OpResult {
  const instance = instanceOf(doc, instanceId);
  const main = instance && innerClips(instance.comp).find((c) => c.id === innerId);
  const shown = main && withOverride(main, instance.overrides[innerId] ?? {});
  const paints = (shown?.props[paint] as Record<string, unknown>[] | undefined) ?? [];
  if (!paints.length) {
    return fail(`${innerId} has no ${paint === Paint.Fill ? 'fill' : 'stroke'} to recolour`);
  }
  const [first, ...rest] = paints;
  const recoloured = paint === Paint.Fill ? { ...first, color } : { ...first, paint: { ...(first.paint as object), color } };
  return overrideInstance(doc, instanceId, innerId, { [paint]: [recoloured, ...rest] });
}
