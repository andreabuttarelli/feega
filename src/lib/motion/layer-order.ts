import { TrackKind } from './components';
import { findClip, type MotionDoc, type MotionTrack } from './doc';
import { layerOrder } from './siblings';
import { moveTrack, type OpResult } from './timeline';

export enum Arrange {
  Front = 'front',
  Forward = 'forward',
  Backward = 'backward',
  Back = 'back'
}

type Isolated = { doc: MotionDoc; trackId: string };

function isolate(doc: MotionDoc, clipId: string, newId: () => string): Isolated | string {
  const found = findClip(doc, clipId);
  if (!found) {
    return `no clip ${clipId}`;
  }
  const { track } = found;
  const at = track.clips.findIndex((c) => c.id === clipId);
  const below = track.clips.slice(0, at);
  const above = track.clips.slice(at + 1);
  if (!below.length && !above.length) {
    return { doc, trackId: track.id };
  }

  const part = (clips: MotionTrack['clips']): MotionTrack => ({ ...track, id: newId(), clips });
  const own = below.length ? part([found.clip]) : { ...track, clips: [found.clip] };
  const split = [...(above.length ? [part(above)] : []), own, ...(below.length ? [{ ...track, clips: below }] : [])];
  const index = doc.tracks.indexOf(track);
  return { doc: { ...doc, tracks: [...doc.tracks.slice(0, index), ...split, ...doc.tracks.slice(index + 1)] }, trackId: own.id };
}

function lastVisualIndex(doc: MotionDoc): number {
  return doc.tracks.filter((t) => t.kind === TrackKind.Visual).length - 1;
}

type Step = (own: Isolated, newId: () => string) => OpResult | string;

function stepPast(offset: number, landing: number): Step {
  return (own, newId) => {
    const order = layerOrder({ ...own.doc, tracks: own.doc.tracks.filter((t) => t.kind === TrackKind.Visual) });
    const clipId = own.doc.tracks.find((t) => t.id === own.trackId)!.clips[0].id;
    const neighbour = order[order.indexOf(clipId) + offset];
    if (!neighbour) {
      return { ok: true, doc: own.doc };
    }
    const next = isolate(own.doc, neighbour, newId);
    if (typeof next === 'string') {
      return next;
    }
    const rest = next.doc.tracks.filter((t) => t.id !== own.trackId);
    return moveTrack(next.doc, own.trackId, rest.findIndex((t) => t.id === next.trackId) + landing);
  };
}

const STEPS: Record<Arrange, Step> = {
  [Arrange.Front]: (own) => moveTrack(own.doc, own.trackId, 0),
  [Arrange.Forward]: stepPast(-1, 0),
  [Arrange.Backward]: stepPast(1, 1),
  [Arrange.Back]: (own) => moveTrack(own.doc, own.trackId, lastVisualIndex(own.doc))
};

const LAST_FIRST: ReadonlySet<Arrange> = new Set([Arrange.Front, Arrange.Forward]);

export function arrangeLayers(doc: MotionDoc, ids: readonly string[], to: Arrange, newId: () => string): OpResult {
  let next = doc;
  const order = LAST_FIRST.has(to) ? [...ids].reverse() : ids;

  for (const id of order) {
    const own = isolate(next, id, newId);
    if (typeof own === 'string') {
      return { ok: false, error: own };
    }
    const moved = STEPS[to](own, newId);
    if (typeof moved === 'string') {
      return { ok: false, error: moved };
    }
    if (!moved.ok) {
      return moved;
    }
    next = moved.doc;
  }

  return { ok: true, doc: next };
}
