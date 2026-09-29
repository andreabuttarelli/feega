<script lang="ts">
  import { untrack } from 'svelte';
  import { AssetSize, sized } from '$lib/canvas/asset-url';
  import { tierBoard } from '$lib/canvas/tier-board.svelte';

  const DEFAULT_TIER = AssetSize.Px1024;

  let { src, nodeId, alt, fit = 'contain' }: { src: string; nodeId: string; alt: string; fit?: 'contain' | 'cover' } = $props();

  const board = tierBoard();
  const tier = $derived(board ? board.of(nodeId) : DEFAULT_TIER);
  const wanted = $derived(tier ? sized(src, tier) : null);

  let shown = $state<string | null>(null);

  $effect(() => {
    const next = wanted;
    const current = untrack(() => shown);
    if (!next || next === current) {
      return;
    }
    if (!current) {
      shown = next;
      return;
    }

    let live = true;
    const probe = new Image();
    probe.src = next;
    const swap = () => {
      if (live) {
        shown = next;
      }
    };
    probe.decode().then(swap, swap);
    return () => {
      live = false;
    };
  });
</script>

{#if shown}
  <img class="tiered" style:object-fit={fit} src={shown} {alt} decoding="async" data-tier={tier} />
{/if}

<style>
  .tiered {
    width: 100%;
    height: 100%;
    display: block;
    background: var(--paper-2, #f9f9f9);
  }
</style>
