import { describe, expect, it } from 'vitest';
import { linkOf, linkWrite, Opens } from './link-edit';

const at = (file: string, line = 1, col = 1) => ({ file, line, col });
const readers = (files: Record<string, string>) => async (path: string) => files[path] ?? null;

const after = (out: Awaited<ReturnType<typeof linkWrite>>, file: string) => (out.ok ? out.changes.find((c) => c.path === file)?.after : undefined);

describe('linkOf', () => {
  it('reads href and target of an anchor', async () => {
    const read = readers({ 'a.svelte': `<a href="/pricing" target="_blank">x</a>` });

    expect(await linkOf(read, at('a.svelte'))).toMatchObject({ tag: 'a', attr: 'href', value: '/pricing', newTab: true, editable: true });
  });

  it('is not a link for a div', async () => {
    expect(await linkOf(readers({ 'a.svelte': `<div href="/x"></div>` }), at('a.svelte'))).toBeNull();
  });

  it.each([
    ['Link', 'Page.tsx', `import Link from 'next/link';\n<Link href="/a">x</Link>`, 'href', 2],
    ['Link', 'Page.tsx', `import { Link } from 'react-router-dom';\n<Link to="/a">x</Link>`, 'to', 2],
    ['RouterLink', 'A.vue', `<template><RouterLink to="/a">x</RouterLink></template>`, 'to', 1],
    ['NuxtLink', 'A.vue', `<template><NuxtLink to="/a">x</NuxtLink></template>`, 'to', 1]
  ])('reads the destination of %s (%s)', async (tag, file, source, attr, line) => {
    const col = source.split('\n')[line - 1].indexOf(`<${tag}`) + 1;

    expect(await linkOf(readers({ [file]: source }), at(file, line, col))).toMatchObject({ attr, value: '/a', editable: true });
  });

  it('reads a Vue bound string', async () => {
    const out = await linkOf(readers({ 'A.vue': `<template><a :href="'/a'">x</a></template>` }), at('A.vue', 1, 11));

    expect(out).toMatchObject({ value: '/a', editable: true });
  });

  it('resolves a constant defined in the file', async () => {
    const source = `<script>\n  const url = '/docs';\n</script>\n<a href={url}>x</a>`;

    expect(await linkOf(readers({ 'a.svelte': source }), at('a.svelte', 4))).toMatchObject({ value: '/docs', editable: true });
  });

  it('refuses a value that is not a plain string', async () => {
    const out = await linkOf(readers({ 'a.svelte': `<a href={page.url}>x</a>` }), at('a.svelte'));

    expect(out).toMatchObject({ editable: false, value: null });
  });
});

describe('linkWrite', () => {
  it('rewrites a literal href and nothing else', async () => {
    const source = `<a class="x" href="/a">go</a>`;
    const out = await linkWrite(readers({ 'a.svelte': source }), at('a.svelte'), { href: '/b' });

    expect(after(out, 'a.svelte')).toBe(`<a class="x" href="/b">go</a>`);
  });

  it('rewrites the string inside braces keeping its quote', async () => {
    const out = await linkWrite(readers({ 'a.tsx': `<a href={'/a'}>go</a>` }), at('a.tsx'), { href: '/b' });

    expect(after(out, 'a.tsx')).toBe(`<a href={'/b'}>go</a>`);
  });

  it('rewrites a Vue bound string', async () => {
    const out = await linkWrite(readers({ 'a.vue': `<a :href="'/a'">go</a>` }), at('a.vue'), { href: '/b' });

    expect(after(out, 'a.vue')).toBe(`<a :href="'/b'">go</a>`);
  });

  it('writes to the constant where the href is defined', async () => {
    const source = `<script>\n  const url = '/docs';\n</script>\n<a href={url}>x</a>`;
    const out = await linkWrite(readers({ 'a.svelte': source }), at('a.svelte', 4), { href: '/guide' });

    expect(after(out, 'a.svelte')).toBe(`<script>\n  const url = '/guide';\n</script>\n<a href={url}>x</a>`);
  });

  it('writes to the constant of an imported module', async () => {
    const files = { 'src/A.tsx': `import { DOCS } from './links';\nexport const A = () => <a href={DOCS}>x</a>;`, 'src/links.ts': `export const DOCS = '/docs';\n` };
    const out = await linkWrite(readers(files), at('src/A.tsx', 2, 24), { href: '/guide' });

    expect(after(out, 'src/links.ts')).toBe(`export const DOCS = '/guide';\n`);
  });

  it('refuses a computed href and touches nothing', async () => {
    const out = await linkWrite(readers({ 'a.svelte': `<a href={page.url}>x</a>` }), at('a.svelte'), { href: '/b' });

    expect(out.ok).toBe(false);
  });

  it('adds the href an anchor lacks', async () => {
    const out = await linkWrite(readers({ 'a.svelte': `<a class="x">go</a>` }), at('a.svelte'), { href: '/b' });

    expect(after(out, 'a.svelte')).toBe(`<a class="x" href="/b">go</a>`);
  });

  it('refuses a value that would break the attribute', async () => {
    const out = await linkWrite(readers({ 'a.svelte': `<a href="/a">go</a>` }), at('a.svelte'), { href: '/a"b' });

    expect(out.ok).toBe(false);
  });

  it('opens in a new tab with a safe rel', async () => {
    const out = await linkWrite(readers({ 'a.tsx': `<a href="/a">go</a>` }), at('a.tsx'), { opens: Opens.NewTab });

    expect(after(out, 'a.tsx')).toBe(`<a href="/a" target="_blank" rel="noopener noreferrer">go</a>`);
  });

  it('merges into an existing rel', async () => {
    const out = await linkWrite(readers({ 'a.tsx': `<a href="/a" rel="nofollow">go</a>` }), at('a.tsx'), { opens: Opens.NewTab });

    expect(after(out, 'a.tsx')).toBe(`<a href="/a" rel="nofollow noopener noreferrer" target="_blank">go</a>`);
  });

  it('goes back to the same tab removing target and the safe rel', async () => {
    const out = await linkWrite(readers({ 'a.tsx': `<a href="/a" target="_blank" rel="noopener noreferrer">go</a>` }), at('a.tsx'), { opens: Opens.SameTab });

    expect(after(out, 'a.tsx')).toBe(`<a href="/a">go</a>`);
  });

  it('keeps unrelated rel tokens when going back', async () => {
    const out = await linkWrite(readers({ 'a.tsx': `<a href="/a" target="_blank" rel="nofollow noopener">go</a>` }), at('a.tsx'), { opens: Opens.SameTab });

    expect(after(out, 'a.tsx')).toBe(`<a href="/a" rel="nofollow">go</a>`);
  });

  it('refuses a target that is not a literal', async () => {
    const out = await linkWrite(readers({ 'a.tsx': `<a href="/a" target={t}>go</a>` }), at('a.tsx'), { opens: Opens.NewTab });

    expect(out.ok).toBe(false);
  });

  it('writes a multiline tag', async () => {
    const source = `<Link\n  href="/a"\n  className="x"\n>go</Link>`;
    const out = await linkWrite(readers({ 'a.tsx': source }), at('a.tsx'), { opens: Opens.NewTab });

    expect(after(out, 'a.tsx')).toContain('target="_blank"');
    expect(after(out, 'a.tsx')).toContain('rel="noopener noreferrer"');
  });
});
