import { TrackKind } from '@feega/motion-core/motion/components';
import { newClip, type MotionClip, type MotionDoc, type MotionTrack } from '@feega/motion-core/motion/doc';
import { embedMotion, motionCompId } from './embed';
import type { Junction } from '@feega/motion-core/motion/junction-model';
import type { OpResult } from '@feega/motion-core/motion/timeline';

export const SCENES_TRACK = 'scenes';

export type ScenePlacement = { nodeId: string; durationInFrames: number };
export type SceneFrame = { id: string; x: number; y: number };
export type Scene = { clipId: string; nodeId: string; from: number; durationInFrames: number; junction: Junction | null };

const sceneOf = (clip: MotionClip): string | null => (clip.component === 'Precomp' && typeof clip.props.scene === 'string' ? clip.props.scene : null);

const total = (scenes: readonly { durationInFrames: number }[]) => scenes.reduce((sum, s) => sum + s.durationInFrames, 0);

const fail = (error: string): OpResult => ({ ok: false, error });

const sceneClip = (id: string, s: ScenePlacement): MotionClip =>
  newClip({ id, from: 0, durationInFrames: s.durationInFrames, component: 'Precomp', props: { comp: '', loop: false, hold: true, scene: s.nodeId } });

function packed(clips: readonly MotionClip[]): MotionClip[] {
  return clips.map((c, i) => ({ ...c, from: total(clips.slice(0, i)), junction: i === 0 ? null : (c.junction ?? null) }));
}

function withScenes(host: MotionDoc, clips: readonly MotionClip[]): MotionDoc {
  const held = scenesTrack(host);
  const track: MotionTrack = { ...(held ?? { id: SCENES_TRACK, kind: TrackKind.Visual, name: 'Scenes' }), clips: packed(clips) };
  const tracks = held ? host.tracks.map((t) => (t === held ? track : t)) : [...host.tracks, track];
  return { ...host, durationInFrames: Math.max(1, total(clips)), tracks };
}

const scenesTrack = (doc: MotionDoc): MotionTrack | undefined => doc.tracks.find((t) => t.id === SCENES_TRACK) ?? doc.tracks.find((t) => (t.clips as MotionClip[]).some((c) => sceneOf(c)));

const sceneClips = (doc: MotionDoc): MotionClip[] => (scenesTrack(doc)?.clips as MotionClip[] | undefined) ?? [];

export function scenesLeftToRight(frames: readonly SceneFrame[]): string[] {
  return [...frames].sort((a, b) => a.x - b.x || a.y - b.y).map((f) => f.id);
}

export function sequenceScenes(host: MotionDoc, scenes: readonly ScenePlacement[]): MotionDoc {
  return withScenes(host, scenes.map((s, i) => sceneClip(`scene-${i + 1}`, s)));
}

const freeSceneId = (clips: readonly MotionClip[]) => {
  const taken = new Set(clips.map((c) => c.id));
  return Array.from({ length: clips.length + 1 }, (_, i) => `scene-${i + 1}`).find((c) => !taken.has(c))!;
};

export function appendScene(doc: MotionDoc, scene: ScenePlacement): MotionDoc {
  const clips = sceneClips(doc);
  return withScenes(doc, [...clips, sceneClip(freeSceneId(clips), scene)]);
}

const boundariesOf = (clips: readonly MotionClip[]) => [0, ...clips.map((_, i) => total(clips.slice(0, i + 1)))];

export function insertSceneAt(doc: MotionDoc, scene: ScenePlacement, frame: number): MotionDoc {
  const clips = sceneClips(doc);
  const boundaries = boundariesOf(clips);
  const nearest = boundaries.reduce((best, b, i) => (Math.abs(b - frame) < Math.abs(boundaries[best] - frame) ? i : best), 0);
  return withScenes(doc, [...clips.slice(0, nearest), sceneClip(freeSceneId(clips), scene), ...clips.slice(nearest)]);
}

export function scenesOf(doc: MotionDoc): Scene[] {
  return sceneClips(doc).flatMap((c) => {
    const nodeId = sceneOf(c);
    return nodeId ? [{ clipId: c.id, nodeId, from: c.from, durationInFrames: c.durationInFrames, junction: c.junction ?? null }] : [];
  });
}

export function reorderScenes(doc: MotionDoc, clipIds: readonly string[]): OpResult {
  const clips = sceneClips(doc);
  const byId = new Map(clips.map((c) => [c.id, c]));
  if (clipIds.length !== clips.length || clipIds.some((id) => !byId.has(id))) {
    return fail(`list every scene once: ${clips.map((c) => c.id).join(', ')}`);
  }
  return { ok: true, doc: withScenes(doc, clipIds.map((id) => byId.get(id)!)) };
}

