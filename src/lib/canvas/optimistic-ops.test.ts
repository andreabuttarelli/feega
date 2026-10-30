import { describe, expect, it } from 'vitest';
import { OpOutcome, createOptimistic, restoreRows, type OptimisticPort } from './optimistic-ops';
import type { UndoItem } from './undo-plan';

type Row = { id: string; name: string };
type State = { nodes: Row[]; edges: Row[] };

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

function harness(start: State) {
  let state = start;
  const reserved: (UndoItem[] | null | 'pending')[] = [];
  const notices: string[] = [];
  let holds = 0;
  let idles = 0;
  const port: OptimisticPort<State> = {
    read: () => state,
    write: (next) => { state = next; },
    reserve: () => {
      const at = reserved.push('pending') - 1;
      return (items) => { reserved[at] = items; };
    },
    hold: () => {
      holds += 1;
      return () => { holds -= 1; };
    },
    idle: () => { idles += 1; },
    notice: (text) => notices.push(text)
  };
  const run = createOptimistic(port, (current, before, touched) => ({ nodes: restoreRows(current.nodes, before.nodes, touched.nodes), edges: restoreRows(current.edges, before.edges, touched.edges) }));
  return { run, state: () => state, reserved, notices, holds: () => holds, idles: () => idles };
}

const rename = (id: string, name: string) => (s: State): State => ({ ...s, nodes: s.nodes.map((n) => (n.id === id ? { ...n, name } : n)) });
const ITEM: UndoItem = { kind: 'node.delete', nodeId: 'a', before: {} };

describe('optimistic ops: the screen changes first, the server catches up', () => {
  it('applies the change before the server answers', () => {
    const t = harness({ nodes: [{ id: 'a', name: 'old' }], edges: [] });
    const answer = deferred<{ undo: UndoItem[] } | null>();

    void t.run({ apply: rename('a', 'new'), touched: { nodes: ['a'], edges: [] }, send: () => answer.promise, undo: (a) => a.undo, notice: 'Rename undone' });

    expect(t.state().nodes[0].name).toBe('new');
    expect(t.reserved).toEqual(['pending']);
    expect(t.holds()).toBe(1);
  });

  it('lands the undo slot it reserved with what the server returned', async () => {
    const t = harness({ nodes: [{ id: 'a', name: 'old' }], edges: [] });

    const outcome = await t.run({ apply: rename('a', 'new'), touched: { nodes: ['a'], edges: [] }, send: async () => ({ undo: [ITEM] }), undo: (a) => a.undo, notice: 'Rename undone' });

    expect(outcome).toBe(OpOutcome.Landed);
    expect(t.reserved).toEqual([[ITEM]]);
    expect(t.holds()).toBe(0);
    expect(t.idles()).toBe(1);
  });

  it('rolls back only what the op touched, and says so, when the server refuses', async () => {
    const t = harness({ nodes: [{ id: 'a', name: 'old' }, { id: 'b', name: 'b' }], edges: [] });
    const answer = deferred<{ undo: UndoItem[] } | null>();

    const ran = t.run({ apply: rename('a', 'new'), touched: { nodes: ['a'], edges: [] }, send: () => answer.promise, undo: (a) => a.undo, notice: 'Rename undone' });
    t.state().nodes[1] = { id: 'b', name: 'edited meanwhile' };
    answer.resolve(null);

    expect(await ran).toBe(OpOutcome.RolledBack);
    expect(t.state().nodes).toEqual([{ id: 'a', name: 'old' }, { id: 'b', name: 'edited meanwhile' }]);
    expect(t.reserved).toEqual([null]);
    expect(t.notices).toEqual(['Rename undone']);
  });

  it('treats a network throw as a refusal', async () => {
    const t = harness({ nodes: [{ id: 'a', name: 'old' }], edges: [] });

    const outcome = await t.run({ apply: rename('a', 'new'), touched: { nodes: ['a'], edges: [] }, send: () => Promise.reject(new Error('offline')), undo: () => [], notice: 'Rename undone' });

    expect(outcome).toBe(OpOutcome.RolledBack);
    expect(t.state().nodes[0].name).toBe('old');
  });

  it('sends ops one at a time, in the order they were made, and idles once', async () => {
    const t = harness({ nodes: [{ id: 'a', name: '0' }], edges: [] });
    const sent: string[] = [];
    const first = deferred<{ undo: UndoItem[] } | null>();

    const one = t.run({ apply: rename('a', '1'), touched: { nodes: ['a'], edges: [] }, send: () => { sent.push('1'); return first.promise; }, undo: () => [], notice: '' });
    const two = t.run({ apply: rename('a', '2'), touched: { nodes: ['a'], edges: [] }, send: async () => { sent.push('2'); return { undo: [] }; }, undo: () => [], notice: '' });
    await Promise.resolve();

    expect(t.state().nodes[0].name).toBe('2');
    expect(sent).toEqual(['1']);
    expect(t.holds()).toBe(2);

    first.resolve({ undo: [] });
    await Promise.all([one, two]);
    expect(sent).toEqual(['1', '2']);
    expect(t.idles()).toBe(1);
    expect(t.holds()).toBe(0);
  });

  it('reconciles what the server settled once it answers', async () => {
    const t = harness({ nodes: [{ id: 'tmp', name: 'x' }], edges: [] });

    await t.run({
      apply: (s) => s,
      touched: { nodes: ['tmp'], edges: [] },
      send: async () => ({ undo: [], id: 'real' }),
      undo: () => [],
      settle: (s, a) => ({ ...s, nodes: s.nodes.map((n) => (n.id === 'tmp' ? { ...n, id: a.id } : n)) }),
      notice: ''
    });

    expect(t.state().nodes[0].id).toBe('real');
  });
});

describe('restoreRows: a rollback puts back what was there, where it was', () => {
  it('re-adds a removed row at its old place', () => {
    const before = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(restoreRows([{ id: 'a' }, { id: 'c' }], before, ['b'])).toEqual(before);
  });

  it('drops a row the op added', () => {
    expect(restoreRows([{ id: 'g' }, { id: 'a' }], [{ id: 'a' }], ['g'])).toEqual([{ id: 'a' }]);
  });

  it('puts a reordered row back in its slot', () => {
    expect(restoreRows([{ id: 'b' }, { id: 'c' }, { id: 'a' }], [{ id: 'a' }, { id: 'b' }, { id: 'c' }], ['a'])).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  });
});
