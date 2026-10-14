import { findClip, type MotionDoc } from '$lib/motion/doc';
import { COMPONENTS, type ComponentId } from '$lib/motion/components';
import { moveClip, moveTrack, renameTrack, type OpResult } from '$lib/motion/timeline';
import { setClipFlags, setTrackFlags } from '$lib/motion/organize';
import { isLockedComp } from '$lib/motion/template/library';
import { CUSTOM_CLIP, PART_SEP, componentLabel, partIcon, partLabel } from '$lib/motion/poster-parts';
import { NODE_KIND_LABEL } from './node-label';
import type { NodeType } from './node-data';

export enum LayerKind {
  Node = 'node',
  Track = 'track',
  Clip = 'clip',
  Group = 'group',
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

export type CanvasLayer = { id: string; type: string; name: string | null; head?: number | null };
export type OpenVideo = { nodeId: string; doc: MotionDoc; parts?: Record<string, readonly string[]> };
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
};

type Track = MotionDoc['tracks'][number];
type Clip = Track['clips'][number];

const NODE_DEPTH = 0;
const TRACK_DEPTH = 1;

const clipLabel = (clip: Clip) => (clip.component === CUSTOM_CLIP ? componentLabel(String(clip.props.name)) : (COMPONENTS[clip.component as ComponentId]?.label ?? clip.component));

const KEY_SEP = '/';

function trackRows(doc: MotionDoc, tracks: readonly Track[], nodeId: string, depth: number, nested: boolean, parts: Parts = {}, path = ''): LayerRow[] {
  return tracks.flatMap((track) => [
    { id: track.id, key: `${path}${track.id}`, kind: LayerKind.Track, depth, label: track.name || track.id, type: track.kind, nodeId, hidden: !!track.hidden, locked: !!track.locked, nested },
    ...track.clips.flatMap((clip) => clipRows(doc, clip, nodeId, depth + 1, nested, parts, path))
  ]);
}

function clipRows(doc: MotionDoc, clip: Clip, nodeId: string, depth: number, nested: boolean, parts: Parts, path: string): LayerRow[] {
  const comp = clip.component === 'Precomp' ? String((clip.props as { comp?: string }).comp ?? '') : '';
  const template = comp !== '' && isLockedComp(doc, comp);
  const key = `${path}${clip.id}`;
  const row: LayerRow = {
    id: clip.id,
    key,
    kind: template ? LayerKind.Group : LayerKind.Clip,
    depth,
    label: template ? (doc.comps[comp]?.name ?? clipLabel(clip)) : clipLabel(clip),
    type: clip.component,
    nodeId,
    hidden: !!clip.hidden,
    locked: template || !!clip.locked,
    nested
  };
  const inside = comp && !template ? (doc.comps[comp]?.tracks ?? []) : [];
  const own = (parts[clip.id] ?? []).map((part) => partRow(doc, clip, part, nodeId, depth + 1, key));
  return [row, ...own, ...trackRows(doc, inside, nodeId, depth + 1, true, {}, `${key}${KEY_SEP}`)];
}

function partRow(doc: MotionDoc, clip: Clip, part: string, nodeId: string, depth: number, clipKey: string): LayerRow {
  return { id: `${clip.id}${PART_SEP}${part}`, key: `${clipKey}${PART_SEP}${part}`, kind: LayerKind.Part, depth, label: partLabel(doc, clip, part), type: partIcon(doc, clip, part), nodeId, hidden: false, locked: false, nested: true };
}

export const frameRows = (doc: MotionDoc, nodeId: string, parts: Parts = {}): LayerRow[] => trackRows(doc, doc.tracks, nodeId, TRACK_DEPTH, false, parts);

export type FrameOutlines = Record<string, readonly LayerRow[]>;

function childRows(nodeId: string, open: OpenVideo | null, outlines: FrameOutlines): LayerRow[] {
  if (open?.nodeId === nodeId) {
    return trackRows(open.doc, open.doc.tracks, nodeId, TRACK_DEPTH, false, open.parts);
  }
  return (outlines[nodeId] ?? []).map((row) => ({ ...row, nested: true }));
}

