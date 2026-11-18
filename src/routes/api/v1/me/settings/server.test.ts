import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestSupabase, type TestSupabase } from '$lib/testkit/supabase';
import { SettingsSection } from '$lib/settings/sections';

const { USER, state } = vi.hoisted(() => ({
  USER: { id: 'u1', email: 'ada@x.it', user_metadata: {}, created_at: '2020-01-01T00:00:00Z' },
  state: { kit: null as unknown as { client: unknown } }
}));

const ORG = { id: 'org-a', name: 'Acme', slug: 'acme' };

vi.mock('$lib/server/db/client', async (original) => ({ ...(await original<object>()), createUserDb: () => state.kit.client }));
vi.mock('$lib/server/nav-cache', async (original) => ({
  ...(await original<object>()),
  verifiedToken: async (_db: unknown, token: string) => (token === 'jwt' ? USER : null)
}));
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => [{ org: ORG, role: 'owner' }]), memberRole: vi.fn(async () => 'owner') }));
vi.mock('$lib/server/repos/profiles', async (original) => ({ ...(await original<object>()), ensureProfile: vi.fn(async () => ({ name: 'Ada Lovelace', email: USER.email, avatarUrl: null })) }));
vi.mock('$lib/server/credits', async (original) => ({ ...(await original<object>()), orgCreditBalance: vi.fn(async () => 42) }));
vi.mock('$lib/server/repos/projects', async (original) => ({ ...(await original<object>()), listProjects: vi.fn(async () => []) }));
vi.mock('$lib/server/cli-auth', async (original) => ({ ...(await original<object>()), generateApiKey: () => ({ key: 'feega_k', hash: 'h', prefix: 'feega_k' }) }));
vi.mock('$lib/server/offerable-models', () => ({ offerableSlotChoices: vi.fn(async () => ({ choices: [], synced: true })), offerableModels: vi.fn(async () => ({ choices: [], synced: true })) }));

const shellApi = await import('./+server');
const sectionApi = await import('./[section]/+server');

const ORIGIN = 'https://feega.test';
const BASE = `${ORIGIN}/api/v1/me/settings`;

function seed(): TestSupabase {
  return createTestSupabase({
    orgs: [{ id: ORG.id, name: ORG.name, slug: ORG.slug, stripe_customer_id: null }],
    orgs_members: [{ org_id: ORG.id, user_id: USER.id, role: 'owner' }],
    profiles: [{ id: USER.id, name: 'Ada Lovelace', email: USER.email, avatar_url: null }],
    api_keys: [],
    orgs_invites: [],
    org_spend_caps: [{ org_id: ORG.id, scope: 'project_total', project_id: 'p1', cap_usd: 9, reset: 'none' }]
  });
}

type Reply = { status: number; body: Record<string, unknown> };

async function call(method: 'GET' | 'POST', path: string, body?: FormData, token = 'jwt'): Promise<Reply> {
  const url = new URL(`${BASE}${path}`);
  const section = url.pathname.replace('/api/v1/me/settings', '').replace(/^\//, '');
  const request = new Request(url, { method, body, headers: token ? { authorization: `Bearer ${token}` } : {} });
  const handler = section ? (method === 'GET' ? sectionApi.GET : sectionApi.POST) : shellApi.GET;
  const res = await (handler as (e: unknown) => Promise<Response>)({ request, url, params: { section } });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

function form(fields: Record<string, string>): FormData {
  const body = new FormData();
  Object.entries(fields).forEach(([key, value]) => body.set(key, value));
  return body;
}

const rowsOf = (table: string) => (state.kit as TestSupabase).tables.get(table) ?? [];

beforeEach(() => {
  state.kit = seed();
});

describe('the dashboard settings API', () => {
  it('the shell carries the chosen org and no project', async () => {
    const reply = await call('GET', '?path=/app/settings/profile');

    expect(reply.status).toBe(200);
    expect(reply.body.data).toMatchObject({ isOwner: true });
  });

  it('spend loads only the org member caps', async () => {
    const reply = await call('GET', `/${SettingsSection.Spend}`);

    expect(reply.body.data).toMatchObject({ caps: [], scopes: ['org_member'], canEdit: true });
  });

  it('spend saves an org member cap through the real handler', async () => {
    const reply = await call('POST', `/${SettingsSection.Spend}?action=saveCap`, form({ scope: 'org_member', cap_usd: '5' }));

    expect(reply.status).toBe(200);
    expect(rowsOf('org_spend_caps').some((row) => row.scope === 'org_member' && row.project_id === null)).toBe(true);
  });

  it('spend refuses a project cap, which lives in the project', async () => {
    const reply = await call('POST', `/${SettingsSection.Spend}?action=saveCap`, form({ scope: 'project_total', cap_usd: '5' }));

    expect(reply.status).toBe(400);
  });

  it('creates an API key in the chosen org with no project in the path', async () => {
    const reply = await call('POST', `/${SettingsSection.ApiKeys}?action=createApiKey`, form({ key_name: 'deploy' }));

    expect(reply.status).toBe(200);
    expect(rowsOf('api_keys')[0]).toMatchObject({ org_id: ORG.id, user_id: USER.id });
  });

  it('a project section is not served here', async () => {
    expect((await call('GET', `/${SettingsSection.Project}`)).status).toBe(404);
    expect((await call('GET', '/nope')).status).toBe(404);
  });

  it('a missing or bad token is a 401', async () => {
    expect(await call('GET', '/profile', undefined, '')).toEqual({ status: 401, body: { error: 'missing_bearer' } });
    expect(await call('GET', '/profile', undefined, 'bad')).toEqual({ status: 401, body: { error: 'invalid_token' } });
  });
});
