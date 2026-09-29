import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestSupabase, type TestSupabase } from '$lib/testkit/supabase';

vi.mock('$env/dynamic/private', () => ({ env: { ZERNIO_API_KEY: 'test-key' } }));
vi.mock('$lib/server/ai-log', () => ({ logAiCall: vi.fn() }));

const caller = { db: null as unknown, orgId: 'org-1', userId: 'user-1', apiKeyId: null as string | null, writeAllowed: true };
vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: async () => ({ caller }) }));
vi.mock('$lib/server/credits', () => ({ orgCreditBalance: async () => 1_000_000 }));
vi.mock('$lib/server/ads/provider-media', () => ({
  providerMediaSigner: () => async (media: { path: string }[]) => new Map(media.map((m) => [m.path, `https://signed.test/${m.path}`]))
}));

const campaigns = await import('./+server');
const approve = await import('./[id]/approve/+server');
const status = await import('./[id]/status/+server');

let kit: TestSupabase;
const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ ad: { _id: 'z-ad', platformCampaignId: 'meta-1' } }), { status: 200 }));

beforeEach(() => {
  kit = createTestSupabase({
    ad_accounts: [{ id: 'acct-1', org_id: 'org-1', brand_id: 'b1', platform: 'meta', currency: 'EUR', status: 'connected', zernio_ad_account_id: 'z-acct' }],
    social_accounts: [{ id: 'sa', org_id: 'org-1', brand_id: 'b1', platform: 'facebook', zernio_account_id: 'z-fb', zernio_profile_id: 'z-prof' }],
    nodes: [{ id: 'n1', org_id: 'org-1', type: 'image', data: { refId: 'as1' }, deleted_at: null }],
    assets: [{ id: 'as1', org_id: 'org-1', type: 'image', url: 'https://cdn.test/a.png' }],
    ad_campaigns: [],
    ad_creatives: []
  });
  caller.db = kit.client;
  caller.apiKeyId = null;
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const body = {
  brand_id: 'b1',
  ad_account_id: 'acct-1',
  objective: 'awareness',
  budget_type: 'daily',
  budget_amount: 5,
  days: 2,
  countries: ['IT'],
  placements: ['instagram_feed'],
  primary_text: 'Hi',
  headline: 'Hello',
  node_ids: ['n1']
};

type Handler = { POST: (...args: never[]) => unknown };

function post(handler: Handler, json: unknown, params: Record<string, string> = {}) {
  const request = new Request('https://feega.test/x', {
    method: 'POST',
    headers: { authorization: 'Bearer t' },
    body: JSON.stringify(json)
  });
  return (handler.POST as (e: unknown) => Promise<Response>)({ request, url: new URL(request.url), params });
}

describe('POST /api/v1/org/ads/campaigns', () => {
  it('an agent key proposes a draft through the same server function as the app, spending nothing', async () => {
    caller.apiKeyId = 'key-1';
    const res = await post(campaigns, body);

    expect(res.status).toBe(200);
    expect(kit.tables.get('ad_campaigns')![0]).toMatchObject({ status: 'draft', approved_by: null, actor_kind: 'agent' });
    expect(kit.tables.get('ad_creatives')![0]).toMatchObject({ headline: 'Hello', media: [{ assetId: 'as1', order: 0 }] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('says what is wrong with an incomplete draft', async () => {
    const res = await post(campaigns, { ...body, headline: '' });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: 'invalid_draft' });
  });
});

describe('POST .../approve', () => {
  it('refuses an API key before touching the provider', async () => {
    await post(campaigns, body);
    caller.apiKeyId = 'key-1';
    const id = kit.tables.get('ad_campaigns')![0].id;

    const res = await post(approve, {}, { id });

    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a person approves and it launches on Zernio', async () => {
    await post(campaigns, body);
    const id = kit.tables.get('ad_campaigns')![0].id;

    const res = await post(approve, {}, { id });

    expect(res.status).toBe(200);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://zernio.com/api/v1/ads/create');
    expect(kit.tables.get('ad_campaigns')![0].status).toBe('active');
  });
});

describe('POST .../status', () => {
  it('pauses a running campaign', async () => {
    await post(campaigns, body);
    const id = kit.tables.get('ad_campaigns')![0].id;
    await post(approve, {}, { id });

    const res = await post(status, { next: 'paused' }, { id });

    expect(res.status).toBe(200);
    expect(kit.tables.get('ad_campaigns')![0].status).toBe('paused');
  });
});
