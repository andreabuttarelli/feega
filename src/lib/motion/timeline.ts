import { COMPONENTS, TrackKind, defaultProps, type ComponentId } from './components';
import { Strictness } from './custom/component';
import { withParams } from './custom/params';
import { FPS, MAX_SECONDS, TransitionKind, maxFrames, type Edge } from './design';
import { FORMATS, byFrame, clipProps, compRefProblem, findClip, fontsOfClip, newClip, type Background, type MotionClip, type MotionDoc, type MotionFormat, type MotionTrack } from './doc';
import { Ease } from './design';
import { Matte, isMaskKey, maskSchema, maskStackSchema, type MaskInput } from './mask';
import { matteSource } from './matte';
import { CAMERA_LANE, type CameraKey } from './camera';
import { editCameraLane } from './camera-ops';
import { Around, EASE_PRESETS, Half, presetEase, withHalf, type EasePreset } from './graph';
import { Interp, keyframesProblem, transformSchema, type EaseSpec, type KeyValue, type Keyframe, type Keyframes, type Transform } from './keyframes';

export type OpResult = { ok: true; doc: MotionDoc } | { ok: false; error: string };

export enum ClipEdge {
  Start = 'start',
  End = 'end'
}

export enum Side {
  In = 'in',
  Out = 'out'
}

const NO_EDGE: Edge = { kind: TransitionKind.None, durationInFrames: 0 };
const MIN_FRAMES = 1;

const fail = (error: string): OpResult => ({ ok: false, error });

function clipEnd(clip: Pick<MotionClip, 'from' | 'durationInFrames'>): number {
  return clip.from + clip.durationInFrames;
}

function fitted(doc: MotionDoc): OpResult {
  const end = Math.max(0, ...doc.tracks.flatMap((t) => t.clips.map(clipEnd)));
  if (end > maxFrames(doc.fps)) {
    return fail(`the video can be at most ${MAX_SECONDS} seconds`);
  }
  return { ok: true, doc: { ...doc, durationInFrames: Math.max(doc.durationInFrames, end) } };
}

function editClip(doc: MotionDoc, clipId: string, edit: (clip: MotionClip) => MotionClip | string): OpResult {
  const found = findClip(doc, clipId);
  if (!found) {
    return fail(`no clip ${clipId}`);
  }

  const next = edit(found.clip);
  if (typeof next === 'string') {
    return fail(next);
  }

  return fitted({
    ...doc,
    tracks: doc.tracks.map((t) => (t.id === found.track.id ? { ...t, clips: t.clips.map((c) => (c.id === clipId ? next : c)) } : t))
  });
}

function trackFor(doc: MotionDoc, kind: TrackKind, trackId?: string): MotionTrack | string {
  if (!trackId) {
    return doc.tracks.find((t) => t.kind === kind) ?? `no ${kind} track`;
  }

  const track = doc.tracks.find((t) => t.id === trackId);
  if (!track) {
    return `no track ${trackId}`;
  }
  if (track.kind !== kind) {
    return `a ${kind} clip cannot go on ${track.kind} track ${trackId}`;
  }
  return track;
}

export type NewClip = {
  component: ComponentId;
  from: number;
  durationInFrames?: number;
  trackId?: string;
  props?: Record<string, unknown>;
  transitionIn?: Edge;
  transitionOut?: Edge;
};

export function addClip(doc: MotionDoc, input: NewClip, id: string): OpResult {
  const spec = COMPONENTS[input.component];
  const track = trackFor(doc, spec.track, input.trackId);
  if (typeof track === 'string') {
    return fail(track);
  }

  const props = clipProps(doc.components, input.component, { ...defaultProps(input.component), ...input.props }, Strictness.Strict);
  if (!props.ok) {
    return fail(props.error);
  }
  const missing = fontsOfClip(doc, { component: input.component, props: props.props }) ?? compRefProblem(doc, { component: input.component, props: props.props });
  if (missing) {
    return fail(missing);
  }

  const clip = newClip({
    id,
    from: Math.max(0, Math.round(input.from)),
    durationInFrames: Math.max(MIN_FRAMES, Math.round(input.durationInFrames ?? (spec.durationInFrames * doc.fps) / FPS)),
    component: input.component,
    props: props.props,
    transitionIn: input.transitionIn ?? NO_EDGE,
    transitionOut: input.transitionOut ?? NO_EDGE
  });

  return fitted({ ...doc, tracks: doc.tracks.map((t) => (t.id === track.id ? { ...t, clips: [...t.clips, clip] } : t)) });
}

