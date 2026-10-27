import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

const runs = vi.hoisted(() => [
  { id: 'r1', prompt: 'a cat', model: 'flux', params: { aspectRatio: '1:1' }, outputAssetId: 'asset-1', costUsd: 0.04, startedAt: '2026-10-01T00:00:00Z' },
  { id: 'r2', prompt: 'a dog', model: 'flux', params: { aspectRatio: '16:9' }, outputAssetId: 'asset-2', costUsd: 0.04, startedAt: '2026-10-02T00:00:00Z' }
]);
vi.mock('$lib/server/canvas/generate', async (original) => ({ ...(await original<object>()), runsOf: async () => runs }));

const { CANVAS_OPS } = await import('./canvas-ops');
const ctx = { db: fakeDb({}).db, orgId: 'o', projectId: 'p', userId: 'u' } as never;

describe('compare_runs — what changed between two versions of a node, for the chat and MCP', () => {
  it('returns both versions and the prompt and settings that differ', async () => {
    const out = await CANVAS_OPS.compare_runs.run(ctx, { nodeId: 'n', runA: 'r1', runB: 'r2' });

    expect(out).toMatchObject({
      a: { runId: 'r1', assetId: 'asset-1' },
      b: { runId: 'r2', assetId: 'asset-2' },
      diff: [
        { field: 'prompt', a: 'a cat', b: 'a dog' },
        { field: 'aspectRatio', a: '1:1', b: '16:9' }
      ]
    });
  });

  it('refuses a run the node does not have', async () => {
    const out = await CANVAS_OPS.compare_runs.run(ctx, { nodeId: 'n', runA: 'r1', runB: 'nope' });

    expect(out).toEqual({ error: 'run_not_found', message: 'Both runs must belong to the node (list_runs).' });
  });
});
