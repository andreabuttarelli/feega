import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestSupabase, type TestSupabase } from '$lib/testkit/supabase';
import { SettingsSection } from '$lib/settings/sections';
import { UncensoredLock } from '$lib/uncensored-lock';
import { ProjectMode } from '$lib/project-mode';

const { USER, state } = vi.hoisted(() => ({
  USER: { id: 'u1', email: 'ada@x.it', user_metadata: {}, created_at: '2020-01-01T00:00:00Z' },
  state: { kit: null as unknown as { client: unknown } }
}));

const ORG = { id: 'org-a', name: 'Acme', slug: 'acme' };
const PROJECT = { id: 'p1', name: 'Launch', slug: 'launch', brandId: 'b1', archivedAt: null, lastActiveAt: '2026-10-01', mode: ProjectMode.Standard };

vi.mock('$lib/server/db/client', async (original) => ({ ...(await original<object>()), createUserDb: () => state.kit.client }));
vi.mock('$lib/server/nav-cache', async (original) => ({
  ...(await original<object>()),
  verifiedToken: async (_db: unknown, token: string) => (token === 'jwt' ? USER : null),
  invalidateBrandNav: vi.fn()
}));
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => [{ org: ORG, role: 'owner' }]) }));
vi.mock('$lib/server/projects/lookup', () => ({ findProjectForUser: vi.fn(async () => ({ orgId: ORG.id, project: PROJECT })) }));
vi.mock('$lib/server/repos/profiles', async (original) => ({ ...(await original<object>()), ensureProfile: vi.fn(async () => ({ name: 'Ada Lovelace', email: USER.email, avatarUrl: null })) }));
vi.mock('$lib/server/credits', async (original) => ({ ...(await original<object>()), orgCreditBalance: vi.fn(async () => 42) }));
vi.mock('$lib/server/uncensored-workspace/workspace-server', () => ({ uncensoredLockFor: vi.fn(async () => UncensoredLock.Open) }));
vi.mock('$lib/server/repos/canvas', async (original) => ({ ...(await original<object>()), listCanvases: vi.fn(async () => [{ id: 'c1', name: 'Board' }]) }));
vi.mock('$lib/server/repos/projects', async (original) => ({ ...(await original<object>()), listProjects: vi.fn(async () => [PROJECT]) }));
vi.mock('$lib/server/tenancy', async (original) => ({ ...(await original<object>()), hasManyTenants: () => true }));
vi.mock('$lib/server/email', async (original) => ({ ...(await original<object>()), sendEmail: vi.fn(async () => undefined) }));
vi.mock('$lib/server/cli-auth', async (original) => ({ ...(await original<object>()), generateApiKey: () => ({ key: 'feega_k', hash: 'h', prefix: 'feega_k' }) }));
vi.mock('$lib/server/supabase-admin', () => ({ createAdminClient: () => state.kit.client }));
vi.mock('$lib/server/offerable-models', () => ({ offerableSlotChoices: vi.fn(async () => ({ choices: [], synced: true })) }));

const projectLayout = await import('../../../../../../p/[projectId]/+layout.server');
const settingsLayout = await import('$lib/server/settings/shell');
const ROUTES: Record<SettingsSection, () => Promise<{ load?: (e: never) => unknown; actions?: Record<string, (e: never) => unknown> }>> = {
  [SettingsSection.Project]: () => import('$lib/server/settings/pages/project'),
  [SettingsSection.Brand]: () => import('$lib/server/settings/pages/brand'),
  [SettingsSection.Video]: () => import('$lib/server/settings/pages/video'),
  [SettingsSection.Profile]: () => import('$lib/server/settings/pages/profile'),
  [SettingsSection.Content]: () => import('$lib/server/settings/pages/content'),
  [SettingsSection.Team]: () => import('$lib/server/settings/pages/team'),
  [SettingsSection.ApiKeys]: () => import('$lib/server/settings/pages/api-keys'),
  [SettingsSection.Danger]: () => import('$lib/server/settings/pages/danger')
};
const shellApi = await import('./+server');
const sectionApi = await import('./[section]/+server');

const NOW = new Date('2026-10-15T10:00:00Z');
const ORIGIN = 'https://feega.test';

