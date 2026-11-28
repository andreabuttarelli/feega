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

describe('noise in linked examples', () => {
  const BLOG = 'src/routes/blog/[slug]/+page.svelte';
  const linkIn = (file: string, text: string) => sourcedOf(project({ [BLOG]: '', [file]: text }), '/blog/[slug]');

  it.each([
    ['a value equal to its param name', '<a href="/blog/slug">x</a>'],
    ['a single character value', '<a href="/blog/a">x</a>'],
    ['a link inside an html comment', '<!-- <a href="/blog/hello">x</a> -->'],
    ['a link inside a block comment', "/* goto('/blog/hello') */"],
    ['a link inside a line comment', "// goto('/blog/hello')"]
  ])('drops %s', async (_name, text) => {
    expect(await linkIn('src/routes/+page.svelte', text)).toBeUndefined();
  });

  it.each(['src/lib/nav.test.ts', 'src/lib/nav.spec.ts', 'src/lib/Nav.stories.svelte', 'src/__tests__/nav.ts', 'tests/fixtures/nav.ts'])('drops a link found only in %s', async (file) => {
    expect(await linkIn(file, "goto('/blog/hello')")).toBeUndefined();
  });

  it('keeps a link that a real file also has', async () => {
    const root = project({ [BLOG]: '', 'src/a.test.ts': "goto('/blog/hello')", 'src/routes/+page.svelte': '<a href="/blog/hello">x</a>' });

    expect(await sourcedOf(root, '/blog/[slug]')).toEqual(['/blog/hello']);
  });

  it('keeps a url with two slashes after a protocol on the same line', async () => {
    expect(await linkIn('src/routes/+page.svelte', '<a href="https://x.com">x</a> <a href="/blog/hello">x</a>')).toEqual(['/blog/hello']);
  });
});
