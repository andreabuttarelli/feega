import { DESIGN_MAX_SIDE, MAX_TRACKS, compOf, newClip, type MotionClip, type MotionComp, type MotionDoc, type MotionTrack } from '@feega/motion-core/motion/doc';
import { defaultProps } from '@feega/motion-core/motion/components';
import { reframed, type Size } from '$lib/motion/comp-frame';
import type { ImportMap } from './import-map';
import { freezeLayout } from '$lib/motion/layout/ops';
import { withAutoLayout } from '@feega/motion-core/motion/layout/resolve';
import type { Stroke } from '@feega/motion-core/motion/stroke/model';

export const BOARD_GAP = 160;

const FULL = 1;
const CENTRE = 0.5;
const FULL_EPSILON = 1e-4;
const PLACEHOLDER_FILL = '#e4e4e7';
const PLACEHOLDER_PREFIX = 'Importing ';

export enum AddRefusal {
  Full = 'frame_full',
  NoBoards = 'no_boards',
  Unsized = 'unsized'
}

export type NewId = () => string;

export type BoardsAdded = { ok: true; doc: MotionDoc; boards: Record<string, string>; reused: number; kept: string[] } | { ok: false; refusal: AddRefusal; detail: string };

type Box = { left: number; top: number; right: number; bottom: number };

const clipsOf = (tracks: readonly MotionTrack[]) => tracks.flatMap((t) => t.clips as MotionClip[]);

function boxOf(clip: MotionClip, size: Size): Box | null {
  const [x, y, w, h] = [clip.props.x, clip.props.y, clip.props.width, clip.props.height].map(Number);
  if (![x, y, w, h].every(Number.isFinite)) {
    return null;
  }
  const [dx, dy] = [Number(clip.transform?.x ?? 0), Number(clip.transform?.y ?? 0)];
  return { left: (x - w / 2 + dx) * size.width, top: (y - h / 2 + dy) * size.height, right: (x + w / 2 + dx) * size.width, bottom: (y + h / 2 + dy) * size.height };
}

function unionOf(boxes: Box[]): Box | null {
  if (!boxes.length) {
    return null;
  }
  return { left: Math.min(...boxes.map((b) => b.left)), top: Math.min(...boxes.map((b) => b.top)), right: Math.max(...boxes.map((b) => b.right)), bottom: Math.max(...boxes.map((b) => b.bottom)) };
}

const near = (a: unknown, b: number) => Math.abs(Number(a) - b) < FULL_EPSILON;

const fillsDoc = (clip: MotionClip) => !clip.parent && near(clip.props.width, FULL) && near(clip.props.height, FULL) && near(clip.props.x ?? CENTRE, CENTRE) && near(clip.props.y ?? CENTRE, CENTRE);

const sizeOf = (doc: MotionDoc): Size => ({ width: doc.width, height: doc.height });

function subtree(clips: MotionClip[], roots: readonly string[]): Set<string> {
  const ids = new Set(roots);
  let grew = true;
  while (grew) {
    grew = false;
    for (const clip of clips) {
      if (clip.parent && ids.has(clip.parent) && !ids.has(clip.id)) {
        ids.add(clip.id);
        grew = true;
      }
    }
  }
  return ids;
}

function stroked(comp: Pick<MotionComp, 'tracks'>, unit: number): MotionTrack[] {
  const thinner = (c: MotionClip): MotionClip => (Array.isArray(c.props.strokes) ? { ...c, props: { ...c.props, strokes: (c.props.strokes as Stroke[]).map((s) => ({ ...s, ...(typeof s.width === 'number' ? { width: s.width * unit } : {}), ...(s.sides ? { sides: s.sides.map((w) => w * unit) } : {}) })) } } : c);
  return comp.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map(thinner) }));
}

