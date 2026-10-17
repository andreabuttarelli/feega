import { findClip, type MotionDoc } from '$lib/motion/doc';
import { COMPONENTS, type ComponentId } from '$lib/motion/components';
import { addTrack, moveClip, moveTrack, renameTrack, type OpResult } from '$lib/motion/timeline';
import { setClipFlags, setTrackFlags } from '$lib/motion/organize';
import { isLockedComp } from '$lib/motion/template/library';
import { CUSTOM_CLIP, PART_SEP, componentLabel, partIcon, partLabel } from '$lib/motion/poster-parts';
import { EditMode } from '$lib/motion/edit-mode';
import { TrackKind } from '$lib/motion/components';
import { joinMask, leaveMask, maskMembers, maskOf, releaseMasks, useAsMask } from '$lib/motion/mask-group';
import { Command } from '$lib/motion/shortcuts';
import { NODE_KIND_LABEL } from './node-label';
import { elementName } from '$lib/motion/element-name';
import type { NodeType } from './node-data';

export enum LayerKind {
  Node = 'node',
  Track = 'track',
  Clip = 'clip',
  Group = 'group',
  Mask = 'mask',
  Part = 'part'
}

export enum LayerAction {
  Up = 'up',
  Down = 'down',
  Hide = 'hide',
  Lock = 'lock',
  Rename = 'rename'
}

export enum Pick {
  One = 'one',
  Toggle = 'toggle'
}

export enum NodeIcon {
  Still = 'still',
  Video = 'video'
}

export type CanvasLayer = { id: string; type: string; name: string | null; head?: number | null; poster?: string | null; still?: boolean; element?: boolean };
export type OpenVideo = { nodeId: string; doc: MotionDoc; parts?: Record<string, readonly string[]>; mode?: EditMode };

const FRAME_TYPE = 'motion';

export const nodeIcon = (node: { type: string; still?: boolean }): string => (node.type === FRAME_TYPE ? (node.still ? NodeIcon.Still : NodeIcon.Video) : node.type);
type Parts = Record<string, readonly string[]>;

export type LayerRow = {
  id: string;
  key: string;
  kind: LayerKind;
  depth: number;
  label: string;
  type: string;
  nodeId: string;
  hidden: boolean;
  locked: boolean;
  nested: boolean;
  thumb?: string | null;
  foldable?: boolean;
  element?: boolean;
};

type Track = MotionDoc['tracks'][number];
type Clip = Track['clips'][number];

const NODE_DEPTH = 0;
const TRACK_DEPTH = 1;

const clipLabel = (clip: Clip) => (clip.component === CUSTOM_CLIP ? componentLabel(String(clip.props.name)) : elementName(clip));

const KEY_SEP = '/';

const DEFAULT_TRACK_NAME: Record<TrackKind, RegExp> = {
  [TrackKind.Visual]: /^Video \d+$/,
  [TrackKind.Audio]: /^Audio \d+$/
};

const MAX_NAMED_CLIPS = 2;
const NAME_JOIN = ' · ';

function groupLabel(track: Track, index: number): string {
  if (track.name && !DEFAULT_TRACK_NAME[track.kind].test(track.name)) {
    return track.name;
  }
  const known = [...new Set(track.clips.map(clipLabel).filter(Boolean))];
  return known.length ? known.slice(0, MAX_NAMED_CLIPS).join(NAME_JOIN) : `Track ${index + 1}`;
}

type Masks = ReadonlyMap<string, readonly string[]>;
type Walk = { doc: MotionDoc; nodeId: string; nested: boolean; parts: Parts; path: string; mode: EditMode; masks: Masks; masked: ReadonlySet<string>; folded: ReadonlySet<string> };

const NO_MASKS = { masks: new Map(), masked: new Set<string>() };

function masksOf(doc: MotionDoc): { masks: Masks; masked: ReadonlySet<string> } {
  const masks = new Map([...maskMembers(doc)].filter(([id]) => findClip(doc, id)));
  return { masks, masked: new Set([...masks.values()].flat()) };
}

