import { describe, expect, it } from 'vitest';
import { OptimisticAction, optimisticOp, requestOf, restoreCanvas, type CanvasRows, type OptEdge, type OptTile } from './optimistic-registry';
import { OpOutcome, createOptimistic } from './optimistic-ops';
import { Stack } from './stacking';
import { SECTION_TYPE } from './section';
import { layoutOf } from './node-layout';
import type { CanvasNodeRecord } from '$lib/server/repos/canvas';
import type { UndoItem } from './undo-plan';

const tile = (id: string, x = 0): OptTile => ({ id, type: 'motion', displayName: id, x, y: 0, w: 100, h: 100, data: { kind: 'element' }, version: 1 });
const edge = (id: string): OptEdge => ({ id, source: 'a', target: 'b', mode: 'fixed' });
const ctx = { toTile: (r: CanvasNodeRecord): OptTile => ({ id: r.id, type: r.type, displayName: r.displayName, x: r.position.x, y: r.position.y, w: r.size.width ?? 0, h: r.size.height ?? 0, data: r.data, version: r.version }) };
const copy = (id: string, version = 0): CanvasNodeRecord => ({ id, canvasId: 'c', projectId: 'p', type: 'motion', displayName: null, position: { x: 32, y: 32, z: 0 }, size: { width: 100, height: 100 }, data: { docHeadRevision: 1 }, version });
const duplicated = { ids: ['a'], copies: [copy('a2')], copyIds: { a: 'a2' } };
const uploaded = { record: { ...copy('up'), type: 'pending' }, fields: { path: 'p/up.png', node_id: 'up' } };
const carried = { fields: { source: 'a', clip: 'txt', ids: '["k1"]' }, made: copy('m'), gone: 'a' };
const start = (): CanvasRows<OptTile, OptEdge> => ({ nodes: [tile('a'), tile('b', 200)], edges: [edge('e')] });

type Sent = { action: string; fields: Record<string, string> };

function runner(answer: Record<string, unknown> | null) {
  let rows = start();
  const sent: Sent[] = [];
  const undo: (UndoItem[] | null)[] = [];
  const run = createOptimistic<CanvasRows<OptTile, OptEdge>>(
    {
      read: () => rows,
      write: (next) => { rows = next; },
      reserve: () => (items) => { undo.push(items); },
      hold: () => () => {},
      idle: () => {},
      notice: () => {}
    },
    restoreCanvas
  );
  const post = async (action: string, fields: Record<string, string>) => {
    sent.push({ action, fields });
    return answer;
  };
  return { run, rows: () => rows, sent, undo, post };
}

