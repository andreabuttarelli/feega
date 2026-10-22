import { compOf, findClip, type MotionClip, type MotionComp, type MotionDoc } from './doc';
import { precompose } from './precomp';
import { setProps, type OpResult } from './timeline';

export type NewId = () => string;
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

export function detachInstance(doc: MotionDoc, instanceId: string, newId: NewId): OpResult {
  const instance = instanceOf(doc, instanceId);
  if (!instance) {
    return fail(`${instanceId} is not an instance of a component`);
  }
  const { component: _main, ...plain } = instance.comp;
  const tracks = plain.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map((c) => (instance.overrides[c.id] ? { ...c, props: { ...c.props, ...instance.overrides[c.id] } } : c)) }));
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
