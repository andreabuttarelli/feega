import { describe, expect, it } from 'vitest';
import { Place } from './move-node';
import { StructureOp, structure } from './structure';

const SVELTE = `<script>
  import Hero from './Hero.svelte';
  import Pricing from './Pricing.svelte';
</script>

<main>
  <Hero title="a" />
  <Pricing />
</main>
`;

const JSX = `import { Hero } from './Hero';
import { Pricing } from './Pricing';

export default function Page() {
  return (
    <main>
      <Hero title="a" />
      <Pricing />
    </main>
  );
}
`;

const VUE = `<script setup>
import Hero from './Hero.vue';
import Pricing from './Pricing.vue';
</script>

<template>
  <main>
    <Hero title="a" />
    <pricing />
  </main>
</template>
`;

const usage = (text: string, file: string, from: string, to: string, place: Place) =>
  structure(async () => text, { op: StructureOp.MoveUsage, at: { file, line: 1, col: 1 }, usage: { from, to, place } });

describe('moveUsage', () => {
  it('swaps two Svelte component usages in the file that uses them', async () => {
    const out = await usage(SVELTE, 'a.svelte', 'Pricing', 'Hero', Place.Before);

    expect(out.ok && out.changes[0].after).toBe(SVELTE.replace('  <Hero title="a" />\n  <Pricing />\n', '  <Pricing />\n  <Hero title="a" />\n'));
  });

  it('swaps two React component usages', async () => {
    const out = await usage(JSX, 'page.tsx', 'Hero', 'Pricing', Place.After);

    expect(out.ok && out.changes[0].after).toBe(JSX.replace('      <Hero title="a" />\n      <Pricing />\n', '      <Pricing />\n      <Hero title="a" />\n'));
  });

  it('finds a Vue usage written in kebab case', async () => {
    const out = await usage(VUE, 'App.vue', 'Pricing', 'Hero', Place.Before);

    expect(out.ok && out.changes[0].after).toBe(VUE.replace('    <Hero title="a" />\n    <pricing />\n', '    <pricing />\n    <Hero title="a" />\n'));
  });

  it('refuses when a usage is not in the file', async () => {
    const out = await usage(SVELTE, 'a.svelte', 'Footer', 'Hero', Place.Before);

    expect(out.ok).toBe(false);
  });
});