describe('optimistic registry: every action says how it looks before the server answers', () => {
  it('wrap with stack shows a container holding the picked tiles', () => {
    const op = optimisticOp(OptimisticAction.Stack, { ids: ['a', 'b'], id: 's' }, start(), ctx, async () => null);
    const shown = op.apply(start());
    expect(shown.nodes.map((n) => n.id)).toEqual(['s', 'a', 'b']);
    expect(shown.nodes.filter((n) => n.id !== 's').every((n) => layoutOf(n.data).groupId === 's')).toBe(true);
  });

  it('wrap in a section puts a section behind the picked tiles', () => {
    const shown = optimisticOp(OptimisticAction.Section, { ids: ['a', 'b'], id: 'sec' }, start(), ctx, async () => null).apply(start());
    expect(shown.nodes[0]).toMatchObject({ id: 'sec', type: SECTION_TYPE });
    expect(shown.nodes.slice(1).every((n) => layoutOf(n.data).groupId === 'sec')).toBe(true);
  });

  it('a free element dropped on a frame leaves the canvas', () => {
    const shown = optimisticOp(OptimisticAction.MoveFree, { id: 'a', frameId: 'f', at: { x: 0.5, y: 0.5 } }, start(), ctx, async () => null).apply(start());
    expect(shown.nodes.map((n) => n.id)).toEqual(['b']);
  });

  it('bring to front reorders, rename renames, wire mode flips', () => {
    expect(optimisticOp(OptimisticAction.Restack, { ids: ['a'], to: Stack.Front }, start(), ctx, async () => null).apply(start()).nodes.map((n) => n.id)).toEqual(['b', 'a']);
    expect(optimisticOp(OptimisticAction.Rename, { id: 'a', name: '  Hero ' }, start(), ctx, async () => null).apply(start()).nodes[0].displayName).toBe('Hero');
    expect(optimisticOp(OptimisticAction.EdgeMode, { connectionId: 'e', mode: 'iterate' }, start(), ctx, async () => null).apply(start()).edges[0].mode).toBe('iterate');
  });

  it('duplicate shows the copies, picked, under the ids the server will give them', () => {
    const shown = optimisticOp(OptimisticAction.Duplicate, duplicated, start(), ctx, async () => null).apply(start());
    expect(shown.nodes.map((n) => [n.id, n.select ?? false])).toEqual([['a', false], ['b', false], ['a2', true]]);
  });

  it('scaling a group scales its members around its corner, and pins their height', () => {
    const rows: CanvasRows<OptTile, OptEdge> = { nodes: [{ ...tile('g'), data: { kind: 'group' } }, { ...tile('a', 50), data: { kind: 'element', groupId: 'g' }, w: 50, h: 50 }], edges: [] };
    const op = optimisticOp(OptimisticAction.ScaleGroup, { id: 'g', width: 200, height: 200 }, rows, ctx, async () => null);

    expect(op.apply(rows).nodes.map(({ id, x, w, h, userHeight }) => ({ id, x, w, h, userHeight }))).toEqual([
      { id: 'g', x: 0, w: 200, h: 200, userHeight: 200 },
      { id: 'a', x: 100, w: 100, h: 100, userHeight: 100 }
    ]);
    expect(op.touched.nodes).toEqual(['g', 'a']);
  });

  it('restoring a run shows its media on the node', () => {
    const shown = optimisticOp(OptimisticAction.RestoreRun, { id: 'a', runId: 'r1', mediaId: 'm1' }, start(), ctx, async () => null).apply(start());
    expect(shown.nodes[0].data).toMatchObject({ refId: 'm1', runId: 'r1' });
  });

  it('an element carried out of a frame shows its new tile, picked, and an emptied element leaves', () => {
    const shown = optimisticOp(OptimisticAction.MoveElement, carried, start(), ctx, async () => null).apply(start());
    expect(shown.nodes.map((n) => [n.id, n.select ?? false])).toEqual([['b', false], ['m', true]]);
  });

  it('a carry sends the fields it was given, ids included', async () => {
    const t = runner({ outcome: 'done', undo: [] });
    await t.run(optimisticOp(OptimisticAction.CopyElement, carried, t.rows(), ctx, t.post));
    expect(t.sent).toEqual([{ action: 'copyElement', fields: carried.fields }]);
  });

  it('an upload shows its tile at once and becomes the stored node when it lands', async () => {
    const t = runner({ asset: { id: 'as' }, node: { ...copy('up'), type: 'image', version: 1 } });
    const op = optimisticOp(OptimisticAction.Upload, uploaded, t.rows(), ctx, t.post);

    expect(op.apply(t.rows()).nodes.map((n) => [n.id, n.type, n.select ?? false])).toEqual([['a', 'motion', false], ['b', 'motion', false], ['up', 'pending', true]]);
    await t.run(op);
    expect(t.rows().nodes.at(-1)).toMatchObject({ id: 'up', type: 'image', version: 1 });
    expect(t.undo[0]?.map((i) => i.kind)).toEqual(['node.create']);
  });

  it('names the request an op will send before it is sent, so it can be kept for a reload', () => {
    expect(requestOf(OptimisticAction.Rename, { id: 'a', name: 'Hero' })).toEqual({ action: 'rename', fields: { node_id: 'a', name: 'Hero' } });
  });

  it('delete takes nodes and wires away', () => {
    const shown = optimisticOp(OptimisticAction.Remove, { nodeIds: ['a'], edgeIds: ['e'] }, start(), ctx, async () => null).apply(start());
    expect(shown).toEqual({ nodes: [tile('b', 200)], edges: [] });
  });
});

