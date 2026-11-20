import { describe, expect, it } from 'vitest';
import { StructureOp, structure } from './structure';

const SVELTE = `<script>
  const plans = [
    { name: 'Starter' },
    { name: 'Studio' },
    { name: 'Team' }
  ];
</script>

<ul>
  {#each plans as plan}
    <li>{plan.name}</li>
  {/each}
</ul>
`;

const JSX = `const PLANS = ['a', 'b', 'c'];

export default function Page() {
  return (
    <ul>
      {PLANS.map((plan) => (
        <li key={plan}>{plan}</li>
      ))}
    </ul>
  );
}
`;

const VUE = `<script setup>
const plans = [{ n: 1 }, { n: 2 }, { n: 3 }];
</script>

<template>
  <ul>
    <li v-for="plan in plans" :key="plan.n">{{ plan.n }}</li>
  </ul>
</template>
`;

const FETCHED = `<script>
  let { plans } = $props();
</script>

<ul>
  {#each plans as plan}
    <li>{plan}</li>
  {/each}
</ul>
`;

const loop = (text: string, file: string, line: number, col: number, from: number, to: number) =>
  structure(async () => text, { op: StructureOp.MoveLoopItem, at: { file, line, col }, loop: { from, to } });

const LINKS = `import { DOCS_URL } from './urls';

export const HEADER_LINKS = [
  { href: '/download', label: 'Download' },
  { href: DOCS_URL, label: 'Docs' },
  { href: '/pricing', label: 'Pricing' },
] as const;
`;

const NAV = `<script lang="ts">
  import { HEADER_LINKS } from '$lib/site/links';
</script>

<nav>
  {#each HEADER_LINKS as link}
    <a class="chip" href={link.href}>{link.label}</a>
  {/each}
</nav>
`;

const NAV_TSX = `import { HEADER_LINKS } from '../site/links';

export function Nav() {
  return (
    <nav>
      {HEADER_LINKS.map((link) => (
        <a key={link.href} href={link.href}>{link.label}</a>
      ))}
    </nav>
  );
}
`;

const NAV_VUE = `<script setup lang="ts">
import { HEADER_LINKS } from '@/site/links';
</script>

<template>
  <nav>
    <a v-for="link in HEADER_LINKS" :key="link.href" :href="link.href">{{ link.label }}</a>
  </nav>
</template>
`;

const files = (map: Record<string, string>) => async (path: string) => map[path] ?? null;

const moved = (map: Record<string, string>, file: string, line: number, col: number, from: number, to: number) =>
  structure(files(map), { op: StructureOp.MoveLoopItem, at: { file, line, col }, loop: { from, to } });

describe('moveLoopItem across files', () => {
  it('reorders an array imported through the $lib alias, keeping as const and the trailing comma', async () => {
    const out = await moved({ 'src/routes/+page.svelte': NAV, 'src/lib/site/links.ts': LINKS }, 'src/routes/+page.svelte', 7, 5, 2, 0);

    expect(out.ok && out.changes.map((c) => c.path)).toEqual(['src/lib/site/links.ts']);
    expect(out.ok && out.changes[0].after).toBe(
      LINKS.replace(
        "{ href: '/download', label: 'Download' },\n  { href: DOCS_URL, label: 'Docs' },\n  { href: '/pricing', label: 'Pricing' },",
        "{ href: '/pricing', label: 'Pricing' },\n  { href: '/download', label: 'Download' },\n  { href: DOCS_URL, label: 'Docs' },"
      )
    );
  });

  it('follows a relative import behind a .map() in JSX', async () => {
    const out = await moved({ 'src/nav/Nav.tsx': NAV_TSX, 'src/site/links.ts': LINKS }, 'src/nav/Nav.tsx', 7, 9, 0, 1);

    expect(out.ok && out.changes[0].path).toBe('src/site/links.ts');
    expect(out.ok && out.changes[0].after).toContain("{ href: DOCS_URL, label: 'Docs' },\n  { href: '/download', label: 'Download' },");
  });

  it('follows the @ alias behind a v-for in Vue', async () => {
    const out = await moved({ 'src/Nav.vue': NAV_VUE, 'src/site/links.ts': LINKS }, 'src/Nav.vue', 7, 5, 1, 2);

    expect(out.ok && out.changes[0].path).toBe('src/site/links.ts');
    expect(out.ok && out.changes[0].after).toContain("{ href: '/pricing', label: 'Pricing' },\n  { href: DOCS_URL, label: 'Docs' },");
  });

  it('reads through satisfies and a type annotation', async () => {
    const typed = `export const LINKS: readonly Link[] = [\n  { label: 'a' },\n  { label: 'b' }\n] satisfies readonly Link[];\n`;
    const page = NAV.replaceAll('HEADER_LINKS', 'LINKS');
    const out = await moved({ 'src/routes/+page.svelte': page, 'src/lib/site/links.ts': typed }, 'src/routes/+page.svelte', 7, 5, 1, 0);

    expect(out.ok && out.changes[0].after).toBe(`export const LINKS: readonly Link[] = [\n  { label: 'b' },\n  { label: 'a' }\n] satisfies readonly Link[];\n`);
  });

  it.each([
    ['a function call', NAV, 'export const HEADER_LINKS = buildLinks();\n', /built by an expression/],
    ['a spread', NAV, "export const HEADER_LINKS = [...BASE, { href: '/x' }];\n", /spreads/],
    ['a filter chain', NAV.replace('HEADER_LINKS as', 'HEADER_LINKS.filter(Boolean) as'), "export const HEADER_LINKS = [{ href: '/x' }];\n", /function call or chain/],
    ['props', NAV, 'export {};\n', /props, fetched data or a store/]
  ])('refuses %s and names why', async (_name, page, data, reason) => {
    const out = await moved({ 'src/routes/+page.svelte': page, 'src/lib/site/links.ts': data }, 'src/routes/+page.svelte', 7, 5, 0, 1);

    expect(out.ok).toBe(false);
    expect(!out.ok && out.reason).toMatch(reason);
  });
});

describe('moveLoopItem', () => {
  it('reorders the objects of an array literal behind an {#each} block', async () => {
    const out = await loop(SVELTE, 'a.svelte', 11, 5, 2, 0);

    expect(out.ok && out.changes[0].after).toBe(SVELTE.replace("{ name: 'Starter' },\n    { name: 'Studio' },\n    { name: 'Team' }", "{ name: 'Team' },\n    { name: 'Starter' },\n    { name: 'Studio' }"));
  });

  it('reorders the items behind a .map() call in JSX', async () => {
    const out = await loop(JSX, 'page.tsx', 7, 9, 0, 1);

    expect(out.ok && out.changes[0].after).toBe(JSX.replace("['a', 'b', 'c']", "['b', 'a', 'c']"));
  });

  it('reorders the items behind a v-for in Vue', async () => {
    const out = await loop(VUE, 'App.vue', 7, 5, 0, 2);

    expect(out.ok && out.changes[0].after).toBe(VUE.replace('[{ n: 1 }, { n: 2 }, { n: 3 }]', '[{ n: 2 }, { n: 3 }, { n: 1 }]'));
  });

  it('refuses when the data is not an array literal in the same file', async () => {
    const out = await loop(FETCHED, 'a.svelte', 7, 5, 0, 1);

    expect(out.ok).toBe(false);
    expect(!out.ok && out.reason).toMatch(/array/);
  });
});