export function layerRows(nodes: readonly CanvasLayer[], open: OpenVideo | null, outlines: FrameOutlines = {}, folded: ReadonlySet<string> = new Set()): LayerRow[] {
  return nodes.flatMap((node) => {
    const row: LayerRow = { id: node.id, key: node.id, kind: LayerKind.Node, depth: NODE_DEPTH, label: node.name || NODE_KIND_LABEL[node.type as NodeType] || node.type, type: node.type, nodeId: node.id, hidden: false, locked: false, nested: false };
    return folded.has(node.id) ? [row] : [row, ...childRows(node.id, open, outlines)];
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

const TRACK_EDIT: Record<LayerAction, (doc: MotionDoc, track: Track, index: number, name?: string) => OpResult> = {
  [LayerAction.Up]: (doc, track, index) => (index > 0 ? moveTrack(doc, track.id, index - 1) : fail('already the top track')),
  [LayerAction.Down]: (doc, track, index) => (index < doc.tracks.length - 1 ? moveTrack(doc, track.id, index + 1) : fail('already the bottom track')),
  [LayerAction.Hide]: (doc, track) => setTrackFlags(doc, track.id, { hidden: !track.hidden }),
  [LayerAction.Lock]: (doc, track) => setTrackFlags(doc, track.id, { locked: !track.locked }),
  [LayerAction.Rename]: (doc, track, _index, name) => renameTrack(doc, track.id, (name ?? '').trim().slice(0, 60))
};

const CLIP_EDIT: Record<LayerAction, (doc: MotionDoc, clip: Clip) => OpResult> = {
  [LayerAction.Up]: (doc, clip) => moveClipAlong(doc, clip.id, ABOVE),
  [LayerAction.Down]: (doc, clip) => moveClipAlong(doc, clip.id, BELOW),
  [LayerAction.Hide]: (doc, clip) => setClipFlags(doc, clip.id, { hidden: !clip.hidden }),
  [LayerAction.Lock]: (doc, clip) => setClipFlags(doc, clip.id, { locked: !clip.locked }),
  [LayerAction.Rename]: () => fail('clips have no name of their own: rename the track')
};

export function layerEdit(doc: MotionDoc, id: string, action: LayerAction, name?: string): OpResult {
  const index = doc.tracks.findIndex((t) => t.id === id);
  if (index >= 0) {
    return TRACK_EDIT[action](doc, doc.tracks[index], index, name);
  }
  const found = findClip(doc, id);
  if (!found || !doc.tracks.some((t) => t.id === found.track.id)) {
    return fail(`no layer ${id} at the top level of this video`);
  }
  return CLIP_EDIT[action](doc, found.clip);
}

export function dropLayer(doc: MotionDoc, dragged: string, onto: string): OpResult {
  const target = doc.tracks.findIndex((t) => t.id === onto);
  if (target < 0) {
    return fail('drop a layer on a track');
  }
  if (doc.tracks.some((t) => t.id === dragged)) {
    return moveTrack(doc, dragged, target);
  }
  const found = findClip(doc, dragged);
  if (!found || found.track.kind !== doc.tracks[target].kind) {
    return fail('a clip moves only onto a track of its kind');
  }
  return moveClip(doc, dragged, { from: found.clip.from, trackId: onto });
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

export const rowPicked = (row: LayerRow, selection: LayerSelection): boolean =>
  selectedLayers(selection).includes(row.id) && (row.kind === LayerKind.Node || row.nodeId === selection.video?.nodeId);

export type LayerHover = { nodeId: string; id: string } | null;

export const tileHovered = (hover: LayerHover, nodeId: string, openNodeId: string | null): boolean => !!hover && hover.nodeId === nodeId && (hover.id === nodeId || openNodeId !== nodeId);

export const frameHover = (hover: LayerHover, openNodeId: string | null): string | null => (hover && hover.nodeId === openNodeId && hover.id !== openNodeId ? hover.id : null);