function seed(): TestSupabase {
  return createTestSupabase({
    orgs: [{ id: ORG.id, name: ORG.name, slug: ORG.slug, stripe_customer_id: null }],
    orgs_members: [{ org_id: ORG.id, user_id: USER.id, role: 'owner' }],
    projects: [{ id: PROJECT.id, org_id: ORG.id, name: PROJECT.name, brand_id: 'b1', archived_at: null, mode: 'standard' }],
    brands: [
      { id: 'b1', org_id: ORG.id, name: 'Acme', slug: 'acme', website: null, logo_url: null, short_description: null, content: null },
      { id: 'b2', org_id: ORG.id, name: 'Beta', slug: 'beta', website: null, logo_url: null, short_description: null, content: null }
    ],
    profiles: [{ id: USER.id, name: 'Ada Lovelace', email: USER.email, avatar_url: null }],
    api_keys: [{ id: 'k1', org_id: ORG.id, user_id: USER.id, name: 'ci', key_prefix: 'feega_x', scopes: [], created_at: '2026-01-01', last_used_at: null }],
    orgs_invites: [{ id: 'i1', org_id: ORG.id, email: 'bob@x.it', accepted_at: null, created_at: '2026-01-01' }],
    influencers: [],
    social_accounts: [],
    credit_ledger: []
  });
}

type Outcome = { status: number; body: unknown };

function cookieJar() {
  return { get: () => undefined, getAll: () => [], set: vi.fn(), delete: vi.fn(), serialize: () => '' };
}

function directEvent(path: string, method: 'GET' | 'POST', body?: FormData) {
  const supabase = Object.assign(Object.create(state.kit.client as object), { auth: { getUser: async () => ({ data: { user: USER }, error: null }) } });
  const locals = { safeGetSession: async () => ({ session: { access_token: 'jwt' }, user: USER }), db: async () => state.kit.client, supabase };
  const url = new URL(`${ORIGIN}${path}`);
  const base = { url, params: { projectId: PROJECT.id }, locals, cookies: cookieJar(), depends: () => {}, request: new Request(url, { method, body }) };
  const projectShell = () => projectLayout.load({ ...base } as never) as Promise<Record<string, unknown>>;
  const settingsShell = async () => ({ ...(await projectShell()), ...((await settingsLayout.load({ ...base, parent: projectShell } as never)) as object) });
  return { ...base, parent: settingsShell, shellParent: projectShell };
}

async function outcome(run: () => unknown): Promise<Outcome> {
  try {
    const result = (await run()) as { status?: number; data?: unknown; type?: string } | undefined;
    if (result && result.constructor?.name === 'ActionFailure') {
      return { status: result.status!, body: result.data ?? {} };
    }
    return { status: 200, body: { data: result ?? null } };
  } catch (e) {
    const thrown = e as { status: number; location?: string; body?: { message: string } };
    return thrown.location ? { status: 200, body: { redirect: thrown.location } } : { status: thrown.status, body: { error: thrown.body?.message } };
  }
}

async function api(method: 'GET' | 'POST', path: string, body?: FormData, token = 'jwt'): Promise<Outcome> {
  const url = new URL(`${ORIGIN}/api/v1/me/projects/${PROJECT.id}/settings${path}`);
  const section = url.pathname.split('/settings')[1].replace(/^\//, '');
  const request = new Request(url, { method, body, headers: token ? { authorization: `Bearer ${token}` } : {} });
  const handler = section ? (method === 'GET' ? sectionApi.GET : sectionApi.POST) : shellApi.GET;
  const res = await (handler as (e: unknown) => Promise<Response>)({ request, url, params: { projectId: PROJECT.id, section } });
  return { status: res.status, body: await res.json() };
}

function form(fields: Record<string, string>): FormData {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    body.set(k, v);
  }
  return body;
}

