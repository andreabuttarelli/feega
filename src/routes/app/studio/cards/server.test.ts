import { describe, expect, it, vi } from 'vitest';

const toolScope = vi.fn(async () => ({ db: {}, orgId: 'org', projectId: 'p1', userId: 'u1' }));
const batchScope = vi.fn(async () => ({ db: {}, orgId: 'org', projectId: 'p1', userId: 'u1', batch: { id: 'b1', orgId: 'org', name: 'Autumn', status: 'running' } }));
vi.mock('$lib/server/dashboard/tool-scope', () => ({ toolScope, batchScope }));

const listBatches = vi.fn(async () => [{ id: 'b1', name: 'Autumn', status: 'running', createdAt: '2026-10-03' }]);
vi.mock('$lib/server/repos/product-batches', () => ({ listBatches, listItems: vi.fn(async () => []) }));
vi.mock('$lib/server/studio/studio-media', () => ({ signedAssets: vi.fn(async () => ({ assets: new Map(), urls: {} })) }));

describe('what a studio batch node reads from the studio', () => {
  it('the batch picker lists the batches of the canvas project', async () => {
    const { GET } = await import('./+server');
    const response = await GET({} as never);

    expect(await response.json()).toEqual([{ id: 'b1', name: 'Autumn', status: 'running' }]);
    expect(listBatches).toHaveBeenCalledWith({}, { orgId: 'org', projectId: 'p1' });
  });

  it('the card of one batch comes from its items', async () => {
    const { GET } = await import('../[batchId]/card/+server');
    const response = await GET({} as never);

    expect(await response.json()).toMatchObject({ id: 'b1', name: 'Autumn', total: 0, href: '/app/studio/b1' });
  });
});
