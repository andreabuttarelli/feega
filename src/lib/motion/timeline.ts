import { COMPONENTS, TrackKind, defaultProps, parseProps, type ComponentId } from './components';
import { FPS, TransitionKind, type Edge } from './design';
import { FORMATS, MAX_FRAMES, findClip, type MotionClip, type MotionDoc, type MotionFormat, type MotionTrack } from './doc';

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
  if (end > MAX_FRAMES) {
    return fail(`the video can be at most ${MAX_FRAMES / FPS} seconds`);
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

  const props = parseProps(input.component, { ...defaultProps(input.component), ...input.props });
  if (!props.ok) {
    return fail(props.error);
  }

  const clip: MotionClip = {
    id,
    from: Math.max(0, Math.round(input.from)),
    durationInFrames: Math.max(MIN_FRAMES, Math.round(input.durationInFrames ?? spec.durationInFrames)),
    trimStart: 0,
    component: input.component,
    props: props.props,
    transitionIn: input.transitionIn ?? NO_EDGE,
    transitionOut: input.transitionOut ?? NO_EDGE
  };

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
  return { ok: true, doc: { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => !ids.includes(c.id)) })) } };
}

export function setProps(doc: MotionDoc, clipId: string, patch: Record<string, unknown>): OpResult {
  return editClip(doc, clipId, (clip) => {
    const verdict = parseProps(clip.component, { ...clip.props, ...patch });
    return verdict.ok ? { ...clip, props: verdict.props } : verdict.error;
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

export function moveTrack(doc: MotionDoc, trackId: string, toIndex: number): OpResult {
  const track = doc.tracks.find((t) => t.id === trackId);
  if (!track) {
    return fail(`no track ${trackId}`);
  }

  const rest = doc.tracks.filter((t) => t.id !== trackId);
  const at = Math.min(Math.max(0, toIndex), rest.length);
  return { ok: true, doc: { ...doc, tracks: [...rest.slice(0, at), track, ...rest.slice(at)] } };
}

export function setCanvas(doc: MotionDoc, input: { format?: MotionFormat; durationInFrames?: number }): OpResult {
  const size = input.format ? FORMATS[input.format] : { width: doc.width, height: doc.height };
  const durationInFrames = Math.round(input.durationInFrames ?? doc.durationInFrames);
  const end = Math.max(0, ...doc.tracks.flatMap((t) => t.clips.map(clipEnd)));

  if (durationInFrames < Math.max(1, end)) {
    return fail(`a clip ends at frame ${end}: move or trim it before shortening the video`);
  }
  if (durationInFrames > MAX_FRAMES) {
    return fail(`the video can be at most ${MAX_FRAMES / FPS} seconds`);
  }
  return { ok: true, doc: { ...doc, width: size.width, height: size.height, durationInFrames } };
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
  const edges = doc.tracks.flatMap((t) => t.clips.filter((c) => !input.exclude.includes(c.id)).flatMap((c) => [c.from, clipEnd(c)]));
  const seconds = Array.from({ length: Math.floor(doc.durationInFrames / doc.fps) + 1 }, (_, i) => i * doc.fps);
  return [...new Set([...edges, input.playhead, ...seconds])];
}
