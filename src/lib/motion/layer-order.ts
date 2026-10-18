import { TrackKind } from './components';
import { findClip, type MotionDoc } from './doc';
import { addTrack, moveClip, moveTrack, type OpResult } from './timeline';

export enum Arrange {
  Front = 'front',
  Back = 'back'
}

function ownTrack(doc: MotionDoc, clipId: string, newId: () => string): OpResult & { trackId?: string } {
  const found = findClip(doc, clipId);
  if (!found) {
    return { ok: false, error: `no clip ${clipId}` };
  }
  if (found.track.clips.length === 1) {
    return { ok: true, doc, trackId: found.track.id };
  }

  const trackId = newId();
  const added = addTrack(doc, found.track.kind as TrackKind, trackId);
  if (!added.ok) {
    return added;
  }
  const moved = moveClip(added.doc, clipId, { from: found.clip.from, trackId });
  return moved.ok ? { ...moved, trackId } : moved;
}

function lastVisualIndex(doc: MotionDoc): number {
  return doc.tracks.filter((t) => t.kind === TrackKind.Visual).length - 1;
}

export function arrangeLayers(doc: MotionDoc, ids: readonly string[], to: Arrange, newId: () => string): OpResult {
  let next = doc;
  const order = to === Arrange.Front ? [...ids].reverse() : ids;

  for (const id of order) {
    const own = ownTrack(next, id, newId);
    if (!own.ok) {
      return own;
    }
    const index = to === Arrange.Front ? 0 : lastVisualIndex(own.doc);
    const moved = moveTrack(own.doc, own.trackId!, index);
    if (!moved.ok) {
      return moved;
    }
    next = moved.doc;
  }

  return { ok: true, doc: next };
}
