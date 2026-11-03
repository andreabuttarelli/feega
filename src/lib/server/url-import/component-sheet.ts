import { Background, type MotionClip, type MotionComp, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, editClip } from '@feega/motion-core/motion/timeline';
import { ShapeKind } from '@feega/motion-core/motion/shape/schema';
import { Destination } from '$lib/canvas/figma/scene';
import { FrameKind } from '$lib/canvas/motion-node';
import type { PlanItem } from '$lib/canvas/figma/figma-doc';
import { componentSlice } from '$lib/motion/canvas-components';
import { compBox, reframed, type Box, type Point } from '$lib/motion/comp-frame';
import type { NewId } from '$lib/motion/main-component';
import { SET_BACKDROP, SET_GAP_PX, SET_PAD_PX } from '$lib/motion/component-set';
import { backdropsOf, type Backdrop } from './main-backdrop';

const PAGE_GAP_PX = 120;
const PAGE_ROW_PX = 2400;

export type Homes = Record<number, Record<string, number>>;
export type ComponentPages = { sets: PlanItem[]; homes: Homes; setHomes: Homes };

type Main = { id: string; comp: MotionComp; box: Box; backdrop: Backdrop | null };
type SetOf = { name: string; source: PlanItem; mains: Main[] };

const widthOf = (b: Box) => b.right - b.left;
const heightOf = (b: Box) => b.bottom - b.top;

function setsOf(items: readonly PlanItem[]): Map<string, SetOf> {
  const sets = new Map<string, SetOf>();
  const seen = new Set<string>();
  for (const item of items) {
    const size = { width: item.doc.width, height: item.doc.height };
    const backdropOf = backdropsOf(item.doc);
    for (const [id, comp] of Object.entries(item.doc.comps)) {
      const box = comp.component && !seen.has(id) ? compBox(comp, size) : null;
      if (!box) {
        continue;
      }
      seen.add(id);
      const key = comp.component!.set ?? id;
      const set = sets.get(key) ?? { name: comp.component!.set ?? comp.component!.name, source: item, mains: [] };
      sets.set(key, { ...set, mains: [...set.mains, { id, comp, box, backdrop: backdropOf(id) }] });
    }
  }
  return sets;
}

const bare = (source: MotionDoc, size: { width: number; height: number }): MotionDoc => ({ ...source, ...size, background: Background.Transparent, tracks: source.tracks.map((t) => ({ ...t, clips: [] })), comps: {} });

const clipIdsIn = (doc: MotionDoc) => new Set(Object.values(doc.comps).flatMap((c) => c.tracks.flatMap((t) => t.clips.map((clip) => clip.id))));

const backdropKey = (b: Backdrop | null) => (b ? `${b.fill}|${b.bind ?? ''}` : '');

