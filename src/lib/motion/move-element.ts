import { COMPONENTS, TrackKind, type ComponentId } from './components';
import { MAX_SHORT_SIDE, MAX_SIDE, MAX_TRACKS, MotionFormat, cloneDoc, compsOf, findClip, newClip, newMotionDoc, type AssetRef, type MotionClip, type MotionDoc, type MotionTrack } from './doc';
import { FPS, maxFrames } from './design';
import { fieldsOf } from './inspector';
import { retimer } from './frame-rate';
import { DocMode } from './still';
import { removeClips, type OpResult } from './timeline';
import { TRANSFORM } from './keyframes';

export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type Box = { left: number; top: number; width: number; height: number };

type Carried = Pick<MotionDoc, 'assets' | 'fonts' | 'components' | 'comps'>;

export type Element = { clip: MotionClip; fps: number; size: Size; stillAt: number; carried: Carried };

export type Placement = { at: Point; frame?: number };

export type NewId = () => string;

export enum OutputKind {
  Image = 'image',
  Video = 'video',
  Text = 'text'
}

export type Output =
  | { kind: OutputKind.Image; assetId: string; name: string; width?: number | null; height?: number | null }
  | { kind: OutputKind.Video; assetId: string; name: string; seconds?: number | null; width?: number | null; height?: number | null }
  | { kind: OutputKind.Text; text: string; name: string };

export type Lifted = { ok: true; doc: MotionDoc; element: Element } | { ok: false; error: string };

const CENTRE: Point = { x: 0.5, y: 0.5 };
const FULL: Box = { left: 0, top: 0, width: 1, height: 1 };
const MIN_SIDE = 16;
const TEXT_CANVAS: Size = { width: 1080, height: 1080 };
const PICTURE_FALLBACK: Size = { width: 1080, height: 1080 };
const AUDIO_TRACK = 'a1';

type Scale = (from: Size, to: Size) => number;

const SIZE_PROPS: Record<string, Scale> = {
  width: (from, to) => from.width / to.width,
  height: (from, to) => from.height / to.height,
  size: (from, to) => Math.min(from.width, from.height) / Math.min(to.width, to.height)
};

const POSITION_KEYS: Record<keyof Point, keyof Point> = { x: 'x', y: 'y' };

type Media = { component: ComponentId; prop: string; value: (output: Output) => unknown; asset: (output: Output) => AssetRef | null; size: (output: Output) => Size; frames: (output: Output, fps: number) => number | null };

const pictureSize = (output: Output): Size => ('width' in output && output.width && output.height ? { width: output.width, height: output.height } : PICTURE_FALLBACK);

const mediaAsset = (output: Output): AssetRef | null => ('assetId' in output ? { id: output.assetId, kind: output.kind as 'image' | 'video', name: output.name } : null);

const MEDIA: Record<OutputKind, Media> = {
  [OutputKind.Image]: { component: 'Image', prop: 'assetId', value: (o) => ('assetId' in o ? o.assetId : null), asset: mediaAsset, size: pictureSize, frames: () => null },
  [OutputKind.Video]: { component: 'Video', prop: 'assetId', value: (o) => ('assetId' in o ? o.assetId : null), asset: mediaAsset, size: pictureSize, frames: (o, fps) => ('seconds' in o && o.seconds ? Math.max(1, Math.round(o.seconds * fps)) : null) },
  [OutputKind.Text]: { component: 'Text', prop: 'text', value: (o) => ('text' in o ? o.text : null), asset: () => null, size: () => TEXT_CANVAS, frames: () => null }
};

const MEDIA_FIT = { [OutputKind.Image]: { fit: 'contain', width: 1, height: 1 }, [OutputKind.Video]: { fit: 'contain', width: 1, height: 1 }, [OutputKind.Text]: {} } satisfies Record<OutputKind, Record<string, unknown>>;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function rangeOf(component: ComponentId, key: string): { min: number; max: number } | null {
  const field = fieldsOf(component).find((f) => f.key === key);
  return field?.min !== undefined && field.max !== undefined ? { min: field.min, max: field.max } : null;
}

