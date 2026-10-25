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
    onshow
  }: { items: HistoryItem[]; medium: GenMedium; urlOf: (mediaId: string) => string | null; onshow: (runId: string) => void } = $props();
</script>

<Popover.Root>
  <Popover.Trigger
    aria-label={`History: ${items.length} results`}
    data-control="history"
    class={cn(
      CONTROL_HEIGHT,
      'inline-flex items-center gap-1.5 border border-line-2 bg-background px-2 text-xs text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-muted'
    )}
  >
    <LayoutGrid class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
    <span class="tabular-nums">{items.length}</span>
  </Popover.Trigger>
  <Popover.Content class="w-80">
    <div class="grid grid-cols-4 gap-1 p-2" data-testid="variants-history" role="group" aria-label="Results of this node">
      {#each items as item (item.runId)}
        {@const url = urlOf(item.mediaId)}
        <button
          type="button"
          class={cn('relative aspect-square overflow-hidden border border-line-2 bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring', item.shown && 'ring-2 ring-foreground')}
          aria-label={`Result ${item.position} of ${items.length}`}
          aria-pressed={item.shown}
          onclick={() => onshow(item.runId)}
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
