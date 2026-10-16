import { describe, expect, it, vi } from 'vitest';
import { ProjectMode } from '$lib/project-mode';
import { TourState } from '$lib/onboarding/tour';

const USER = { id: 'u1', email: 'ada@x.it', created_at: '2020-01-01T00:00:00Z' };

const listMemberships = vi.fn(async () => [
  { org: { id: 'org-a', name: 'A', slug: 'a' }, role: 'owner' },
  { org: { id: 'org-b', name: 'B', slug: 'b' }, role: 'member' }
]);
const getUser = vi.fn(async () => ({ data: { user: USER }, error: null }));

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships }));
vi.mock('$lib/server/repos/profiles', () => ({
  ensureProfile: vi.fn(async () => ({ name: 'Ada', email: 'ada@x.it', avatarUrl: null })),
  readTourSeen: vi.fn(async () => ({ seenAt: '2020-02-01T00:00:00Z' }))
}));
vi.mock('$lib/server/credits', () => ({ orgCreditBalance: vi.fn(async () => 42) }));
vi.mock('$lib/server/repos/projects', () => ({
  listProjects: vi.fn(async () => [
    { id: 'p1', name: 'Launch', mode: ProjectMode.Standard },
    { id: 'p2', name: 'Private', mode: ProjectMode.Uncensored }
  ])
}));

const db = {
  auth: { getUser },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { terms_version: '2020-01-01' } }) }) }) })
};
const DASHBOARD = { canvases: [], projects: [], batches: [], motions: [], moreVideos: null };
const dashboardFor = vi.fn(async (_db: unknown, _deps: unknown, _org: string) => DASHBOARD);
vi.mock('$lib/server/dashboard/dashboard', () => ({ DASHBOARD_DEPS: {}, dashboardFor }));
vi.mock('$lib/server/db/client', () => ({ createUserDb: () => db }));
vi.mock('$lib/server/feature-flags', () => ({ isPlanGoEnabled: () => false }));
vi.mock('$lib/server/seline', () => ({ selineSetUser: vi.fn() }));
vi.mock('$lib/server/social-publishing', () => ({ socialPublishing: async () => 'off' }));

const { GET } = await import('./+server');
const { appShell } = await import('$lib/server/dashboard/app-shell');
const { load: rootLoad } = await import('../../../../+layout.server');

async function call(headers: Record<string, string>, org?: string) {
  const url = new URL(`https://feega.test/api/v1/me/bootstrap${org ? `?org=${org}` : ''}`);
  const res = await (GET as (e: unknown) => Promise<Response>)({ request: new Request(url, { headers }), url });
  const raw = await res.json();
  return { res, body: raw.data ?? raw };
}

const locals = { safeGetSession: async () => ({ session: {}, user: USER }), db: async () => db };
const cookies = (org?: string) => ({ get: (name: string) => (name === 'dz-org' ? org : undefined) });

describe('GET /api/v1/me/bootstrap: the dashboard layouts in one call', () => {
  it('returns the same shell the /app layout loads, for the same workspace', async () => {
    const page = await appShell({ locals, cookies: cookies('org-b') } as never);

    const { res, body } = await call({ authorization: 'Bearer jwt' }, 'org-b');

    expect(res.status).toBe(200);
    expect(body.shell).toEqual(page);
    expect(body.user).toEqual({ id: 'u1', email: 'ada@x.it' });
  });

  it('returns the same terms and tour flags the root layout loads', async () => {
    const url = new URL('https://feega.test/app');
    const root = (await (rootLoad as (e: unknown) => Promise<{ termsNoticeVersion: string | null; tour: TourState }>)({
      url,
      untrack: <T>(fn: () => T): T => fn(),
      locals
    })) as { termsNoticeVersion: string | null; tour: TourState };

    const { body } = await call({ authorization: 'Bearer jwt' });

    expect(body.flags).toEqual({ termsNoticeVersion: root.termsNoticeVersion, tour: root.tour });
    expect(body.flags.termsNoticeVersion).not.toBeNull();
  });

  it('carries the recents of the chosen workspace, read in parallel with the shell', async () => {
    let release: (m: unknown) => void = () => {};
    listMemberships.mockReturnValueOnce(new Promise((r) => (release = r)) as never);
    dashboardFor.mockClear();

    const pending = call({ authorization: 'Bearer jwt' }, 'org-b');
    await new Promise((r) => setTimeout(r, 0));
    expect(dashboardFor).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'org-b');
    release([{ org: { id: 'org-b', name: 'B', slug: 'b' }, role: 'member' }]);

    expect((await pending).body.dashboard).toEqual(DASHBOARD);
  });

  it('reads the recents of the workspace actually chosen when the hint was wrong', async () => {
    dashboardFor.mockClear();
    const { body } = await call({ authorization: 'Bearer jwt' }, 'org-gone');
    expect(body.shell.org.id).toBe('org-a');
    expect(dashboardFor).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), 'org-a');
  });

  it('verifies a token with Auth once, not on every navigation', async () => {
    getUser.mockClear();
    await call({ authorization: 'Bearer same-token' });
    await call({ authorization: 'Bearer same-token' });
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it('refuses a request without a bearer', async () => {
    const { res, body } = await call({});
    expect(res.status).toBe(401);
    expect(body).toEqual({ error: 'missing_bearer' });
  });

  it('refuses an invalid token', async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('bad') } as never);
    const { res, body } = await call({ authorization: 'Bearer nope' });
    expect(res.status).toBe(401);
    expect(body).toEqual({ error: 'invalid_token' });
  });

  it('a user with no workspace is told so, where the layout sends them to the root', async () => {
    listMemberships.mockResolvedValueOnce([]);
    const { res, body } = await call({ authorization: 'Bearer jwt' });
    expect(res.status).toBe(404);
    expect(body).toEqual({ error: 'no_organization' });
  });
});
