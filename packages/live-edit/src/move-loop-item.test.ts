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
