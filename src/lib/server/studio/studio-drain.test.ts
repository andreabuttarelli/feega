import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemStatus } from '$lib/studio/batch-state';

const item = (id: string, genNodeId: string, attempts = 0) => ({
  id,
  orgId: 'org',
  batchId: 'b',
  genNodeId,
  productIndex: 2,
  productTitle: 'Shirt',
  influencerId: null,
  environment: 'white_ecom',
  shot: 'packshot',
  variation: 1,
  preview: false,
  model: 'lite',
  status: ItemStatus.Queued,
  attempts,
  error: null,
  assetId: null,
  nodeRunId: null,
  approval: 'pending',
  updatedAt: new Date().toISOString()
});

const repo = vi.hoisted(() => ({
  dueItems: vi.fn(),
  runningItems: vi.fn(async () => []),
  findBatch: vi.fn(async () => ({ id: 'b', projectId: 'p', canvasId: 'c', productsNodeId: 'products', actorId: 'user' })),
  moveItems: vi.fn()
}));
const engine = vi.hoisted(() => ({ runGenNode: vi.fn() }));

vi.mock('$lib/server/repos/product-batches', () => repo);
vi.mock('$lib/server/canvas/generate', () => engine);
vi.mock('$lib/server/repos/canvas', () => ({ findNode: vi.fn(async (_db, { nodeId }) => ({ id: nodeId, version: 7, data: { prompt: 'locked', params: { aspectRatio: '3:4' } } })) }));

const { drainStudio } = await import('./studio-drain');

function patchesFor(id: string) {
  return repo.moveItems.mock.calls.map(([, input]) => input).filter((input) => input.itemIds[0] === id);
}

describe('drainStudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.moveItems.mockImplementation(async (_db, input) => {
      const queued = (await repo.dueItems.mock.results[0].value) as ReturnType<typeof item>[];
      const claimed = queued.find((q) => q.id === input.itemIds[0])!;
      return input.from.includes(ItemStatus.Queued) ? [{ ...claimed, attempts: input.patch.attempts }] : [];
    });
  });

  it('gira ogni item col motore vero, sul suo nodo, vedendo solo il suo prodotto', async () => {
    repo.dueItems.mockResolvedValue([item('a', 'n1')]);
    engine.runGenNode.mockResolvedValue({ kind: 'done', asset: { id: 'asset' }, run: { id: 'run' } });

    const out = await drainStudio({} as never);

    expect(out).toMatchObject({ claimed: 1, done: 1 });
    expect(engine.runGenNode).toHaveBeenCalledWith({}, expect.objectContaining({ nodeId: 'n1', expectedVersion: 7, model: 'lite', iterateSelection: { products: 2 }, actor: { kind: 'agent', id: 'user', agentKey: 'studio' } }));
    expect(patchesFor('a').at(-1)!.patch).toMatchObject({ status: ItemStatus.Done, asset_id: 'asset', node_run_id: 'run' });
  });

  it('un errore transitorio torna in coda con attesa; un blocco di moderazione no', async () => {
    repo.dueItems.mockResolvedValue([item('t', 'n1'), item('m', 'n2')]);
    engine.runGenNode.mockImplementation(async (_db, run) =>
      run.nodeId === 'n1' ? { kind: 'refused', error: 'provider 503' } : { kind: 'refused', error: 'Refused: unsafe' }
    );

    const out = await drainStudio({} as never);

    expect(out).toMatchObject({ requeued: 1, blocked: 1 });
    expect(patchesFor('t').at(-1)!.patch).toMatchObject({ status: ItemStatus.Queued, error: 'provider 503' });
    expect(patchesFor('m').at(-1)!.patch).toMatchObject({ status: ItemStatus.Blocked });
  });

  it('due item della stessa cella non girano insieme', async () => {
    repo.dueItems.mockResolvedValue([item('a', 'same'), item('b', 'same')]);
    engine.runGenNode.mockResolvedValue({ kind: 'done', asset: { id: 'x' }, run: { id: 'r' } });

    const out = await drainStudio({} as never);

    expect(out.claimed).toBe(1);
  });
});
