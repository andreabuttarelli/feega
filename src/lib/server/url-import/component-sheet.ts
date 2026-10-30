import type { MotionComp, MotionDoc } from '@feega/motion-core/motion/doc';
import type { PlanItem } from '$lib/canvas/figma/figma-doc';
import { componentSlice } from '$lib/motion/canvas-components';
import { compBox, reframed, type Box } from '$lib/motion/comp-frame';
import { addClip, editClip } from '@feega/motion-core/motion/timeline';
import { ShapeKind } from '@feega/motion-core/motion/shape/schema';
import { DEFAULT_MODE, keyOf } from '@feega/motion-core/motion/variables-model';
import type { NewId } from '$lib/motion/main-component';
import { SET_BACKDROP, SET_GAP_PX } from '$lib/motion/component-set';

const PAD_PX = 40;
const PAGE_GAP_PX = 120;
const PAGE_ROW_PX = 2400;
const BACKGROUND = 'Background';
const FULL = { x: 0.5, y: 0.5, width: 1, height: 1 };

export type ComponentPages = { sets: PlanItem[]; homes: Record<number, Record<string, number>> };

type Main = { id: string; comp: MotionComp; box: Box };
type SetOf = { name: string; source: PlanItem; mains: Main[] };

const widthOf = (b: Box) => b.right - b.left;
const heightOf = (b: Box) => b.bottom - b.top;

function setsOf(items: readonly PlanItem[]): Map<string, SetOf> {
  const sets = new Map<string, SetOf>();
  const seen = new Set<string>();
  for (const item of items) {
    const size = { width: item.doc.width, height: item.doc.height };
    for (const [id, comp] of Object.entries(item.doc.comps)) {
      const box = comp.component && !seen.has(id) ? compBox(comp, size) : null;
      if (!box) {
        continue;
      }
      seen.add(id);
      const key = comp.component!.set ?? id;
      const set = sets.get(key) ?? { name: comp.component!.set ?? comp.component!.name, source: item, mains: [] };
      sets.set(key, { ...set, mains: [...set.mains, { id, comp, box }] });
    }
  }
  return sets;
}

function backdropped(source: MotionDoc, size: { width: number; height: number }, newId: NewId): MotionDoc {
  const empty: MotionDoc = { ...source, ...size, tracks: source.tracks.map((t) => ({ ...t, clips: [] })), comps: {} };
  const [collection, vars] = Object.entries(source.variables ?? {}).find(([, c]) => c.vars[BACKGROUND]) ?? [];
  const fill = vars?.vars[BACKGROUND].values[DEFAULT_MODE];
  if (!collection || typeof fill !== 'string') {
    return empty;
  }
  const id = newId();
  const added = addClip(empty, { component: 'Shape', from: 0, durationInFrames: source.durationInFrames, props: { shape: ShapeKind.Rect, fill, ...FULL } }, id);
  const bound = added.ok ? editClip(added.doc, id, (clip) => ({ ...clip, name: SET_BACKDROP, bind: { fill: keyOf(collection, BACKGROUND) } })) : added;
  return bound.ok ? bound.doc : empty;
}

const clipIdsIn = (doc: MotionDoc) => new Set(Object.values(doc.comps).flatMap((c) => c.tracks.flatMap((t) => t.clips.map((clip) => clip.id))));

function setDoc(set: SetOf, newId: NewId): MotionDoc {
  const source = set.source.doc;
  const size = {
    width: Math.ceil(PAD_PX * 2 + set.mains.reduce((sum, m) => sum + widthOf(m.box) + SET_GAP_PX, -SET_GAP_PX)),
    height: Math.ceil(PAD_PX * 2 + Math.max(...set.mains.map((m) => heightOf(m.box))))
  };
  let doc = backdropped(source, size, newId);
  let left = PAD_PX;
  for (const main of set.mains) {
    const nested = Object.fromEntries(Object.entries(componentSlice(source, main.id).comps).filter(([id]) => id !== main.id && !doc.comps[id]).map(([id, comp]) => [id, reframed(comp, source, size)]));
    const moved = reframed(main.comp, source, size, { x: left - main.box.left, y: PAD_PX - main.box.top });
    const { home: _home, ...component } = main.comp.component!;
    doc = { ...doc, comps: { ...doc.comps, ...nested, [main.id]: { ...moved, component } } };
    const placed = addClip(doc, { component: 'Precomp', from: 0, durationInFrames: Math.min(main.comp.durationInFrames, doc.durationInFrames), props: { comp: main.id } }, newId());
    doc = placed.ok ? placed.doc : doc;
    left += widthOf(main.box) + SET_GAP_PX;
  }
  return doc;
}

function laidOnPage(items: PlanItem[]): PlanItem[] {
  let [left, top, tall] = [0, 0, 0];
  return items.map((item) => {
    if (left > 0 && left + item.size.width > PAGE_ROW_PX) {
      [left, top, tall] = [0, top + tall + PAGE_GAP_PX, 0];
    }
    const centre = { x: left + item.size.width / 2, y: top + item.size.height / 2 };
    left += item.size.width + PAGE_GAP_PX;
    tall = Math.max(tall, item.size.height);
    return { ...item, centre };
  });
}

export function componentPages(items: readonly PlanItem[], newId: NewId): ComponentPages {
  const sets = [...setsOf(items).values()];
  const made = sets.map((set) => {
    const doc = setDoc(set, newId);
    const inside = clipIdsIn(doc);
    return { ...set.source, doc, name: set.name, size: { width: doc.width, height: doc.height }, centre: { x: 0, y: 0 }, images: items.flatMap((i) => i.images).filter((i) => inside.has(i.clipId)) };
  });
  const homeOf = new Map(sets.flatMap((set, at) => set.mains.map((m) => [m.id, at] as const)));
  const homes = Object.fromEntries(
    items.flatMap((item, i) => {
      const own = Object.keys(item.doc.comps).flatMap((id) => (homeOf.has(id) ? [[id, homeOf.get(id)!] as const] : []));
      return own.length ? [[i, Object.fromEntries(own)]] : [];
    })
  );
  return { sets: laidOnPage(made), homes };
}
