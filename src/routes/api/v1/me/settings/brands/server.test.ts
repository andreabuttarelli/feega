import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestSupabase, type TestSupabase } from '$lib/testkit/supabase';
import { SettingsSection } from '$lib/settings/sections';

const { USER, state } = vi.hoisted(() => ({
  USER: { id: 'u1', email: 'ada@x.it', user_metadata: {}, created_at: '2020-01-01T00:00:00Z' },
  state: { kit: null as unknown as { client: unknown } }
}));

const ORG = { id: 'org-a', name: 'Acme', slug: 'acme' };
const MINE = 'brand-mine';
const FOREIGN = 'brand-foreign';

vi.mock('$lib/server/db/client', async (original) => ({ ...(await original<object>()), createUserDb: () => state.kit.client }));
vi.mock('$lib/server/nav-cache', async (original) => ({
  ...(await original<object>()),
  verifiedToken: async (_db: unknown, token: string) => (token === 'jwt' ? USER : null),
  invalidateBrandNav: vi.fn()
}));
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => [{ org: ORG, role: 'owner' }]), memberRole: vi.fn(async () => 'owner') }));
vi.mock('$lib/server/repos/profiles', async (original) => ({ ...(await original<object>()), ensureProfile: vi.fn(async () => ({ name: 'Ada Lovelace', email: USER.email, avatarUrl: null })) }));
vi.mock('$lib/server/credits', async (original) => ({ ...(await original<object>()), orgCreditBalance: vi.fn(async () => 42) }));
vi.mock('$lib/server/repos/projects', async (original) => ({ ...(await original<object>()), listProjects: vi.fn(async () => []) }));
vi.mock('$lib/server/tenancy', async (original) => ({ ...(await original<object>()), hasManyTenants: () => true }));
vi.mock('$lib/server/offerable-models', () => ({ offerableSlotChoices: vi.fn(async () => ({ choices: [], synced: true })), offerableModels: vi.fn(async () => ({ choices: [], synced: true })) }));

const listApi = await import('./+server');
const shellApi = await import('./[brandId]/+server');
const sectionApi = await import('./[brandId]/[section]/+server');

const BASE = 'https://feega.test/api/v1/me/settings/brands';

function seed(): TestSupabase {
  return createTestSupabase({
    orgs: [{ id: ORG.id, name: ORG.name, slug: ORG.slug, stripe_customer_id: null }],
    orgs_members: [{ org_id: ORG.id, user_id: USER.id, role: 'owner' }],
    profiles: [{ id: USER.id, name: 'Ada Lovelace', email: USER.email, avatar_url: null }],
    api_keys: [],
    orgs_invites: [],
    brands: [
      { id: MINE, org_id: ORG.id, name: 'Mine', slug: 'mine', website: null },
      { id: FOREIGN, org_id: 'org-z', name: 'Foreign', slug: 'foreign', website: null }
    ],
    products: [
      { id: 'pr1', brand_id: MINE, org_id: ORG.id, title: 'Mug', price: 5, currency: 'EUR', images: [], available: true, store_url: null, platform: null },
      { id: 'pr2', brand_id: FOREIGN, org_id: 'org-z', title: 'Hidden', price: 1, currency: 'EUR', images: [], available: true, store_url: null, platform: null }
    ]
  });
}

type Reply = { status: number; body: Record<string, unknown> };

function form(fields: Record<string, string>): FormData {
  const body = new FormData();
  Object.entries(fields).forEach(([key, value]) => body.set(key, value));
  return body;
}

async function run(handler: unknown, url: URL, init: RequestInit, params: Record<string, string>): Promise<Reply> {
  const request = new Request(url, { ...init, headers: { authorization: 'Bearer jwt' } });
  const res = await (handler as (e: unknown) => Promise<Response>)({ request, url, params });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

const rowsOf = (table: string) => (state.kit as TestSupabase).tables.get(table) ?? [];

beforeEach(() => {
  state.kit = seed();
});

describe('the dashboard brand settings API', () => {
  it('lists the brands of the chosen org only', async () => {
    const reply = await run(listApi.GET, new URL(BASE), {}, {});

    expect(reply.status).toBe(200);
    expect((reply.body.data as { brands: { id: string }[] }).brands.map((b) => b.id)).toEqual([MINE]);
  });

  it('creates a brand in the chosen org without a project', async () => {
    const reply = await run(listApi.POST, new URL(`${BASE}?action=createBrand`), { method: 'POST', body: form({ name: 'Fresh' }) }, {});

    expect(reply.status).toBe(200);
    expect(rowsOf('brands').find((b) => b.name === 'Fresh')).toMatchObject({ org_id: ORG.id });
  });

  it('the shell carries the brand from the URL, with no project', async () => {
    const reply = await run(shellApi.GET, new URL(`${BASE}/${MINE}`), {}, { brandId: MINE });

    expect(reply.status).toBe(200);
    expect(reply.body.data).toMatchObject({ brand: { id: MINE, org_id: ORG.id } });
  });

  it('a brand of another org is a 404, in the shell and in every section', async () => {
    expect((await run(shellApi.GET, new URL(`${BASE}/${FOREIGN}`), {}, { brandId: FOREIGN })).status).toBe(404);
    expect((await run(sectionApi.GET, new URL(`${BASE}/${FOREIGN}/products`), {}, { brandId: FOREIGN, section: SettingsSection.Products })).status).toBe(404);
    expect((await run(sectionApi.POST, new URL(`${BASE}/${FOREIGN}/brand?action=update`), { method: 'POST', body: form({ name: 'Taken' }) }, { brandId: FOREIGN, section: SettingsSection.Brand })).status).toBe(404);
    expect(rowsOf('brands').find((b) => b.id === FOREIGN)).toMatchObject({ name: 'Foreign' });
  });

  it('products loads the products of the brand in the URL', async () => {
    const reply = await run(sectionApi.GET, new URL(`${BASE}/${MINE}/products`), {}, { brandId: MINE, section: SettingsSection.Products });

    expect((reply.body.data as { products: { id: string }[] }).products.map((p) => p.id)).toEqual(['pr1']);
  });

  it('saves the brand name through the real handler', async () => {
    const reply = await run(sectionApi.POST, new URL(`${BASE}/${MINE}/brand?action=update`), { method: 'POST', body: form({ name: 'Renamed' }) }, { brandId: MINE, section: SettingsSection.Brand });

    expect(reply.status).toBe(200);
    expect(rowsOf('brands').find((b) => b.id === MINE)).toMatchObject({ name: 'Renamed' });
  });

  it('a project or workspace section is not served for a brand', async () => {
    expect((await run(sectionApi.GET, new URL(`${BASE}/${MINE}/project`), {}, { brandId: MINE, section: SettingsSection.Project })).status).toBe(404);
    expect((await run(sectionApi.GET, new URL(`${BASE}/${MINE}/spend`), {}, { brandId: MINE, section: SettingsSection.Spend })).status).toBe(404);
  });
});
