import { findClip, type MotionDoc } from './doc';
import { OpKind, applyOps, diffDoc, type DocOp } from './doc-ops';

export enum Side {
  Branch = 'branch',
  Main = 'main'
}

export type Conflict = { path: string; branch: unknown; main: unknown };

export type Choices = Readonly<Record<string, Side>>;

type Of<K extends OpKind> = Extract<DocOp, { kind: K }>;

const DELETED = 'deleted';
const EDITED = 'edited';

const PATH: { [K in OpKind]: (op: Of<K>) => string } = {
  [OpKind.DocSet]: (op) => `doc:${op.field}`,
  [OpKind.DocEntry]: (op) => `doc:${op.field}:${op.key}`,
  [OpKind.TrackAdd]: (op) => `exists:track:${op.track.id}`,
  [OpKind.TrackRemove]: (op) => `exists:track:${op.trackId}`,
  [OpKind.TrackMove]: (op) => `order:track:${op.trackId}`,
  [OpKind.TrackSet]: (op) => `track:${op.trackId}:${op.field}`,
  [OpKind.ClipRemove]: (op) => `exists:clip:${op.clipId}`,
  [OpKind.ClipAdd]: (op) => `exists:clip:${op.clip.id}`,
  [OpKind.ClipMove]: (op) => `order:clip:${op.clipId}`,
  [OpKind.ClipSet]: (op) => `clip:${op.clipId}:${op.field}`,
  [OpKind.ClipEntry]: (op) => `clip:${op.clipId}:${op.field}:${op.key}`
};

const OWNER: { [K in OpKind]: (op: Of<K>) => string | null } = {
  [OpKind.DocSet]: () => null,
  [OpKind.DocEntry]: () => null,
  [OpKind.TrackAdd]: (op) => `track:${op.track.id}`,
  [OpKind.TrackRemove]: (op) => `track:${op.trackId}`,
  [OpKind.TrackMove]: (op) => `track:${op.trackId}`,
  [OpKind.TrackSet]: (op) => `track:${op.trackId}`,
  [OpKind.ClipRemove]: (op) => `clip:${op.clipId}`,
  [OpKind.ClipAdd]: (op) => `clip:${op.clip.id}`,
  [OpKind.ClipMove]: (op) => `clip:${op.clipId}`,
  [OpKind.ClipSet]: (op) => `clip:${op.clipId}`,
  [OpKind.ClipEntry]: (op) => `clip:${op.clipId}`
};

const REMOVALS = new Set([OpKind.ClipRemove, OpKind.TrackRemove]);

export const pathOf = (op: DocOp): string => (PATH[op.kind] as (op: DocOp) => string)(op);

const ownerOf = (op: DocOp): string | null => (OWNER[op.kind] as (op: DocOp) => string | null)(op);

const same = (a: DocOp, b: DocOp) => JSON.stringify(a) === JSON.stringify(b);

const valueOf = (op: DocOp): unknown => (REMOVALS.has(op.kind) ? DELETED : 'value' in op ? op.value : EDITED);

const existsOf = (owner: string) => `exists:${owner}`;

function removedOwners(ops: readonly DocOp[]): Set<string> {
  return new Set(ops.filter((op) => REMOVALS.has(op.kind)).map((op) => ownerOf(op)!));
}

function conflictsOf(mine: readonly DocOp[], theirs: readonly DocOp[]): Conflict[] {
  const main = new Map(theirs.map((op) => [pathOf(op), op]));
  const sameField = mine.flatMap((op): Conflict[] => {
    const other = main.get(pathOf(op));
    return other && !same(op, other) ? [{ path: pathOf(op), branch: valueOf(op), main: valueOf(other) }] : [];
  });

  const touched = (ops: readonly DocOp[]) => new Set(ops.filter((op) => !REMOVALS.has(op.kind)).map(ownerOf).filter((o): o is string => o !== null));
  const mainRemoved = removedOwners(theirs);
  const branchRemoved = removedOwners(mine);
  const branchTouched = touched(mine);
  const mainTouched = touched(theirs);
  const deleteVsEdit = [
    ...[...mainRemoved].filter((o) => branchTouched.has(o)).map((o) => ({ path: existsOf(o), branch: EDITED, main: DELETED })),
    ...[...branchRemoved].filter((o) => mainTouched.has(o)).map((o) => ({ path: existsOf(o), branch: DELETED, main: EDITED }))
  ];

  const owned = new Set(deleteVsEdit.map((c) => c.path));
  return [...sameField.filter((c) => !owned.has(c.path)), ...deleteVsEdit];
}

export function branchDiff(base: MotionDoc, branch: MotionDoc, main: MotionDoc): { mine: DocOp[]; theirs: DocOp[]; conflicts: Conflict[] } {
  const mine = diffDoc(base, branch);
  const theirs = diffDoc(base, main);
  return { mine, theirs, conflicts: conflictsOf(mine, theirs) };
}

function restoreClip(branch: MotionDoc, clipId: string): DocOp[] {
  const found = findClip(branch, clipId);
  if (!found) {
    return [];
  }
  const index = found.track.clips.findIndex((c) => c.id === clipId);
  return [{ kind: OpKind.ClipAdd, trackId: found.track.id, clip: found.clip, after: index > 0 ? found.track.clips[index - 1].id : null }];
}

export function mergeBranch(base: MotionDoc, branch: MotionDoc, main: MotionDoc, choices: Choices): MotionDoc {
  const { mine, theirs, conflicts } = branchDiff(base, branch, main);
  const contested = new Map(conflicts.map((c) => [c.path, c]));
  const mainRemoved = removedOwners(theirs);
  const pick = (path: string) => choices[path] ?? Side.Main;

  const kept = mine.filter((op) => {
    const owner = ownerOf(op);
    const ownerConflict = owner ? contested.get(existsOf(owner)) : undefined;
    if (ownerConflict) {
      return pick(ownerConflict.path) === Side.Branch && !mainRemoved.has(owner!);
    }
    return !contested.has(pathOf(op)) || pick(pathOf(op)) === Side.Branch;
  });

  const revived = conflicts
    .filter((c) => c.main === DELETED && pick(c.path) === Side.Branch && c.path.startsWith('exists:clip:'))
    .flatMap((c) => restoreClip(branch, c.path.slice('exists:clip:'.length)));

  return applyOps(main, [...kept, ...revived]);
}
