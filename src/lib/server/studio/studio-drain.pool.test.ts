import { describe, expect, it, vi } from 'vitest';
import { ItemStatus } from '$lib/studio/batch-state';

type Row = { id: string; orgId: string; batchId: string; genNodeId: string; productIndex: number; model: string; status: ItemStatus; attempts: number; nextAttemptAt: number; updatedAt: string };

const store = vi.hoisted(() => ({ rows: [] as Row[] }));

const repo = vi.hoisted(() => ({
  dueItems: vi.fn(async (_db: unknown, scope: { limit: number }) =>
    store.rows.filter((r) => r.status === 'queued' && r.nextAttemptAt <= Date.now()).slice(0, scope.limit).map((r) => ({ ...r }))
  ),
  runningItems: vi.fn(async () => store.rows.filter((r) => r.status === 'running').map((r) => ({ ...r }))),
  findBatch: vi.fn(async () => ({ id: 'b', projectId: 'p', canvasId: 'c', productsNodeId: 'products', actorId: 'user' })),
  moveItems: vi.fn(async (_db: unknown, input: { itemIds: string[]; from: string[]; patch: Record<string, unknown> }) => {
    const moved: Row[] = [];
    for (const row of store.rows) {
      if (!input.itemIds.includes(row.id) || !input.from.includes(row.status)) {
        continue;
      }
      const { next_attempt_at, ...rest } = input.patch;
      Object.assign(row, rest, next_attempt_at ? { nextAttemptAt: Date.parse(String(next_attempt_at)) } : {});
      moved.push({ ...row });
    }
    return moved;
  })
}));
const engine = vi.hoisted(() => ({ runGenNode: vi.fn() }));

vi.mock('$lib/server/repos/product-batches', () => repo);
vi.mock('$lib/server/canvas/generate', () => engine);
vi.mock('$lib/server/repos/canvas', () => ({ findNode: vi.fn(async (_db, { nodeId }) => ({ id: nodeId, version: 1, data: { prompt: 'locked' } })) }));

const { drainStudio } = await import('./studio-drain');

const PROVIDER_MS = 1000;
const DONE = { kind: 'done', asset: { id: 'a' }, run: { id: 'r' } };
const NO_IMAGE = { kind: 'refused', error: 'no image returned' };

function seed(count: number): void {
  store.rows = Array.from({ length: count }, (_, i) => ({
    id: `i${i}`,
    orgId: 'org',
    batchId: 'b',
    genNodeId: `n${i}`,
    productIndex: 1,
    model: 'nano-banana-2-lite',
    status: ItemStatus.Queued,
    attempts: 0,
    nextAttemptAt: 0,
    updatedAt: new Date().toISOString()
  }));
}

function after(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('drainStudio in parallelo', () => {
  it('12 foto da 1 s ciascuna finiscono in circa 2 s, non 12', async () => {
    seed(12);
    engine.runGenNode.mockReset();
    engine.runGenNode.mockImplementation(async () => {
      await after(PROVIDER_MS);
      return DONE;
    });

    const started = Date.now();
    const out = await drainStudio({} as never, { batchId: 'b' });
    const elapsed = Date.now() - started;

    expect(out.done).toBe(12);
    expect(elapsed).toBeLessThan(2.5 * PROVIDER_MS);
    expect(store.rows.every((r) => r.status === ItemStatus.Done)).toBe(true);
  }, 10_000);

  it('non supera mai 8 foto insieme', async () => {
    seed(12);
    let live = 0;
    let peak = 0;
    engine.runGenNode.mockReset();
    engine.runGenNode.mockImplementation(async () => {
      live++;
      peak = Math.max(peak, live);
      await after(50);
      live--;
      return DONE;
    });

    await drainStudio({} as never, { batchId: 'b' });

    expect(peak).toBe(8);
  });

  it('una foto fallita riprova una volta da sola, nello stesso giro', async () => {
    seed(1);
    engine.runGenNode.mockReset();
    engine.runGenNode.mockResolvedValueOnce(NO_IMAGE).mockResolvedValueOnce(DONE);

    await drainStudio({} as never, { batchId: 'b' });

    expect(engine.runGenNode).toHaveBeenCalledTimes(2);
    expect(store.rows[0]).toMatchObject({ status: ItemStatus.Done, attempts: 2 });
  });

  it('dopo il secondo fallimento si ferma', async () => {
    seed(1);
    engine.runGenNode.mockReset();
    engine.runGenNode.mockResolvedValue(NO_IMAGE);

    await drainStudio({} as never, { batchId: 'b' });

    expect(engine.runGenNode).toHaveBeenCalledTimes(2);
    expect(store.rows[0].status).toBe(ItemStatus.Failed);
  });
});
