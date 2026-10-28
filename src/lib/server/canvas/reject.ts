import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { listCanvasEvents, type CanvasEvent, type CanvasEventKind } from '$lib/server/repos/canvas-events';
import {
  deleteConnection,
  deleteNode,
  findNode,
  listConnections,
  moveNode,
  restoreConnection,
  restoreNode,
  writeNodeData,
  type CanvasNodeRecord
} from '$lib/server/repos/canvas';
import { sameValue } from '$lib/canvas/node-patch';
import { mergeReject, RejectOutcome, type AgentChange, type Choice, type EventConflict, type RejectResult, type Side } from '$lib/canvas/reject-plan';
import type { UndoItem } from '$lib/canvas/undo-plan';
import { agentChanges } from '$lib/canvas/undo-last';

export type RejectInput = {
  orgId: string;
  canvasId: string;
  eventIds: number[];
  choices?: Choice[];
  confirm?: boolean;
  actor: Actor;
};

const SINCE_LIMIT = 2000;

type Edited = { node: CanvasNodeRecord; side: Side };
type Write = () => Promise<UndoItem | null>;

type Plan = {
  db: Db;
  input: RejectInput;
  later: (event: CanvasEvent) => CanvasEvent[];
  liveEdges: Set<string>;
  edited: Map<string, Edited>;
  gone: Set<string>;
  writes: Write[];
  reverted: string[];
  conflicts: EventConflict[];
  confirm: { nodeId: string; touchedBy: number[] } | null;
  stale: string | null;
};

const scope = (plan: Plan, nodeId: string) => ({ orgId: plan.input.orgId, nodeId });
const sideOf = (node: CanvasNodeRecord): Side => ({ data: node.data, position: node.position });
const sameActor = (a: CanvasEvent, b: CanvasEvent) => a.actorKind === b.actorKind && a.actorId === b.actorId && a.agentKey === b.agentKey;

function edgeEnds(event: CanvasEvent): { sourceNodeId: string; targetNodeId: string } {
  const side = (event.after ?? event.before ?? {}) as Record<string, string>;
  return { sourceNodeId: side.sourceNodeId, targetNodeId: side.targetNodeId };
}

function touches(plan: Plan, event: CanvasEvent, nodeId: string): boolean {
  if (event.nodeId === nodeId) {
    return true;
  }
  const ends = edgeEnds(event);
  const onNode = ends.sourceNodeId === nodeId || ends.targetNodeId === nodeId;
  return event.kind === 'edge.create' && onNode && plan.liveEdges.has(event.edgeId ?? '');
}

async function planUpdate(plan: Plan, event: CanvasEvent) {
  const nodeId = event.nodeId!;
  const known = plan.edited.get(nodeId);
  const node = known?.node ?? (await findNode(plan.db, scope(plan, nodeId)));
  if (!node) {
    plan.stale = nodeId;
    return;
  }

  const choices = Object.fromEntries((plan.input.choices ?? []).filter((c) => c.eventId === event.id).map((c) => [c.path, c.keep]));
  const merge = mergeReject(event.before ?? {}, event.after ?? {}, known?.side ?? sideOf(node), choices);
  plan.edited.set(nodeId, { node, side: merge.next });
  plan.reverted.push(...merge.reverted.map((path) => `${nodeId}:${path}`));
  plan.conflicts.push(...merge.conflicts.map((conflict) => ({ ...conflict, eventId: event.id, nodeId })));
}

async function planCreate(plan: Plan, event: CanvasEvent) {
  const nodeId = event.nodeId!;
  const node = await findNode(plan.db, scope(plan, nodeId));
  if (!node) {
    return;
  }

  const touchedBy = plan.later(event).filter((later) => !sameActor(later, event) && touches(plan, later, nodeId)).map((later) => later.id);
  if (touchedBy.length && !plan.input.confirm) {
    plan.confirm ??= { nodeId, touchedBy };
    return;
  }

  plan.gone.add(nodeId);
  plan.reverted.push(`${nodeId}:created`);
  plan.writes.push(async () => {
    await deleteNode(plan.db, { ...scope(plan, nodeId), actor: plan.input.actor });
    return { kind: 'node.delete', nodeId, before: { type: node.type, position: node.position, size: node.size, data: node.data } };
  });
}

async function planDelete(plan: Plan, event: CanvasEvent) {
  const nodeId = event.nodeId!;
  if (await findNode(plan.db, scope(plan, nodeId))) {
    return;
  }

  const before = (event.before ?? {}) as { position?: { x: number; y: number; z: number }; size?: { width: number | null; height: number | null }; data?: Record<string, unknown> };
  plan.reverted.push(`${nodeId}:deleted`);
  plan.writes.push(async () => {
    const node = await restoreNode(plan.db, {
      ...scope(plan, nodeId),
      position: before.position ?? { x: 0, y: 0, z: 0 },
      size: before.size ?? { width: null, height: null },
      data: before.data ?? {},
      actor: plan.input.actor
    });
    return node ? { kind: 'node.create', nodeId, after: { type: node.type, position: node.position, size: node.size, data: node.data } } : null;
  });
}

