<script lang="ts">
  import type { ColourUse } from '$lib/motion/selection-colours';
  import ColourRow from './ColourRow.svelte';

  let { colours, palette, onswap }: { colours: readonly ColourUse[]; palette: () => readonly string[]; onswap: (from: string, to: string) => void } = $props();

  const rowOf = new Map<string, number>();
  let next = 0;

  function keyOf(colour: string): number {
    const known = rowOf.get(colour);
    if (known !== undefined) {
      return known;
    }
    rowOf.set(colour, next);
    return next++;
  }

  function swap(from: string, to: string) {
    rowOf.set(to, keyOf(from));
    rowOf.delete(from);
    onswap(from, to);
  }
</script>

{#each colours as { colour, count } (keyOf(colour))}
  <ColourRow {colour} {count} {palette} onchange={(to) => swap(colour, to)} />
{/each}
