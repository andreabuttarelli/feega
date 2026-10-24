import { TrackKind } from './components';
import { newClip, type MotionClip, type MotionDoc, type MotionTrack } from './doc';
import { embedMotion, motionCompId } from './embed';

export const SCENES_TRACK = 'scenes';

export type ScenePlacement = { nodeId: string; durationInFrames: number };
export type SceneFrame = { id: string; x: number; y: number };

const sceneOf = (clip: MotionClip): string | null => (clip.component === 'Precomp' && typeof clip.props.scene === 'string' ? clip.props.scene : null);

const total = (scenes: readonly ScenePlacement[]) => scenes.reduce((sum, s) => sum + s.durationInFrames, 0);

export function scenesLeftToRight(frames: readonly SceneFrame[]): string[] {
  return [...frames].sort((a, b) => a.x - b.x || a.y - b.y).map((f) => f.id);
}

export function sequenceScenes(host: MotionDoc, scenes: readonly ScenePlacement[]): MotionDoc {
  const clips = scenes.map((s, i) =>
    newClip({ id: `scene-${i + 1}`, from: total(scenes.slice(0, i)), durationInFrames: s.durationInFrames, component: 'Precomp', props: { comp: '', loop: false, hold: true, scene: s.nodeId } })
  );
  const track: MotionTrack = { id: SCENES_TRACK, kind: TrackKind.Visual, name: 'Scenes', clips };

  return { ...host, durationInFrames: Math.max(1, total(scenes)), tracks: [...host.tracks.filter((t) => t.id !== SCENES_TRACK), track] };
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
  const tracks = doc.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).flatMap((c) => pointed(c, docs)) }));

  return used.reduce((acc, id) => embedMotion(acc, id, docs[id]), { ...doc, tracks });
}
