import { describe, expect, it } from 'vitest';
import { agentChanges, lastGesture, type LoggedEvent } from './undo-last';

const ME = { kind: 'agent' as const, id: 'user', agentKey: 'mcp' };
const T0 = Date.parse('2026-10-26T10:00:00Z');

const event = (id: number, fields: Partial<LoggedEvent>): LoggedEvent => ({
  id,
  kind: 'node.update',
  nodeId: 'n1',
  edgeId: null,
  before: null,
  after: null,
  actorKind: 'agent',
  actorId: 'user',
  agentKey: 'mcp',
  createdAt: new Date(T0).toISOString(),
  ...fields
});

describe('the last gesture of an actor', () => {
  it('is nothing when the actor never wrote', () => {
    expect(lastGesture([event(1, { actorKind: 'user', agentKey: null })], ME)).toBeNull();
  });

  it('skips events written by someone else', () => {
    const events = [event(3, { actorKind: 'user', agentKey: null }), event(2, { kind: 'node.delete', before: { type: 'text' } })];
    expect(lastGesture(events, ME)).toEqual({ items: [{ kind: 'node.delete', nodeId: 'n1', before: { type: 'text' } }] });
  });

  it('tells two agents of the same user apart', () => {
    const events = [event(2, { agentKey: 'sidebar' }), event(1, { kind: 'node.create', after: { type: 'text' } })];
    expect(lastGesture(events, ME)).toEqual({ items: [{ kind: 'node.create', nodeId: 'n1', after: { type: 'text' } }] });
  });

  it('turns an update into an item with before and after', () => {
    const events = [event(1, { before: { data: { a: 1 } }, after: { data: { a: 2 } } })];
    expect(lastGesture(events, ME)).toEqual({
      items: [{ kind: 'node.update', nodeId: 'n1', before: { data: { a: 1 } }, after: { data: { a: 2 } }, expectedVersion: 0 }]
    });
  });

  it('reads the ends of an edge from the side that was recorded', () => {
    const ends = { sourceNodeId: 's', targetNodeId: 't' };
    expect(lastGesture([event(1, { kind: 'edge.create', nodeId: null, edgeId: 'e', after: ends })], ME)?.items).toEqual([{ kind: 'edge.create', edgeId: 'e', ...ends }]);
    expect(lastGesture([event(1, { kind: 'edge.delete', nodeId: null, edgeId: 'e', before: ends })], ME)?.items).toEqual([{ kind: 'edge.delete', edgeId: 'e', ...ends }]);
  });

  it('groups the events written in the same instant, newest first', () => {
    const events = [
      event(3, { kind: 'edge.create', nodeId: null, edgeId: 'e', after: { sourceNodeId: 's', targetNodeId: 'n2' } }),
      event(2, { kind: 'node.create', nodeId: 'n2', after: {} }),
      event(1, { kind: 'node.delete', createdAt: new Date(T0 - 60_000).toISOString(), before: {} })
    ];
    expect(lastGesture(events, ME)?.items.map((item) => item.kind)).toEqual(['edge.create', 'node.create']);
  });

  it('drops events it cannot turn into an item', () => {
    expect(lastGesture([event(1, { kind: 'edge.create', nodeId: null, edgeId: 'e', after: null })], ME)).toBeNull();
  });
});

describe('a logged agent move', () => {
  it('is not an undo item: undo_last leaves moves to move_node', () => {
    const move = event(1, { before: { position: { x: 0, y: 0 } }, after: { position: { x: 9, y: 0 } } });
    expect(lastGesture([move], ME)).toBeNull();
  });
});

describe('agent changes: one row per agent gesture', () => {
  const at = (ms: number) => new Date(T0 + ms).toISOString();

  it('groups one agent writes made in the same instant, newest first, and leaves people out', () => {
    const events = [
      event(5, { createdAt: at(9000) }),
      event(4, { actorKind: 'user', agentKey: null, createdAt: at(8000) }),
      event(3, { createdAt: at(1000) }),
      event(2, { createdAt: at(500) }),
      event(1, { agentKey: 'sidebar', createdAt: at(400) })
    ];

    expect(agentChanges(events).map((change) => change.map((e) => e.id))).toEqual([[5], [3, 2], [1]]);
  });
});
