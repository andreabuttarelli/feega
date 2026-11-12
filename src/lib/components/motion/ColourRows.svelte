<script lang="ts">
  import type { ColourUse } from '$lib/motion/selection-colours';
  import ColourRow from './ColourRow.svelte';

  let { colours, palette, onswap }: { colours: readonly ColourUse[]; palette: () => readonly string[]; onswap: (from: string, to: string) => void } = $props();
</script>

{#each colours as { colour, count } (colour)}
  <ColourRow {colour} {count} {palette} onchange={(to) => onswap(colour, to)} />
{/each}