function resized<C extends Pick<MotionComp, 'tracks' | 'frame' | 'name' | 'durationInFrames'>>(comp: C, from: Size, to: Size): C {
  if (comp.frame) {
    return comp;
  }
  const scaled = reframed(comp as MotionComp, from, to);
  return { ...comp, tracks: stroked(scaled, Math.min(from.width, from.height) / Math.min(to.width, to.height)) };
}

function grown(doc: MotionDoc, size: Size): MotionDoc {
  const from = sizeOf(doc);
  if (from.width === size.width && from.height === size.height) {
    return doc;
  }
  const full = new Set(clipsOf(doc.tracks).filter(fillsDoc).map((c) => c.id));
  const refilled = (c: MotionClip): MotionClip => (full.has(c.id) ? { ...c, props: { ...c.props, x: CENTRE, y: CENTRE, width: FULL, height: FULL } } : c);
  const top = resized({ name: 'doc', durationInFrames: doc.durationInFrames, tracks: doc.tracks }, from, size);
  const comps = Object.fromEntries(Object.entries(doc.comps).map(([id, c]) => [id, resized(c, from, size)]));
  return { ...doc, width: size.width, height: size.height, comps, tracks: top.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map(refilled) })) };
}

function freed(doc: MotionDoc, parent: string | null): MotionDoc {
  const ground = parent ? clipsOf(doc.tracks).find((c) => c.id === parent) : undefined;
  if (!ground?.autoLayout) {
    return doc;
  }
  const frozen = freezeLayout(doc, ground.id);
  return frozen.ok ? frozen.doc : doc;
}

const componentKey = (comp: MotionComp): string | null => {
  const main = comp.component;
  if (!main) {
    return null;
  }
  const variant = Object.entries(main.variant ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify([main.set ?? main.name, variant]);
};

const skeletonOf = (comp: MotionComp): string => {
  const clips = clipsOf(comp.tracks);
  const at = new Map(clips.map((c, i) => [c.id, i]));
  return JSON.stringify(clips.map((c) => [c.component, c.parent ? (at.get(c.parent) ?? -1) : null]));
};

function needed(comps: MotionDoc['comps'], clips: MotionClip[]): string[] {
  const found = new Set<string>();
  const queue = clips.flatMap((c) => compOf(c) ?? []);
  while (queue.length) {
    const id = queue.shift()!;
    if (found.has(id) || !comps[id]) {
      continue;
    }
    found.add(id);
    queue.push(...clipsOf(comps[id].tracks).flatMap((c) => compOf(c) ?? []));
  }
  return [...found];
}

type Remap = { comp: Map<string, string>; clip: Map<string, string> };

const swap = (map: Map<string, string>, id: string) => map.get(id) ?? id;

function remappedKeys(value: unknown, map: Remap): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  return Object.fromEntries(Object.entries(value).map(([key, inner]) => [swap(map.clip, key), inner && typeof inner === 'object' && 'overrides' in inner ? { ...inner, overrides: remappedKeys((inner as { overrides: unknown }).overrides, map) } : inner]));
}

function remappedClip(clip: MotionClip, map: Remap): MotionClip {
  const comp = compOf(clip);
  const props = comp ? { ...clip.props, comp: swap(map.comp, comp), ...(clip.props.overrides ? { overrides: remappedKeys(clip.props.overrides, map) } : {}), ...(clip.props.modeValues ? { modeValues: remappedKeys(clip.props.modeValues, map) } : {}) } : clip.props;
  return { ...clip, id: swap(map.clip, clip.id), parent: clip.parent ? swap(map.clip, clip.parent) : clip.parent, props };
}

function remappedComp(comp: MotionComp, map: Remap): MotionComp {
  const properties = comp.component?.properties ? Object.fromEntries(Object.entries(comp.component.properties).map(([k, p]) => [k, { ...p, target: swap(map.clip, p.target) }])) : undefined;
  return { ...comp, ...(comp.component ? { component: { ...comp.component, ...(properties ? { properties } : {}) } } : {}), tracks: comp.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map((c) => remappedClip(c, map)) })) };
}

