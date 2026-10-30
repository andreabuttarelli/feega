import { compsOf, type MotionClip, type MotionComp, type MotionDoc } from '@feega/motion-core/motion/doc';
import { withOverride } from '@feega/motion-core/motion/precomp';
import { componentSlice } from './canvas-components';
import type { Overrides } from './main-component';
import { compBox, reframed, type Point, type Size } from './comp-frame';

export type HomeDocs = ReadonlyMap<string, MotionDoc | null>;

const homeOf = (comp: MotionComp, frameId: string): string | null => {
  const home = comp.component?.home;
  return home && home !== frameId ? home : null;
};

export const mainHomesOf = (doc: MotionDoc, frameId: string): string[] => [...new Set(Object.values(doc.comps).flatMap((comp) => homeOf(comp, frameId) ?? []))].sort();

const clipsIn = (comp: Pick<MotionComp, 'tracks'>): MotionClip[] => comp.tracks.flatMap((t) => t.clips as MotionClip[]);

function containsItself(comps: MotionDoc['comps'], compId: string): boolean {
  const seen = new Set<string>();
  const stack = clipsIn(comps[compId]).flatMap(compsOf);
  while (stack.length) {
    const next = stack.pop()!;
    if (next === compId) {
      return true;
    }
    if (seen.has(next) || !comps[next]) {
      continue;
    }
    seen.add(next);
    stack.push(...clipsIn(comps[next]).flatMap(compsOf));
  }
  return false;
}

const mapClips = (tracks: MotionComp['tracks'], change: (clip: MotionClip) => MotionClip) => tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map(change) }));

const bakedWith = (comp: MotionComp, overrides: Overrides): MotionComp => ({ ...comp, tracks: mapClips(comp.tracks, (c) => (overrides[c.id] ? withOverride(c, overrides[c.id]) : c)) });

function detached(doc: MotionDoc, compId: string): MotionDoc {
  const { component: _main, ...plain } = doc.comps[compId];
  const own: MotionDoc['comps'] = {};

  const unlink = (clip: MotionClip): MotionClip => {
    if (clip.component !== 'Precomp' || clip.props.comp !== compId) {
      return clip;
    }
    const { overrides, ...props } = clip.props as Record<string, unknown> & { overrides?: Overrides };
    if (!overrides || !Object.keys(overrides).length) {
      return { ...clip, props };
    }
    const ownId = `${compId}-${clip.id}`;
    own[ownId] = bakedWith(plain, overrides);
    return { ...clip, props: { ...props, comp: ownId } };
  };

  const tracks = mapClips(doc.tracks, unlink);
  const comps = Object.fromEntries(Object.entries(doc.comps).map(([id, comp]) => [id, id === compId ? plain : { ...comp, tracks: mapClips(comp.tracks, unlink) }]));
  return { ...doc, tracks, comps: { ...comps, ...own } };
}

const sizeOf = (doc: MotionDoc): Size => ({ width: doc.width, height: doc.height });

function anchored(local: MotionComp | undefined, arriving: MotionComp, size: Size): Point {
  const was = local ? compBox(local, size) : null;
  const now = compBox(arriving, size);
  return was && now ? { x: was.left - now.left, y: was.top - now.top } : { x: 0, y: 0 };
}

function followed(doc: MotionDoc, compId: string, home: string, homeDoc: MotionDoc): MotionDoc {
  const main = homeDoc.comps[compId];
  if (!main?.component) {
    return detached(doc, compId);
  }

  const slice = componentSlice(homeDoc, compId).comps;
  const [from, to] = [sizeOf(homeDoc), sizeOf(doc)];
  const shift = anchored(doc.comps[compId], reframed(main, from, to), to);
  const picked = Object.fromEntries(
    Object.entries(slice).flatMap(([id, comp]) => {
      if (id === compId) {
        return [[id, { ...reframed(comp, from, to, shift), component: { ...comp.component!, home } }]];
      }
      return comp.component && doc.comps[id] ? [] : [[id, reframed(comp, from, to)]];
    })
  );
  const comps = { ...doc.comps, ...picked };
  return containsItself(comps, compId) ? doc : { ...doc, comps };
}

export function linkedMains(doc: MotionDoc, frameId: string, homes: HomeDocs): MotionDoc {
  return Object.keys(doc.comps)
    .sort()
    .reduce((current, compId) => {
      const comp = current.comps[compId];
      const home = comp ? homeOf(comp, frameId) : null;
      if (!home || !homes.has(home)) {
        return current;
      }
      const homeDoc = homes.get(home);
      return homeDoc ? followed(current, compId, home, homeDoc) : detached(current, compId);
    }, doc);
}

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const RADIX = 36;

function fnv(text: string): string {
  let hash = FNV_OFFSET;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), FNV_PRIME);
  }
  return (hash >>> 0).toString(RADIX);
}

export function mainsSignature(doc: MotionDoc, frameId: string): string | null {
  const own = Object.keys(doc.comps)
    .filter((id) => doc.comps[id].component && !homeOf(doc.comps[id], frameId))
    .sort();
  if (!own.length) {
    return null;
  }
  return fnv(JSON.stringify(own.map((id) => [id, componentSlice(doc, id).comps])));
}
