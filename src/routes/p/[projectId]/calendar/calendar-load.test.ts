import { describe, expect, it, vi } from 'vitest';
import { buildCalendarData, ALL_BRANDS } from './calendar-load';
import { fakeDb } from '$lib/server/db/fake-db';
import { listOrgBrands } from '$lib/server/repos/brands';
import { listPosts } from '$lib/server/repos/posts';

const ORG = 'org-1';

const demo = { id: 'brand-1', name: 'Demo', slug: 'demo', website: null, shortDescription: null, logoUrl: null };
const other = { id: 'brand-2', name: 'Other', slug: 'other', website: null, shortDescription: null, logoUrl: null };

const account = { id: 'acc-ig', platform: 'instagram' as const, handle: 'demo', displayName: 'Demo IG', avatarUrl: null, status: 'connected' };

function postOf(id: string, brandId: string) {
  return {
    id,
    brandId,
    title: null,
    caption: 'Ciao',
    perPlatform: null,
    media: [],
    linkUrl: null,
    status: 'ready' as const,
    createdAt: '2026-09-01T00:00:00Z'
  };
}

function repos(overrides: { brands?: unknown[]; deliveryStatus?: ReturnType<typeof vi.fn> } = {}) {
  return {
    listOrgBrands: vi.fn().mockResolvedValue(overrides.brands ?? [demo, other]),
    listBrandAccounts: vi.fn().mockResolvedValue([account]),
    listPosts: vi.fn(async (_db: unknown, scope: { brandId: string }) => [postOf(`post-${scope.brandId}`, scope.brandId)]),
    deliveryStatus: overrides.deliveryStatus ?? vi.fn().mockResolvedValue([])
  };
}

const base = { orgId: ORG, db: {} as never, publisher: {} as never };

describe('buildCalendarData: selezione del brand', () => {
  it('senza parametro mostra i post di TUTTI i brand dell org', async () => {
    const data = await buildCalendarData(repos() as never, { ...base, brandParam: null });

    expect(data.selection).toBe(ALL_BRANDS);
    expect(data.posts.map((p) => p.id)).toEqual(['post-brand-1', 'post-brand-2']);
  });

  it('con uno slug mostra solo i post di quel brand', async () => {
    const data = await buildCalendarData(repos() as never, { ...base, brandParam: 'other' });

    expect(data.selection).toBe('other');
    expect(data.posts.map((p) => p.id)).toEqual(['post-brand-2']);
  });

  it('uno slug sconosciuto ricade su tutti, non su una pagina vuota', async () => {
    const data = await buildCalendarData(repos() as never, { ...base, brandParam: 'ghost' });

    expect(data.selection).toBe(ALL_BRANDS);
    expect(data.posts).toHaveLength(2);
  });

  it('gli account arrivano per brand, per programmare ogni post sul SUO brand', async () => {
    const data = await buildCalendarData(repos() as never, { ...base, brandParam: null });

    expect(data.accountsByBrand).toEqual({ 'brand-1': [account], 'brand-2': [account] });
  });

  it('un org senza brand non ha post', async () => {
    const r = repos({ brands: [] });
    const data = await buildCalendarData(r as never, { ...base, brandParam: null });

    expect(data).toMatchObject({ brands: [], posts: [], selection: ALL_BRANDS });
    expect(r.listPosts).not.toHaveBeenCalled();
  });
});

describe('buildCalendarData: consegne', () => {
  it('porta lo stato di consegna per post', async () => {
    const delivery = { accountId: 'acc-ig', platform: 'instagram', status: 'scheduled', url: null, error: null, scheduledFor: '2026-09-15T09:00:00Z' };
    const data = await buildCalendarData(repos({ deliveryStatus: vi.fn().mockResolvedValue([delivery]) }) as never, { ...base, brandParam: 'demo' });

    expect(data.posts[0].deliveries).toEqual([delivery]);
  });

  it('se deliveryStatus fallisce il post appare comunque, senza consegne', async () => {
    const data = await buildCalendarData(
      repos({ deliveryStatus: vi.fn().mockRejectedValue(new Error('column posts.zernio_post_ids does not exist')) }) as never,
      { ...base, brandParam: 'demo' }
    );

    expect(data.posts).toEqual([{ ...postOf('post-brand-1', 'brand-1'), deliveries: [] }]);
  });
});

describe('buildCalendarData: isolamento fra org', () => {
  it('"tutti" non attraversa i brand di un altra org', async () => {
    const { db } = fakeDb(
      {
        brands: [
          { id: 'brand-1', org_id: ORG, name: 'Demo', slug: 'demo' },
          { id: 'brand-x', org_id: 'org-2', name: 'Stranger', slug: 'stranger' }
        ],
        posts: [
          { id: 'mine', org_id: ORG, brand_id: 'brand-1', caption: 'a', status: 'ready', created_at: '2026-09-01' },
          { id: 'theirs', org_id: 'org-2', brand_id: 'brand-x', caption: 'b', status: 'ready', created_at: '2026-09-01' }
        ]
      },
      { filter: true }
    );

    const data = await buildCalendarData(
      { listOrgBrands, listPosts, listBrandAccounts: vi.fn().mockResolvedValue([]), deliveryStatus: vi.fn().mockResolvedValue([]) },
      { orgId: ORG, brandParam: null, db, publisher: {} as never }
    );

    expect(data.brands.map((b) => b.id)).toEqual(['brand-1']);
    expect(data.posts.map((p) => p.id)).toEqual(['mine']);
  });

  it('lo slug di un brand di un altra org non lo apre', async () => {
    const { db } = fakeDb(
      {
        brands: [{ id: 'brand-x', org_id: 'org-2', name: 'Stranger', slug: 'stranger' }],
        posts: [{ id: 'theirs', org_id: 'org-2', brand_id: 'brand-x', caption: 'b', status: 'ready', created_at: '2026-09-01' }]
      },
      { filter: true }
    );

    const data = await buildCalendarData(
      { listOrgBrands, listPosts, listBrandAccounts: vi.fn().mockResolvedValue([]), deliveryStatus: vi.fn().mockResolvedValue([]) },
      { orgId: ORG, brandParam: 'stranger', db, publisher: {} as never }
    );

    expect(data.posts).toEqual([]);
  });
});
