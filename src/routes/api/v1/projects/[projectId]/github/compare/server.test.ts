import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeGithub, type FakeGithub } from '$lib/server/code-push/fake-github.testkit';
import { githubHost } from '$lib/server/code-push/github-host';
import { EntryKind, linkSchema, type CodeLink } from '$lib/server/code-push/link';

const findReachableProject = vi.fn();
let gh: FakeGithub;
let links: Map<string, CodeLink>;
let marks: Map<string, unknown>;

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => []) }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject: (...args: unknown[]) => findReachableProject(...args) }));
vi.mock('$lib/server/code-push/compare-runtime', () => ({
  compareDeps: () => ({
    host: async () => githubHost(gh.call, { owner: 'acme', repo: 'app', ref: null }),
    links: { read: async (id: string) => links.get(id) ?? null },
    placeOf: async () => ({ canvasId: 'c1', x: 0, y: 0, w: 100, h: 100 }),
    importAt: async () => ({ frameId: `v${marks.size + 1}` }),
    mark: async (id: string, mark: unknown) => {
      marks.set(id, mark);
    }
  })
}));

const compare = await import('./+server');

type Handler = (event: unknown) => Promise<Response>;

async function post(body: unknown) {
  const locals = { safeGetSession: async () => ({ user: { id: 'u1' } }), db: async () => ({}) };
  const url = new URL('https://feega.test/api/v1/projects/p1/github/compare');
  const res = await (compare.POST as Handler)({ params: { projectId: 'p1' }, locals, request: new Request(url, { method: 'POST', body: JSON.stringify(body) }), url });
  return { res, body: await res.json() };
}

beforeEach(() => {
  gh = fakeGithub();
  marks = new Map();
  findReachableProject.mockResolvedValue({ orgId: 'o1', project: { id: 'p1' } });
  const sha = gh.seed('main', { 'src/Hero.tsx': 'v0' });
  gh.seed('feega/x', { 'src/Hero.tsx': 'v1' });
  links = new Map([['n1', linkSchema.parse({ repo: 'acme/app', entryKind: EntryKind.Page, entry: 'src/Hero.tsx', baseBranch: 'main', baseSha: sha })]]);
});

describe('/api/v1/projects/:id/github/compare', () => {
  it('ogni ref diventa un frame versione', async () => {
    const { res, body } = await post({ nodeId: 'n1', refs: ['main', 'feega/x'] });

    expect(res.status).toBe(200);
    expect(body.versions.map((v: { label: string }) => v.label)).toEqual(['main', 'feega/x']);
    expect(marks.size).toBe(2);
  });

  it('un ref sconosciuto è 404', async () => {
    expect((await post({ nodeId: 'n1', refs: ['gone'] })).res.status).toBe(404);
  });

  it('più di quattro ref è 400', async () => {
    expect((await post({ nodeId: 'n1', refs: ['a', 'b', 'c', 'd', 'e'] })).res.status).toBe(400);
  });
});
