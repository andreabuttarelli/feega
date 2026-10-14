import { describe, expect, it } from 'vitest';
import { downstreamPlan, nodeOutputs, recentRuns, stalePlan, staleIds, type NodeOutput } from './run-graph';

const edge = (sourceNodeId: string, targetNodeId: string) => ({ sourceNodeId, targetNodeId });
const types = (entries: Record<string, string>) => new Map(Object.entries(entries));

describe('downstreamPlan', () => {
  it('runs the node, then every dependent in topological order', () => {
    const plan = downstreamPlan('a', [edge('a', 'b'), edge('b', 'c')], types({ a: 'text', b: 'image', c: 'video' }));

    expect(plan).toEqual({
      ok: true,
      steps: [
        { nodeId: 'a', dependsOn: [] },
        { nodeId: 'b', dependsOn: ['a'] },
        { nodeId: 'c', dependsOn: ['b'] }
      ]
    });
  });

  it('leaves upstream and unrelated nodes alone', () => {
    const plan = downstreamPlan('b', [edge('a', 'b'), edge('b', 'c'), edge('x', 'y')], types({ a: 'text', b: 'image', c: 'video', x: 'text', y: 'image' }));

    expect(plan.ok && plan.steps.map((s) => s.nodeId)).toEqual(['b', 'c']);
  });

  it('walks through nodes that do not generate, without running them', () => {
    const plan = downstreamPlan('a', [edge('a', 'doc'), edge('doc', 'c')], types({ a: 'text', doc: 'doc', c: 'image' }));

    expect(plan).toEqual({ ok: true, steps: [{ nodeId: 'a', dependsOn: [] }, { nodeId: 'c', dependsOn: ['a'] }] });
  });

  it('a node fed twice waits for both of its inputs', () => {
    const plan = downstreamPlan('a', [edge('a', 'b'), edge('a', 'c'), edge('b', 'd'), edge('c', 'd')], types({ a: 'text', b: 'text', c: 'image', d: 'video' }));

    expect(plan.ok && plan.steps.at(-1)).toEqual({ nodeId: 'd', dependsOn: ['b', 'c'] });
  });

  it('refuses a cycle', () => {
    const plan = downstreamPlan('a', [edge('a', 'b'), edge('b', 'a')], types({ a: 'text', b: 'text' }));

    expect(plan).toEqual({ ok: false, reason: 'The connections form a cycle' });
  });

  it('refuses when nothing downstream generates', () => {
    const plan = downstreamPlan('d', [], types({ d: 'doc' }));

    expect(plan.ok).toBe(false);
  });
});

describe('staleIds', () => {
  const out = (id: string, type: string, lastDoneAt: string | null): NodeOutput => ({ id, type, lastDoneAt });

  it('a result older than the result it was made from is stale', () => {
    const nodes = [out('a', 'text', '2026-10-02'), out('b', 'image', '2026-10-01')];

    expect(staleIds(nodes, [edge('a', 'b')])).toEqual(['b']);
  });

  it('a result newer than its inputs is fresh', () => {
    const nodes = [out('a', 'text', '2026-10-01'), out('b', 'image', '2026-10-02')];

    expect(staleIds(nodes, [edge('a', 'b')])).toEqual([]);
  });

  it('staleness flows down the chain', () => {
    const nodes = [out('a', 'text', '2026-10-03'), out('b', 'image', '2026-10-01'), out('c', 'video', '2026-10-02')];

    expect(staleIds(nodes, [edge('a', 'b'), edge('b', 'c')])).toEqual(['b', 'c']);
  });

  it('a node that never ran is not stale: it is new', () => {
    const nodes = [out('a', 'text', '2026-10-02'), out('b', 'image', null)];

    expect(staleIds(nodes, [edge('a', 'b')])).toEqual([]);
  });

  it('a cycle does not loop forever', () => {
    const nodes = [out('a', 'text', '2026-10-02'), out('b', 'text', '2026-10-01')];

    expect(staleIds(nodes, [edge('a', 'b'), edge('b', 'a')])).toContain('b');
  });

  it('stalePlan orders the stale nodes by their dependencies', () => {
    const nodes = [out('a', 'text', '2026-10-03'), out('b', 'image', '2026-10-01'), out('c', 'video', '2026-10-02')];

    expect(stalePlan(nodes, [edge('a', 'b'), edge('b', 'c')])).toEqual({
      ok: true,
      steps: [
        { nodeId: 'b', dependsOn: [] },
        { nodeId: 'c', dependsOn: ['b'] }
      ]
    });
  });
});

describe('nodeOutputs', () => {
  it('takes the latest finished success of each node', () => {
    const runs = {
      a: [
        { status: 'done', finishedAt: '2026-10-01' },
        { status: 'done', finishedAt: '2026-10-03' },
        { status: 'failed', finishedAt: '2026-10-04' }
      ]
    };

    expect(nodeOutputs([{ id: 'a', type: 'text' }, { id: 'b', type: 'image' }], runs)).toEqual([
      { id: 'a', type: 'text', lastDoneAt: '2026-10-03' },
      { id: 'b', type: 'image', lastDoneAt: null }
    ]);
  });
});

describe('recentRuns', () => {
  it('lists the newest runs across nodes, with node name, status and cost', () => {
    const runs = {
      a: [{ id: 'r1', status: 'done', startedAt: '2026-10-01', costUsd: 0.02 }],
      b: [{ id: 'r2', status: 'running', startedAt: '2026-10-02', costUsd: null }]
    };

    expect(recentRuns(runs, new Map([['a', 'Hook'], ['b', 'Cover']]), 1)).toEqual([
      { id: 'r2', nodeId: 'b', name: 'Cover', status: 'running', startedAt: '2026-10-02', costUsd: null }
    ]);
  });
});
