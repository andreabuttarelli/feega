import { compsOf, type MotionClip, type MotionComp, type MotionDoc } from './doc';
import type { NewId } from './main-component';
import { setMembers, type Variant } from './variants';
import { addClip, setTransform, type OpResult } from './timeline';

export type FrameDoc = { id: string; doc: MotionDoc };
export type ComponentVariant = { compId: string; variant: Variant };
export type ComponentGroup = { key: string; frameId: string; name: string; variants: ComponentVariant[] };
export type Offset = { x: number; y: number };

const fail = (error: string): OpResult => ({ ok: false, error });

export function componentGroups(frames: readonly FrameDoc[]): ComponentGroup[] {
  const seen = new Set<string>();
  return frames.flatMap(({ id, doc }) =>
    Object.entries(doc.comps).flatMap(([compId, comp]) => {
      if (!comp.component || seen.has(compId)) {
        return [];
      }
      const members = setMembers(doc, compId);
      members.forEach(([memberId]) => seen.add(memberId));
      return [{ key: `${id}:${compId}`, frameId: id, name: comp.component.name, variants: members.map(([memberId, m]) => ({ compId: memberId, variant: m.component!.variant ?? {} })) }];
    })
  );
}

function withNested(source: MotionDoc, compId: string, found: Map<string, MotionComp> = new Map()): Map<string, MotionComp> {
  const comp = source.comps[compId];
  if (!comp || found.has(compId)) {
    return found;
  }
  found.set(compId, comp);
  comp.tracks.flatMap((t) => t.clips as MotionClip[]).flatMap(compsOf).forEach((ref) => withNested(source, ref, found));
  return found;
}

function copied(target: MotionDoc, source: MotionDoc, compId: string): MotionDoc {
  if (target.comps[compId]) {
    return target;
  }
  const comps = Object.fromEntries([...withNested(source, compId)].filter(([id]) => !target.comps[id]));
  const known = new Set(target.assets.map((a) => a.id));
  const assets = [...target.assets, ...source.assets.filter((a) => !known.has(a.id))];
  return { ...target, assets, comps: { ...target.comps, ...comps } };
}

export function placeInstance(target: MotionDoc, source: MotionDoc, compId: string, newId: NewId, at?: Offset): OpResult {
  const main = source.comps[compId];
  if (!main?.component) {
    return fail(`${compId} is not a main component`);
  }
  const id = newId();
  const withMain = copied(target, source, compId);
  const added = addClip(withMain, { component: 'Precomp', from: 0, durationInFrames: Math.min(main.durationInFrames, withMain.durationInFrames), props: { comp: compId } }, id);
  return added.ok && at ? setTransform(added.doc, id, at) : added;
}
