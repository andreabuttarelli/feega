<script lang="ts">
  import type { MotionDoc } from '@feega/motion-core/motion/doc';
  import type { OpResult } from '@feega/motion-core/motion/timeline';
  import ColourRow from './ColourRow.svelte';
  import { documentColours, frameColours, recolourFrame } from '$lib/motion/selection-colours';

  let { doc, onchange }: { doc: MotionDoc; onchange: (result: OpResult, summary: string) => void } = $props();

  const colours = $derived(frameColours(doc));

  const swap = (from: string, to: string) => onchange(recolourFrame(doc, from, to), `Recoloured ${from} to ${to} in the frame`);
</script>

{#if colours.length}
  <section class="section ui-section" data-testid="frame-colours">
    <h3>Selection colours</h3>
    {#each colours as { colour, count } (colour)}
      <ColourRow {colour} {count} palette={() => documentColours(doc)} onchange={(to) => swap(colour, to)} />
    {/each}
  </section>
{/if}

<style>
  .section {
    padding: 0 12px 12px;
    border-bottom: 1px solid var(--ui-line);
  }

  h3 {
    display: flex;
    align-items: center;
    height: 36px;
    margin: 0;
    font-size: var(--ui-text-xs);
    font-weight: 600;
  }
</style>
