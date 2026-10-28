<script lang="ts">
  import type { MotionDoc } from '@feega/motion-core/motion/doc';
  import { BRAND_COLORS } from '@feega/motion-core/motion/components';
  import type { OpResult } from '@feega/motion-core/motion/timeline';
  import { frameColours, isBrandToken, recolourFrame } from '$lib/motion/selection-colours';

  let { doc, onchange }: { doc: MotionDoc; onchange: (result: OpResult, summary: string) => void } = $props();

  const colours = $derived(frameColours(doc));

  const swap = (from: string, to: string) => onchange(recolourFrame(doc, from, to), `Recoloured ${from} to ${to} in the frame`);
</script>

{#if colours.length}
  <section class="section ui-section" data-testid="frame-colours">
    <h3>Selection colours</h3>
    {#each colours as { colour, count } (colour)}
      <label class="line" data-colour={colour}>
        <span class="value">{colour}</span>
        <span class="count">{count}</span>
        {#if isBrandToken(colour)}
          <select aria-label={`Replace ${colour}`} value={colour} onchange={(e) => swap(colour, e.currentTarget.value)}>
            {#each BRAND_COLORS as token (token)}<option value={token}>{token}</option>{/each}
          </select>
        {:else}
          <input type="color" aria-label={`Replace ${colour}`} value={colour.slice(0, 7)} onchange={(e) => swap(colour, e.currentTarget.value)} />
        {/if}
      </label>
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

  .line {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--ui-text-xs);
    color: var(--ui-ink-2);
  }

  .value {
    flex: 1;
    min-width: 0;
  }

  .count {
    color: var(--ui-ink-3);
  }

  select {
    min-width: 0;
    height: 28px;
  }

  input[type='color'] {
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-xs);
    background: none;
    cursor: pointer;
  }
</style>
