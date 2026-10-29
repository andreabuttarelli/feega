import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { findNode } from '$lib/server/repos/canvas';
import { readRevision } from '$lib/server/repos/motion-revisions';
import { restoreRevision, Restore } from '$lib/server/motion/restore';
import { nameVersion } from '$lib/server/motion/version-names';
import { motionOf } from '$lib/canvas/motion-node';
import { clipsOf } from '@feega/motion-core/motion/doc';
import { HistorySource, entryRef, type EntryRef } from '$lib/canvas/history/timeline';
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

export type Acted = { outcome: HistoryOutcome };

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

async function restoreVersion(at: At, actor: Actor): Promise<Acted> {
  const out = await restoreCanvasVersion(at.db, { orgId: at.scope.orgId, canvasId: at.scope.canvasId, versionId: at.ref.key, actor });
  return out.outcome === RestoreOutcome.Restored ? { outcome: HistoryOutcome.Done } : MISSING;
}

const RESTORED: Record<Restore, HistoryOutcome> = { [Restore.Restored]: HistoryOutcome.Done, [Restore.Missing]: HistoryOutcome.Missing, [Restore.Conflict]: HistoryOutcome.Conflict };

async function restoreFrame(at: At, actor: Actor): Promise<Acted> {
  const frame = await frameOf(at);
  const node = frame ? motionOf(frame.record) : null;
  if (!frame || !node) {
    return MISSING;
  }
  const out = await restoreRevision(at.db, { orgId: at.scope.orgId, nodeId: frame.record.id, node, version: frame.version, actor });
  return { outcome: RESTORED[out.outcome] };
}

async function nameFrame(at: At, name: string, actor: Actor): Promise<Acted> {
  const frame = await frameOf(at);
  if (!frame) {
    return MISSING;
  }
  const out = await nameVersion(at.db, { orgId: at.scope.orgId, nodeId: frame.record.id, version: frame.version, name, actor });
  return { outcome: out.named ? HistoryOutcome.Done : HistoryOutcome.Missing };
}

type Handlers = {
  preview?: (at: At) => Promise<Previewed>;
  restore?: (at: At, actor: Actor) => Promise<Acted>;
  name?: (at: At, name: string, actor: Actor) => Promise<Acted>;
};

const HANDLERS: Record<HistorySource, Handlers> = {
  [HistorySource.Event]: {},
  [HistorySource.Version]: { preview: previewVersion, restore: restoreVersion },
  [HistorySource.Revision]: { preview: previewRevision, restore: restoreFrame, name: nameFrame },
  [HistorySource.Branch]: {}
};

function handlersOf(db: Db, scope: Scope): { at: At; handlers: Handlers } | null {
  const ref = entryRef(scope.entryId);
  return ref ? { at: { db, scope, ref }, handlers: HANDLERS[ref.source] } : null;
}

export async function previewAt(db: Db, scope: Scope): Promise<Previewed> {
  const found = handlersOf(db, scope);
  return found?.handlers.preview ? found.handlers.preview(found.at) : UNSUPPORTED;
}

export async function restoreTo(db: Db, input: Scope & { actor: Actor }): Promise<Acted> {
  const found = handlersOf(db, input);
  return found?.handlers.restore ? found.handlers.restore(found.at, input.actor) : UNSUPPORTED;
}

export async function nameAt(db: Db, input: Scope & { name: string; actor: Actor }): Promise<Acted> {
  const found = handlersOf(db, input);
  return found?.handlers.name ? found.handlers.name(found.at, input.name, input.actor) : UNSUPPORTED;
}
