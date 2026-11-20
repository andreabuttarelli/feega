import { describe, expect, it } from 'vitest';
import { StructureOp, structure } from './structure';

const LINKS = `export const HEADER_LINKS = [
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

const TSX = `const PLANS = ['a', 'b', 'c'];

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

const PROJECT = { 'src/routes/+page.svelte': NAV, 'src/lib/site/links.ts': LINKS };

const run = (map: Record<string, string>, file: string, line: number, col: number, op: StructureOp, instance?: number) =>
  structure(async (path) => map[path] ?? null, { op, at: { file, line, col }, instance });

const nav = (op: StructureOp, instance?: number) => run(PROJECT, 'src/routes/+page.svelte', 7, 5, op, instance);

const DOWNLOAD = "{ href: '/download', label: 'Download' }";
const DOCS = '{ href: DOCS_URL, label: \'Docs\' }';
const PRICING = "{ href: '/pricing', label: 'Pricing' }";

const arrayOf = (...entries: string[]) => `export const HEADER_LINKS = [\n${entries.map((e) => `  ${e},\n`).join('')}] as const;\n`;

describe('duplicating a loop item', () => {
  it('copies the entry of an imported array right after itself', async () => {
    const out = await nav(StructureOp.Duplicate, 1);

    expect(out.ok && out.changes.map((c) => c.path)).toEqual(['src/lib/site/links.ts']);
    expect(out.ok && out.changes[0].after).toBe(arrayOf(DOWNLOAD, DOCS, DOCS, PRICING));
  });

  it('copies the last entry and keeps the trailing comma', async () => {
    const out = await nav(StructureOp.Duplicate, 2);

    expect(out.ok && out.changes[0].after).toBe(arrayOf(DOWNLOAD, DOCS, PRICING, PRICING));
  });

  it('keeps a one-line array on one line', async () => {
    const out = await run({ 'a.tsx': TSX }, 'a.tsx', 7, 9, StructureOp.Duplicate, 0);

    expect(out.ok && out.changes[0].after).toBe(TSX.replace("['a', 'b', 'c']", "['a', 'a', 'b', 'c']"));
  });

  it('copies the entry behind a v-for', async () => {
    const out = await run({ 'App.vue': VUE }, 'App.vue', 7, 5, StructureOp.Duplicate, 1);

    expect(out.ok && out.changes[0].after).toBe(VUE.replace('{ n: 2 }, { n: 3 }', '{ n: 2 }, { n: 2 }, { n: 3 }'));
  });

  it('refuses without the position of the item', async () => {
    const out = await nav(StructureOp.Duplicate);

    expect(out.ok).toBe(false);
    expect(!out.ok && out.reason).toMatch(/position/);
  });

  it('refuses an item outside the array', async () => {
    const out = await nav(StructureOp.Duplicate, 7);

    expect(!out.ok && out.reason).toMatch(/outside the array/);
  });

  it('refuses when the array comes from props, naming why', async () => {
    const page = NAV.replace("  import { HEADER_LINKS } from '$lib/site/links';", '  let { HEADER_LINKS } = $props();');
    const out = await run({ 'src/routes/+page.svelte': page }, 'src/routes/+page.svelte', 7, 5, StructureOp.Duplicate, 0);

    expect(!out.ok && out.reason).toMatch(/props, fetched data or a store/);
  });
});

describe('deleting a loop item', () => {
  it.each([
    [0, arrayOf(DOCS, PRICING)],
    [1, arrayOf(DOWNLOAD, PRICING)],
    [2, arrayOf(DOWNLOAD, DOCS)]
  ])('removes entry %i and its separator', async (index, expected) => {
    const out = await nav(StructureOp.Delete, index);

    expect(out.ok && out.changes[0].after).toBe(expected);
  });

  it('removes the entry of a one-line array', async () => {
    const out = await run({ 'a.tsx': TSX }, 'a.tsx', 7, 9, StructureOp.Delete, 2);

    expect(out.ok && out.changes[0].after).toBe(TSX.replace("['a', 'b', 'c']", "['a', 'b']"));
  });

  it('empties the array of the last entry and warns', async () => {
    const out = await run({ 'a.tsx': TSX.replace("['a', 'b', 'c']", "['a']") }, 'a.tsx', 7, 9, StructureOp.Delete, 0);

    expect(out.ok && out.changes[0].after).toContain('const PLANS = [];');
    expect(out.ok && out.note).toMatch(/empty/);
  });
});

describe('adding a loop item', () => {
  it('appends a copy of the selected entry', async () => {
    const out = await nav(StructureOp.AddItem, 0);

    expect(out.ok && out.changes[0].after).toBe(arrayOf(DOWNLOAD, DOCS, PRICING, DOWNLOAD));
  });

  it('refuses an element that no loop renders', async () => {
    const out = await run({ 'a.svelte': '<p>hi</p>\n' }, 'a.svelte', 1, 1, StructureOp.AddItem, 0);

    expect(!out.ok && out.reason).toMatch(/not rendered by a loop/);
  });
});
