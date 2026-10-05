import { TrackKind } from './components';
import { compOf, compsOf, newClip, type MotionClip, type MotionComp, type MotionDoc, type MotionTrack } from './doc';
import { TransitionKind } from './design';
import type { Keyframes } from './keyframes';
import { withoutHidden } from './organize';
import { addClip, type OpResult } from './timeline';
import { ringCards, ringRadiusPx, ringSliceId, slicesFor } from './ring/model';

export type CompPath = readonly string[];
export type GroupProps = { span?: number };

export const MAX_COMP_DEPTH = 8;
const MAX_LOOPS = 600;
const SEPARATOR = '__';
const STILL = { kind: TransitionKind.None, durationInFrames: 0 };

const fail = (error: string): OpResult => ({ ok: false, error });
const clipEnd = (c: Pick<MotionClip, 'from' | 'durationInFrames'>) => c.from + c.durationInFrames;

export function viewOf(root: MotionDoc, path: CompPath): MotionDoc {
  const id = path.at(-1);
  const comp = id === undefined ? null : root.comps[id];
  if (!comp) {
    return root;
  }
  return { ...root, durationInFrames: comp.durationInFrames, tracks: comp.tracks, camera: null, markers: undefined, workArea: null };
}

export function mergeView(root: MotionDoc, path: CompPath, view: MotionDoc): MotionDoc {
  const id = path.at(-1);
  if (id === undefined || !root.comps[id]) {
    return view;
  }
  const comp: MotionComp = { ...(view.comps[id] ?? root.comps[id]), tracks: view.tracks, durationInFrames: view.durationInFrames };
  return { ...root, assets: view.assets, fonts: view.fonts, components: view.components, fields: view.fields, comps: { ...view.comps, [id]: comp } };
}

export function pathNames(root: MotionDoc, path: CompPath): string[] {
  return path.map((id) => root.comps[id]?.name ?? id);
}

function chosenTracks(doc: MotionDoc, ids: ReadonlySet<string>): MotionTrack[] {
  return doc.tracks.filter((t) => t.kind === TrackKind.Visual).flatMap((t) => {
    const clips = t.clips.filter((c) => ids.has(c.id));
    return clips.length ? [{ ...t, clips }] : [];
  });
}

const freed = (clip: MotionClip, inside: ReadonlySet<string>): MotionClip => (clip.parent && inside.has(clip.parent) ? clip : { ...clip, parent: null });

export function precompose(doc: MotionDoc, clipIds: readonly string[], ids: { comp: string; clip: string }, name: string): OpResult {
  const chosen = new Set(clipIds);
  const tracks = chosenTracks(doc, chosen);
  const clips = tracks.flatMap((t) => t.clips as MotionClip[]);
  if (!clips.length) {
    return fail('select clips on video tracks to precompose');
  }
  if (doc.comps[ids.comp]) {
    return fail(`a composition ${ids.comp} already exists`);
  }

  const from = Math.min(...clips.map((c) => c.from));
  const end = Math.max(...clips.map(clipEnd));
  const comp: MotionComp = {
    name: name.trim().slice(0, 60) || 'Precomp',
    durationInFrames: end - from,
    tracks: tracks.map((t) => ({ id: t.id, kind: t.kind, name: t.name, clips: (t.clips as MotionClip[]).map((c) => ({ ...freed(c, chosen), from: c.from - from })) }))
  };
  const host = tracks[0].id;
  const precomp = newClip({ id: ids.clip, from, durationInFrames: end - from, component: 'Precomp', props: { comp: ids.comp, loop: false } });
  const rest = doc.tracks.map((t) => {
    const kept = (t.clips as MotionClip[]).filter((c) => !chosen.has(c.id)).map((c) => (c.parent && chosen.has(c.parent) ? { ...c, parent: null } : c));
    return { ...t, clips: t.id === host ? [...kept, precomp] : kept };
  });
  return { ok: true, doc: { ...doc, tracks: rest, comps: { ...doc.comps, [ids.comp]: comp } } };
}

export function addAdjustment(doc: MotionDoc, timing: { from: number; durationInFrames?: number }, ids: { clip: string; track: string }): OpResult {
  const track: MotionTrack = { id: ids.track, kind: TrackKind.Visual, name: 'Adjustment', clips: [] };
  return addClip({ ...doc, tracks: [track, ...doc.tracks] }, { component: 'Adjustment', from: timing.from, durationInFrames: timing.durationInFrames, trackId: ids.track }, ids.clip);
}

function shifted(keyframes: Keyframes, by: number): Keyframes {
  if (!by) {
    return keyframes;
  }
  return Object.fromEntries(Object.entries(keyframes).map(([key, track]) => [key, (track ?? []).map((k) => ({ ...k, frame: k.frame - by }))]));
}

type Window = { from: number; end: number; offset: number; length: number; loops: number[] };

function windowOf(clip: MotionClip, comp: MotionComp): Window {
  const length = comp.durationInFrames;
  const first = clip.props.loop ? Math.floor(clip.trimStart / length) : 0;
  const last = clip.props.loop ? Math.min(first + MAX_LOOPS, Math.ceil((clip.trimStart + clip.durationInFrames) / length)) : 1;
  return { from: clip.from, end: clipEnd(clip), offset: clip.from - clip.trimStart, length, loops: Array.from({ length: last - first }, (_, i) => first + i) };
}