const laidOut = (component: ComponentId) => rangeOf(component, 'x') !== null && rangeOf(component, 'y') !== null;

function usedText(clips: readonly MotionClip[]): string {
  return JSON.stringify(clips);
}

function compsNeeded(doc: MotionDoc, clip: MotionClip): MotionDoc['comps'] {
  const needed: MotionDoc['comps'] = {};
  const queue = compsOf(clip);
  while (queue.length) {
    const id = queue.shift()!;
    const comp = doc.comps[id];
    if (!comp || needed[id]) {
      continue;
    }
    needed[id] = comp;
    queue.push(...comp.tracks.flatMap((t) => (t.clips as MotionClip[]).flatMap(compsOf)));
  }
  return needed;
}

function carriedBy(doc: MotionDoc, clip: MotionClip): Carried {
  const comps = compsNeeded(doc, clip);
  const text = usedText([clip, ...Object.values(comps).flatMap((c) => c.tracks.flatMap((t) => t.clips as MotionClip[]))]);
  return {
    comps,
    assets: doc.assets.filter((a) => text.includes(a.id)),
    fonts: doc.fonts.filter((f) => text.includes(JSON.stringify(f.family))),
    components: Object.fromEntries(Object.entries(doc.components).filter(([name]) => text.includes(JSON.stringify(name))))
  };
}

export function liftElement(doc: MotionDoc, clipId: string): Lifted {
  const found = findClip(doc, clipId);
  if (!found) {
    return { ok: false, error: `no element ${clipId} in this frame` };
  }

  const removed = removeClips(doc, [clipId]);
  if (!removed.ok) {
    return removed;
  }

  const clip = cloneDoc(found.clip);
  const stillAt = doc.still ? clamp(doc.still.frame - clip.from, 0, clip.durationInFrames - 1) : 0;
  const element: Element = { clip: { ...clip, parent: null }, fps: doc.fps, size: { width: doc.width, height: doc.height }, stillAt, carried: carriedBy(doc, clip) };
  return { ok: true, doc: removed.doc, element };
}

function sized(clip: MotionClip, from: Size, to: Size): MotionClip {
  const props = { ...clip.props };
  const keyframes = { ...clip.keyframes };
  for (const [key, scale] of Object.entries(SIZE_PROPS)) {
    const range = rangeOf(clip.component, key);
    if (!range) {
      continue;
    }
    const factor = scale(from, to);
    const resize = (value: number) => clamp(value * factor, range.min, range.max);
    if (typeof props[key] === 'number') {
      props[key] = resize(props[key] as number);
    }
    if (keyframes[key]) {
      keyframes[key] = keyframes[key].map((k) => (typeof k.value === 'number' ? { ...k, value: resize(k.value) } : k));
    }
  }
  return { ...clip, props, keyframes };
}

function shiftKeys(clip: MotionClip, key: string, delta: number, range: { min: number; max: number }): MotionClip['keyframes'] {
  const track = clip.keyframes[key];
  if (!track) {
    return clip.keyframes;
  }
  return { ...clip.keyframes, [key]: track.map((k) => (typeof k.value === 'number' ? { ...k, value: clamp(k.value + delta, range.min, range.max) } : k)) };
}

function positioned(clip: MotionClip, at: Point): MotionClip {
  let next = clip;
  for (const axis of Object.values(POSITION_KEYS)) {
    const range = rangeOf(clip.component, axis);
    if (range) {
      const was = typeof next.props[axis] === 'number' ? (next.props[axis] as number) : CENTRE[axis];
      const value = clamp(at[axis], range.min, range.max);
      next = { ...next, props: { ...next.props, [axis]: value }, keyframes: shiftKeys(next, axis, value - was, range) };
      continue;
    }
    const offset = TRANSFORM[axis];
    const was = next.transform[axis] ?? offset.fallback;
    const value = clamp(at[axis] - CENTRE[axis], offset.min, offset.max);
    next = { ...next, transform: { ...next.transform, [axis]: value }, keyframes: shiftKeys(next, axis, value - was, offset) };
  }
  return next;
}

