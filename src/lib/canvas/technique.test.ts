import { describe, expect, it } from 'vitest';
import { packageTechnique, techniquePlan, withInputs, type Technique } from './technique';

const node = (id: string, type: string, x: number, y: number, data: Record<string, unknown> = {}) => ({ id, type, x, y, data });
const edge = (source: string, target: string) => ({ id: `${source}-${target}`, source, target, sourceHandle: 'derives_from', targetHandle: 'text' });

const nodes = [
  node('a', 'text', 400, 300, { prompt: 'idea', running: true }),
  node('b', 'image', 800, 300, { prompt: 'picture' }),
  node('c', 'video', 1200, 500, { prompt: 'clip' }),
  node('z', 'text', 0, 0)
];
const edges = [edge('a', 'b'), edge('b', 'c')];

describe('packageTechnique', () => {
  const packaged = packageTechnique({ ids: ['a', 'b', 'c'], nodes, edges });

  it('keeps the selected nodes and the edges inside them, moved to the origin', () => {
    if (!packaged.ok) {
      throw new Error(packaged.reason);
    }

    expect(packaged.technique.plan.nodes.map((n) => [n.type, n.x, n.y])).toEqual([['text', 0, 0], ['image', 400, 0], ['video', 800, 200]]);
    expect(packaged.technique.plan.edges).toHaveLength(2);
  });

  it('drops the run state of the source nodes', () => {
    if (!packaged.ok) {
      throw new Error(packaged.reason);
    }

    expect(packaged.technique.plan.nodes[0].data).toEqual({ prompt: 'idea' });
  });

  it('declares the nodes nothing feeds as inputs and the ones that feed nothing as outputs', () => {
    if (!packaged.ok) {
      throw new Error(packaged.reason);
    }

    expect(packaged.technique.inputs).toEqual([{ node: 0, type: 'text' }]);
    expect(packaged.technique.outputs).toEqual([{ node: 2, type: 'video' }]);
  });

  it('refuses a single node', () => {
    expect(packageTechnique({ ids: ['a'], nodes, edges })).toEqual({ ok: false, reason: 'Select at least two nodes' });
  });

  it('refuses a selection that is not one connected flow', () => {
    expect(packageTechnique({ ids: ['a', 'z'], nodes, edges })).toEqual({ ok: false, reason: 'The selected nodes are not all connected' });
  });

  it('refuses a cycle', () => {
    const cyclic = packageTechnique({ ids: ['a', 'b'], nodes, edges: [edge('a', 'b'), edge('b', 'a')] });

    expect(cyclic).toEqual({ ok: false, reason: 'The connections form a cycle' });
  });
});

describe('techniquePlan', () => {
  const technique: Technique = {
    plan: { nodes: [{ sourceIndex: 0, type: 'text', data: {}, x: 0, y: 0 }, { sourceIndex: 1, type: 'image', data: {}, x: 400, y: 0 }], edges: [{ sourceIndex: 0, targetIndex: 1, sourceHandle: null, targetHandle: 'text' }] },
    inputs: [{ node: 0, type: 'text' }],
    outputs: [{ node: 1, type: 'image' }]
  };

  it('places the flow at the given point', () => {
    expect(techniquePlan(technique, { x: 100, y: 50 }).nodes.map((n) => [n.x, n.y])).toEqual([[100, 50], [500, 50]]);
  });

  it('does not touch the stored plan', () => {
    techniquePlan(technique, { x: 100, y: 50 });

    expect(technique.plan.nodes[0].x).toBe(0);
  });
});

describe('withInputs', () => {
  const plan = { nodes: [{ sourceIndex: 0, type: 'text', data: { prompt: 'old' }, x: 0, y: 0 }, { sourceIndex: 1, type: 'doc', data: { content: 'old', public: false }, x: 0, y: 0 }], edges: [] };

  it('writes the value as the prompt of a generation node and as the content of a doc', () => {
    const out = withInputs(plan, [{ node: 0, value: 'new prompt' }, { node: 1, value: 'new notes' }]);

    expect(out.nodes[0].data).toEqual({ prompt: 'new prompt' });
    expect(out.nodes[1].data).toEqual({ content: 'new notes', public: false });
  });

  it('ignores a slot that is not in the plan', () => {
    expect(withInputs(plan, [{ node: 9, value: 'x' }])).toEqual(plan);
  });
});

describe('withInputs media slots', () => {
  it('puts an image slot value in the url of that node', () => {
    const plan = { nodes: [{ sourceIndex: 0, type: 'image', x: 0, y: 0, width: 1, height: 1, data: {} }], edges: [] } as never;

    const out = withInputs(plan, [{ node: 0, value: 'https://x/i.png' }]);

    expect(out.nodes[0].data).toMatchObject({ url: 'https://x/i.png' });
  });
});
