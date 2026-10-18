import { z } from 'zod';
import type { MotionClip, MotionDoc, MotionTrack } from './doc';

export enum OpKind {
  DocSet = 'doc.set',
  DocEntry = 'doc.entry',
  TrackAdd = 'track.add',
  TrackRemove = 'track.remove',
  TrackMove = 'track.move',
  TrackSet = 'track.set',
  ClipRemove = 'clip.remove',
  ClipAdd = 'clip.add',
  ClipMove = 'clip.move',
  ClipSet = 'clip.set',
  ClipEntry = 'clip.entry'
}

export type Slot = { after: string | null } | { index: number };

export type DocOp =
  | { kind: OpKind.DocSet; field: string; value?: unknown }
  | { kind: OpKind.DocEntry; field: string; key: string; value?: unknown }
  | ({ kind: OpKind.TrackAdd; track: Omit<MotionTrack, 'clips'> } & Slot)
  | { kind: OpKind.TrackRemove; trackId: string }
  | ({ kind: OpKind.TrackMove; trackId: string } & Slot)
  | { kind: OpKind.TrackSet; trackId: string; field: string; value?: unknown }
  | { kind: OpKind.ClipRemove; clipId: string }
  | ({ kind: OpKind.ClipAdd; trackId: string; clip: MotionClip } & Slot)
  | ({ kind: OpKind.ClipMove; clipId: string; trackId: string } & Slot)
  | { kind: OpKind.ClipSet; clipId: string; field: string; value?: unknown }
  | { kind: OpKind.ClipEntry; clipId: string; field: string; key: string; value?: unknown };

const KEYED_DOC_FIELDS = new Set(['comps', 'components', 'links']);
const KEYED_CLIP_FIELDS = new Set(['props', 'keyframes', 'transform']);
const TRACKS = 'tracks';
const CLIPS = 'clips';
const ID = 'id';

type Bag = Record<string, unknown>;
type Placed = { trackId: string; index: number; clip: MotionClip };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const keysOf = (...bags: (Bag | undefined)[]) => [...new Set(bags.flatMap((b) => Object.keys(b ?? {})))];

const valued = (value: unknown) => (value === undefined ? {} : { value });

function fieldOps<T extends DocOp>(before: Bag, after: Bag, skip: Set<string>, make: (field: string, value: unknown) => T): T[] {
  return keysOf(before, after)
    .filter((field) => !skip.has(field) && !same(before[field], after[field]))
    .map((field) => make(field, after[field]));
}

function entryOps<T extends DocOp>(before: Bag, after: Bag, fields: Set<string>, make: (field: string, key: string, value: unknown) => T): T[] {
  return [...fields].flatMap((field) => {
    const was = (before[field] ?? {}) as Bag;
    const now = (after[field] ?? {}) as Bag;
    return keysOf(was, now)
      .filter((key) => !same(was[key], now[key]))
      .map((key) => make(field, key, now[key]));
  });
}

function placements(doc: MotionDoc): Map<string, Placed> {
  return new Map(doc.tracks.flatMap((t) => t.clips.map((clip, index) => [clip.id, { trackId: t.id, index, clip }] as const)));
}

function settled(previous: (number | undefined)[]): Set<number> {
  const tails: number[] = [];
  const from: number[] = [];
  const at: number[] = [];
  previous.forEach((value, i) => {
    if (value === undefined) {
      return;
    }
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (previous[tails[mid]]! < value) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    from[i] = lo > 0 ? tails[lo - 1] : -1;
    tails[lo] = i;
    at[lo] = i;
  });
  const kept = new Set<number>();
  for (let i = tails.length ? tails[tails.length - 1] : -1; i >= 0; i = from[i]) {
    kept.add(i);
  }
  return kept;
}

const afterOf = (ids: readonly string[], i: number) => ({ after: i > 0 ? ids[i - 1] : null });