const groupsTrack = (track: Track, mode: EditMode) => mode === EditMode.Motion && track.clips.length > 1;

function trackRows(walk: Walk, tracks: readonly Track[], depth: number): LayerRow[] {
  return tracks.flatMap((track, index) => {
    if (!groupsTrack(track, walk.mode)) {
      return track.clips.flatMap((clip) => clipRows(walk, clip, depth));
    }
    const group: LayerRow = { id: track.id, key: `${walk.path}${track.id}`, kind: LayerKind.Track, depth, label: groupLabel(track, index), type: track.kind, nodeId: walk.nodeId, hidden: !!track.hidden, locked: !!track.locked, nested: walk.nested };
    return [group, ...track.clips.flatMap((clip) => clipRows(walk, clip, depth + 1))];
  });
}

const isComponent = (clip: Clip, template: boolean, parts: Parts) => template || clip.component === CUSTOM_CLIP || (parts[clip.id]?.length ?? 0) > 0;

const kindOf = (walk: Walk, clip: Clip, template: boolean) => (walk.masks.has(clip.id) ? LayerKind.Mask : isComponent(clip, template, walk.parts) ? LayerKind.Group : LayerKind.Clip);

function clipRows(walk: Walk, clip: Clip, depth: number): LayerRow[] {
  return walk.masked.has(clip.id) ? [] : layerTree(walk, clip, depth);
}

function maskedRows(walk: Walk, maskId: string, depth: number): LayerRow[] {
  return (walk.masks.get(maskId) ?? []).flatMap((id) => layerTree(walk, findClip(walk.doc, id)!.clip, depth));
}

function layerTree(walk: Walk, clip: Clip, depth: number): LayerRow[] {
  const { doc, nodeId, nested, parts, path } = walk;
  const comp = clip.component === 'Precomp' ? String((clip.props as { comp?: string }).comp ?? '') : '';
  const template = comp !== '' && isLockedComp(doc, comp);
  const key = `${path}${clip.id}`;
  const row: LayerRow = {
    id: clip.id,
    key,
    kind: kindOf(walk, clip, template),
    depth,
    label: doc.comps[comp]?.name ?? clipLabel(clip),
    type: clip.component,
    nodeId,
    hidden: !!clip.hidden,
    locked: template || !!clip.locked,
    nested
  };
  const nests = comp !== '' && !template;
  row.foldable = nests || undefined;
  const inside = nests && !walk.folded.has(key) ? (doc.comps[comp]?.tracks ?? []) : [];
  const own = (parts[clip.id] ?? []).map((part) => partRow(doc, clip, part, nodeId, depth + 1, key));
  return [row, ...own, ...trackRows({ ...walk, ...NO_MASKS, nested: true, parts: {}, path: `${key}${KEY_SEP}` }, inside, depth + 1), ...maskedRows(walk, clip.id, depth + 1)];
}

function partRow(doc: MotionDoc, clip: Clip, part: string, nodeId: string, depth: number, clipKey: string): LayerRow {
  return { id: `${clip.id}${PART_SEP}${part}`, key: `${clipKey}${PART_SEP}${part}`, kind: LayerKind.Part, depth, label: partLabel(doc, clip, part), type: partIcon(doc, clip, part), nodeId, hidden: false, locked: false, nested: true };
}

const frameWalk = (doc: MotionDoc, nodeId: string, parts: Parts, mode: EditMode, folded: ReadonlySet<string> = new Set()): Walk => ({ doc, nodeId, nested: false, parts, path: '', mode, folded, ...masksOf(doc) });

export const frameRows = (doc: MotionDoc, nodeId: string, parts: Parts = {}): LayerRow[] => trackRows(frameWalk(doc, nodeId, parts, EditMode.Design), doc.tracks, TRACK_DEPTH);

