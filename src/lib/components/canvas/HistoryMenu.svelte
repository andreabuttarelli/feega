<script lang="ts">
  import LayoutGrid from '@lucide/svelte/icons/layout-grid';
  import type { HistoryItem } from '$lib/canvas/gen-history';
  import type { GenMedium } from '$lib/canvas/gen-node';
  import * as Popover from '$lib/components/ui/popover/index.js';
  import { CONTROL_HEIGHT } from '$lib/components/ui/control/index.js';
  import { cn } from '$lib/utils.js';

  let {
    items,
    medium,
    urlOf,
    onshow,
    oncompare
  }: {
    items: HistoryItem[];
    medium: GenMedium;
    urlOf: (mediaId: string) => string | null;
    onshow: (runId: string) => void;
    oncompare: (a: string, b: string) => void;
  } = $props();

  const COMPARE_PICKS = 2;
  const comparable = $derived(medium === 'image');

  let comparing = $state(false);
  let picked = $state<string[]>([]);

  function choose(runId: string) {
    if (!comparing) {
      onshow(runId);
      return;
    }
    picked = picked.includes(runId) ? picked.filter((id) => id !== runId) : [...picked, runId];
    if (picked.length < COMPARE_PICKS) {
      return;
    }
    oncompare(picked[0], picked[1]);
    picked = [];
    comparing = false;
  }

  function toggleCompare() {
    comparing = !comparing;
    picked = [];
  }
</script>

<Popover.Root>
  <Popover.Trigger
    aria-label={`History: ${items.length} results`}
    data-control="history"
    class={cn(
      CONTROL_HEIGHT,
      'inline-flex items-center gap-1.5 rounded-sm bg-transparent px-2 text-xs text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-muted'
    )}
  >
    <LayoutGrid class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
    <span class="tabular-nums">{items.length}</span>
  </Popover.Trigger>
  <Popover.Content class="w-80">
    {#if comparable}
      <div class="flex items-center justify-between gap-2 px-2 pt-2 text-xs">
        <span class="text-muted-foreground" data-testid="history-hint">{comparing ? `Pick two (${picked.length}/${COMPARE_PICKS})` : 'Click one to pin it as the output'}</span>
        <button type="button" class="border border-line-2 px-2 py-0.5 hover:bg-muted" aria-pressed={comparing} data-testid="history-compare" onclick={toggleCompare}>
          {comparing ? 'Cancel' : 'Compare'}
        </button>
      </div>
    {/if}
    <div class="grid grid-cols-4 gap-1 p-2" data-testid="variants-history" role="group" aria-label="Results of this node">
      {#each items as item (item.runId)}
        {@const url = urlOf(item.mediaId)}
        <button
          type="button"
          class={cn(
            'relative aspect-square overflow-hidden border border-line-2 bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring',
            (comparing ? picked.includes(item.runId) : item.shown) && 'ring-2 ring-foreground'
          )}
          aria-label={`Result ${item.position} of ${items.length}`}
          aria-pressed={comparing ? picked.includes(item.runId) : item.shown}
          onclick={() => choose(item.runId)}
        >
          {#if url && medium === 'video'}
            <video src={url} muted playsinline preload="metadata" class="size-full object-cover"></video>
          {:else if url}
            <img src={url} alt="" class="size-full object-cover" loading="lazy" />
          {/if}
          <span class="absolute bottom-0 left-0 bg-background/80 px-1 text-[0.625rem] tabular-nums">{item.position}</span>
        </button>
      {/each}
    </div>
  </Popover.Content>
</Popover.Root>