function trackOps(before: MotionDoc, after: MotionDoc): DocOp[] {
  const was = new Map(before.tracks.map((t, index) => [t.id, { t, index }]));
  const now = new Set(after.tracks.map((t) => t.id));
  const order = after.tracks.map((t) => t.id);
  const stays = settled(after.tracks.map((t) => was.get(t.id)?.index));

  return [
    ...before.tracks.filter((t) => !now.has(t.id)).map((t): DocOp => ({ kind: OpKind.TrackRemove, trackId: t.id })),
    ...after.tracks.flatMap((t, i): DocOp[] => {
      const old = was.get(t.id);
      const { clips: _clips, ...track } = t;
      if (!old) {
        return [{ kind: OpKind.TrackAdd, track, ...afterOf(order, i) }];
      }
      const set = fieldOps(old.t as unknown as Bag, t as unknown as Bag, new Set([CLIPS, ID]), (field, value): DocOp => ({ kind: OpKind.TrackSet, trackId: t.id, field, ...valued(value) }));
      return stays.has(i) ? set : [{ kind: OpKind.TrackMove, trackId: t.id, ...afterOf(order, i) }, ...set];
    })
  ];
}

function clipOps(before: MotionDoc, after: MotionDoc): DocOp[] {
  const was = placements(before);
  const now = placements(after);
  const removed = [...was.keys()].filter((id) => !now.has(id)).map((clipId): DocOp => ({ kind: OpKind.ClipRemove, clipId }));

  const placed = after.tracks.flatMap((track) => {
    const order = track.clips.map((c) => c.id);
    const previous = track.clips.map((c) => {
      const old = was.get(c.id);
      return old?.trackId === track.id ? old.index : undefined;
    });
    const stays = settled(previous);
    return track.clips.flatMap((clip, i): DocOp[] => {
      if (!was.has(clip.id)) {
        return [{ kind: OpKind.ClipAdd, trackId: track.id, clip, ...afterOf(order, i) }];
      }
      return stays.has(i) ? [] : [{ kind: OpKind.ClipMove, clipId: clip.id, trackId: track.id, ...afterOf(order, i) }];
    });
  });

  const edited = [...now.values()].flatMap(({ clip }) => {
    const old = was.get(clip.id)?.clip;
    if (!old) {
      return [];
    }
    const before = old as unknown as Bag;
    const after = clip as unknown as Bag;
    return [
      ...fieldOps(before, after, new Set([...KEYED_CLIP_FIELDS, ID]), (field, value): DocOp => ({ kind: OpKind.ClipSet, clipId: clip.id, field, ...valued(value) })),
      ...entryOps(before, after, KEYED_CLIP_FIELDS, (field, key, value): DocOp => ({ kind: OpKind.ClipEntry, clipId: clip.id, field, key, ...valued(value) }))
    ];
  });

  return [...removed, ...placed, ...edited];
}

export function diffDoc(before: MotionDoc, after: MotionDoc): DocOp[] {
  const was = before as unknown as Bag;
  const now = after as unknown as Bag;
  return [
    ...trackOps(before, after),
    ...clipOps(before, after),
    ...fieldOps(was, now, new Set([...KEYED_DOC_FIELDS, TRACKS]), (field, value): DocOp => ({ kind: OpKind.DocSet, field, ...valued(value) })),
    ...entryOps(was, now, KEYED_DOC_FIELDS, (field, key, value): DocOp => ({ kind: OpKind.DocEntry, field, key, ...valued(value) }))
  ];
}

type Draft = Bag & { tracks: MotionTrack[] };

function assign(bag: Bag, field: string, value: unknown) {
  if (value === undefined) {
    delete bag[field];
    return;
  }
  bag[field] = value;
}

function assignEntry(owner: Bag, field: string, key: string, value: unknown) {
  const entries = { ...((owner[field] ?? {}) as Bag) };
  assign(entries, key, value);
  owner[field] = entries;
}

const trackOf = (doc: Draft, trackId: string) => doc.tracks.find((t) => t.id === trackId);

function clipOf(doc: Draft, clipId: string): { track: MotionTrack; index: number } | null {
  for (const track of doc.tracks) {
    const index = track.clips.findIndex((c) => c.id === clipId);
    if (index >= 0) {
      return { track, index };
    }
  }
  return null;
}

const insertAt = <T>(list: T[], index: number, item: T) => list.splice(Math.min(Math.max(index, 0), list.length), 0, item);

function place<T extends { id: string }>(list: T[], slot: Slot, item: T) {
  if ('index' in slot) {
    insertAt(list, slot.index, item);
    return;
  }
  const anchor = slot.after === null ? -1 : list.findIndex((x) => x.id === slot.after);
  const index = slot.after !== null && anchor < 0 ? list.length : anchor + 1;
  insertAt(list, index, item);
}

function takeClip(doc: Draft, clipId: string): MotionClip | null {
  const at = clipOf(doc, clipId);
  return at ? at.track.clips.splice(at.index, 1)[0] : null;
}