describe('optimistic registry: a refusal puts the canvas back', () => {
  for (const [action, input] of [
    [OptimisticAction.Stack, { ids: ['a', 'b'], id: 's' }],
    [OptimisticAction.Section, { ids: ['a', 'b'], id: 'sec' }],
    [OptimisticAction.Group, { ids: ['a', 'b'], id: 'g' }],
    [OptimisticAction.MoveFree, { id: 'a', frameId: 'f', at: { x: 0.5, y: 0.5 } }],
    [OptimisticAction.Restack, { ids: ['a'], to: Stack.Front }],
    [OptimisticAction.Rename, { id: 'a', name: 'x' }],
    [OptimisticAction.EdgeMode, { connectionId: 'e', mode: 'iterate' }],
    [OptimisticAction.Remove, { nodeIds: ['a'], edgeIds: ['e'] }],
    [OptimisticAction.Duplicate, duplicated],
    [OptimisticAction.MoveElement, carried],
    [OptimisticAction.PlaceComponent, carried],
    [OptimisticAction.CopyFree, carried],
    [OptimisticAction.InsertScene, carried],
    [OptimisticAction.CombineScenes, carried],
    [OptimisticAction.LayersToFrame, carried],
    [OptimisticAction.Upload, uploaded],
    [OptimisticAction.ScaleGroup, { id: 'a', width: 300, height: 300 }],
    [OptimisticAction.RestoreRun, { id: 'a', runId: 'r', mediaId: 'm' }]
  ] as const) {
    it(`${action} rolls back`, async () => {
      const t = runner(null);
      const outcome = await t.run(optimisticOp(action, input as never, t.rows(), ctx, t.post));
      expect(outcome).toBe(OpOutcome.RolledBack);
      expect(t.rows()).toEqual(start());
      expect(t.undo).toEqual([null]);
    });
  }

  it('a duplicate the server wrote nothing for is a refusal', async () => {
    const t = runner({ nodes: [], connections: [] });
    expect(await t.run(optimisticOp(OptimisticAction.Duplicate, duplicated, t.rows(), ctx, t.post))).toBe(OpOutcome.RolledBack);
    expect(t.rows()).toEqual(start());
  });

  it('a moved answer that is not done is a refusal', async () => {
    const t = runner({ outcome: 'invalid' });
    expect(await t.run(optimisticOp(OptimisticAction.Stack, { ids: ['a', 'b'], id: 's' }, t.rows(), ctx, t.post))).toBe(OpOutcome.RolledBack);
    expect(t.rows()).toEqual(start());
  });
});

describe('optimistic registry: a landing records the gesture', () => {
  it('a server action lands the undo the server returned', async () => {
    const item: UndoItem = { kind: 'node.create', nodeId: 's', after: {} };
    const t = runner({ outcome: 'done', undo: [item] });
    await t.run(optimisticOp(OptimisticAction.Stack, { ids: ['a', 'b'], id: 's' }, t.rows(), ctx, t.post));
    expect(t.sent).toEqual([{ action: 'stackElements', fields: { ids: '["a","b"]', node_id: 's' } }]);
    expect(t.undo).toEqual([[item]]);
  });

  it('delete lands an undo built from the rows it took away', async () => {
    const t = runner({ removed: true });
    await t.run(optimisticOp(OptimisticAction.Remove, { nodeIds: ['a'], edgeIds: ['e'] }, t.rows(), ctx, t.post));
    expect(t.sent).toEqual([{ action: 'remove', fields: { node_ids: 'a', connection_ids: 'e' } }]);
    expect(t.undo[0]?.map((i) => i.kind)).toEqual(['edge.delete', 'node.delete']);
  });

  it('a duplicate lands its copies as created, and takes the saved rows in their place', async () => {
    const t = runner({ nodes: [copy('a2', 1)], connections: [] });
    await t.run(optimisticOp(OptimisticAction.Duplicate, { ...duplicated, offset: { dx: 32, dy: 32 } }, t.rows(), ctx, t.post));
    expect(t.sent).toEqual([{ action: 'duplicate', fields: { node_ids: 'a', copy_ids: '{"a":"a2"}', dx: '32', dy: '32' } }]);
    expect(t.undo[0]?.map((i) => i.kind)).toEqual(['node.create']);
    expect(t.rows().nodes.find((n) => n.id === 'a2')?.version).toBe(1);
  });

  it('a duplicate shown only once saved appears when the server answers', async () => {
    const t = runner({ nodes: [copy('a2', 1)], connections: [] });
    await t.run(optimisticOp(OptimisticAction.Duplicate, { ...duplicated, copies: [] }, t.rows(), ctx, t.post));
    expect(t.rows().nodes.map((n) => n.id)).toEqual(['a', 'b', 'a2']);
  });
});
