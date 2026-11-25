import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../../../packages/library/src/catalog';
import { newPage } from './new-page';

const catalog = buildCatalog();

const project = (files: Record<string, string>) => async (path: string) => files[path] ?? null;

const pkg = (deps: string[]) => JSON.stringify({ dependencies: Object.fromEntries(deps.map((d) => [d, '1'])) });

const paths = (out: Awaited<ReturnType<typeof newPage>>) => (out.ok ? out.changes.map((c) => c.path) : []);

describe('newPage route files', () => {
  it.each([
    ['next', { 'package.json': pkg(['next', 'react']), 'app/layout.tsx': '', 'tsconfig.json': '{}' }, 'app/about/page.tsx'],
    ['next src dir', { 'package.json': pkg(['next', 'react']), 'src/app/layout.tsx': '', 'tsconfig.json': '{}' }, 'src/app/about/page.tsx'],
    ['sveltekit', { 'package.json': pkg(['@sveltejs/kit', 'svelte']) }, 'src/routes/about/+page.svelte'],
    ['astro', { 'package.json': pkg(['astro']) }, 'src/pages/about.astro'],
    ['nuxt', { 'package.json': pkg(['nuxt', 'vue']), 'pages/index.vue': '' }, 'pages/about.vue']
  ])('%s writes %s', async (_name, files, expected) => {
    const out = await newPage(project(files), { route: 'about', item: null, catalog });

    expect(out).toMatchObject({ ok: true, route: '/about' });
    expect(paths(out)).toContain(expected);
  });

  it('turns a typed name into a route', async () => {
    const out = await newPage(project({ 'package.json': pkg(['astro']) }), { route: ' /About Us ', item: null, catalog });

    expect(out).toMatchObject({ ok: true, route: '/about-us' });
  });

  it('allows a nested route', async () => {
    const out = await newPage(project({ 'package.json': pkg(['astro']) }), { route: 'blog/first', item: null, catalog });

    expect(paths(out)).toContain('src/pages/blog/first.astro');
  });

  it('writes a heading in a blank page', async () => {
    const out = await newPage(project({ 'package.json': pkg(['@sveltejs/kit', 'svelte']) }), { route: 'about', item: null, catalog });

    expect(out.ok && out.changes[0].after).toContain('<h1>About</h1>');
    expect(out.ok && out.changes[0].before).toBe('');
  });

  it('fills the page with a library section and its files', async () => {
    const out = await newPage(project({ 'package.json': pkg(['@sveltejs/kit', 'svelte']) }), { route: 'pricing', item: 'pricing', catalog });

    expect(out.ok).toBe(true);
    expect(paths(out)).toEqual(expect.arrayContaining(['src/routes/pricing/+page.svelte', 'src/lib/components/feega/Pricing.svelte']));
    expect(out.ok && out.changes.find((c) => c.path.endsWith('+page.svelte'))!.after).toContain('<Pricing />');
  });
});

describe('newPage refusals', () => {
  it('refuses frameworks whose router needs a config change', async () => {
    const out = await newPage(project({ 'package.json': pkg(['react', 'vite']) }), { route: 'about', item: null, catalog });

    expect(out).toMatchObject({ ok: false });
    expect(out.ok ? '' : out.reason).toContain('router');
  });

  it('refuses a page that already exists', async () => {
    const out = await newPage(project({ 'package.json': pkg(['astro']), 'src/pages/about.astro': 'x' }), { route: 'about', item: null, catalog });

    expect(out).toMatchObject({ ok: false });
  });

  it('refuses an empty, dynamic or pro item request', async () => {
    const files = project({ 'package.json': pkg(['astro']) });

    expect(await newPage(files, { route: ' / ', item: null, catalog })).toMatchObject({ ok: false });
    expect(await newPage(files, { route: '[id]', item: null, catalog })).toMatchObject({ ok: false });
    expect(await newPage(files, { route: 'x', item: 'no-such-item', catalog })).toMatchObject({ ok: false });
  });

  it('refuses Nuxt without a pages folder', async () => {
    const out = await newPage(project({ 'package.json': pkg(['nuxt', 'vue']) }), { route: 'about', item: null, catalog });

    expect(out).toMatchObject({ ok: false });
  });
});