function timed(clip: MotionClip, target: MotionDoc, element: Element, frame?: number): MotionClip {
  const retime = retimer(element.fps, target.fps);
  const moved = retime.clip(clip);
  const limit = maxFrames(target.fps);
  const durationInFrames = Math.min(moved.durationInFrames, limit);

  if (target.still) {
    return { ...moved, durationInFrames, from: Math.max(0, target.still.frame - retime.frame(element.stillAt)) };
  }
  const wanted = Math.max(0, Math.round(frame ?? moved.from));
  return { ...moved, durationInFrames, from: Math.min(wanted, limit - durationInFrames) };
}

function freshId(doc: MotionDoc, id: string, newId: NewId): string {
  const taken = new Set([...doc.tracks, ...Object.values(doc.comps).flatMap((c) => c.tracks)].flatMap((t) => t.clips.map((c) => c.id)));
  let next = id;
  while (taken.has(next)) {
    next = newId();
  }
  return next;
}

function withTrack(doc: MotionDoc, clip: MotionClip, newId: NewId): MotionTrack[] {
  const kind = COMPONENTS[clip.component].track;
  if (kind === TrackKind.Visual && doc.tracks.length < MAX_TRACKS) {
    const count = doc.tracks.filter((t) => t.kind === kind).length + 1;
    return [{ id: freshTrackId(doc, newId), kind, name: `Video ${count}`, clips: [clip] }, ...doc.tracks];
  }
  const host = doc.tracks.find((t) => t.kind === kind);
  if (host) {
    return doc.tracks.map((t) => (t === host ? { ...t, clips: [...t.clips, clip] } : t));
  }
  return [...doc.tracks, { id: freshTrackId(doc, newId), kind, name: 'Audio 1', clips: [clip] }];
}

function freshTrackId(doc: MotionDoc, newId: NewId): string {
  const taken = new Set(doc.tracks.map((t) => t.id));
  let next = newId();
  while (taken.has(next)) {
    next = newId();
  }
  return next;
}

function merged(doc: MotionDoc, carried: Carried, element: Element): Pick<MotionDoc, 'assets' | 'fonts' | 'components' | 'comps'> {
  const retime = retimer(element.fps, doc.fps);
  const comps = Object.fromEntries(Object.entries(carried.comps).filter(([id]) => !doc.comps[id]).map(([id, comp]) => [id, retime.comp(comp)]));
  return {
    assets: [...doc.assets, ...carried.assets.filter((a) => !doc.assets.some((b) => b.id === a.id))],
    fonts: [...doc.fonts, ...carried.fonts.filter((f) => !doc.fonts.some((g) => g.family === f.family))],
    components: { ...carried.components, ...doc.components },
    comps: { ...doc.comps, ...comps }
  };
}

function grown(doc: MotionDoc, clip: MotionClip): number {
  if (doc.still) {
    return doc.durationInFrames;
  }
  return Math.min(maxFrames(doc.fps), Math.max(doc.durationInFrames, clip.from + clip.durationInFrames));
}

export type Placed = { ok: true; doc: MotionDoc; clipId: string } | { ok: false; error: string };

export function placeElement(doc: MotionDoc, element: Element, place: Placement, newId: NewId): Placed {
  const target: Size = { width: doc.width, height: doc.height };
  const clip = positioned(sized(timed({ ...element.clip, id: freshId(doc, element.clip.id, newId) }, doc, element, place.frame), element.size, target), place.at);
  const tracks = withTrack(doc, clip, newId);
  return { ok: true, clipId: clip.id, doc: { ...doc, ...merged(doc, element.carried, element), tracks, durationInFrames: grown(doc, clip) } };
}

