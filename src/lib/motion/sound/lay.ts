import { TrackKind } from '../components';
import { findClip, type MotionDoc } from '../doc';
import { addClip, addTrack, removeClips, type OpResult } from '../timeline';
import type { SoundScore } from './score';

export const SOUND_TRACK = 'Sound design';

export type SoundRender = { score: SoundScore; assetId: string };

function withoutPrevious(doc: MotionDoc): MotionDoc {
  const previous = doc.sound?.clipId;
  if (!previous || !findClip(doc, previous)) {
    return doc;
  }
  const out = removeClips(doc, [previous]);
  return out.ok ? out.doc : doc;
}

function soundTrack(doc: MotionDoc, id: string): { doc: MotionDoc; trackId: string } {
  const existing = doc.tracks.find((t) => t.kind === TrackKind.Audio && t.name === SOUND_TRACK);
  if (existing) {
    return { doc, trackId: existing.id };
  }
  const out = addTrack(doc, TrackKind.Audio, id, SOUND_TRACK);
  return { doc: out.ok ? out.doc : doc, trackId: id };
}

export function laySound(doc: MotionDoc, render: SoundRender, ids: { clip: string; track: string }): OpResult {
  const { doc: ready, trackId } = soundTrack(withoutPrevious(doc), ids.track);
  const placed = addClip(ready, { component: 'Audio', from: 0, durationInFrames: doc.durationInFrames, trackId, props: { assetId: render.assetId } }, ids.clip);
  if (!placed.ok) {
    return placed;
  }
  return { ok: true, doc: { ...placed.doc, sound: { score: render.score, assetId: render.assetId, clipId: ids.clip } } };
}