export function moveClip(doc: MotionDoc, clipId: string, to: { from: number; trackId?: string }): OpResult {
  const found = findClip(doc, clipId);
  if (!found) {
    return fail(`no clip ${clipId}`);
  }

  const target = trackFor(doc, found.track.kind as TrackKind, to.trackId ?? found.track.id);
  if (typeof target === 'string') {
    return fail(target);
  }

  const moved = { ...found.clip, from: Math.max(0, Math.round(to.from)) };
  const tracks = doc.tracks.map((t) => {
    const kept = t.clips.filter((c) => c.id !== clipId);
    return t.id === target.id ? { ...t, clips: [...kept, moved] } : { ...t, clips: kept };
  });
  return fitted({ ...doc, tracks });
}

export function trimClip(doc: MotionDoc, clipId: string, edge: ClipEdge, frame: number): OpResult {
  return editClip(doc, clipId, (clip) => {
    const at = Math.round(frame);
    if (edge === ClipEdge.End) {
      return { ...clip, durationInFrames: Math.max(MIN_FRAMES, at - clip.from) };
    }

    const end = clipEnd(clip);
    const from = Math.min(end - MIN_FRAMES, Math.max(clip.from - clip.trimStart, 0, at));
    return { ...clip, from, durationInFrames: end - from, trimStart: clip.trimStart + (from - clip.from) };
  });
}

export function setTiming(doc: MotionDoc, clipId: string, timing: { from?: number; durationInFrames?: number }): OpResult {
  return editClip(doc, clipId, (clip) => ({
    ...clip,
    from: Math.max(0, Math.round(timing.from ?? clip.from)),
    durationInFrames: Math.max(MIN_FRAMES, Math.round(timing.durationInFrames ?? clip.durationInFrames))
  }));
}

export function splitClip(doc: MotionDoc, clipId: string, atFrame: number, newId: string): OpResult {
  const found = findClip(doc, clipId);
  if (!found) {
    return fail(`no clip ${clipId}`);
  }

  const { clip, track } = found;
  const at = Math.round(atFrame);
  if (at <= clip.from || at >= clipEnd(clip)) {
    return fail('the playhead is not inside the clip');
  }

  const left: MotionClip = { ...clip, durationInFrames: at - clip.from, transitionOut: NO_EDGE };
  const right: MotionClip = {
    ...clip,
    id: newId,
    from: at,
    durationInFrames: clipEnd(clip) - at,
    trimStart: clip.trimStart + (at - clip.from),
    transitionIn: NO_EDGE
  };

  const clips = track.clips.flatMap((c) => (c.id === clipId ? [left, right] : [c]));
  return fitted({ ...doc, tracks: doc.tracks.map((t) => (t.id === track.id ? { ...t, clips } : t)) });
}

export function duplicateClip(doc: MotionDoc, clipId: string, newId: string): OpResult {
  const found = findClip(doc, clipId);
  if (!found) {
    return fail(`no clip ${clipId}`);
  }

  const copy: MotionClip = { ...structuredClone(found.clip), id: newId, from: clipEnd(found.clip) };
  return fitted({ ...doc, tracks: doc.tracks.map((t) => (t.id === found.track.id ? { ...t, clips: [...t.clips, copy] } : t)) });
}

export function removeClips(doc: MotionDoc, ids: readonly string[]): OpResult {
  const missing = ids.find((id) => !findClip(doc, id));
  if (missing) {
    return fail(`no clip ${missing}`);
  }
  const orphan = (c: MotionTrack['clips'][number]) => (c.parent && ids.includes(c.parent) ? { ...c, parent: null } : c);
  return { ok: true, doc: { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => !ids.includes(c.id)).map(orphan) })) } };
}

