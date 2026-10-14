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

export type DocOp =
  | { kind: OpKind.DocSet; field: string; value?: unknown }
  | { kind: OpKind.DocEntry; field: string; key: string; value?: unknown }
  | { kind: OpKind.TrackAdd; track: Omit<MotionTrack, 'clips'>; index: number }
  | { kind: OpKind.TrackRemove; trackId: string }
  | { kind: OpKind.TrackMove; trackId: string; index: number }
  | { kind: OpKind.TrackSet; trackId: string; field: string; value?: unknown }
  | { kind: OpKind.ClipRemove; clipId: string }
  | { kind: OpKind.ClipAdd; trackId: string; index: number; clip: MotionClip }
  | { kind: OpKind.ClipMove; clipId: string; trackId: string; index: number }
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

function reordered(track: MotionTrack, was: Map<string, Placed>): boolean {
  const kept = track.clips.filter((c) => was.get(c.id)?.trackId === track.id).map((c) => was.get(c.id)!.index);
  return kept.some((index, i) => i > 0 && index < kept[i - 1]);
}

function trackOps(before: MotionDoc, after: MotionDoc): DocOp[] {
  const was = new Map(before.tracks.map((t, index) => [t.id, { t, index }]));
  const now = new Set(after.tracks.map((t) => t.id));
  const kept = before.tracks.filter((t) => now.has(t.id)).map((t) => t.id);
  const order = after.tracks.filter((t) => was.has(t.id)).map((t) => t.id);
  const moved = !same(kept, order);

  return [
    ...before.tracks.filter((t) => !now.has(t.id)).map((t): DocOp => ({ kind: OpKind.TrackRemove, trackId: t.id })),
    ...after.tracks.flatMap((t, index): DocOp[] => {
      const old = was.get(t.id);
      const { clips: _clips, ...track } = t;
      if (!old) {
        return [{ kind: OpKind.TrackAdd, track, index }];
      }
      const set = fieldOps(old.t as unknown as Bag, t as unknown as Bag, new Set([CLIPS, ID]), (field, value): DocOp => ({ kind: OpKind.TrackSet, trackId: t.id, field, ...valued(value) }));
      return moved ? [{ kind: OpKind.TrackMove, trackId: t.id, index }, ...set] : set;
    })
  ];
}

function clipOps(before: MotionDoc, after: MotionDoc): DocOp[] {
  const was = placements(before);
  const now = placements(after);
  const removed = [...was.keys()].filter((id) => !now.has(id)).map((clipId): DocOp => ({ kind: OpKind.ClipRemove, clipId }));

  const placed = after.tracks.flatMap((track) => {
    const shuffled = reordered(track, was);
    return track.clips.flatMap((clip, index): DocOp[] => {
      const old = was.get(clip.id);
      if (!old) {
        return [{ kind: OpKind.ClipAdd, trackId: track.id, index, clip }];
      }
      return old.trackId !== track.id || shuffled ? [{ kind: OpKind.ClipMove, clipId: clip.id, trackId: track.id, index }] : [];
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

function takeClip(doc: Draft, clipId: string): MotionClip | null {
  const at = clipOf(doc, clipId);
  return at ? at.track.clips.splice(at.index, 1)[0] : null;
}

const APPLY: { [K in OpKind]: (doc: Draft, op: Extract<DocOp, { kind: K }>) => void } = {
  [OpKind.DocSet]: (doc, op) => assign(doc, op.field, op.value),
  [OpKind.DocEntry]: (doc, op) => assignEntry(doc, op.field, op.key, op.value),
  [OpKind.TrackAdd]: (doc, op) => {
    if (!trackOf(doc, op.track.id)) {
      insertAt(doc.tracks, op.index, { ...op.track, clips: [] } as MotionTrack);
    }
  },
  [OpKind.TrackRemove]: (doc, op) => {
    doc.tracks = doc.tracks.filter((t) => t.id !== op.trackId);
  },
  [OpKind.TrackMove]: (doc, op) => {
    const track = trackOf(doc, op.trackId);
    if (track) {
      doc.tracks = doc.tracks.filter((t) => t !== track);
      insertAt(doc.tracks, op.index, track);
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
      insertAt(track.clips, op.index, op.clip);
    }
  },
  [OpKind.ClipMove]: (doc, op) => {
    const track = trackOf(doc, op.trackId);
    if (!track || !clipOf(doc, op.clipId)) {
      return;
    }
    insertAt(track.clips, op.index, takeClip(doc, op.clipId)!);
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
const field = z.string().min(1);
const value = z.unknown().optional();
const record = z.record(z.string(), z.unknown());

export const MAX_OPS = 5000;

export const opsSchema = z
  .array(
    z.discriminatedUnion('kind', [
      z.object({ kind: z.literal(OpKind.DocSet), field, value }),
      z.object({ kind: z.literal(OpKind.DocEntry), field, key: z.string(), value }),
      z.object({ kind: z.literal(OpKind.TrackAdd), track: record.and(z.object({ id })), index }),
      z.object({ kind: z.literal(OpKind.TrackRemove), trackId: id }),
      z.object({ kind: z.literal(OpKind.TrackMove), trackId: id, index }),
      z.object({ kind: z.literal(OpKind.TrackSet), trackId: id, field, value }),
      z.object({ kind: z.literal(OpKind.ClipRemove), clipId: id }),
      z.object({ kind: z.literal(OpKind.ClipAdd), trackId: id, index, clip: record.and(z.object({ id })) }),
      z.object({ kind: z.literal(OpKind.ClipMove), clipId: id, trackId: id, index }),
      z.object({ kind: z.literal(OpKind.ClipSet), clipId: id, field, value }),
      z.object({ kind: z.literal(OpKind.ClipEntry), clipId: id, field, key: z.string(), value })
    ])
  )
  .max(MAX_OPS);

export function parseOps(input: unknown): DocOp[] | null {
  const parsed = opsSchema.safeParse(input);
  return parsed.success ? (parsed.data as DocOp[]) : null;
}