function mostUsed(mains: Main[]): Backdrop | null {
  const counts = new Map<string, { backdrop: Backdrop; uses: number }>();
  for (const { backdrop } of mains.filter((m) => m.backdrop)) {
    const key = backdropKey(backdrop);
    counts.set(key, { backdrop: backdrop!, uses: (counts.get(key)?.uses ?? 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => b.uses - a.uses)[0]?.backdrop ?? null;
}

function backed(doc: MotionDoc, backdrop: Backdrop, box: Box, newId: NewId): MotionDoc {
  const id = newId();
  const props = { shape: ShapeKind.Rect, fill: backdrop.fill, x: (box.left + box.right) / 2 / doc.width, y: (box.top + box.bottom) / 2 / doc.height, width: widthOf(box) / doc.width, height: heightOf(box) / doc.height };
  const added = addClip(doc, { component: 'Shape', from: 0, durationInFrames: doc.durationInFrames, props }, id);
  const named = added.ok ? editClip(added.doc, id, (clip) => ({ ...clip, name: SET_BACKDROP, ...(backdrop.bind ? { bind: { ...clip.bind, fill: backdrop.bind } } : {}) })) : added;
  return named.ok ? named.doc : doc;
}

function setDoc(set: SetOf, newId: NewId): MotionDoc {
  const source = set.source.doc;
  const size = {
    width: Math.ceil(SET_PAD_PX * 2 + set.mains.reduce((sum, m) => sum + widthOf(m.box) + SET_GAP_PX, -SET_GAP_PX)),
    height: Math.ceil(SET_PAD_PX * 2 + Math.max(...set.mains.map((m) => heightOf(m.box))))
  };
  const slots = set.mains.map((main, i) => ({ main, left: SET_PAD_PX + set.mains.slice(0, i).reduce((sum, m) => sum + widthOf(m.box) + SET_GAP_PX, 0) }));
  const common = mostUsed(set.mains);
  const half = SET_GAP_PX / 2;
  let doc = bare(source, size);
  doc = common ? backed(doc, common, { left: 0, top: 0, right: size.width, bottom: size.height }, newId) : doc;
  for (const { main, left } of slots.filter((s) => s.main.backdrop && backdropKey(s.main.backdrop) !== backdropKey(common))) {
    doc = backed(doc, main.backdrop!, { left: left - half, top: SET_PAD_PX - half, right: left + widthOf(main.box) + half, bottom: SET_PAD_PX + heightOf(main.box) + half }, newId);
  }
  const shifts = new Map<string, Point>();
  for (const { main, left } of slots) {
    const nested = Object.entries(componentSlice(source, main.id).comps).filter(([id]) => id !== main.id && !doc.comps[id]);
    nested.forEach(([id, comp]) => shifts.set(id, toCorner(comp, source)));
    shifts.set(main.id, { x: left - main.box.left, y: SET_PAD_PX - main.box.top });
    const carried = Object.fromEntries(nested.map(([id, comp]) => [id, reframed(comp, source, size, shifts.get(id))]));
    const moved = reframed(main.comp, source, size, shifts.get(main.id));
    const { home: _home, ...component } = main.comp.component!;
    doc = { ...doc, comps: { ...doc.comps, ...carried, [main.id]: { ...moved, component } } };
    const placed = addClip(doc, { component: 'Precomp', from: 0, durationInFrames: Math.min(main.comp.durationInFrames, doc.durationInFrames), props: { comp: main.id } }, newId());
    doc = placed.ok ? placed.doc : doc;
  }
  return { ...doc, comps: Object.fromEntries(Object.entries(doc.comps).map(([id, comp]) => [id, followingMains(comp, shifts, size)])) };
}

const NO_SHIFT: Point = { x: 0, y: 0 };

function toCorner(comp: MotionComp, size: { width: number; height: number }): Point {
  const box = compBox(comp, size);
  return box ? { x: -box.left, y: -box.top } : NO_SHIFT;
}

function followingMain(clip: MotionClip, shifts: Map<string, Point>, size: { width: number; height: number }): MotionClip {
  const shift = shifts.get(String(clip.props.comp));
  if (clip.component !== 'Precomp' || !shift) {
    return clip;
  }
  return { ...clip, transform: { ...clip.transform, x: Number(clip.transform?.x ?? 0) - shift.x / size.width, y: Number(clip.transform?.y ?? 0) - shift.y / size.height } };
}

const followingMains = (comp: MotionComp, shifts: Map<string, Point>, size: { width: number; height: number }): MotionComp => ({ ...comp, tracks: comp.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map((c) => followingMain(c, shifts, size)) })) });

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

function homesIn(items: readonly PlanItem[], homeOf: Map<string, number>, elsewhere: (id: string, at: number) => boolean = () => true): Homes {
  return Object.fromEntries(
    items.flatMap((item, i) => {
      const own = Object.keys(item.doc.comps).flatMap((id) => (homeOf.has(id) && elsewhere(id, i) ? [[id, homeOf.get(id)!] as const] : []));
      return own.length ? [[i, Object.fromEntries(own)]] : [];
    })
  );
}

export function componentPages(items: readonly PlanItem[], newId: NewId): ComponentPages {
  const sets = [...setsOf(items).values()];
  const made = sets.map((set) => {
    const doc = setDoc(set, newId);
    const inside = clipIdsIn(doc);
    return { ...set.source, destination: Destination.Free, kind: FrameKind.Element, doc, name: set.name, size: { width: doc.width, height: doc.height }, centre: { x: 0, y: 0 }, images: items.flatMap((i) => i.images).filter((i) => inside.has(i.clipId)) };
  });
  const homeOf = new Map(sets.flatMap((set, at) => set.mains.map((m) => [m.id, at] as const)));
  return { sets: laidOnPage(made), homes: homesIn(items, homeOf), setHomes: homesIn(made, homeOf, (id, at) => homeOf.get(id) !== at) };
}
