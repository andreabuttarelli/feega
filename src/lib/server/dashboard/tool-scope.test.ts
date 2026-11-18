import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectMode } from '$lib/project-mode';

const ORG_A = { org: { id: 'org-a', name: 'A', slug: 'a' }, role: 'owner' as const };
const ORG_B = { org: { id: 'org-b', name: 'B', slug: 'b' }, role: 'member' as const };

const project = (id: string, mode = ProjectMode.Standard) => ({ id, name: id, slug: id, archivedAt: null, lastActiveAt: '', mode });

const listMemberships = vi.fn(async () => [ORG_A, ORG_B]);
const listProjects = vi.fn(async (_db: unknown, orgId: string) => (orgId === 'org-b' ? [project('b-recent')] : [project('a-secret', ProjectMode.Uncensored), project('a-recent'), project('a-old')]));
const findReachableProject = vi.fn(async (_db: unknown, input: { projectId: string }) =>
  input.projectId.startsWith('foreign') ? null : { orgId: input.projectId.startsWith('b-') ? 'org-b' : 'org-a', project: project(input.projectId) }
);

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships }));
vi.mock('$lib/server/repos/projects', () => ({ listProjects }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject }));

const { toolScope } = await import('./tool-scope');

function event(search = '', cookies: Record<string, string> = {}) {
  return {
    url: new URL(`http://x/app/motion${search}`),
    cookies: { get: (name: string) => cookies[name] },
    locals: {
      safeGetSession: async () => ({ session: {}, user: { id: 'u1' } }),
      db: async () => ({})
    }
  } as never;
}

async function refusal(promise: Promise<unknown>): Promise<{ status?: number; location?: string }> {
  return promise.then(
    () => ({}),
    (e) => e
  );
}

describe('a tool page picks its project without a project in the URL path', () => {
  beforeEach(() => vi.clearAllMocks());

  it('opens the project named by ?project=', async () => {
    expect(await toolScope(event('?project=b-recent'))).toMatchObject({ orgId: 'org-b', projectId: 'b-recent', userId: 'u1' });
  });

  it('defaults to the most recent standard project of the chosen org', async () => {
    expect((await toolScope(event('', { 'dz-org': 'org-a' }))).projectId).toBe('a-recent');
  });

  it('refuses a project that is not the user’s', async () => {
    expect((await refusal(toolScope(event('?project=foreign')))).status).toBe(404);
  });

  it('sends a signed-out visitor to login', async () => {
    const signedOut = { ...(event() as object), locals: { safeGetSession: async () => ({ session: null, user: null }), db: async () => ({}) } };
    expect((await refusal(toolScope(signedOut as never))).location).toBe('/login');
  });
});
