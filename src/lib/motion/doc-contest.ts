import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { OpKind, diffDoc, type DocOp } from './doc-ops';

export type Contested = { id: string; now: unknown };

const DOC_SCOPE = 'doc';

const docKey = (field: string, key?: string) => [DOC_SCOPE, field, key].filter(Boolean).join(':');

const TOUCHED: { [K in OpKind]: (op: Extract<DocOp, { kind: K }>) => string } = {
  [OpKind.DocSet]: (op) => docKey(op.field),
  [OpKind.DocEntry]: (op) => docKey(op.field, op.key),
  [OpKind.TrackAdd]: (op) => op.track.id,
  [OpKind.TrackRemove]: (op) => op.trackId,
  [OpKind.TrackMove]: (op) => op.trackId,
  [OpKind.TrackSet]: (op) => op.trackId,
  [OpKind.ClipRemove]: (op) => op.clipId,
  [OpKind.ClipAdd]: (op) => op.clip.id,
  [OpKind.ClipMove]: (op) => op.clipId,
  [OpKind.ClipSet]: (op) => op.clipId,
  [OpKind.ClipEntry]: (op) => op.clipId
};

export function touchedIds(ops: readonly DocOp[]): Set<string> {
  return new Set(ops.map((op) => (TOUCHED[op.kind] as (op: DocOp) => string)(op)));
}

function currentOf(doc: MotionDoc, id: string): unknown {
  for (const track of doc.tracks) {
    if (track.id === id) {
      return { ...track, clips: track.clips.map((c) => c.id) };
    }
    const clip = track.clips.find((c) => c.id === id);
    if (clip) {
      return clip;
    }
  }
  if (!id.startsWith(`${DOC_SCOPE}:`)) {
    return null;
  }
  const [, field, key] = id.split(':');
  const value = (doc as unknown as Record<string, unknown>)[field];
  return key ? ((value ?? {}) as Record<string, unknown>)[key] ?? null : (value ?? null);
}

export function contested(base: MotionDoc, head: MotionDoc, attempted: MotionDoc): Contested[] {
  const byOthers = touchedIds(diffDoc(base, head));
  if (!byOthers.size) {
    return [];
  }
  const mine = touchedIds(diffDoc(head, attempted));
  return [...mine].filter((id) => byOthers.has(id)).map((id) => ({ id, now: currentOf(head, id) }));
}
