import { describe, expect, it } from 'vitest';
import { addGo, Go } from './go-action';

const at = (file: string, line = 1, col = 1) => ({ file, line, col });
const readers = (files: Record<string, string>) => async (path: string) => files[path] ?? null;
const pkg = (deps: Record<string, string>) => JSON.stringify({ dependencies: deps });

const after = (out: Awaited<ReturnType<typeof addGo>>) => (out.ok ? out.changes[0].after : undefined);

describe('addGo for React', () => {
  const files = { 'package.json': pkg({ react: '19' }) };

  it('adds an inline handler that sets the location', async () => {
    const out = await addGo(readers({ ...files, 'A.tsx': `<button className="x">Go</button>` }), at('A.tsx'), { go: Go.Page, target: '/pricing' });

    expect(after(out)).toBe(`<button className="x" onClick={() => (window.location.href = '/pricing')}>Go</button>`);
  });

  it('opens a url in a new tab', async () => {
    const out = await addGo(readers({ ...files, 'A.tsx': `<button>Go</button>` }), at('A.tsx'), { go: Go.Url, target: 'https://feega.app' });

    expect(after(out)).toBe(`<button onClick={() => window.open('https://feega.app', '_blank', 'noopener,noreferrer')}>Go</button>`);
  });

  it('scrolls to a section id, accepting a leading hash', async () => {
    const out = await addGo(readers({ ...files, 'A.tsx': `<button>Go</button>` }), at('A.tsx'), { go: Go.Section, target: '#pricing' });

    expect(after(out)).toBe(`<button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>Go</button>`);
  });

  it('refuses an element that already handles click', async () => {
    const out = await addGo(readers({ ...files, 'A.tsx': `<button onClick={save}>Go</button>` }), at('A.tsx'), { go: Go.Page, target: '/x' });

    expect(out).toMatchObject({ ok: false });
  });

  it('allows an element that handles another event', async () => {
    const out = await addGo(readers({ ...files, 'A.tsx': `<button onMouseEnter={hover}>Go</button>` }), at('A.tsx'), { go: Go.Page, target: '/x' });

    expect(out.ok).toBe(true);
  });

  it('refuses a link element', async () => {
    const out = await addGo(readers({ ...files, 'A.tsx': `<a href="/a">Go</a>` }), at('A.tsx'), { go: Go.Page, target: '/x' });

    expect(out).toMatchObject({ ok: false });
  });

  it.each([
    [Go.Page, 'pricing'],
    [Go.Page, "/a'b"],
    [Go.Url, 'feega.app'],
    [Go.Section, 'two words']
  ])('refuses a bad %s target %s', async (go, target) => {
    const out = await addGo(readers({ ...files, 'A.tsx': `<button>Go</button>` }), at('A.tsx'), { go, target });

    expect(out.ok).toBe(false);
  });
});

describe('addGo for Next', () => {
  const files = { 'package.json': pkg({ next: '15', react: '19' }) };

  it('marks an app route file as a client component', async () => {
    const out = await addGo(readers({ ...files, 'app/page.jsx': `export default function Page() {\n  return <button>Go</button>;\n}\n` }), at('app/page.jsx', 2, 10), { go: Go.Page, target: '/x' });

    expect(after(out)?.startsWith(`'use client';\n\nexport default`)).toBe(true);
  });

  it('keeps an existing client directive', async () => {
    const out = await addGo(readers({ ...files, 'app/page.jsx': `'use client';\nexport default () => <button>Go</button>;\n` }), at('app/page.jsx', 2, 22), { go: Go.Page, target: '/x' });

    expect(after(out)?.match(/use client/g)).toHaveLength(1);
  });

  it('refuses a file that exports metadata', async () => {
    const out = await addGo(readers({ ...files, 'app/page.jsx': `export const metadata = {};\nexport default () => <button>Go</button>;\n` }), at('app/page.jsx', 2, 22), { go: Go.Page, target: '/x' });

    expect(out).toMatchObject({ ok: false });
  });

  it('does not touch a pages router file', async () => {
    const out = await addGo(readers({ ...files, 'pages/index.jsx': `export default () => <button>Go</button>;\n` }), at('pages/index.jsx', 1, 22), { go: Go.Page, target: '/x' });

    expect(after(out)?.startsWith('export')).toBe(true);
  });
});

