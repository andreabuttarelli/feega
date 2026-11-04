import { compsOf, type MotionClip, type MotionComp, type MotionDoc } from '@feega/motion-core/motion/doc';
import type { NewId } from './main-component';
import { reframed } from './comp-frame';
import { setMembers, type Variant } from './variants';
import { addClip, setTransform, type OpResult } from '@feega/motion-core/motion/timeline';
import { SEPARATOR } from '@feega/motion-core/motion/precomp';

export type FrameDoc = { id: string; doc: MotionDoc };
export type FrameMains = { id: string; doc: { comps: Record<string, Pick<MotionComp, 'component'>> } };
export type ComponentVariant = { compId: string; variant: Variant };
export type ComponentGroup = { key: string; frameId: string; home: string; name: string; variants: ComponentVariant[] };
export type Offset = { x: number; y: number };

const fail = (error: string): OpResult => ({ ok: false, error });

export function componentGroups(frames: readonly FrameMains[]): ComponentGroup[] {
  const seen = new Set<string>();
  const present = new Set(frames.map((f) => f.id));
  return frames.flatMap(({ id, doc }) =>
    Object.entries(doc.comps).flatMap(([compId, comp]) => {
      const home = comp.component?.home;
      const followed = Boolean(home && home !== id && present.has(home));
      if (!comp.component || followed || seen.has(compId)) {
        return [];
      }
      const members = setMembers(doc, compId);
      members.forEach(([memberId]) => seen.add(memberId));
      return [{ key: `${id}:${compId}`, frameId: id, home: comp.component.home ?? id, name: comp.component.name, variants: members.map(([memberId, m]) => ({ compId: memberId, variant: m.component!.variant ?? {} })) }];
    })
  );
}

function withSet(source: MotionDoc, compId: string): Map<string, MotionComp> {
  const found = new Map<string, MotionComp>();
  const members = setMembers(source, compId).map(([id]) => id);
  [compId, ...members].forEach((id) => withNested(source, id, found));
  return found;
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
  const comps = Object.fromEntries([...withSet(source, compId)].filter(([id]) => !target.comps[id]).map(([id, comp]) => [id, reframed(comp, source, target)]));
  const known = new Set(target.assets.map((a) => a.id));
  const assets = [...target.assets, ...source.assets.filter((a) => !known.has(a.id))];
  return { ...target, assets, comps: { ...target.comps, ...comps } };
}

export function componentSlice(source: MotionDoc, compId: string): MotionDoc {
  const comps = Object.fromEntries(withSet(source, compId));
  return { ...source, tracks: [], comps };
}

export function homed(source: MotionDoc, frameId: string): MotionDoc {
  const comps = Object.fromEntries(Object.entries(source.comps).map(([id, comp]) => [id, comp.component ? { ...comp, component: { ...comp.component, home: comp.component.home ?? frameId } } : comp]));
  return { ...source, comps };
}

export function homedAt(source: MotionDoc, homes: Readonly<Record<string, string>>): MotionDoc {
  const comps = Object.fromEntries(Object.entries(source.comps).map(([id, comp]) => [id, comp.component && homes[id] ? { ...comp, component: { ...comp.component, home: homes[id] } } : comp]));
  return { ...source, comps };
}

export const mainHome = (doc: MotionDoc, compId: string, frameId: string): string => doc.comps[compId]?.component?.home ?? frameId;

const FIRST_LOOP = 0;

function mainPath(doc: MotionDoc, clips: readonly MotionClip[], compId: string, seen: Set<string>): string | null {
  const own = clips.find((c) => c.props.comp === compId);
  if (own) {
    return own.id;
  }
  for (const host of clips) {
    const comp = host.props.comp;
    if (typeof comp !== 'string' || seen.has(comp)) {
      continue;
    }
    seen.add(comp);
    const inner = mainPath(doc, (doc.comps[comp]?.tracks ?? []).flatMap((t) => t.clips as MotionClip[]), compId, seen);
    if (inner) {
      return `${host.id}${SEPARATOR}${FIRST_LOOP}${SEPARATOR}${inner}`;
    }
  }
  return null;
}

export const mainClipOf = (doc: MotionDoc, compId: string): string | null => mainPath(doc, doc.tracks.flatMap((t) => t.clips as MotionClip[]), compId, new Set());

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
