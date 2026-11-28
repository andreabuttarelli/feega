import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listRoutes } from './project-routes';

function project(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'feega-examples-'));
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  }

  return root;
}

const sourcedOf = async (root: string, route: string) => (await listRoutes(root)).find((r) => r.route === route)?.sourced;

const PAGE = 'src/routes/alternatives/[slug=alternative]/+page.svelte';

describe('examples from source', () => {
  it('finds literal links in components', async () => {
    const root = project({ [PAGE]: '', 'src/routes/+page.svelte': '<a href="/alternatives/figma">Figma</a>\n<a href="/alternatives/canva">Canva</a>' });

    expect(await sourcedOf(root, '/alternatives/[slug=alternative]')).toEqual(['/alternatives/figma', '/alternatives/canva']);
  });

  it('finds links in markdown', async () => {
    const root = project({ [PAGE]: '', 'content/post.md': 'Try [Figma](/alternatives/figma).' });

    expect(await sourcedOf(root, '/alternatives/[slug=alternative]')).toEqual(['/alternatives/figma']);
  });

  it('leaves a declared static page out of the examples', async () => {
    const root = project({
      'src/routes/blog/[slug]/+page.svelte': '',
      'src/routes/blog/new/+page.svelte': '',
      'src/routes/+page.svelte': '<a href="/blog/new">New</a><a href="/blog/hello">Hello</a>'
    });

    expect(await sourcedOf(root, '/blog/[slug]')).toEqual(['/blog/hello']);
  });

  it('reads prerender entries mapped over an imported list', async () => {
    const root = project({
      'src/routes/for/[slug=stack]/+page.svelte': '',
      'src/routes/for/[slug=stack]/+page.ts': "import { STACKS } from '$lib/stacks';\nexport const entries = () => STACKS.map((s) => ({ slug: s.slug }));",
      'src/lib/stacks.ts': "export const STACKS = [{ slug: 'react', name: 'React' }, { slug: 'vue', name: 'Vue' }];"
    });

    expect(await sourcedOf(root, '/for/[slug=stack]')).toEqual(['/for/react', '/for/vue']);
  });

  it('reads Next generateStaticParams', async () => {
    const root = project({ 'app/blog/[slug]/page.tsx': "export function generateStaticParams() {\n  return [{ slug: 'a' }, { slug: 'b' }];\n}\nexport default function Page() { return null; }" });

    expect(await sourcedOf(root, '/blog/[slug]')).toEqual(['/blog/a', '/blog/b']);
  });

  it('reads Astro getStaticPaths', async () => {
    const root = project({ 'src/pages/blog/[slug].astro': "---\nexport function getStaticPaths() {\n  return [{ params: { slug: 'a' } }];\n}\n---\n<h1>x</h1>" });

    expect(await sourcedOf(root, '/blog/[slug]')).toEqual(['/blog/a']);
  });

  it('lists an entry once when a link points to it too', async () => {
    const root = project({
      'src/routes/blog/[slug]/+page.svelte': '',
      'src/routes/blog/[slug]/+page.ts': "export const entries = () => [{ slug: 'a' }];",
      'src/routes/+page.svelte': '<a href="/blog/a">A</a>'
    });

    expect(await sourcedOf(root, '/blog/[slug]')).toEqual(['/blog/a']);
  });

  it('skips node_modules and build folders', async () => {
    const root = project({ [PAGE]: '', 'node_modules/x/index.js': 'goto("/alternatives/ghost")', '.svelte-kit/out.js': 'goto("/alternatives/ghost")' });

    expect(await sourcedOf(root, '/alternatives/[slug=alternative]')).toBeUndefined();
  });

  it('skips files over the size cap', async () => {
    const root = project({ [PAGE]: '', 'src/big.ts': `${' '.repeat(300_000)}goto('/alternatives/big')` });

    expect(await sourcedOf(root, '/alternatives/[slug=alternative]')).toBeUndefined();
  });

  it('follows an edited file', async () => {
    const root = project({ [PAGE]: '', 'src/routes/+page.svelte': '<a href="/alternatives/figma">x</a>' });
    await sourcedOf(root, '/alternatives/[slug=alternative]');
    const file = join(root, 'src/routes/+page.svelte');
    writeFileSync(file, '<a href="/alternatives/canva">x</a>');
    utimesSync(file, new Date(), new Date(Date.now() + 5000));

    expect(await sourcedOf(root, '/alternatives/[slug=alternative]')).toEqual(['/alternatives/canva']);
  });

  it('caps the examples of one route', async () => {
    const links = Array.from({ length: 80 }, (_, i) => `<a href="/blog/p${i}">x</a>`).join('');
    const root = project({ 'src/routes/blog/[slug]/+page.svelte': '', 'src/routes/+page.svelte': links });

    expect((await sourcedOf(root, '/blog/[slug]'))?.length).toBe(50);
  });
});