describe('addGo for Svelte', () => {
  const kit = { 'package.json': pkg({ svelte: '^5.0.0', '@sveltejs/kit': '^2' }) };

  it('uses goto and imports it into the instance script', async () => {
    const source = `<script>\n  let n = 0;\n</script>\n<button>Go</button>`;
    const out = await addGo(readers({ ...kit, 'a.svelte': source }), at('a.svelte', 4), { go: Go.Page, target: '/x' });

    expect(after(out)).toBe(`<script>\n  import { goto } from '$app/navigation';\n  let n = 0;\n</script>\n<button onclick={() => goto('/x')}>Go</button>`);
  });

  it('creates a script block when the file has none', async () => {
    const out = await addGo(readers({ ...kit, 'a.svelte': `<button>Go</button>` }), at('a.svelte'), { go: Go.Page, target: '/x' });

    expect(after(out)).toBe(`<script>\n  import { goto } from '$app/navigation';\n</script>\n\n<button onclick={() => goto('/x')}>Go</button>`);
  });

  it('skips a module script and reuses the instance one', async () => {
    const source = `<script module>\n  export const a = 1;\n</script>\n<script lang="ts">\n  let n = 0;\n</script>\n<button>Go</button>`;
    const out = await addGo(readers({ ...kit, 'a.svelte': source }), at('a.svelte', 7), { go: Go.Page, target: '/x' });

    expect(after(out)).toContain(`<script lang="ts">\n  import { goto } from '$app/navigation';\n  let n = 0;`);
  });

  it('merges into an existing navigation import', async () => {
    const source = `<script>\n  import { invalidate } from '$app/navigation';\n</script>\n<button>Go</button>`;
    const out = await addGo(readers({ ...kit, 'a.svelte': source }), at('a.svelte', 4), { go: Go.Page, target: '/x' });

    expect(after(out)).toContain(`import { invalidate, goto } from '$app/navigation';`);
  });

  it('does not import goto twice', async () => {
    const source = `<script>\n  import { goto } from '$app/navigation';\n</script>\n<button>Go</button>`;
    const out = await addGo(readers({ ...kit, 'a.svelte': source }), at('a.svelte', 4), { go: Go.Page, target: '/x' });

    expect(after(out)?.match(/goto \}/g)).toHaveLength(1);
  });

  it('uses the location without SvelteKit', async () => {
    const out = await addGo(readers({ 'package.json': pkg({ svelte: '^5' }), 'a.svelte': `<button>Go</button>` }), at('a.svelte'), { go: Go.Page, target: '/x' });

    expect(after(out)).toBe(`<button onclick={() => (window.location.href = '/x')}>Go</button>`);
  });

  it('uses on:click for Svelte 4', async () => {
    const out = await addGo(readers({ 'package.json': pkg({ svelte: '^4.2.0' }), 'a.svelte': `<button>Go</button>` }), at('a.svelte'), { go: Go.Url, target: 'https://a.io' });

    expect(after(out)).toBe(`<button on:click={() => window.open('https://a.io', '_blank', 'noopener,noreferrer')}>Go</button>`);
  });

  it('refuses an on:click directive already there', async () => {
    const out = await addGo(readers({ ...kit, 'a.svelte': `<button on:click={f}>Go</button>` }), at('a.svelte'), { go: Go.Page, target: '/x' });

    expect(out.ok).toBe(false);
  });
});

describe('addGo for Vue', () => {
  it('pushes on the router when it is installed', async () => {
    const out = await addGo(readers({ 'package.json': pkg({ vue: '3', 'vue-router': '4' }), 'A.vue': `<template>\n  <button>Go</button>\n</template>` }), at('A.vue', 2, 3), { go: Go.Page, target: '/x' });

    expect(after(out)).toBe(`<template>\n  <button @click="$router.push('/x')">Go</button>\n</template>`);
  });

  it('goes through the window of the event without a router', async () => {
    const out = await addGo(readers({ 'package.json': pkg({ vue: '3' }), 'A.vue': `<template><button>Go</button></template>` }), at('A.vue', 1, 11), { go: Go.Page, target: '/x' });

    expect(after(out)).toBe(`<template><button @click="$event.view.location.href = '/x'">Go</button></template>`);
  });

  it('scrolls through the document of the event', async () => {
    const out = await addGo(readers({ 'package.json': pkg({ vue: '3' }), 'A.vue': `<template><button>Go</button></template>` }), at('A.vue', 1, 11), { go: Go.Section, target: 'pricing' });

    expect(after(out)).toBe(`<template><button @click="$event.view.document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })">Go</button></template>`);
  });

  it('refuses an element with @click', async () => {
    const out = await addGo(readers({ 'package.json': pkg({ vue: '3' }), 'A.vue': `<template><button @click="f">Go</button></template>` }), at('A.vue', 1, 11), { go: Go.Page, target: '/x' });

    expect(out.ok).toBe(false);
  });
});