export type FrameOutlines = Record<string, readonly LayerRow[]>;

function namedParts(rows: readonly LayerRow[]): Parts {
  const parts: Record<string, string[]> = {};
  for (const row of rows) {
    const at = row.kind === LayerKind.Part ? row.id.indexOf(PART_SEP) : -1;
    if (at >= 0) {
      (parts[row.id.slice(0, at)] ??= []).push(row.id.slice(at + 1));
    }
  }
  return parts;
}

function childRows(nodeId: string, open: OpenVideo | null, outlines: FrameOutlines, folded: ReadonlySet<string>): LayerRow[] {
  if (open?.nodeId === nodeId) {
    const parts = { ...open.parts, ...namedParts(outlines[nodeId] ?? []) };
    return trackRows(frameWalk(open.doc, nodeId, parts, open.mode ?? EditMode.Design, folded), open.doc.tracks, TRACK_DEPTH);
  }
  return (outlines[nodeId] ?? []).map((row) => ({ ...row, nested: true }));
}

export function layerRows(nodes: readonly CanvasLayer[], open: OpenVideo | null, outlines: FrameOutlines = {}, folded: ReadonlySet<string> = new Set()): LayerRow[] {
  return nodes.flatMap((node) => {
    const row: LayerRow = { id: node.id, key: node.id, kind: LayerKind.Node, depth: NODE_DEPTH, label: node.name || NODE_KIND_LABEL[node.type as NodeType] || node.type, type: nodeIcon(node), nodeId: node.id, hidden: false, locked: false, nested: false, thumb: node.poster ?? null, element: node.element || undefined };
    return folded.has(node.id) || node.element ? [row] : [row, ...childRows(node.id, open, outlines, folded)];
  });
}

const fail = (error: string): OpResult => ({ ok: false, error });

const ABOVE = -1;
const BELOW = 1;

function moveClipAlong(doc: MotionDoc, clipId: string, step: typeof ABOVE | typeof BELOW): OpResult {
  const found = findClip(doc, clipId);
  const at = found ? doc.tracks.findIndex((t) => t.id === found.track.id) : -1;
  if (!found || at < 0) {
    return fail(`no clip ${clipId} on a top-level track`);
  }
  const neighbours = step === ABOVE ? doc.tracks.slice(0, at).reverse() : doc.tracks.slice(at + 1);
  const next = neighbours.find((t) => t.kind === found.track.kind);
  return next ? moveClip(doc, clipId, { from: found.clip.from, trackId: next.id }) : fail('no track of the same kind that way');
}

export enum Place {
  Above = 'above',
  Below = 'below',
  Into = 'into'
}

type NewId = () => string;

const newTrackId: NewId = () => crypto.randomUUID().slice(0, 8);

function topTrack(doc: MotionDoc, id: string): { track: Track; index: number } | null {
  const index = doc.tracks.findIndex((t) => t.id === id || t.clips.some((c) => c.id === id));
  return index < 0 ? null : { track: doc.tracks[index], index };
}

const then = (result: OpResult, next: (doc: MotionDoc) => OpResult): OpResult => (result.ok ? next(result.doc) : result);

function intoTrack(doc: MotionDoc, dragged: string, target: Track): OpResult {
  const clip = findClip(doc, dragged)?.clip;
  if (!clip || target.id === dragged) {
    return fail('drop a clip into a group');
  }
  return moveClip(doc, dragged, { from: clip.from, trackId: target.id });
}

