import { describe, expect, it } from 'vitest';
import type { PageRoute } from './page-route';
import { generatorPages, routeRuntime } from './route-runtime';

const BLOG = '/blog/[slug]';
const SHOP = '/shop/[id]';
const FILES = new Map([
  [BLOG, 'src/routes/blog/[slug]/+page.svelte'],
  [SHOP, 'src/routes/shop/[id]/+page.svelte']
]);

type Reply = { entries?: Record<string, string>[]; reasons?: string[] } | 'html';

function setup(replies: Record<string, Reply>, over: { enabled?: boolean; base?: string | null } = {}) {
  const asked: string[] = [];
  let inFlight = 0;
  let overlap = false;
  const shown: PageRoute[][] = [];
  const runtime = routeRuntime({
    base: () => (over.base === undefined ? 'http://127.0.0.1:5173' : over.base),
    enabled: () => over.enabled ?? true,
    files: async () => FILES,
    shown: async (routes) => void shown.push(routes),
    fetcher: async (url) => {
      const file = new URL(String(url)).searchParams.get('file') ?? '';
      asked.push(file);
      overlap ||= inFlight > 0;
      inFlight++;
      await Promise.resolve();
      inFlight--;
      const reply = replies[file];
      return { ok: reply !== undefined && reply !== 'html', json: async () => (reply === 'html' ? Promise.reject(new Error('not json')) : reply) } as Response;
    }
  });

  return { runtime, asked, shown, overlapped: () => overlap };
}

const dynamic = (route: string, sourced?: string[]): PageRoute => ({ route, dynamic: true, sourced });
const sourcedOf = (routes: PageRoute[], route: string) => routes.find((r) => r.route === route)?.sourced;

describe('runtime route entries', () => {
  it('adds the entries a route generates, ahead of the ones found in source', async () => {
    const { runtime } = setup({ [FILES.get(BLOG)!]: { entries: [{ slug: 'hello' }, { slug: 'world' }] } });
    const routes = [dynamic(BLOG, ['/blog/linked'])];
    await runtime.run(routes);

    expect(sourcedOf(runtime.overlay(routes), BLOG)).toEqual(['/blog/hello', '/blog/world', '/blog/linked']);
  });

  it('asks one route at a time and shows the list after each answer', async () => {
    const { runtime, shown, overlapped } = setup({ [FILES.get(BLOG)!]: { entries: [{ slug: 'a1' }] }, [FILES.get(SHOP)!]: { entries: [{ id: '42' }] } });
    await runtime.run([dynamic(BLOG), dynamic(SHOP)]);

    expect(overlapped()).toBe(false);
    expect(shown.map((routes) => routes.flatMap((r) => r.sourced ?? []))).toEqual([['/blog/a1'], ['/blog/a1', '/shop/42']]);
  });

  it('leaves out a route that already has enough examples and a static route', async () => {
    const { runtime, asked } = setup({});
    const full = Array.from({ length: 10 }, (_, i) => `/blog/p${i}`);
    await runtime.run([dynamic(BLOG, full), { route: '/about', dynamic: false }]);

    expect(asked).toEqual([]);
  });

  it('asks nothing when the setting is off', async () => {
    const { runtime, asked } = setup({}, { enabled: false });
    await runtime.run([dynamic(BLOG)]);

    expect(asked).toEqual([]);
  });

  it('asks nothing while there is no dev server, and asks again once there is', async () => {
    let base: string | null = null;
    const asked: string[] = [];
    const runtime = routeRuntime({
      base: () => base,
      enabled: () => true,
      files: async () => FILES,
      shown: async () => undefined,
      fetcher: async (url) => (asked.push(String(url)), { ok: true, json: async () => ({ entries: [] }) } as Response)
    });
    await runtime.run([dynamic(BLOG)]);
    base = 'http://127.0.0.1:5173';
    await runtime.run([dynamic(BLOG)]);

    expect(asked).toHaveLength(1);
  });

  it('keeps going when a route answers with something that is not JSON', async () => {
    const { runtime } = setup({ [FILES.get(BLOG)!]: 'html', [FILES.get(SHOP)!]: { entries: [{ id: '42' }] } });
    const routes = [dynamic(BLOG), dynamic(SHOP)];
    await runtime.run(routes);

    expect(sourcedOf(runtime.overlay(routes), SHOP)).toEqual(['/shop/42']);
  });

  it('drops an entry that does not fill every parameter of the route', async () => {
    const { runtime } = setup({ [FILES.get(BLOG)!]: { entries: [{ other: 'x' }, { slug: 'ok' }] } });
    const routes = [dynamic(BLOG)];
    await runtime.run(routes);

    expect(sourcedOf(runtime.overlay(routes), BLOG)).toEqual(['/blog/ok']);
  });

  it('asks a route only once until one of its files changes', async () => {
    const { runtime, asked } = setup({});
    const routes = [dynamic(BLOG), dynamic(SHOP)];
    await runtime.run(routes);
    await runtime.run(routes);
    await runtime.touched(['src/routes/blog/[slug]/+page.ts']);

    expect(asked).toEqual([FILES.get(BLOG), FILES.get(SHOP), FILES.get(BLOG)]);
  });

  it('asks again every route under a changed layout', async () => {
    const { runtime, asked } = setup({});
    await runtime.run([dynamic(BLOG), dynamic(SHOP)]);
    asked.length = 0;
    await runtime.touched(['src/routes/+layout.ts']);

    expect(asked).toEqual([FILES.get(BLOG), FILES.get(SHOP)]);
  });

  it('ignores a change to a file that is not a route file', async () => {
    const { runtime, asked } = setup({});
    await runtime.run([dynamic(BLOG)]);
    asked.length = 0;
    await runtime.touched(['src/lib/utils.ts']);

    expect(asked).toEqual([]);
  });

  it('shows the source examples only when the setting is off', async () => {
    let on = true;
    const runtime = routeRuntime({
      base: () => 'http://127.0.0.1:5173',
      enabled: () => on,
      files: async () => FILES,
      shown: async () => undefined,
      fetcher: async () => ({ ok: true, json: async () => ({ entries: [{ slug: 'hello' }] }) }) as Response
    });
    const routes = [dynamic(BLOG, ['/blog/linked'])];
    await runtime.run(routes);
    on = false;

    expect(sourcedOf(runtime.overlay(routes), BLOG)).toEqual(['/blog/linked']);
  });

  it('drops the old examples of a changed route that now generates none', async () => {
    const replies: Record<string, Reply> = { [FILES.get(BLOG)!]: { entries: [{ slug: 'hello' }] } };
    const { runtime } = setup(replies);
    const routes = [dynamic(BLOG)];
    await runtime.run(routes);
    replies[FILES.get(BLOG)!] = { entries: [] };
    await runtime.touched(['src/routes/blog/[slug]/+page.ts']);

    expect(sourcedOf(runtime.overlay(routes), BLOG)).toBeUndefined();
  });
});

describe('generatorPages', () => {
  it('maps a dynamic SvelteKit or Astro page to its route and leaves the rest out', () => {
    const files = ['src/routes/blog/[slug]/+page.svelte', 'src/routes/blog/[slug]/+page.ts', 'src/routes/about/+page.svelte', 'src/pages/p/[id].astro', 'app/shop/[id]/page.tsx'];

    expect([...generatorPages(files)]).toEqual([
      ['/blog/[slug]', 'src/routes/blog/[slug]/+page.svelte'],
      ['/p/[id]', 'src/pages/p/[id].astro']
    ]);
  });
});