function placeOne(clip: MotionClip, w: Window, k: number, prefix: string): MotionClip | null {
  const start = w.offset + k * w.length + clip.from;
  const stop = start + Math.min(clip.durationInFrames, w.length - clip.from);
  const from = Math.max(start, w.from);
  const end = Math.min(stop, w.end);
  if (end <= from) {
    return null;
  }
  const cut = from - start;
  return {
    ...clip,
    id: `${prefix}${k}${SEPARATOR}${clip.id}`,
    parent: clip.parent ? `${prefix}${k}${SEPARATOR}${clip.parent}` : null,
    from,
    durationInFrames: end - from,
    trimStart: clip.trimStart + cut,
    keyframes: shifted(clip.keyframes, cut),
    transitionIn: cut ? STILL : clip.transitionIn,
    transitionOut: end < stop ? STILL : clip.transitionOut
  };
}

function placed(host: MotionClip, comp: MotionComp, tracks: MotionTrack[]): MotionTrack[] {
  const w = windowOf(host, comp);
  const prefix = `${host.id}${SEPARATOR}`;
  const laid = tracks.map((t) => ({ ...t, id: `${prefix}${t.id}`, clips: w.loops.flatMap((k) => (t.clips as MotionClip[]).flatMap((c) => placeOne(c, w, k, prefix) ?? [])) }));
  const present = new Set(laid.flatMap((t) => t.clips.map((c) => c.id)));
  return laid.map((t) => ({ ...t, clips: t.clips.map((c) => (c.parent && !present.has(c.parent) ? { ...c, parent: null } : c)) }));
}

type Expander = (doc: MotionDoc, track: MotionTrack, host: MotionClip, depth: number) => MotionTrack[];

function precompTracks(doc: MotionDoc, track: MotionTrack, host: MotionClip, depth: number): MotionTrack[] {
  const comp = doc.comps[compOf(host)!];
  const inner = expand(doc, withoutHidden({ ...doc, tracks: comp.tracks }).tracks, depth + 1);
  const group: MotionClip = { ...host, props: { ...host.props, span: inner.length } };
  return [{ ...track, id: `${host.id}${SEPARATOR}group`, clips: [group] }, ...placed(host, comp, inner)];
}

function sliceHost(ring: MotionClip, card: number, slice: number, comp: string): MotionClip {
  return newClip({ id: ringSliceId(ring.id, card, slice), from: ring.from, durationInFrames: ring.durationInFrames, trimStart: ring.trimStart, component: 'Precomp', props: { comp, loop: true } });
}

function ringTracks(doc: MotionDoc, track: MotionTrack, ring: MotionClip, depth: number): MotionTrack[] {
  const cards = ringCards(ring.props as never);
  const slices = slicesFor(cards.length, ringRadiusPx(ring.props as never, Math.min(doc.width, doc.height)));
  const hosts = cards.flatMap((shown, card) =>
    shown?.kind === COMP_CARD && doc.comps[shown.assetId]
      ? Array.from({ length: slices }, (_, slice) => ({ ...track, id: `${ringSliceId(ring.id, card, slice)}${SEPARATOR}host`, clips: [sliceHost(ring, card, slice, shown.assetId)] }))
      : []
  );
  const inner = expand(doc, hosts, depth);
  const group: MotionClip = { ...ring, props: { ...ring.props, span: inner.length } };
  return [{ ...track, id: `${ring.id}${SEPARATOR}group`, clips: [group] }, ...inner];
}

const COMP_CARD = 'comp';

const EXPANDERS: Partial<Record<MotionClip['component'], Expander>> = {
  Precomp: precompTracks,
  Composition: ringTracks
};

const isHost = (doc: MotionDoc, clip: MotionClip, depth: number) =>
  depth < MAX_COMP_DEPTH && EXPANDERS[clip.component] !== undefined && compsOf(clip).some((id) => doc.comps[id]);

function expand(doc: MotionDoc, tracks: readonly MotionTrack[], depth: number): MotionTrack[] {
  return tracks.flatMap((track) => {
    const hosts = (track.clips as MotionClip[]).filter((c) => isHost(doc, c, depth));
    if (!hosts.length) {
      return [track];
    }
    const rest = { ...track, clips: track.clips.filter((c) => !hosts.includes(c as MotionClip)) };
    const groups = hosts.flatMap((host) => EXPANDERS[host.component]!(doc, track, host, depth));
    return [...groups, rest];
  });
}

export function flattenComps(doc: MotionDoc): MotionDoc {
  if (!Object.keys(doc.comps).length) {
    return doc;
  }
  return { ...doc, tracks: expand(doc, doc.tracks, 0) };
}

export function hostIdsOf(clipId: string): string[] {
  const parts = clipId.split(SEPARATOR);
  return Array.from({ length: Math.floor((parts.length - 1) / 2) }, (_, i) => parts.slice(0, 2 * i + 1).join(SEPARATOR));
}