export function restack(doc: MotionDoc, dragged: string, target: string, place: Place, newId: NewId = newTrackId): OpResult {
  const from = topTrack(doc, dragged);
  const to = topTrack(doc, target);
  if (!from || !to || dragged === target) {
    return fail(`cannot move ${dragged} onto ${target}`);
  }
  if (from.track.kind !== to.track.kind) {
    return fail('a layer moves only among layers of its kind');
  }
  if (place === Place.Into) {
    return intoTrack(doc, dragged, to.track);
  }

  const wholeTrack = from.track.id === dragged || from.track.clips.length === 1;
  const slot = to.index + (place === Place.Below ? 1 : 0);
  if (wholeTrack) {
    return moveTrack(doc, from.track.id, slot - (from.index < to.index ? 1 : 0));
  }
  const clip = findClip(doc, dragged)!.clip;
  const id = newId();
  return then(
    then(addTrack(doc, from.track.kind as TrackKind, id), (d) => moveTrack(d, id, slot)),
    (d) => moveClip(d, dragged, { from: clip.from, trackId: id })
  );
}

const EDGE = 0.25;
const HALF = 0.5;

const GROUP_DROP = (at: number) => (at < EDGE ? Place.Above : at > 1 - EDGE ? Place.Below : Place.Into);
const ROW_DROP = (at: number) => (at < HALF ? Place.Above : Place.Below);

const DROP: Record<LayerKind, (at: number) => Place> = {
  [LayerKind.Node]: ROW_DROP,
  [LayerKind.Track]: GROUP_DROP,
  [LayerKind.Clip]: ROW_DROP,
  [LayerKind.Group]: ROW_DROP,
  [LayerKind.Mask]: GROUP_DROP,
  [LayerKind.Part]: ROW_DROP
};

export const dropPlace = (kind: LayerKind, at: number): Place => DROP[kind](at);

export type LayerMenuItem = { command: Command.UseAsMask | Command.RemoveMask; summary: string; op: (doc: MotionDoc, ids: readonly string[]) => OpResult };

export const LAYER_MENU: readonly LayerMenuItem[] = [
  { command: Command.UseAsMask, summary: 'Used as mask', op: useAsMask },
  { command: Command.RemoveMask, summary: 'Removed a mask', op: releaseMasks }
];

export function dropLayer(doc: MotionDoc, dragged: string, target: string, place: Place, newId: NewId = newTrackId): OpResult {
  const into = place === Place.Into && maskMembers(doc).has(target);
  const moved = restack(doc, dragged, target, into ? Place.Above : place, newId);
  if (!moved.ok) {
    return moved;
  }
  const mask = into ? target : maskOf(doc, target);
  return mask && mask !== dragged ? joinMask(moved.doc, dragged, mask) : leaveMask(moved.doc, dragged);
}

const TRACK_EDIT: Record<LayerAction, (doc: MotionDoc, track: Track, index: number, name?: string) => OpResult> = {
  [LayerAction.Up]: (doc, track, index) => (index > 0 ? moveTrack(doc, track.id, index - 1) : fail('already the top track')),
  [LayerAction.Down]: (doc, track, index) => (index < doc.tracks.length - 1 ? moveTrack(doc, track.id, index + 1) : fail('already the bottom track')),
  [LayerAction.Hide]: (doc, track) => setTrackFlags(doc, track.id, { hidden: !track.hidden }),
  [LayerAction.Lock]: (doc, track) => setTrackFlags(doc, track.id, { locked: !track.locked }),
  [LayerAction.Rename]: (doc, track, _index, name) => renameTrack(doc, track.id, (name ?? '').trim().slice(0, 60))
};

function stepClip(doc: MotionDoc, clip: Clip, step: typeof ABOVE | typeof BELOW, newId: NewId): OpResult {
  const along = moveClipAlong(doc, clip.id, step);
  if (along.ok) {
    return along;
  }
  const at = topTrack(doc, clip.id)!;
  return restack(doc, clip.id, at.track.id, step === ABOVE ? Place.Above : Place.Below, newId);
}

const CLIP_EDIT: Record<LayerAction, (doc: MotionDoc, clip: Clip, newId: NewId) => OpResult> = {
  [LayerAction.Up]: (doc, clip, newId) => stepClip(doc, clip, ABOVE, newId),
  [LayerAction.Down]: (doc, clip, newId) => stepClip(doc, clip, BELOW, newId),
  [LayerAction.Hide]: (doc, clip) => setClipFlags(doc, clip.id, { hidden: !clip.hidden }),
  [LayerAction.Lock]: (doc, clip) => setClipFlags(doc, clip.id, { locked: !clip.locked }),
  [LayerAction.Rename]: () => fail('clips have no name of their own: rename the track')
};