export function setProps(doc: MotionDoc, clipId: string, patch: Record<string, unknown>): OpResult {
  return editClip(doc, clipId, (clip) => {
    const verdict = clipProps(doc.components, clip.component, { ...clip.props, ...patch }, Strictness.Strict);
    if (!verdict.ok) {
      return verdict.error;
    }
    const next = { component: clip.component, props: verdict.props };
    return fontsOfClip(doc, next) ?? compRefProblem(doc, next) ?? { ...clip, props: verdict.props };
  });
}

export function setTransition(doc: MotionDoc, clipId: string, side: Side, edge: Edge): OpResult {
  return editClip(doc, clipId, (clip) => {
    const durationInFrames = Math.min(Math.max(0, Math.round(edge.durationInFrames)), clip.durationInFrames);
    const next = { kind: edge.kind, durationInFrames };
    return side === Side.In ? { ...clip, transitionIn: next } : { ...clip, transitionOut: next };
  });
}

export function addTrack(doc: MotionDoc, kind: TrackKind, id: string, name?: string): OpResult {
  const count = doc.tracks.filter((t) => t.kind === kind).length + 1;
  const track: MotionTrack = { id, kind, name: name ?? `${kind === TrackKind.Visual ? 'Video' : 'Audio'} ${count}`, clips: [] };
  const firstAudio = doc.tracks.findIndex((t) => t.kind === TrackKind.Audio);
  const at = kind === TrackKind.Visual ? 0 : firstAudio < 0 ? doc.tracks.length : firstAudio;
  return { ok: true, doc: { ...doc, tracks: [...doc.tracks.slice(0, at), track, ...doc.tracks.slice(at)] } };
}

export function removeTrack(doc: MotionDoc, trackId: string): OpResult {
  if (!doc.tracks.some((t) => t.id === trackId)) {
    return fail(`no track ${trackId}`);
  }
  return { ok: true, doc: { ...doc, tracks: doc.tracks.filter((t) => t.id !== trackId) } };
}

export function renameTrack(doc: MotionDoc, trackId: string, name: string): OpResult {
  if (!doc.tracks.some((t) => t.id === trackId)) {
    return fail(`no track ${trackId}`);
  }
  return { ok: true, doc: { ...doc, tracks: doc.tracks.map((t) => (t.id === trackId ? { ...t, name } : t)) } };
}

export function removeAsset(doc: MotionDoc, assetId: string): OpResult {
  if (!doc.assets.some((a) => a.id === assetId)) {
    return fail(`no asset ${assetId} in this video`);
  }
  const users = doc.tracks.flatMap((t) => t.clips).filter((c) => JSON.stringify([c.props, c.mask, c.maskStack]).includes(JSON.stringify(assetId)));
  if (users.length) {
    return fail(`asset ${assetId} is used by ${users.map((c) => c.id).join(', ')}: remove or change those first`);
  }
  return { ok: true, doc: { ...doc, assets: doc.assets.filter((a) => a.id !== assetId) } };
}

export function moveTrack(doc: MotionDoc, trackId: string, toIndex: number): OpResult {
  const track = doc.tracks.find((t) => t.id === trackId);
  if (!track) {
    return fail(`no track ${trackId}`);
  }

  const rest = doc.tracks.filter((t) => t.id !== trackId);
  const at = Math.min(Math.max(0, toIndex), rest.length);
  return { ok: true, doc: { ...doc, tracks: [...rest.slice(0, at), track, ...rest.slice(at)] } };
}

export function setCanvas(doc: MotionDoc, input: { format?: MotionFormat; durationInFrames?: number; background?: Background }): OpResult {
  const size = input.format ? FORMATS[input.format] : { width: doc.width, height: doc.height };
  const durationInFrames = Math.round(input.durationInFrames ?? doc.durationInFrames);
  const end = Math.max(0, ...doc.tracks.flatMap((t) => t.clips.map(clipEnd)));

  if (durationInFrames < Math.max(1, end)) {
    return fail(`a clip ends at frame ${end}: move or trim it before shortening the video`);
  }
  if (durationInFrames > maxFrames(doc.fps)) {
    return fail(`the video can be at most ${MAX_SECONDS} seconds`);
  }
  return { ok: true, doc: { ...doc, width: size.width, height: size.height, durationInFrames, background: input.background ?? doc.background } };
}

