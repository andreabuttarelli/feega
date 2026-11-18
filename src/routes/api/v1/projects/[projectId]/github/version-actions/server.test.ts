import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeGithub, type FakeGithub } from '$lib/server/code-push/fake-github.testkit';
import { githubHost } from '$lib/server/code-push/github-host';
import { EntryKind, linkSchema, type CodeLink } from '$lib/server/code-push/link';

const findReachableProject = vi.fn();
let gh: FakeGithub;
let links: Map<string, CodeLink>;
let oldSha: string;

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => []) }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject: (...args: unknown[]) => findReachableProject(...args) }));
vi.mock('$lib/server/code-push/compare-runtime', () => ({
  actionDeps: () => ({
    host: async () => githubHost(gh.call, { owner: 'acme', repo: 'app', ref: null }),
    links: { read: async (id: string) => links.get(id) ?? null, save: async (id: string, l: CodeLink) => Boolean(links.set(id, l)) },
    markOf: async (id: string) => (id === 'v1' ? { of: 'n1', ref: 'old', label: 'old', sha: oldSha, entry: 'src/Hero.tsx' } : null),
    copyAsVariant: async () => 'variant-1'
  })
}));

const actions = await import('./+server');

type Handler = (event: unknown) => Promise<Response>;

async function post(body: unknown) {
  const locals = { safeGetSession: async () => ({ user: { id: 'u1' } }), db: async () => ({}) };
  const url = new URL('https://feega.test/api/v1/projects/p1/github/version-actions');
  const res = await (actions.POST as Handler)({ params: { projectId: 'p1' }, locals, request: new Request(url, { method: 'POST', body: JSON.stringify(body) }), url });
  return { res, body: await res.json() };
}

beforeEach(() => {
  gh = fakeGithub();
  findReachableProject.mockResolvedValue({ orgId: 'o1', project: { id: 'p1' } });
  oldSha = gh.seed('main', { 'src/Hero.tsx': 'old' });
  const head = gh.seed('main', { 'src/Hero.tsx': 'new' });
  links = new Map([['n1', linkSchema.parse({ repo: 'acme/app', entryKind: EntryKind.Page, entry: 'src/Hero.tsx', baseBranch: 'main', baseSha: head })]]);
});

describe('/api/v1/projects/:id/github/version-actions', () => {
  it('restore, variant e diff del codice', async () => {
    expect((await post({ versionId: 'v1', action: 'restore' })).body).toEqual({ ok: true, nodeId: 'n1', paths: ['src/Hero.tsx'] });
    expect((await post({ versionId: 'v1', action: 'variant' })).body).toEqual({ ok: true, frameId: 'variant-1' });
    expect((await post({ versionId: 'v1', action: 'code_diff' })).body.files).toEqual([{ path: 'src/Hero.tsx', before: 'new', after: 'old' }]);
  });

  it('un frame che non è una versione è 404', async () => {
    expect((await post({ versionId: 'n1', action: 'restore' })).res.status).toBe(404);
  });

  it('un’azione sconosciuta è 400', async () => {
    expect((await post({ versionId: 'v1', action: 'merge' })).res.status).toBe(400);
  });
});
