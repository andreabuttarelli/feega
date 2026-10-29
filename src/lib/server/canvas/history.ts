import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { listBranchNodes, listNodes } from '$lib/server/repos/canvas';
import { listCanvasEvents, type CanvasEvent, type CanvasEventKind } from '$lib/server/repos/canvas-events';
import { listConflicts } from '$lib/server/repos/canvas-conflicts';
import { listRevisionMarks, type RevisionMark } from '$lib/server/repos/motion-revisions';
import { listProfileNames } from '$lib/server/repos/profiles';
import { listCanvasVersions } from './canvas-versions';
import { forkOf } from '$lib/server/motion/branch-store';
import { EntryKind, HistorySource, historyGraph, type HistoryAuthor, type HistoryEntry, type HistoryFilter, type HistoryGraph } from '$lib/canvas/history/timeline';
import type { Fork } from '$lib/server/motion/branches';
import type { CanvasNodeRecord } from '$lib/server/repos/canvas';
import { NODE_KIND_LABEL } from '$lib/canvas/node-label';
import type { NodeType } from '$lib/canvas/node-data';

export type HistoryRead = { orgId: string; canvasId: string; filter: HistoryFilter; frameId?: string | null; limit?: number };

type Scope = { orgId: string; canvasId: string };

type Canvas = { scope: Scope; nodes: CanvasNodeRecord[]; branches: CanvasNodeRecord[]; names: Map<string, string> };

const PER_SOURCE = 200;
const MOTION_NODE = 'motion';
const FIRST_REVISION = 1;

const authorOf = (kind: string, id: string | null, agentKey: string | null): HistoryAuthor => ({ kind: kind as HistoryAuthor['kind'], id, agentKey });

const actorAuthor = (actor: Actor): HistoryAuthor => authorOf(actor.kind, actor.id, actor.agentKey ?? null);

const typeLabel = (type: unknown) => NODE_KIND_LABEL[type as NodeType] ?? null;

const snapshotType = (e: CanvasEvent) => e.before?.type ?? e.after?.type;

const nodeName = (names: Map<string, string>, id: unknown, fallback: unknown = null) => names.get(String(id)) ?? typeLabel(fallback);

const edgeName = (names: Map<string, string>, ends: Record<string, unknown> | null) => (ends ? `${nodeName(names, ends.sourceNodeId)} → ${nodeName(names, ends.targetNodeId)}` : null);

const nodeSubject = (e: CanvasEvent, names: Map<string, string>) => nodeName(names, e.nodeId, snapshotType(e));

const SUBJECT_OF: Record<CanvasEventKind, (e: CanvasEvent, names: Map<string, string>) => string | null> = {
  'node.create': nodeSubject,
  'node.update': nodeSubject,
  'node.delete': nodeSubject,
  'edge.create': (e, names) => edgeName(names, e.after),
  'edge.delete': (e, names) => edgeName(names, e.before)
};

const nameOf = (node: CanvasNodeRecord) => node.displayName ?? typeLabel(node.type) ?? node.type;

async function eventEntries(db: Db, canvas: Canvas): Promise<HistoryEntry[]> {
  const events = await listCanvasEvents(db, { ...canvas.scope, limit: PER_SOURCE });
  return events.map((e) => ({
    id: `${HistorySource.Event}:${e.id}`,
    source: HistorySource.Event,
    kind: e.kind as EntryKind,
    at: e.createdAt,
    author: authorOf(e.actorKind, e.actorId, e.agentKey),
    nodeId: e.nodeId ?? e.edgeId,
    frameId: null,
    summary: null,
    sessionId: e.sessionId,
    subject: SUBJECT_OF[e.kind](e, canvas.names)
  }));
}

async function versionEntries(db: Db, canvas: Canvas): Promise<HistoryEntry[]> {
  const versions = await listCanvasVersions(db, canvas.scope);
  return versions.map((v) => ({
    id: `${HistorySource.Version}:${v.id}`,
    source: HistorySource.Version,
    kind: EntryKind.VersionSave,
    at: v.createdAt,
    author: actorAuthor(v.author),
    nodeId: null,
    frameId: null,
    summary: v.name,
    sessionId: null,
    subject: null
  }));
}

function revisionEntry(mark: RevisionMark, fork: Fork | undefined, names: Map<string, string>): HistoryEntry {
  const branched = fork !== undefined && mark.version === FIRST_REVISION;
  const source = branched ? HistorySource.Branch : HistorySource.Revision;
  return {
    id: `${source}:${mark.nodeId}:${mark.version}`,
    source,
    kind: branched ? EntryKind.BranchCreate : EntryKind.RevisionCommit,
    at: mark.createdAt,
    author: authorOf(mark.actorKind, mark.actorId, mark.agentKey),
    nodeId: mark.nodeId,
    frameId: fork?.frameId ?? mark.nodeId,
    summary: branched ? fork.name : mark.summary,
    sessionId: mark.sessionId,
    subject: names.get(fork?.frameId ?? mark.nodeId) ?? null
  };
}

async function frameEntries(db: Db, { scope, nodes, branches, names }: Canvas): Promise<HistoryEntry[]> {
  const forks = new Map(branches.flatMap((b) => {
    const fork = forkOf(b);
    return fork ? [[b.id, fork] as const] : [];
  }));
  const frames = nodes.filter((n) => n.type === MOTION_NODE).map((n) => n.id);

  const marks = await listRevisionMarks(db, { orgId: scope.orgId, nodeIds: [...frames, ...forks.keys()], limit: PER_SOURCE });
  return marks.map((mark) => revisionEntry(mark, forks.get(mark.nodeId), names));
}

async function conflictEntries(db: Db, canvas: Canvas): Promise<HistoryEntry[]> {
  const conflicts = await listConflicts(db, { ...canvas.scope, limit: PER_SOURCE });
  return conflicts.map((c) => ({
    id: `${HistorySource.Conflict}:${c.id}`,
    source: HistorySource.Conflict,
    kind: c.resolution ? EntryKind.ConflictResolved : EntryKind.ConflictOpen,
    at: c.createdAt,
    author: actorAuthor(c.refused),
    nodeId: c.nodeId,
    frameId: null,
    summary: c.resolution,
    sessionId: null,
    subject: canvas.names.get(c.nodeId) ?? null
  }));
}

const READERS: ((db: Db, canvas: Canvas) => Promise<HistoryEntry[]>)[] = [eventEntries, versionEntries, frameEntries, conflictEntries];

async function canvasOf(db: Db, scope: Scope): Promise<Canvas> {
  const [nodes, branches] = await Promise.all([listNodes(db, scope), listBranchNodes(db, scope)]);
  return { scope, nodes, branches, names: new Map(nodes.map((n) => [n.id, nameOf(n)])) };
}

const peopleOf = (entries: HistoryEntry[]) => [...new Set(entries.flatMap((e) => (e.author.kind === 'user' && e.author.id ? [e.author.id] : [])))];

export async function readHistory(db: Db, read: HistoryRead): Promise<HistoryGraph> {
  const scope = { orgId: read.orgId, canvasId: read.canvasId };
  const canvas = await canvasOf(db, scope);
  const entries = (await Promise.all(READERS.map((reader) => reader(db, canvas)))).flat();
  const names = await listProfileNames(db, peopleOf(entries));
  return historyGraph(entries, { filter: read.filter, frameId: read.frameId, names, limit: read.limit ?? PER_SOURCE });
}
