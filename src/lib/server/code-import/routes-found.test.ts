import { describe, expect, it, vi } from 'vitest';
import { CandidateFrom, DiscoveryRefusal, RouteKind } from './routes-discover';
import { allRoutes, leftOut, RouteLeftOut, routesAt, tooManyRoutes, UNREADABLE } from './routes-found';
import { Framework, PlanRefusal } from './run-plan';
import { MAX_ROUTES } from './repo';

const KIT = JSON.stringify({ scripts: { dev: 'vite dev' }, devDependencies: { '@sveltejs/kit': '2' } });
const NEXT = JSON.stringify({ scripts: { dev: 'next dev' }, dependencies: { next: '16' } });

function sourceOf(texts: Record<string, string>, extra: string[] = []) {
  const read = vi.fn(async (path: string) => texts[path] ?? null);
  return { source: { files: async () => [...Object.keys(texts), ...extra], read }, read };
}

describe('routesAt: the routes of a source, without booting it', () => {
  it('plans the app from its manifests, then reads its file router', async () => {
    const { source } = sourceOf({ 'package.json': KIT, 'src/routes/blog/[slug]/+page.ts': "export const entries = () => [{ slug: 'hello' }];" }, ['src/routes/+page.svelte', 'src/routes/blog/[slug]/+page.svelte', 'src/lib/Button.svelte']);

    const found = await routesAt(source, null);

    expect(found).toMatchObject({ ok: true, framework: Framework.SvelteKit, app: '' });
    expect(found.ok && found.routes.map((r) => [r.path, r.kind, r.candidates.map((c) => c.path)])).toEqual([
      ['/', RouteKind.Static, []],
      ['/blog/[slug]', RouteKind.Dynamic, ['/blog/hello']]
    ]);
  });

  it('reads only manifests and route sources, never every file', async () => {
    const { source, read } = sourceOf({ 'package.json': KIT }, ['src/routes/+page.svelte', 'src/lib/Big.svelte', 'README.md']);

    await routesAt(source, null);

    expect(read.mock.calls.map((c) => c[0])).toEqual(['package.json']);
  });

  it('a monorepo with several apps asks which one, listing them', async () => {
    const { source } = sourceOf({ 'package.json': JSON.stringify({ workspaces: ['apps/*'] }), 'apps/web/package.json': NEXT, 'apps/site/package.json': KIT }, ['apps/web/app/page.tsx', 'apps/site/src/routes/+page.svelte']);

    expect(await routesAt(source, null)).toMatchObject({ ok: false, error: PlanRefusal.ChooseApp, apps: ['apps/site', 'apps/web'] });
    expect(await routesAt(source, 'apps/site')).toMatchObject({ ok: true, app: 'apps/site', routes: [{ path: '/', file: 'apps/site/src/routes/+page.svelte' }] });
  });

  it.each([
    { name: 'a file list that cannot be read', source: { files: async () => null, read: async () => null }, error: UNREADABLE },
    { name: 'a Vite app with no file router', source: sourceOf({ 'package.json': JSON.stringify({ scripts: { dev: 'vite' }, devDependencies: { vite: '7' } }) }, ['src/App.tsx']).source, error: DiscoveryRefusal.NoRouter }
  ])('$name is refused with a reason', async ({ source, error }) => {
    expect(await routesAt(source, null)).toMatchObject({ ok: false, error, detail: expect.any(String) });
  });
});

const ROUTES = [
  { path: '/', file: 'a', router: 'sveltekit', kind: RouteKind.Static, params: [], selected: true, candidates: [] },
  { path: '/about', file: 'b', router: 'sveltekit', kind: RouteKind.Static, params: [], selected: true, candidates: [] },
  { path: '/pricing', file: 'c', router: 'sveltekit', kind: RouteKind.Static, params: [], selected: true, candidates: [] },
  { path: '/blog/[slug]', file: 'd', router: 'sveltekit', kind: RouteKind.Dynamic, params: ['slug'], selected: false, candidates: [{ path: '/blog/hello', from: CandidateFrom.Code }] },
  { path: '/docs/[...path]', file: 'e', router: 'sveltekit', kind: RouteKind.Dynamic, params: ['path'], selected: false, candidates: [] }
] as never[];

describe('leftOut: which discovered routes an import did not bring, and why', () => {
  it('names each route left out with its reason, dynamic ones with values seen in links', () => {
    const report = leftOut(ROUTES, { asked: ['/', '/pricing', '/blog/hello'], landed: ['/', '/blog/hello · dark'], links: ['/docs/a/b'] });

    expect(report).toEqual([
      { path: '/about', reason: RouteLeftOut.NotSelected, candidates: [] },
      { path: '/pricing', reason: RouteLeftOut.NotOpened, candidates: [] },
      { path: '/docs/[...path]', reason: RouteLeftOut.NeedsValue, candidates: [{ path: '/docs/a/b', from: CandidateFrom.Links }] }
    ]);
  });
});

describe('the route cap', () => {
  it('all = the selected (static) routes', () => {
    expect(allRoutes(ROUTES)).toEqual(['/', '/about', '/pricing']);
  });

  it('beyond the cap the import is refused with the count, never trimmed', () => {
    expect(tooManyRoutes(Array.from({ length: MAX_ROUTES }, (_, i) => `/r${i}`))).toBeNull();
    expect(tooManyRoutes(Array.from({ length: MAX_ROUTES + 3 }, (_, i) => `/r${i}`))).toBe(`${MAX_ROUTES + 3} pages asked, at most ${MAX_ROUTES} per import: pick fewer`);
  });
});
