import { describe, expect, it, vi } from 'vitest';
import { Approval, ItemStatus } from '$lib/studio/batch-state';

const item = (id: string, status: ItemStatus, approval: Approval, assetId: string | null) => ({ id, status, approval, assetId });

vi.mock('$lib/server/repos/product-batches', () => ({
  listItems: vi.fn(async () => [
    item('i1', ItemStatus.Done, Approval.Approved, 'a1'),
    item('i2', ItemStatus.Done, Approval.Pending, 'a2'),
    item('i3', ItemStatus.Queued, Approval.Pending, null),
    item('i4', ItemStatus.Failed, Approval.Pending, null)
  ])
}));
const signedAssets = vi.fn(async (_db: unknown, _org: string, ids: string[]) => ({ assets: new Map(), urls: Object.fromEntries(ids.map((id) => [id, `https://signed/${id}`])) }));
vi.mock('$lib/server/studio/studio-media', () => ({ signedAssets }));

const { studioBatchCard } = await import('./studio-card');

const batch = { id: 'b1', orgId: 'org', projectId: 'p1', canvasId: 'c1', name: 'Autumn', status: 'running' };

describe('the card a studio batch node draws', () => {
  it('counts the items and shows approved photos first, then the other finished ones', async () => {
    const card = await studioBatchCard({} as never, batch as never);

    expect(card).toEqual({
      id: 'b1',
      name: 'Autumn',
      status: 'running',
      total: 4,
      done: 2,
      running: 1,
      failed: 1,
      approved: 1,
      thumbs: ['https://signed/a1', 'https://signed/a2'],
      href: '/app/studio/b1'
    });
  });
});
