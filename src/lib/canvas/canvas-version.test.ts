import { describe, expect, it } from 'vitest';
import { planCanvasRestore, snapshotSchema, type CanvasSnapshot } from './canvas-version';

const node = (id: string, x = 0) => ({ id, type: 'text', position: { x, y: 0, z: 0 }, size: { width: 100, height: 50 }, data: { prompt: id } });
const edge = (id: string, a: string, b: string) => ({ id, sourceNodeId: a, targetNodeId: b });

const saved: CanvasSnapshot = {
  nodes: [node('a', 10), node('b'), { ...node('f'), type: 'motion' }],
  connections: [edge('e1', 'a', 'b')],
  heads: { f: { version: 3, doc: { tracks: [] } } }
};

describe('restoring a named canvas version', () => {
  it('brings back what was there, moves what moved, removes what came after', () => {
    const now: CanvasSnapshot = { nodes: [node('a', 99), node('c'), { ...node('f'), type: 'motion' }], connections: [edge('e2', 'a', 'c')], heads: { f: { version: 7, doc: {} } } };
    const plan = planCanvasRestore(now, saved);
    expect(plan.put.map((n) => n.id).sort()).toEqual(['a', 'b']);
    expect(plan.remove).toEqual(['c']);
    expect(plan.reconnect).toEqual(['e1']);
    expect(plan.disconnect).toEqual(['e2']);
    expect(plan.docs).toEqual([{ nodeId: 'f', doc: { tracks: [] } }]);
  });

  it('touches nothing that is already as it was', () => {
    const plan = planCanvasRestore(saved, saved);
    expect(plan).toEqual({ put: [], remove: [], reconnect: [], disconnect: [], docs: [] });
  });

  it('a stored snapshot is checked before it is trusted', () => {
    expect(snapshotSchema.safeParse(saved).success).toBe(true);
    expect(snapshotSchema.safeParse({ nodes: 'x' }).success).toBe(false);
  });
});