function freshOf(taken: Set<string>, newId: NewId) {
  return (id: string): string => {
    let next = id;
    while (taken.has(next)) {
      next = newId();
    }
    taken.add(next);
    return next;
  };
}

function mainsReused(local: MotionDoc, piece: MotionDoc, ids: string[]): { reused: Map<string, string>; clip: Map<string, string>; kept: string[] } {
  const mains = new Map(Object.entries(local.comps).flatMap(([id, c]) => (componentKey(c) ? [[componentKey(c)!, id] as const] : [])));
  const reused = new Map<string, string>();
  const clip = new Map<string, string>();
  const kept: string[] = [];
  for (const id of ids) {
    const comp = piece.comps[id];
    const key = componentKey(comp);
    const home = key ? mains.get(key) : undefined;
    if (!home) {
      continue;
    }
    if (skeletonOf(local.comps[home]) !== skeletonOf(comp)) {
      kept.push(comp.component!.set ?? comp.component!.name);
      continue;
    }
    reused.set(id, home);
    clipsOf(comp.tracks).forEach((c, i) => clip.set(c.id, clipsOf(local.comps[home].tracks)[i].id));
  }
  return { reused, clip, kept };
}

function takenIds(doc: MotionDoc): Set<string> {
  return new Set([...clipsOf(doc.tracks), ...Object.values(doc.comps).flatMap((c) => clipsOf(c.tracks))].map((c) => c.id));
}

function libraryOf(local: MotionDoc, piece: MotionDoc): Pick<MotionDoc, 'assets' | 'fonts' | 'components' | 'variables' | 'styles'> {
  const collections = { ...piece.variables, ...local.variables };
  const variables = Object.fromEntries(Object.entries(collections).map(([name, c]) => [name, local.variables?.[name] && piece.variables?.[name] ? { ...c, variables: { ...piece.variables[name].variables, ...local.variables[name].variables } } : c]));
  const styles = { ...piece.styles, ...local.styles };
  return {
    assets: [...local.assets, ...piece.assets.filter((a) => !local.assets.some((b) => b.id === a.id))],
    fonts: [...local.fonts, ...piece.fonts.filter((f) => !local.fonts.some((g) => g.family === f.family))],
    components: { ...piece.components, ...local.components },
    ...(Object.keys(variables).length ? { variables: variables as MotionDoc['variables'] } : {}),
    ...(Object.keys(styles).length ? { styles } : {})
  };
}

function slotFor(local: MotionDoc, parent: string | null, extent: Box): { at: { x: number; y: number }; size: Size } {
  const level = (c: MotionClip) => (c.parent ?? null) === parent || (!c.parent && !fillsDoc(c));
  const content = unionOf(clipsOf(withAutoLayout(local).tracks).filter(level).flatMap((c) => boxOf(c, sizeOf(local)) ?? []));
  const left = content ? Math.max(0, Math.round(content.left)) : 0;
  const bottom = content ? content.bottom : 0;
  const margin = Math.max(0, local.height - bottom);
  const at = { x: left, y: Math.round(bottom + BOARD_GAP) };
  const right = Math.max(0, local.width - (content?.right ?? local.width));
  const size = { width: Math.max(local.width, Math.ceil(at.x + extent.right - extent.left + right)), height: Math.ceil(at.y + extent.bottom - extent.top + margin) };
  return { at, size };
}

