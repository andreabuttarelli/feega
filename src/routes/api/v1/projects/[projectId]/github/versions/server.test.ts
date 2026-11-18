import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeGithub, type FakeGithub } from '$lib/server/code-push/fake-github.testkit';
import { githubHost } from '$lib/server/code-push/github-host';
import { EntryKind, linkSchema, type CodeLink } from '$lib/server/code-push/link';

const findReachableProject = vi.fn();
let gh: FakeGithub;
let links: Map<string, CodeLink>;

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => []) }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject: (...args: unknown[]) => findReachableProject(...args) }));
vi.mock('$lib/server/code-push/frames-runtime', () => ({
  framesDeps: () => ({
    host: async () => githubHost(gh.call, { owner: 'acme', repo: 'app', ref: null }),
    links: { read: async (id: string) => links.get(id) ?? null }
  })
}));

const versions = await import('./+server');

type Handler = (event: unknown) => Promise<Response>;
type Named = { name: string };
type Shaed = { sha: string };

async function post(body: unknown) {
  const locals = { safeGetSession: async () => ({ user: { id: 'u1' } }), db: async () => ({}) };
  const url = new URL('https://feega.test/api/v1/projects/p1/github/versions');
  const res = await (versions.POST as Handler)({ params: { projectId: 'p1' }, locals, request: new Request(url, { method: 'POST', body: JSON.stringify(body) }), url });
  return { res, body: await res.json() };
}

let heroSha: string;
let branchSha: string;

beforeEach(() => {
  gh = fakeGithub();
  findReachableProject.mockResolvedValue({ orgId: 'o1', project: { id: 'p1' } });
  heroSha = gh.seed('main', { 'README.md': 'hi', 'src/Hero.tsx': 'v0' });
  gh.seed('main', { 'README.md': 'changed', 'src/Hero.tsx': 'v0' });
  branchSha = gh.seed('feega/x', { 'src/Hero.tsx': 'v1' });
  gh.tag('v1', 'main');
  links = new Map([['n1', linkSchema.parse({ repo: 'acme/app', entryKind: EntryKind.Page, entry: 'src/Hero.tsx', baseBranch: 'main', baseSha: heroSha })]]);
});

describe('/api/v1/projects/:id/github/versions', () => {
  it('rami, tag e la storia del solo file del frame', async () => {
    const { res, body } = await post({ nodeId: 'n1' });

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.entry).toBe('src/Hero.tsx');
    expect(body.refs.map((r: Named) => r.name)).toEqual(['main', 'feega/x', 'v1']);
    expect(body.commits.map((c: Shaed) => c.sha)).toEqual([heroSha]);
    expect(body.pulls).toEqual([]);
  });

  it('la storia segue il ref chiesto', async () => {
    const { body } = await post({ nodeId: 'n1', ref: 'feega/x' });

    expect(body.commits.map((c: Shaed) => c.sha)).toEqual([branchSha]);
  });

  it('un frame senza link è 404', async () => {
    const { res, body } = await post({ nodeId: 'none' });

    expect(res.status).toBe(404);
    expect(body).toMatchObject({ ok: false, refusal: 'not_linked' });
  });

  it('un corpo senza nodeId è 400', async () => {
    expect((await post({})).res.status).toBe(400);
  });
});