export function layerEdit(doc: MotionDoc, id: string, action: LayerAction, name?: string, newId: NewId = newTrackId): OpResult {
  const index = doc.tracks.findIndex((t) => t.id === id);
  if (index >= 0) {
    return TRACK_EDIT[action](doc, doc.tracks[index], index, name);
  }
  const found = findClip(doc, id);
  if (!found || !doc.tracks.some((t) => t.id === found.track.id)) {
    return fail(`no layer ${id} at the top level of this video`);
  }
  return CLIP_EDIT[action](doc, found.clip, newId);
}

type KeyPress = { key: string; mod: boolean };

const LAYER_KEYS: readonly (KeyPress & { action: LayerAction })[] = [
  { key: ']', mod: true, action: LayerAction.Up },
  { key: '[', mod: true, action: LayerAction.Down }
];

export const layerKey = (press: KeyPress): LayerAction | null => LAYER_KEYS.find((k) => k.key === press.key && k.mod === press.mod)?.action ?? null;

const PICK: Record<Pick, (current: readonly string[], id: string) => string[]> = {
  [Pick.One]: (_current, id) => [id],
  [Pick.Toggle]: (current, id) => (current.includes(id) ? current.filter((c) => c !== id) : [...current, id])
};

export const pickLayers = (current: readonly string[], id: string, pick: Pick) => PICK[pick](current, id);

export const pickFor = (press: { shift: boolean; mod: boolean }): Pick => (press.shift || press.mod ? Pick.Toggle : Pick.One);

export type LayerSelection = {
  canvas: readonly string[];
  video: { nodeId: string; selection: readonly string[]; part: string | null } | null;
};

export function selectedLayers({ canvas, video }: LayerSelection): readonly string[] {
  if (video?.part) {
    return [video.part];
  }
  return video?.selection.length ? video.selection : canvas;
}

const elementPicked = (row: LayerRow, selection: LayerSelection): boolean => selection.video?.nodeId === row.id || selection.canvas.includes(row.id);

export const rowPicked = (row: LayerRow, selection: LayerSelection): boolean =>
  row.element ? elementPicked(row, selection) : selectedLayers(selection).includes(row.id) && (row.kind === LayerKind.Node || row.nodeId === selection.video?.nodeId);

export type LayerHover = { nodeId: string; id: string } | null;

export const tileHovered = (hover: LayerHover, nodeId: string, openNodeId: string | null): boolean => !!hover && hover.nodeId === nodeId && (hover.id === nodeId || openNodeId !== nodeId);

export const frameHover = (hover: LayerHover, openNodeId: string | null): string | null => (hover && hover.nodeId === openNodeId && hover.id !== openNodeId ? hover.id : null);

export function rowsInside<R extends { key: string; depth: number }>(rows: readonly R[], picked: (row: R) => boolean): Set<string> {
  const inside = new Set<string>();
  let parentDepth: number | null = null;
  for (const row of rows) {
    if (parentDepth !== null && row.depth > parentDepth) {
      inside.add(row.key);
      continue;
    }
    parentDepth = picked(row) ? row.depth : null;
  }
  return inside;
}

export function searchRows<R extends { depth: number; label: string }>(rows: readonly R[], query: string): R[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [...rows];
  }
  const kept = new Set<number>();
  const trail: number[] = [];
  rows.forEach((row, i) => {
    trail.length = row.depth;
    trail[row.depth] = i;
    if (row.label.toLowerCase().includes(needle)) {
      trail.forEach((at) => kept.add(at));
    }
  });
  return rows.filter((_, i) => kept.has(i));
}
