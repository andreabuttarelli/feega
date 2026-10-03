import { describe, expect, it, vi } from 'vitest';
import { ProjectMode } from '$lib/project-mode';

const listMemberships = vi.fn(async () => [
  { org: { id: 'org-a', name: 'A', slug: 'a' }, role: 'owner' },
  { org: { id: 'org-b', name: 'B', slug: 'b' }, role: 'member' }
]);
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships }));
vi.mock('$lib/server/repos/profiles', () => ({ ensureProfile: vi.fn(async () => ({ name: 'Ada', email: 'ada@x.it', avatarUrl: null })) }));
vi.mock('$lib/server/credits', () => ({ orgCreditBalance: vi.fn(async () => 42) }));
vi.mock('$lib/server/repos/projects', () => ({
  listProjects: vi.fn(async () => [
    { id: 'p1', name: 'Launch', mode: ProjectMode.Standard },
    { id: 'p2', name: 'Private', mode: ProjectMode.Uncensored }
  ])
}));

const { appShell } = await import('./app-shell');

const locals = { safeGetSession: async () => ({ session: {}, user: { id: 'u1' } }), db: async () => ({}) };
const cookies = (org?: string) => ({ get: (name: string) => (name === 'dz-org' ? org : undefined) });

describe('the /app shell: who, which workspace, how many credits', () => {
  it('opens the workspace chosen in the cookie and lists its standard projects', async () => {
    const shell = await appShell({ locals, cookies: cookies('org-b') } as never);
    expect(shell.org).toEqual({ id: 'org-b', name: 'B', slug: 'b', role: 'member' });
    expect(shell.workspaces.map((w) => w.id)).toEqual(['org-a', 'org-b']);
    expect(shell.creditBalance).toBe(42);
    expect(shell.projects).toEqual([{ id: 'p1', name: 'Launch' }]);
  });

  it('a user with no workspace yet goes through the bootstrap at the root', async () => {
    listMemberships.mockResolvedValueOnce([]);
    const refused = await appShell({ locals, cookies: cookies() } as never).catch((e) => e);
    expect(refused).toMatchObject({ status: 303, location: '/' });
  });
});