export function trimScene(doc: MotionDoc, clipId: string, durationInFrames: number): OpResult {
  const clips = sceneClips(doc);
  if (!clips.some((c) => c.id === clipId)) {
    return fail(`no scene ${clipId}`);
  }
  if (!Number.isInteger(durationInFrames) || durationInFrames < 1) {
    return fail('a scene lasts at least one frame');
  }
  return { ok: true, doc: withScenes(doc, clips.map((c) => (c.id === clipId ? { ...c, durationInFrames } : c))) };
}

export function sceneTransition(doc: MotionDoc, clipId: string, junction: Junction | null): OpResult {
  const clips = sceneClips(doc);
  const at = clips.findIndex((c) => c.id === clipId);
  if (at < 0) {
    return fail(`no scene ${clipId}`);
  }
  if (at === 0 && junction) {
    return fail('the first scene has nothing before it to transition from');
  }
  return { ok: true, doc: withScenes(doc, clips.map((c) => (c.id === clipId ? { ...c, junction } : c))) };
}

export function removeScene(doc: MotionDoc, clipId: string): OpResult {
  const clips = sceneClips(doc);
  if (!clips.some((c) => c.id === clipId)) {
    return fail(`no scene ${clipId}`);
  }
  return { ok: true, doc: withScenes(doc, clips.filter((c) => c.id !== clipId)) };
}

export type InsertableScene = ScenePlacement & { label: string };

const FALLBACK_LABEL = 'Frame';
const LABEL_MAX = 40;

const labelOf = (doc: MotionDoc) => {
  const text = doc.tracks.flatMap((t) => t.clips as MotionClip[]).find((c) => c.component === 'Text' && typeof c.props.text === 'string')?.props.text as string | undefined;
  return text?.trim().slice(0, LABEL_MAX) || FALLBACK_LABEL;
};

export function insertableScenes(frames: readonly { id: string; doc: MotionDoc }[]): InsertableScene[] {
  return frames.filter((f) => !sceneNodeIds(f.doc).length).map((f) => ({ nodeId: f.id, label: labelOf(f.doc), durationInFrames: f.doc.durationInFrames }));
}

export type SceneEdit =
  | { op: 'insert'; node_id: string; duration: number; at?: number }
  | { op: 'reorder'; clip_ids: string[] }
  | { op: 'trim'; clip_id: string; duration: number }
  | { op: 'remove'; clip_id: string };

type ToFrames = (seconds: number) => number;

const SCENE_EDITS: { [K in SceneEdit['op']]: (doc: MotionDoc, edit: Extract<SceneEdit, { op: K }>, frames: ToFrames) => OpResult } = {
  insert: (doc, e, frames) => {
    const scene = { nodeId: e.node_id, durationInFrames: Math.max(1, frames(e.duration)) };
    return { ok: true, doc: e.at === undefined ? appendScene(doc, scene) : insertSceneAt(doc, scene, frames(e.at)) };
  },
  reorder: (doc, e) => reorderScenes(doc, e.clip_ids),
  trim: (doc, e, frames) => trimScene(doc, e.clip_id, Math.max(1, frames(e.duration))),
  remove: (doc, e) => removeScene(doc, e.clip_id)
};

export function sceneEdit(doc: MotionDoc, edit: SceneEdit, frames: ToFrames): OpResult {
  return (SCENE_EDITS[edit.op] as (doc: MotionDoc, edit: SceneEdit, frames: ToFrames) => OpResult)(doc, edit, frames);
}

export function sceneNodeIds(doc: MotionDoc): string[] {
  return doc.tracks.flatMap((t) => (t.clips as MotionClip[]).flatMap((c) => sceneOf(c) ?? []));
}

function pointed(clip: MotionClip, docs: Readonly<Record<string, MotionDoc>>): MotionClip[] {
  const scene = sceneOf(clip);
  if (!scene) {
    return [clip];
  }
  if (!docs[scene]) {
    return [];
  }
  const { scene: _ref, ...props } = clip.props;
  return [{ ...clip, props: { ...props, comp: motionCompId(scene) } }];
}

export function resolveScenes(doc: MotionDoc, docs: Readonly<Record<string, MotionDoc>>): MotionDoc {
  const used = [...new Set(sceneNodeIds(doc))].filter((id) => docs[id]);
  const latestOnTop = (clips: MotionClip[]) => (clips.some(sceneOf) ? [...clips].sort((a, b) => b.from - a.from) : clips);
  const tracks = doc.tracks.map((t) => ({ ...t, clips: latestOnTop(t.clips as MotionClip[]).flatMap((c) => pointed(c, docs)) }));

  return used.reduce((acc, id) => embedMotion(acc, id, docs[id]), { ...doc, tracks });
}