export function snapFrame(frame: number, targets: readonly number[], threshold: number): number {
  let best = frame;
  let distance = threshold + 1;

  for (const target of targets) {
    const d = Math.abs(target - frame);
    if (d <= threshold && d < distance) {
      best = target;
      distance = d;
    }
  }
  return best;
}

export function snapTargets(doc: MotionDoc, input: { playhead: number; exclude: readonly string[] }): number[] {
  const kept = doc.tracks.flatMap((t) => t.clips.filter((c) => !input.exclude.includes(c.id)));
  const edges = kept.flatMap((c) => [c.from, clipEnd(c)]);
  const keys = keyframeFrames(doc, kept.map((c) => c.id));
  const seconds = Array.from({ length: Math.floor(doc.durationInFrames / doc.fps) + 1 }, (_, i) => i * doc.fps);
  const markers = [...(doc.markers ?? []).map((m) => m.frame), ...kept.flatMap((c) => (c.markers ?? []).map((m) => c.from + m.frame))];
  return [...new Set([...edges, ...keys, ...markers, input.playhead, ...seconds])];
}

export type KeyRef = { clipId: string; prop: string; frame: number };
export type KeyBoard = ({ prop: string; offset: number; value: KeyValue; ease: EaseSpec } & KeyShape)[];

export enum Direction {
  Back = 'back',
  Forward = 'forward'
}

function withKeyframes(doc: MotionDoc, clip: MotionClip, keyframes: Keyframes): MotionClip | string {
  const kept = Object.fromEntries(
    Object.entries(keyframes)
      .filter(([, track]) => track.length > 0)
      .map(([prop, track]) => [prop, byFrame(track)])
  );
  return keyframesProblem({ ...withParams(doc, clip), keyframes: kept }) ?? { ...clip, keyframes: kept };
}

export function setTransform(doc: MotionDoc, clipId: string, patch: Transform): OpResult {
  return editClip(doc, clipId, (clip) => {
    const parsed = transformSchema.safeParse({ ...clip.transform, ...patch });
    return parsed.success ? { ...clip, transform: parsed.data } : parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ');
  });
}

export function setKeyframes(doc: MotionDoc, clipId: string, prop: string, track: Keyframe[]): OpResult {
  return editClip(doc, clipId, (clip) => withKeyframes(doc, clip, { ...clip.keyframes, [prop]: track.map((k) => ({ ...k, frame: Math.max(0, Math.round(k.frame)) })) }));
}

export function setKeyframe(doc: MotionDoc, clipId: string, prop: string, frame: number, value: KeyValue): OpResult {
  return editClip(doc, clipId, (clip) => {
    const track = clip.keyframes[prop] ?? [];
    const at = Math.max(0, Math.round(frame));
    const ease = track.find((k) => k.frame === at)?.ease ?? Ease.Standard;
    return withKeyframes(doc, clip, { ...clip.keyframes, [prop]: [...track.filter((k) => k.frame !== at), { frame: at, value, ease }] });
  });
}

export function removeKeyframes(doc: MotionDoc, clipId: string, prop: string, frames?: readonly number[]): OpResult {
  return editClip(doc, clipId, (clip) => {
    const track = frames ? (clip.keyframes[prop] ?? []).filter((k) => !frames.includes(k.frame)) : [];
    return withKeyframes(doc, clip, { ...clip.keyframes, [prop]: track });
  });
}

