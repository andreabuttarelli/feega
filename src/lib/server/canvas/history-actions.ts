import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { findNode } from '$lib/server/repos/canvas';
import { readRevision } from '$lib/server/repos/motion-revisions';
import { restoreRevision, Restore } from '$lib/server/motion/restore';
import { nameVersion } from '$lib/server/motion/version-names';
import { motionOf } from '$lib/canvas/motion-node';
import { clipsOf } from '@feega/motion-core/motion/doc';
import { HistoryAction, HistorySource, entryRef, type EntryRef } from '$lib/canvas/history/timeline';
import { branchStore } from '$lib/server/motion/branch-store';
import { BranchOutcome, dropBranch, mergeBranchBack, reviewBranch } from '$lib/server/motion/branches';
import { Side } from '$lib/motion/branch-merge';
import { RestoreOutcome, readCanvasVersion, restoreCanvasVersion } from './canvas-versions';

export enum HistoryOutcome {
  Done = 'done',
  Missing = 'missing',
  Unsupported = 'unsupported',
  Conflict = 'conflict'
}

type Scope = { orgId: string; canvasId: string; entryId: string };

export type CanvasPreview = { name: string; nodes: { id: string; type: string }[]; connections: number };

export type FramePreview = { frameId: string; version: number; summary: string | null; clips: number; seconds: number };

export type HistoryPreview = CanvasPreview | FramePreview;

export type Previewed = { outcome: HistoryOutcome.Done; preview: HistoryPreview } | { outcome: Exclude<HistoryOutcome, HistoryOutcome.Done> };

export type Acted = { outcome: HistoryOutcome; conflicts?: string[] };

export type Ask = { actor: Actor; name?: string; keep?: Side };

const MISSING = { outcome: HistoryOutcome.Missing } as const;
const UNSUPPORTED = { outcome: HistoryOutcome.Unsupported } as const;

type At = { db: Db; scope: Scope; ref: EntryRef };

async function frameOf(at: At) {
  const record = await findNode(at.db, { orgId: at.scope.orgId, nodeId: at.ref.key });
  return record && record.canvasId === at.scope.canvasId && at.ref.version !== null ? { record, version: at.ref.version } : null;
}

async function previewVersion(at: At): Promise<Previewed> {
  const saved = await readCanvasVersion(at.db, { orgId: at.scope.orgId, canvasId: at.scope.canvasId, versionId: at.ref.key });
  if (!saved) {
    return MISSING;
  }
  const nodes = saved.snapshot.nodes.map((n) => ({ id: n.id, type: n.type }));
  return { outcome: HistoryOutcome.Done, preview: { name: saved.name, nodes, connections: saved.snapshot.connections.length } };
}

async function previewRevision(at: At): Promise<Previewed> {
  const frame = await frameOf(at);
  const head = frame ? await readRevision(at.db, { orgId: at.scope.orgId, nodeId: frame.record.id, version: frame.version }) : null;
  if (!frame || !head) {
    return MISSING;
  }
  const preview = { frameId: frame.record.id, version: head.version, summary: head.summary, clips: clipsOf(head.doc).length, seconds: head.doc.durationInFrames / head.doc.fps };
  return { outcome: HistoryOutcome.Done, preview };
}

async function restoreVersion(at: At, ask: Ask): Promise<Acted> {
  const out = await restoreCanvasVersion(at.db, { orgId: at.scope.orgId, canvasId: at.scope.canvasId, versionId: at.ref.key, actor: ask.actor });
  return out.outcome === RestoreOutcome.Restored ? { outcome: HistoryOutcome.Done } : MISSING;
}

const RESTORED: Record<Restore, HistoryOutcome> = { [Restore.Restored]: HistoryOutcome.Done, [Restore.Missing]: HistoryOutcome.Missing, [Restore.Conflict]: HistoryOutcome.Conflict };

async function restoreFrame(at: At, ask: Ask): Promise<Acted> {
  const frame = await frameOf(at);
  const node = frame ? motionOf(frame.record) : null;
  if (!frame || !node) {
    return MISSING;
  }
  const out = await restoreRevision(at.db, { orgId: at.scope.orgId, nodeId: frame.record.id, node, version: frame.version, actor: ask.actor });
  return { outcome: RESTORED[out.outcome] };
}

async function nameFrame(at: At, ask: Ask): Promise<Acted> {
  const frame = await frameOf(at);
  if (!frame) {
    return MISSING;
  }
  const out = await nameVersion(at.db, { orgId: at.scope.orgId, nodeId: frame.record.id, version: frame.version, name: ask.name ?? '', actor: ask.actor });
  return { outcome: out.named ? HistoryOutcome.Done : HistoryOutcome.Missing };
}

async function mergeFork(at: At, ask: Ask): Promise<Acted> {
  if (!(await frameOf(at))) {
    return MISSING;
  }
  const store = branchStore(at.db, { orgId: at.scope.orgId, actor: ask.actor });
  const review = await reviewBranch(store, at.ref.key);
  if (!review) {
    return MISSING;
  }

  const paths = review.conflicts.map((c) => c.path);
  if (paths.length && !ask.keep) {
    return { outcome: HistoryOutcome.Conflict, conflicts: paths };
  }
  const choices = Object.fromEntries(paths.map((path) => [path, ask.keep!]));
  const out = await mergeBranchBack(store, at.ref.key, choices);
  return { outcome: out.outcome === BranchOutcome.Merged ? HistoryOutcome.Done : HistoryOutcome.Missing };
}

async function dropFork(at: At, ask: Ask): Promise<Acted> {
  if (!(await frameOf(at))) {
    return MISSING;
  }
  const out = await dropBranch(branchStore(at.db, { orgId: at.scope.orgId, actor: ask.actor }), at.ref.key);
  return { outcome: out === BranchOutcome.Dropped ? HistoryOutcome.Done : HistoryOutcome.Missing };
}

type Write = (at: At, ask: Ask) => Promise<Acted>;

type Handlers = { preview?: (at: At) => Promise<Previewed>; writes: Partial<Record<HistoryAction, Write>> };

const HANDLERS: Record<HistorySource, Handlers> = {
  [HistorySource.Event]: { writes: {} },
  [HistorySource.Version]: { preview: previewVersion, writes: { [HistoryAction.Restore]: restoreVersion } },
  [HistorySource.Revision]: { preview: previewRevision, writes: { [HistoryAction.Restore]: restoreFrame, [HistoryAction.Name]: nameFrame } },
  [HistorySource.Branch]: { writes: { [HistoryAction.Merge]: mergeFork, [HistoryAction.Drop]: dropFork } },
  [HistorySource.Conflict]: { writes: {} }
};

function handlersOf(db: Db, scope: Scope): { at: At; handlers: Handlers } | null {
  const ref = entryRef(scope.entryId);
  return ref ? { at: { db, scope, ref }, handlers: HANDLERS[ref.source] } : null;
}

export async function previewAt(db: Db, scope: Scope): Promise<Previewed> {
  const found = handlersOf(db, scope);
  return found?.handlers.preview ? found.handlers.preview(found.at) : UNSUPPORTED;
}

export async function actAt(db: Db, input: Scope & Ask & { action: HistoryAction }): Promise<Acted> {
  const found = handlersOf(db, input);
  const write = found?.handlers.writes[input.action];
  return found && write ? write(found.at, input) : UNSUPPORTED;
}
