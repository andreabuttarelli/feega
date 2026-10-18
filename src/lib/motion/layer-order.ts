import { TrackKind } from './components';
import { findClip, type MotionDoc } from './doc';
import { addTrack, moveClip, moveTrack, type OpResult } from './timeline';

export enum Arrange {
  Front = 'front',
  Forward = 'forward',
  Backward = 'backward',
  Back = 'back'
}

type Owned = { doc: MotionDoc; trackId: string; anchor: string; shared: boolean };

function ownTrack(doc: MotionDoc, clipId: string, newId: () => string): Owned | string {
  const found = findClip(doc, clipId);
  if (!found) {
    return `no clip ${clipId}`;
  }
  if (found.track.clips.length === 1) {
    return { doc, trackId: found.track.id, anchor: found.track.id, shared: false };
  }

  const trackId = newId();
  const added = addTrack(doc, found.track.kind as TrackKind, trackId);
  if (!added.ok) {
    return added.error;
  }
  const moved = moveClip(added.doc, clipId, { from: found.clip.from, trackId });
  return moved.ok ? { doc: moved.doc, trackId, anchor: found.track.id, shared: true } : moved.error;
}

function lastVisualIndex(doc: MotionDoc): number {
  return doc.tracks.filter((t) => t.kind === TrackKind.Visual).length - 1;
}

function anchorIndex(own: Owned): number {
  const tracks = own.shared ? own.doc.tracks.filter((t) => t.id !== own.trackId) : own.doc.tracks;
  return tracks.findIndex((t) => t.id === own.anchor);
}

const TARGET: Record<Arrange, (own: Owned) => number> = {
  [Arrange.Front]: () => 0,
  [Arrange.Forward]: (own) => Math.max(0, anchorIndex(own) - (own.shared ? 0 : 1)),
  [Arrange.Backward]: (own) => Math.min(lastVisualIndex(own.doc), anchorIndex(own) + 1),
  [Arrange.Back]: (own) => lastVisualIndex(own.doc)
};

const LAST_FIRST: ReadonlySet<Arrange> = new Set([Arrange.Front, Arrange.Forward]);

export function arrangeLayers(doc: MotionDoc, ids: readonly string[], to: Arrange, newId: () => string): OpResult {
  let next = doc;
  const order = LAST_FIRST.has(to) ? [...ids].reverse() : ids;

  for (const id of order) {
    const own = ownTrack(next, id, newId);
    if (typeof own === 'string') {
      return { ok: false, error: own };
    }
    const moved = moveTrack(own.doc, own.trackId, TARGET[to](own));
    if (!moved.ok) {
      return moved;
    }
    next = moved.doc;
  }

  return { ok: true, doc: next };
}