function editRefs(doc: MotionDoc, refs: readonly KeyRef[], edit: (track: Keyframe[], frames: number[]) => Keyframe[]): OpResult {
  let result: OpResult = { ok: true, doc };
  const lanes = new Map<string, KeyRef[]>();
  for (const ref of refs) {
    const lane = `${ref.clipId} ${ref.prop}`;
    lanes.set(lane, [...(lanes.get(lane) ?? []), ref]);
  }

  for (const group of lanes.values()) {
    if (!result.ok) {
      return result;
    }
    const { clipId, prop } = group[0];
    const frames = group.map((r) => r.frame);
    const current = result.doc;
    if (clipId === CAMERA_LANE) {
      result = editCameraLane(current, prop as CameraKey, (track) => edit(track, frames));
      continue;
    }
    result = editClip(current, clipId, (clip) => withKeyframes(current, clip, { ...clip.keyframes, [prop]: edit(clip.keyframes[prop] ?? [], frames) }));
  }
  return result;
}

export function moveKeyframes(doc: MotionDoc, refs: readonly KeyRef[], delta: number): OpResult {
  const shift = Math.round(delta);
  return editRefs(doc, refs, (track, frames) => {
    const moving = track.filter((k) => frames.includes(k.frame)).map((k) => ({ ...k, frame: Math.max(0, k.frame + shift) }));
    const landed = new Set(moving.map((k) => k.frame));
    return [...track.filter((k) => !frames.includes(k.frame) && !landed.has(k.frame)), ...moving];
  });
}

export function deleteKeyframes(doc: MotionDoc, refs: readonly KeyRef[]): OpResult {
  return editRefs(doc, refs, (track, frames) => track.filter((k) => !frames.includes(k.frame)));
}

export function setKeyEase(doc: MotionDoc, ref: KeyRef, ease: EaseSpec): OpResult {
  return editRefs(doc, [ref], (track) => track.map((k) => (k.frame === ref.frame ? { ...k, ease } : k)));
}

export type KeyShape = { in?: Interp; out?: Interp; roving?: boolean };

export function shaped(key: Keyframe, shape: KeyShape): Keyframe {
  const next = { ...key, ...shape };
  const { in: inKind, out, roving, ...rest } = next;
  return {
    ...rest,
    ...(inKind && inKind !== Interp.Bezier ? { in: inKind } : {}),
    ...(out && out !== Interp.Bezier ? { out } : {}),
    ...(roving ? { roving } : {})
  };
}

export function setKeyInterp(doc: MotionDoc, refs: readonly KeyRef[], shape: KeyShape): OpResult {
  return editRefs(doc, refs, (track, frames) => track.map((k) => (frames.includes(k.frame) ? shaped(k, shape) : k)));
}

export type EaseBoard = { ease: EaseSpec } & KeyShape;

function keyOf(doc: MotionDoc, ref: KeyRef): Keyframe | undefined {
  const lanes: Partial<Record<string, Keyframe[]>> | undefined = ref.clipId === CAMERA_LANE ? doc.camera?.keyframes : findClip(doc, ref.clipId)?.clip.keyframes;
  return lanes?.[ref.prop]?.find((k) => k.frame === ref.frame);
}

export function copyEase(doc: MotionDoc, ref: KeyRef): EaseBoard | null {
  const key = keyOf(doc, ref);
  return key ? { ease: key.ease, in: key.in, out: key.out } : null;
}

export function pasteEase(doc: MotionDoc, refs: readonly KeyRef[], board: EaseBoard): OpResult {
  return editRefs(doc, refs, (track, frames) => track.map((k) => (frames.includes(k.frame) ? shaped({ ...k, ease: board.ease }, { in: board.in, out: board.out }) : k)));
}

const PRESET_AROUND: Record<Around, (track: Keyframe[], picked: (i: number) => boolean, preset: EasePreset) => Keyframe[]> = {
  [Around.Segment]: (track, picked, preset) => track.map((k, i) => (picked(i) ? shaped({ ...k, ease: presetEase(preset, k.ease) }, { out: Interp.Bezier }) : k)),
  [Around.Keyframe]: (track, picked, preset) => {
    const { halves, bezier } = EASE_PRESETS[preset];
    const leaving = halves.includes(Half.Leaving);
    const entering = halves.includes(Half.Entering);
    return track.map((k, i) => {
      const own = leaving && picked(i);
      const before = entering && picked(i + 1);
      const ease = [own ? Half.Leaving : null, before ? Half.Entering : null].reduce<EaseSpec>((e, half) => (half ? withHalf(half, e, bezier) : e), k.ease);
      return shaped({ ...k, ease }, { ...(own ? { out: Interp.Bezier } : {}), ...(entering && picked(i) ? { in: Interp.Bezier } : {}) });
    });
  }
};