function defaultBox(element: Element): Box {
  const { props } = element.clip;
  if (!laidOut(element.clip.component) || typeof props.width !== 'number' || typeof props.height !== 'number') {
    return FULL;
  }
  const x = typeof props.x === 'number' ? props.x : CENTRE.x;
  const y = typeof props.y === 'number' ? props.y : CENTRE.y;
  return { left: x - props.width / 2, top: y - props.height / 2, width: props.width, height: props.height };
}

const even = (value: number) => Math.max(MIN_SIDE, Math.round(value / 2) * 2);

function fittedSize(px: Size): Size {
  const long = Math.max(px.width, px.height);
  const short = Math.min(px.width, px.height);
  const k = Math.min(1, MAX_SIDE / long, MAX_SHORT_SIDE / short);
  return { width: even(px.width * k), height: even(px.height * k) };
}

export function frameOf(element: Element, mode: DocMode, box: Box | null, newId: NewId): MotionDoc {
  const area = box ?? defaultBox(element);
  const size = fittedSize({ width: area.width * element.size.width, height: area.height * element.size.height });
  const durationInFrames = Math.max(1, element.clip.durationInFrames);
  const blank: MotionDoc = { ...newMotionDoc(MotionFormat.Landscape), ...size, fps: element.fps as MotionDoc['fps'], durationInFrames, tracks: [] };
  const framed = mode === DocMode.Still ? { ...blank, still: { frame: element.stillAt } } : blank;
  const placed = placeElement(framed, { ...element, clip: { ...element.clip, from: 0 } }, { at: CENTRE, frame: 0 }, newId);
  const doc = placed.ok ? placed.doc : framed;
  const audio = doc.tracks.some((t) => t.kind === TrackKind.Audio) ? [] : [{ id: AUDIO_TRACK, kind: TrackKind.Audio, name: 'Audio 1', clips: [] }];
  return { ...doc, tracks: [...doc.tracks, ...audio] };
}

export function mediaElement(output: Output, fps: number = FPS): Element {
  const media = MEDIA[output.kind];
  const durationInFrames = media.frames(output, fps) ?? Math.round((COMPONENTS[media.component].durationInFrames * fps) / FPS);
  const clip = newClip({ id: `${media.component.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}`, from: 0, durationInFrames, component: media.component, props: { ...MEDIA_FIT[output.kind], [media.prop]: media.value(output) } });
  const asset = media.asset(output);
  return { clip, fps, size: media.size(output), stillAt: 0, carried: { assets: asset ? [asset] : [], fonts: [], components: {}, comps: {} } };
}

function refreshed(doc: MotionDoc, clipId: string, element: Element): OpResult {
  const media = Object.values(MEDIA).find((m) => m.component === element.clip.component);
  const found = findClip(doc, clipId);
  if (!media || !found || found.clip.component !== element.clip.component) {
    return { ok: false, error: `element ${clipId} is not a ${element.clip.component}` };
  }
  const value = element.clip.props[media.prop];
  const tracks = doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === clipId ? { ...c, props: { ...c.props, [media.prop]: value } } : c)) }));
  return { ok: true, doc: { ...doc, ...merged(doc, element.carried, element), tracks } };
}

export function linkOutput(doc: MotionDoc, sourceNodeId: string, element: Element, newId: NewId): OpResult {
  const linked = doc.links?.[sourceNodeId];
  if (linked && findClip(doc, linked)?.clip.component === element.clip.component) {
    return refreshed(doc, linked, element);
  }

  const placed = placeElement(doc, element, { at: CENTRE, frame: doc.still?.frame ?? 0 }, newId);
  if (!placed.ok) {
    return placed;
  }
  return { ok: true, doc: { ...placed.doc, links: { ...doc.links, [sourceNodeId]: placed.clipId } } };
}