export function addBoards(before: MotionDoc, piece: MotionDoc, boardIds: readonly string[], parent: string | null, newId: NewId): BoardsAdded {
  const local = freed(before, parent);
  const pieceClips = clipsOf(piece.tracks);
  const boards = pieceClips.filter((c) => boardIds.includes(c.id));
  if (!boards.length) {
    return { ok: false, refusal: AddRefusal.NoBoards, detail: 'the import landed no page to add' };
  }
  const extent = unionOf(boards.flatMap((b) => boxOf(b, sizeOf(piece)) ?? []));
  if (!extent) {
    return { ok: false, refusal: AddRefusal.Unsized, detail: 'the new pages have no size' };
  }

  const { at, size } = slotFor(local, parent, extent);
  if (size.width > DESIGN_MAX_SIDE || size.height > DESIGN_MAX_SIDE) {
    return { ok: false, refusal: AddRefusal.Full, detail: `no room: the frame would be ${size.width}×${size.height} px, at most ${DESIGN_MAX_SIDE} a side` };
  }

  const wide = grown(local, size);
  const sized = grown(piece, size);

  const inTree = subtree(clipsOf(sized.tracks), boardIds);
  const moved = reframed({ name: 'boards', durationInFrames: sized.durationInFrames, tracks: sized.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).filter((c) => inTree.has(c.id)) })).filter((t) => t.clips.length) }, size, size, { x: at.x - extent.left, y: at.y - extent.top });

  const carried = needed(sized.comps, clipsOf(moved.tracks));
  const { reused, clip, kept } = mainsReused(wide, sized, carried);
  const landing = needed({ ...sized.comps, ...Object.fromEntries([...reused.keys()].map((id) => [id, { ...sized.comps[id], tracks: [] }])) }, clipsOf(moved.tracks)).filter((id) => !reused.has(id));

  const taken = takenIds(wide);
  const fresh = freshOf(taken, newId);
  const compTaken = new Set(Object.keys(wide.comps));
  const freshComp = freshOf(compTaken, newId);
  const map: Remap = { comp: new Map([...reused, ...landing.map((id) => [id, freshComp(id)] as const)]), clip };
  for (const c of [...clipsOf(moved.tracks), ...landing.flatMap((id) => clipsOf(sized.comps[id].tracks))]) {
    map.clip.set(c.id, fresh(c.id));
  }

  const trackTaken = new Set(wide.tracks.map((t) => t.id));
  const tracks = moved.tracks.map((t) => ({ ...t, id: freshOf(trackTaken, newId)(t.id), clips: (t.clips as MotionClip[]).map((c) => ({ ...remappedClip(c, map), ...(boardIds.includes(c.id) ? { parent } : {}) })) }));
  if (wide.tracks.length + tracks.length > MAX_TRACKS) {
    return { ok: false, refusal: AddRefusal.Full, detail: `no room: a frame holds at most ${MAX_TRACKS} layers rows` };
  }

  const comps = Object.fromEntries(landing.map((id) => [map.comp.get(id)!, remappedComp(sized.comps[id], map)]));
  const doc = { ...wide, ...libraryOf(wide, sized), tracks: [...tracks, ...wide.tracks], comps: { ...wide.comps, ...comps }, durationInFrames: Math.max(wide.durationInFrames, sized.durationInFrames) };
  return { ok: true, doc, boards: Object.fromEntries(boardIds.map((id) => [id, map.clip.get(id) ?? id])), reused: reused.size, kept: [...new Set(kept)] };
}

export function boardParent(doc: MotionDoc, map: ImportMap | undefined | null): string | null {
  const clips = clipsOf(doc.tracks);
  const first = (map?.pages ?? []).flatMap((p) => p.boards ?? []).map((b) => clips.find((c) => c.id === b.clip)).find(Boolean);
  return first?.parent ?? null;
}


export function placeholderOf(doc: MotionDoc, label: string, size: Size, id: string): MotionDoc {
  const board = newClip({ id, from: 0, durationInFrames: doc.durationInFrames, component: 'Shape', name: `${PLACEHOLDER_PREFIX}${label}…`, props: { ...defaultProps('Shape'), shape: 'rect', x: CENTRE, y: CENTRE, width: FULL, height: FULL, fill: PLACEHOLDER_FILL } });
  return { ...doc, width: size.width, height: size.height, tracks: [{ id: 'placeholder', kind: 'visual', name: 'Placeholder', clips: [board] }] as MotionDoc['tracks'], comps: {} };
}
