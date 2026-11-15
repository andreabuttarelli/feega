import { describe, expect, it } from 'vitest';
import { OptimisticAction, optimisticOp, type OptEdge, type OptTile } from './optimistic-registry';
import { counted } from './counted-list.testkit';

const SIZE = 2000;
const tile = (id: string): OptTile => ({ id, type: 'motion', displayName: id, x: 0, y: 0, w: 100, h: 100, data: {}, version: 1 });
const edge = (id: string): OptEdge => ({ id, source: 'a', target: 'b', mode: 'fixed' });
const ids = (prefix: string) => Array.from({ length: SIZE }, (_, i) => `${prefix}${i}`);
const rows = () => ({ nodes: ids('n').map(tile), edges: ids('e').map(edge) });
const ctx = { toTile: (): OptTile => tile('x') };

describe('optimistic registry scans each id list once, not once per row', () => {
  it('remove looks no id up with a list scan', () => {
    const nodeIds = counted(ids('n'));
    const edgeIds = counted(ids('e'));
    const op = optimisticOp(OptimisticAction.Remove, { nodeIds, edgeIds }, rows(), ctx, async () => null);

    const shown = op.apply(rows());

    expect(shown.nodes).toHaveLength(0);
    expect(nodeIds.scans() + edgeIds.scans()).toBe(0);
  });

  it('remove builds its undo without a list scan', () => {
    const nodeIds = counted(ids('n'));
    const edgeIds = counted(ids('e'));
    const op = optimisticOp(OptimisticAction.Remove, { nodeIds, edgeIds }, rows(), ctx, async () => ({}));

    const undo = op.undo({}, rows());

    expect(undo).toHaveLength(SIZE * 2);
    expect(nodeIds.scans() + edgeIds.scans()).toBe(0);
  });

  it('edge tie looks no id up with a list scan', () => {
    const connectionIds = counted(ids('e'));
    const op = optimisticOp(OptimisticAction.EdgeTie, { connectionIds, tie: null }, rows(), ctx, async () => null);

    op.apply(rows());

    expect(connectionIds.scans()).toBe(0);
  });
});