const APPLY: { [K in OpKind]: (doc: Draft, op: Extract<DocOp, { kind: K }>) => void } = {
  [OpKind.DocSet]: (doc, op) => assign(doc, op.field, op.value),
  [OpKind.DocEntry]: (doc, op) => assignEntry(doc, op.field, op.key, op.value),
  [OpKind.TrackAdd]: (doc, op) => {
    if (!trackOf(doc, op.track.id)) {
      place(doc.tracks, op, { ...op.track, clips: [] } as MotionTrack);
    }
  },
  [OpKind.TrackRemove]: (doc, op) => {
    doc.tracks = doc.tracks.filter((t) => t.id !== op.trackId);
  },
  [OpKind.TrackMove]: (doc, op) => {
    const track = trackOf(doc, op.trackId);
    if (track) {
      doc.tracks = doc.tracks.filter((t) => t !== track);
      place(doc.tracks, op, track);
    }
  },
  [OpKind.TrackSet]: (doc, op) => {
    const track = trackOf(doc, op.trackId);
    if (track) {
      assign(track as unknown as Bag, op.field, op.value);
    }
  },
  [OpKind.ClipRemove]: (doc, op) => void takeClip(doc, op.clipId),
  [OpKind.ClipAdd]: (doc, op) => {
    const track = trackOf(doc, op.trackId);
    if (track && !clipOf(doc, op.clip.id)) {
      place(track.clips, op, op.clip);
    }
  },
  [OpKind.ClipMove]: (doc, op) => {
    const track = trackOf(doc, op.trackId);
    if (!track || !clipOf(doc, op.clipId)) {
      return;
    }
    place(track.clips, op, takeClip(doc, op.clipId)!);
  },
  [OpKind.ClipSet]: (doc, op) => {
    const at = clipOf(doc, op.clipId);
    if (at) {
      assign(at.track.clips[at.index] as unknown as Bag, op.field, op.value);
    }
  },
  [OpKind.ClipEntry]: (doc, op) => {
    const at = clipOf(doc, op.clipId);
    if (at) {
      assignEntry(at.track.clips[at.index] as unknown as Bag, op.field, op.key, op.value);
    }
  }
};

export function applyOps(doc: MotionDoc, ops: readonly DocOp[]): MotionDoc {
  const draft = JSON.parse(JSON.stringify(doc)) as Draft;
  for (const op of ops) {
    (APPLY[op.kind] as (doc: Draft, op: DocOp) => void)(draft, op);
  }
  return draft as unknown as MotionDoc;
}

export function rebase(base: MotionDoc, mine: MotionDoc, theirs: MotionDoc): MotionDoc {
  return applyOps(theirs, diffDoc(base, mine));
}

const id = z.string().min(1);
const index = z.number().int().min(0);
const slot = z.union([z.object({ after: id.nullable() }), z.object({ index })]);
const field = z.string().min(1);
const value = z.unknown().optional();
const record = z.record(z.string(), z.unknown());

export const MAX_OPS = 5000;

export const opsSchema = z
  .array(
    z.union([
      z.object({ kind: z.literal(OpKind.DocSet), field, value }),
      z.object({ kind: z.literal(OpKind.DocEntry), field, key: z.string(), value }),
      z.object({ kind: z.literal(OpKind.TrackAdd), track: record.and(z.object({ id })) }).and(slot),
      z.object({ kind: z.literal(OpKind.TrackRemove), trackId: id }),
      z.object({ kind: z.literal(OpKind.TrackMove), trackId: id }).and(slot),
      z.object({ kind: z.literal(OpKind.TrackSet), trackId: id, field, value }),
      z.object({ kind: z.literal(OpKind.ClipRemove), clipId: id }),
      z.object({ kind: z.literal(OpKind.ClipAdd), trackId: id, clip: record.and(z.object({ id })) }).and(slot),
      z.object({ kind: z.literal(OpKind.ClipMove), clipId: id, trackId: id }).and(slot),
      z.object({ kind: z.literal(OpKind.ClipSet), clipId: id, field, value }),
      z.object({ kind: z.literal(OpKind.ClipEntry), clipId: id, field, key: z.string(), value })
    ])
  )
  .max(MAX_OPS);

export function parseOps(input: unknown): DocOp[] | null {
  const parsed = opsSchema.safeParse(input);
  return parsed.success ? (parsed.data as DocOp[]) : null;
}
