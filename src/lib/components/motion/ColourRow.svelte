<script lang="ts">
  import { ColourDisplay } from '$lib/motion/colour-field';
  import ColorField from './ColorField.svelte';

  let { colour, count, palette, onchange, onselect }: { colour: string; count: number; palette?: () => readonly string[]; onchange: (to: string) => void; onselect?: (colour: string) => void } = $props();
</script>

<div class="line" data-colour={colour}>
  <ColorField name={colour} display={ColourDisplay.Row} value={colour} {palette} {onchange} />
  <span class="count">{count}</span>
  {#if onselect}
    <button type="button" class="target" data-testid="select-layers" aria-label={`Select layers using ${colour}`} onclick={() => onselect(colour)}>
      <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="3.5" fill="none" stroke="currentColor" stroke-width="1.2" /><path d="M6 0.5v2M6 9.5v2M0.5 6h2M9.5 6h2" stroke="currentColor" stroke-width="1.2" /></svg>
    </button>
  {/if}
</div>

<style>
  .line {
    display: flex;
    align-items: center;
    gap: 4px;
    height: var(--ui-row-sm);
    font-size: var(--ui-text-sm);
  }

  .count {
    color: var(--ui-ink-3);
    font-variant-numeric: tabular-nums;
    padding-right: 6px;
  }

  .target {
    display: none;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-ink-2);
    cursor: pointer;
  }

  .line:hover .target,
  .target:focus-visible {
    display: grid;
  }

  .target:hover {
    background: var(--ui-hover);
    color: var(--ui-ink);
  }
</style>
