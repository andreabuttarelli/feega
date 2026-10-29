import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { listBranchNodes, listNodes } from '$lib/server/repos/canvas';
import { listCanvasEvents } from '$lib/server/repos/canvas-events';
import { listRevisionMarks, type RevisionMark } from '$lib/server/repos/motion-revisions';
import { listProfileNames } from '$lib/server/repos/profiles';
import { listCanvasVersions } from './canvas-versions';
import { forkOf } from '$lib/server/motion/branch-store';
import { EntryKind, HistorySource, historyGraph, type HistoryAuthor, type HistoryEntry, type HistoryFilter, type HistoryGraph } from '$lib/canvas/history/timeline';
import type { Fork } from '$lib/server/motion/branches';

export type HistoryRead = { orgId: string; canvasId: string; filter: HistoryFilter; frameId?: string | null; limit?: number };

type Scope = { orgId: string; canvasId: string };

const PER_SOURCE = 200;
const MOTION_NODE = 'motion';
const FIRST_REVISION = 1;

const authorOf = (kind: string, id: string | null, agentKey: string | null): HistoryAuthor => ({ kind: kind as HistoryAuthor['kind'], id, agentKey });

const actorAuthor = (actor: Actor): HistoryAuthor => authorOf(actor.kind, actor.id, actor.agentKey ?? null);

async function eventEntries(db: Db, scope: Scope): Promise<HistoryEntry[]> {
  const events = await listCanvasEvents(db, { ...scope, limit: PER_SOURCE });
  return events.map((e) => ({
    id: `${HistorySource.Event}:${e.id}`,
    source: HistorySource.Event,
    kind: e.kind as EntryKind,
    at: e.createdAt,
    author: authorOf(e.actorKind, e.actorId, e.agentKey),
    nodeId: e.nodeId ?? e.edgeId,
    frameId: null,
    summary: null
  }));
}

async function versionEntries(db: Db, scope: Scope): Promise<HistoryEntry[]> {
  const versions = await listCanvasVersions(db, scope);
  return versions.map((v) => ({
    id: `${HistorySource.Version}:${v.id}`,
    source: HistorySource.Version,
    kind: EntryKind.VersionSave,
    at: v.createdAt,
    author: actorAuthor(v.author),
    nodeId: null,
    frameId: null,
    summary: v.name
  }));
}

function revisionEntry(mark: RevisionMark, fork: Fork | undefined): HistoryEntry {
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
    summary: branched ? fork.name : mark.summary
  };
}

async function frameEntries(db: Db, scope: Scope): Promise<HistoryEntry[]> {
  const [nodes, branches] = await Promise.all([listNodes(db, scope), listBranchNodes(db, scope)]);
  const forks = new Map(branches.flatMap((b) => {
    const fork = forkOf(b);
    return fork ? [[b.id, fork] as const] : [];
  }));
  const frames = nodes.filter((n) => n.type === MOTION_NODE).map((n) => n.id);

  const marks = await listRevisionMarks(db, { orgId: scope.orgId, nodeIds: [...frames, ...forks.keys()], limit: PER_SOURCE });
  return marks.map((mark) => revisionEntry(mark, forks.get(mark.nodeId)));
}

const READERS: ((db: Db, scope: Scope) => Promise<HistoryEntry[]>)[] = [eventEntries, versionEntries, frameEntries];

const peopleOf = (entries: HistoryEntry[]) => [...new Set(entries.flatMap((e) => (e.author.kind === 'user' && e.author.id ? [e.author.id] : [])))];

export async function readHistory(db: Db, read: HistoryRead): Promise<HistoryGraph> {
  const scope = { orgId: read.orgId, canvasId: read.canvasId };
  const entries = (await Promise.all(READERS.map((reader) => reader(db, scope)))).flat();
  const names = await listProfileNames(db, peopleOf(entries));
  return historyGraph(entries, { filter: read.filter, frameId: read.frameId, names, limit: read.limit ?? PER_SOURCE });
}
