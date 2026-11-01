import { compOf, type MotionClip, type MotionComp, type MotionDoc } from '@feega/motion-core/motion/doc';
import { ElementState, OVERRIDABLE_STATES, resolveState } from '@feega/motion-core/motion/states/model';

const STATED = '~';

export const statedId = (comp: string, state: ElementState): string => `${comp}${STATED}${state}`;

type Made = Record<string, MotionComp>;

function stated(doc: MotionDoc, compId: string, state: ElementState, made: Made): string | null {
  const id = statedId(compId, state);
  if (made[id]) {
    return id;
  }
  const comp = doc.comps[compId];
  let changed = false;
  const drawn = (clip: MotionClip): MotionClip => {
    const own = clip.states?.some((r) => r.state === state) ? { ...clip, ...resolveState(clip, state) } : clip;
    const inner = compOf(clip);
    const nested = inner && doc.comps[inner] && !doc.comps[inner].component ? stated(doc, inner, state, made) : null;
    changed ||= own !== clip || nested !== null;
    return nested ? { ...own, props: { ...own.props, comp: nested } } : own;
  };
  const tracks = comp.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map(drawn) }));
  if (!changed) {
    return null;
  }
  const { component: _component, ...plain } = comp;
  made[id] = { ...plain, tracks } as MotionComp;
  return id;
}

const memo = new WeakMap<MotionDoc, MotionDoc>();

export function withStatedComps(doc: MotionDoc): MotionDoc {
  const held = memo.get(doc);
  if (held) {
    return held;
  }
  const made: Made = {};
  const mains = Object.entries(doc.comps).filter(([, c]) => c.component).map(([id]) => id);
  OVERRIDABLE_STATES.forEach((state) => mains.forEach((id) => stated(doc, id, state, made)));
  const next = Object.keys(made).length ? { ...doc, comps: { ...doc.comps, ...made } } : doc;
  memo.set(doc, next);
  return next;
}
