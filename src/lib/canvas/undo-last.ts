import type { Gesture, UndoItem } from './undo-plan';

export type LoggedEvent = {
  id: number;
  kind: UndoItem['kind'];
  nodeId: string | null;
  edgeId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  actorKind: 'user' | 'agent' | 'system';
  actorId: string | null;
  agentKey: string | null;
  createdAt: string;
};

export type Writer = { kind: 'user' | 'agent' | 'system'; id: string | null; agentKey?: string | null };

const SAME_GESTURE_MS = 1500;

const sameWriter = (event: LoggedEvent, writer: Writer) =>
  event.actorKind === writer.kind && event.actorId === writer.id && event.agentKey === (writer.agentKey ?? null);

function edgeEnds(side: Record<string, unknown> | null) {
  const { sourceNodeId, targetNodeId } = side ?? {};
  return typeof sourceNodeId === 'string' && typeof targetNodeId === 'string' ? { sourceNodeId, targetNodeId } : null;
}

function itemOf(event: LoggedEvent): UndoItem | null {
  const nodeId = event.nodeId ?? '';
  const edgeId = event.edgeId ?? '';

  switch (event.kind) {
    case 'node.create':
      return { kind: 'node.create', nodeId, after: event.after ?? {} };
    case 'node.update':
      return event.after && 'data' in event.after ? { kind: 'node.update', nodeId, before: event.before ?? {}, after: event.after, expectedVersion: 0 } : null;
    case 'node.delete':
      return { kind: 'node.delete', nodeId, before: event.before ?? {} };
    case 'edge.create': {
      const ends = edgeEnds(event.after);
      return ends ? { kind: 'edge.create', edgeId, ...ends } : null;
    }
    case 'edge.delete': {
      const ends = edgeEnds(event.before);
      return ends ? { kind: 'edge.delete', edgeId, ...ends } : null;
    }
    default:
      return null;
  }
}

export function lastGesture(newestFirst: readonly LoggedEvent[], writer: Writer): Gesture | null {
  const mine = newestFirst.filter((event) => sameWriter(event, writer));
  if (!mine.length) {
    return null;
  }
  const newest = Date.parse(mine[0].createdAt);
  const items = mine
    .filter((event) => newest - Date.parse(event.createdAt) <= SAME_GESTURE_MS)
    .map(itemOf)
    .filter((item): item is UndoItem => item !== null);

  return items.length ? { items } : null;
}

const writerOf = (event: LoggedEvent): Writer => ({ kind: event.actorKind, id: event.actorId, agentKey: event.agentKey });

export function agentChanges<E extends LoggedEvent>(newestFirst: readonly E[]): E[][] {
  const changes: E[][] = [];

  for (const event of newestFirst) {
    if (event.actorKind !== 'agent') {
      continue;
    }
    const head = changes.at(-1)?.[0];
    const joins = head && sameWriter(event, writerOf(head)) && Date.parse(head.createdAt) - Date.parse(event.createdAt) <= SAME_GESTURE_MS;
    if (joins) {
      changes.at(-1)!.push(event);
      continue;
    }
    changes.push([event]);
  }

  return changes;
}