export function applyEasePreset(doc: MotionDoc, refs: readonly KeyRef[], preset: EasePreset): OpResult {
  return editRefs(doc, refs, (track, frames) => PRESET_AROUND[EASE_PRESETS[preset].around](track, (i) => i < track.length && frames.includes(track[i]?.frame), preset));
}

export function copyKeyframes(doc: MotionDoc, refs: readonly KeyRef[]): KeyBoard {
  const picked = refs.flatMap((ref) => {
    const key = findClip(doc, ref.clipId)?.clip.keyframes[ref.prop]?.find((k) => k.frame === ref.frame);
    return key ? [{ prop: ref.prop, key }] : [];
  });
  const earliest = Math.min(...picked.map((p) => p.key.frame));
  return picked.map(({ prop, key }) => ({ prop, offset: key.frame - earliest, value: key.value, ease: key.ease, in: key.in, out: key.out, roving: key.roving }));
}

export function pasteKeyframes(doc: MotionDoc, clipId: string, board: KeyBoard, at: number): OpResult {
  return editClip(doc, clipId, (clip) => {
    const next: Keyframes = { ...clip.keyframes };
    for (const item of board) {
      const frame = Math.max(0, Math.round(at + item.offset));
      next[item.prop] = [...(next[item.prop] ?? []).filter((k) => k.frame !== frame), shaped({ frame, value: item.value, ease: item.ease }, { in: item.in, out: item.out, roving: item.roving })];
    }
    return withKeyframes(doc, clip, next);
  });
}

export function keyframeFrames(doc: MotionDoc, clipIds: readonly string[]): number[] {
  const frames = clipIds.flatMap((id) => {
    const clip = findClip(doc, id)?.clip;
    return clip ? Object.values(clip.keyframes).flatMap((track) => track.map((k) => clip.from + k.frame)) : [];
  });
  return [...new Set(frames)].sort((a, b) => a - b);
}

export function adjacentKeyframe(frames: readonly number[], frame: number, direction: Direction): number | null {
  if (direction === Direction.Forward) {
    return frames.find((f) => f > frame) ?? null;
  }
  return frames.findLast((f) => f < frame) ?? null;
}

const issues = (error: { issues: { path: PropertyKey[]; message: string }[] }) => error.issues.map((i) => `${i.path.join('.') || 'mask'}: ${i.message}`).join('; ');

export function setMask(doc: MotionDoc, clipId: string, input: MaskInput | null): OpResult {
  return editClip(doc, clipId, (clip) => {
    if (input === null) {
      return { ...clip, mask: null, maskStack: [], keyframes: Object.fromEntries(Object.entries(clip.keyframes).filter(([key]) => !isMaskKey(key))) };
    }
    const parsed = maskSchema.safeParse(input);
    return parsed.success ? { ...clip, mask: parsed.data } : issues(parsed.error);
  });
}

export function setMaskStack(doc: MotionDoc, clipId: string, inputs: MaskInput[]): OpResult {
  return editClip(doc, clipId, (clip) => {
    if (!clip.mask) {
      return 'add a first mask (set_mask) before stacking more on it';
    }
    const parsed = maskStackSchema.safeParse(inputs);
    return parsed.success ? { ...clip, maskStack: parsed.data } : issues(parsed.error);
  });
}

export function setTrackMatte(doc: MotionDoc, clipId: string, matte: Matte): OpResult {
  if (matte !== Matte.None) {
    const source = matteSource(doc, clipId);
    if (!source) {
      return fail('no clip above this one, on the track above and overlapping it in time, to use as matte');
    }
  }
  return editClip(doc, clipId, (clip) => ({ ...clip, matte }));
}
