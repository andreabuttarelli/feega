import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectMode } from '$lib/project-mode';

const ORG_A = { org: { id: 'org-a', name: 'A', slug: 'a' }, role: 'owner' as const };
const ORG_B = { org: { id: 'org-b', name: 'B', slug: 'b' }, role: 'member' as const };

const project = (id: string, mode = ProjectMode.Standard) => ({ id, name: id, slug: id, brandId: null, archivedAt: null, lastActiveAt: '', mode });

const listMemberships = vi.fn(async () => [ORG_A, ORG_B]);
const listProjects = vi.fn(async (_db: unknown, orgId: string) => (orgId === 'org-b' ? [project('b-recent')] : [project('a-secret', ProjectMode.Uncensored), project('a-recent'), project('a-old')]));
const findReachableProject = vi.fn(async (_db: unknown, input: { projectId: string }) =>
  input.projectId.startsWith('foreign') ? null : { orgId: input.projectId.startsWith('b-') ? 'org-b' : 'org-a', project: project(input.projectId) }
);
const findBatch = vi.fn(async (_db: unknown, scope: { orgId: string; batchId: string }) =>
  scope.orgId === 'org-b' && scope.batchId === 'batch-1' ? { id: 'batch-1', projectId: 'b-recent', orgId: 'org-b' } : null
);

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships }));
vi.mock('$lib/server/repos/projects', () => ({ listProjects }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject }));
vi.mock('$lib/server/repos/product-batches', () => ({ findBatch }));

const { toolScope, batchScope } = await import('./tool-scope');

function event(search = '', cookies: Record<string, string> = {}, params: Record<string, string> = {}) {
  return {
    url: new URL(`http://x/app/studio${search}`),
    params,
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

describe('the studio picks its project without a project in the URL path', () => {
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

describe('a batch carries its own project', () => {
  beforeEach(() => vi.clearAllMocks());

  it('finds the batch across the user’s orgs', async () => {
    const scope = await batchScope(event('', {}, { batchId: 'batch-1' }));
    expect(scope).toMatchObject({ orgId: 'org-b', projectId: 'b-recent', batch: { id: 'batch-1' } });
  });

  it('a batch of nobody the user knows is a 404', async () => {
    expect((await refusal(batchScope(event('', {}, { batchId: 'nope' })))).status).toBe(404);
  });
});