const ACTIONS: Array<[SettingsSection, string, Record<string, string>]> = [
  [SettingsSection.Project, 'rename', { name: 'Relaunch' }],
  [SettingsSection.Project, 'rename', { name: '' }],
  [SettingsSection.Project, 'linkBrand', { brandId: 'b2' }],
  [SettingsSection.Project, 'linkBrand', { brandId: 'b2', returnTo: '/p/p1/settings/brand' }],
  [SettingsSection.Project, 'linkBrand', { brandId: 'nope' }],
  [SettingsSection.Project, 'unlinkBrand', {}],
  [SettingsSection.Project, 'forgetAppAccount', {}],
  [SettingsSection.Project, 'setMode', { mode: 'uncensored' }],
  [SettingsSection.Project, 'delete', { confirmName: 'wrong' }],
  [SettingsSection.Brand, 'update', { name: 'Acme 2', website: 'acme.example' }],
  [SettingsSection.Brand, 'update', { name: '' }],
  [SettingsSection.Brand, 'removeLogo', {}],
  [SettingsSection.Brand, 'uploadLogo', {}],
  [SettingsSection.Brand, 'selectBrand', { brandId: 'b2' }],
  [SettingsSection.Brand, 'selectBrand', { brandId: '' }],
  [SettingsSection.Brand, 'createBrand', { name: '' }],
  [SettingsSection.Video, 'updateVideoInstructions', { instructions: 'slow' }],
  [SettingsSection.Video, 'updateVideoDuration', { duration: '8' }],
  [SettingsSection.Video, 'updateVideoResolution', { resolution: '1080p' }],
  [SettingsSection.Video, 'updateMediaModel', { slot: 'image', model: '' }],
  [SettingsSection.Profile, 'updateProfile', { firstName: 'Ada', lastName: 'Byron' }],
  [SettingsSection.Profile, 'removeProfileAvatar', {}],
  [SettingsSection.Profile, 'uploadProfileAvatar', {}],
  [SettingsSection.Content, 'enable', {}],
  [SettingsSection.Content, 'disable', {}],
  [SettingsSection.Content, 'persona', { influencerId: 'x', mark: 'on' }],
  [SettingsSection.Team, 'invite', { email: 'not-an-email' }],
  [SettingsSection.Team, 'revokeInvite', { invite_id: 'i1' }],
  [SettingsSection.ApiKeys, 'createApiKey', { name: 'deploy' }],
  [SettingsSection.ApiKeys, 'revokeApiKey', { key_id: 'k1' }],
  [SettingsSection.Danger, 'deleteBrand', { confirm: 'wrong' }]
];

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

function tablesOf(kit: TestSupabase): unknown {
  return JSON.parse(JSON.stringify(Object.fromEntries(kit.tables)).replace(UUID, '<uuid>'));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  state.kit = seed();
});

describe('settings over the API answer what the settings pages answer', () => {
  it('the settings shell', async () => {
    const event = directEvent(`/p/${PROJECT.id}/settings/brand`, 'GET');
    const expected = await outcome(() => settingsLayout.load({ ...event, parent: event.shellParent } as never));

    state.kit = seed();
    expect(await api('GET', `?path=${encodeURIComponent(`/p/${PROJECT.id}/settings/brand`)}`)).toEqual(expected);
  });

  it.each(Object.values(SettingsSection))('the %s page load', async (section) => {
    const route = await ROUTES[section]();
    const event = directEvent(`/p/${PROJECT.id}/settings/${section}`, 'GET');
    const expected = route.load ? await outcome(() => route.load!(event as never)) : { status: 200, body: { data: null } };

    state.kit = seed();
    expect(await api('GET', `/${section}`)).toEqual(expected);
  });

  it.each(ACTIONS)('%s ?/%s %j: same answer, same writes', async (section, action, fields) => {
    const route = await ROUTES[section]();
    const expected = await outcome(() => route.actions![action](directEvent(`/p/${PROJECT.id}/settings/${section}`, 'POST', form(fields)) as never));
    const expectedTables = tablesOf(state.kit as TestSupabase);

    state.kit = seed();
    expect(await api('POST', `/${section}?action=${action}`, form(fields))).toEqual(expected);
    expect(tablesOf(state.kit as TestSupabase)).toEqual(expectedTables);
  });

  it('covers every action of every section', async () => {
    const covered = new Set(ACTIONS.map(([section, action]) => `${section}/${action}`));
    const missing: string[] = [];
    for (const section of Object.values(SettingsSection)) {
      for (const action of Object.keys((await ROUTES[section]()).actions ?? {})) {
        if (!covered.has(`${section}/${action}`)) {
          missing.push(`${section}/${action}`);
        }
      }
    }
    expect(missing).toEqual(['project/verifyAge', 'profile/deleteAccount']);
  });

  it('an action on a project the caller cannot open is refused before it runs', async () => {
    const { findProjectForUser } = await import('$lib/server/projects/lookup');
    vi.mocked(findProjectForUser).mockResolvedValueOnce(null as never);

    expect((await api('POST', '/project?action=rename', form({ name: 'Hijacked' }))).status).toBe(404);
    expect(state.kit && (state.kit as TestSupabase).tables.get('projects')![0].name).toBe(PROJECT.name);
  });

  it('an unknown section or action is a 404, a missing or bad token a 401', async () => {
    expect((await api('GET', '/nope')).status).toBe(404);
    expect((await api('POST', '/project?action=nope', form({}))).status).toBe(404);
    expect(await api('GET', '/project', undefined, '')).toEqual({ status: 401, body: { error: 'missing_bearer' } });
    expect(await api('GET', '/project', undefined, 'bad')).toEqual({ status: 401, body: { error: 'invalid_token' } });
  });
});