async function planEdge(plan: Plan, event: CanvasEvent) {
  const edgeId = event.edgeId!;
  const alive = plan.liveEdges.has(edgeId);
  const created = event.kind === 'edge.create';
  if (alive !== created) {
    return;
  }

  plan.reverted.push(`${edgeId}:${event.kind}`);
  plan.writes.push(async () => {
    const connection = { orgId: plan.input.orgId, connectionId: edgeId, actor: plan.input.actor };
    await (created ? deleteConnection(plan.db, connection) : restoreConnection(plan.db, connection));
    return { kind: created ? 'edge.delete' : 'edge.create', edgeId, ...edgeEnds(event) };
  });
}

const PLANNERS: Record<CanvasEventKind, (plan: Plan, event: CanvasEvent) => Promise<void>> = {
  'node.update': planUpdate,
  'node.create': planCreate,
  'node.delete': planDelete,
  'edge.create': planEdge,
  'edge.delete': planEdge
};

async function writeEdited(plan: Plan, { node, side }: Edited): Promise<UndoItem | null | 'stale'> {
  if (plan.gone.has(node.id)) {
    return null;
  }

  const position = side.position as CanvasNodeRecord['position'];
  if (!sameValue(position, node.position)) {
    await moveNode(plan.db, { ...scope(plan, node.id), x: position.x, y: position.y, z: position.z, actor: plan.input.actor });
  }

  const data = side.data as Record<string, unknown>;
  if (sameValue(data, node.data)) {
    return null;
  }
  const written = await writeNodeData(plan.db, { ...scope(plan, node.id), data, expectedVersion: node.version, actor: plan.input.actor });
  if (written.outcome !== 'written') {
    return 'stale';
  }
  return { kind: 'node.update', nodeId: node.id, before: { data: node.data }, after: { data: written.node.data }, expectedVersion: node.version };
}

export async function rejectChange(db: Db, input: RejectInput): Promise<RejectResult> {
  const ids = new Set(input.eventIds);
  const sinceId = Math.min(...ids);
  const events = await listCanvasEvents(db, { orgId: input.orgId, canvasId: input.canvasId, sinceId, limit: SINCE_LIMIT });
  const targets = events.filter((event) => ids.has(event.id));
  if (!ids.size || targets.length !== ids.size) {
    return { outcome: RejectOutcome.NotFound };
  }

  const edges = await listConnections(db, { orgId: input.orgId, canvasId: input.canvasId });
  const plan: Plan = {
    db,
    input,
    later: (event) => events.filter((other) => other.id > event.id && !ids.has(other.id)),
    liveEdges: new Set(edges.map((edge) => edge.id)),
    edited: new Map(),
    gone: new Set(),
    writes: [],
    reverted: [],
    conflicts: [],
    confirm: null,
    stale: null
  };

  for (const event of targets) {
    await PLANNERS[event.kind](plan, event);
  }

  if (plan.stale) {
    return { outcome: RejectOutcome.Stale, nodeId: plan.stale };
  }
  if (plan.conflicts.length) {
    return { outcome: RejectOutcome.Conflict, conflicts: plan.conflicts };
  }
  if (plan.confirm) {
    return { outcome: RejectOutcome.Confirm, ...plan.confirm };
  }

  const undo: UndoItem[] = [];
  for (const edited of plan.edited.values()) {
    const item = await writeEdited(plan, edited);
    if (item === 'stale') {
      return { outcome: RejectOutcome.Stale, nodeId: edited.node.id };
    }
    if (item) {
      undo.push(item);
    }
  }
  for (const write of plan.writes) {
    const item = await write();
    if (item) {
      undo.push(item);
    }
  }

  return { outcome: RejectOutcome.Rejected, undo, reverted: plan.reverted };
}

const AGENT_CHANGES_SCAN = 200;

export async function listAgentChanges(db: Db, scope: { orgId: string; canvasId: string }): Promise<AgentChange[]> {
  const events = await listCanvasEvents(db, { ...scope, limit: AGENT_CHANGES_SCAN });
  return agentChanges(events).map((change) => ({
    eventIds: change.map((event) => event.id),
    agent: change[0].agentKey,
    at: change[0].createdAt,
    writes: change.map((event) => ({ kind: event.kind, nodeId: event.nodeId, edgeId: event.edgeId }))
  }));
}
