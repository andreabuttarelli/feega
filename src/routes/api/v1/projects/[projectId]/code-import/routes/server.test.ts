import { describe, it, expect, vi, beforeEach } from 'vitest';

const findReachableProject = vi.fn();
const treeOf = vi.fn();
const rawReader = vi.fn();

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => []) }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject: (...args: unknown[]) => findReachableProject(...args) }));
vi.mock('$lib/server/code-import/github', async (actual) => ({ ...(await actual<object>()), treeOf: (...args: unknown[]) => treeOf(...args) }));
vi.mock('$lib/server/code-import/repo-sync', async (actual) => ({ ...(await actual<object>()), rawReader: (...args: unknown[]) => rawReader(...args) }));

const route = await import('./+server');

type Handler = (event: unknown) => Promise<Response>;

const KIT = JSON.stringify({ scripts: { dev: 'vite dev' }, devDependencies: { '@sveltejs/kit': '2' } });
const NEXT = JSON.stringify({ scripts: { dev: 'next dev' }, dependencies: { next: '16' } });

function repoOf(texts: Record<string, string>, files: string[]) {
  treeOf.mockResolvedValue([...Object.keys(texts), ...files]);
  rawReader.mockReturnValue(async (path: string) => texts[path] ?? null);
}

async function call(query: string) {
  const locals = { safeGetSession: async () => ({ user: { id: 'u1' } }), db: async () => ({}) };
  const url = new URL(`https://feega.test/api/v1/projects/p1/code-import/routes?${query}`);
  const res = await (route.GET as Handler)({ params: { projectId: 'p1' }, locals, request: new Request(url), url });
  return { res, body: await res.json() };
}

beforeEach(() => {
  findReachableProject.mockResolvedValue({ orgId: 'o1', project: { id: 'p1' } });
});

describe('GET /api/v1/projects/:id/code-import/routes', () => {
  it('lists the pages of a GitHub repo from its tree, without booting it', async () => {
    repoOf({ 'package.json': KIT }, ['src/routes/+page.svelte', 'src/routes/wiki/+page.svelte', 'src/routes/wiki/[slug]/+page.svelte']);

    const { res, body } = await call('repo=https%3A%2F%2Fgithub.com%2Facme%2Fsite%2Ftree%2Fmain');

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ framework: 'sveltekit', app: '', max: 20 });
    expect(body.routes.map((r: { path: string; kind: string; selected: boolean }) => [r.path, r.kind, r.selected])).toEqual([
      ['/', 'static', true],
      ['/wiki', 'static', true],
      ['/wiki/[slug]', 'dynamic', false]
    ]);
    expect(treeOf.mock.calls.at(-1)![1]).toEqual({ owner: 'acme', repo: 'site', ref: 'main' });
  });

  it('a monorepo answers 409 with the apps, and the app picked answers its pages', async () => {
    repoOf({ 'package.json': JSON.stringify({ workspaces: ['apps/*'] }), 'apps/web/package.json': NEXT, 'apps/site/package.json': KIT }, ['apps/web/app/page.tsx', 'apps/web/app/pricing/page.tsx']);

    const many = await call('repo=https%3A%2F%2Fgithub.com%2Facme%2Fmono');
    const picked = await call('repo=https%3A%2F%2Fgithub.com%2Facme%2Fmono&app=apps%2Fweb');

    expect(many.res.status).toBe(409);
    expect(many.body).toMatchObject({ error: 'choose_app', apps: ['apps/site', 'apps/web'] });
    expect(picked.body.routes.map((r: { path: string }) => r.path)).toEqual(['/', '/pricing']);
  });

  it('routes defined in code are refused with the reason', async () => {
    repoOf({ 'package.json': JSON.stringify({ scripts: { dev: 'react-router dev' }, devDependencies: { '@react-router/dev': '7' } }), 'app/routes.ts': 'export default [layout("routes/shell.tsx", [index("routes/home.tsx")])];' }, ['app/root.tsx']);

    const { res, body } = await call('repo=https%3A%2F%2Fgithub.com%2Facme%2Frr');

    expect(res.status).toBe(422);
    expect(body).toEqual({ error: 'routes_in_code', detail: 'routes defined in code, not discoverable statically' });
  });

  it('without a source the request is wrong', async () => {
    const { res } = await call('');
    expect(res.status).toBe(400);
  });
});
