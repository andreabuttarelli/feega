<script lang="ts">
  import { GEN_MEDIUMS, type GenMedium } from '$lib/canvas/gen-node';
  import { ADDABLE_LABEL } from '$lib/canvas/addable';
  import { ADDABLE_ICON } from '$lib/canvas/addable-icons';
  import * as Popover from '$lib/components/ui/popover/index.js';
  import { nextIndex } from '$lib/components/ui/control/index.js';

  let {
    at,
    onpick,
    onclose
  }: {
    at: { x: number; y: number };
    onpick: (medium: GenMedium) => void;
    onclose: () => void;
  } = $props();

  let items = $state<HTMLButtonElement[]>([]);

  const anchor = $derived({ getBoundingClientRect: () => new DOMRect(at.x, at.y, 0, 0) });

  function keydown(event: KeyboardEvent, index: number) {
    const next = nextIndex(index, event.key, GEN_MEDIUMS.length);
    if (next === null) {
      return;
    }
    event.preventDefault();
    items[next]?.focus();
  }
</script>

<Popover.Root open onOpenChange={(open) => !open && onclose()}>
  <Popover.Content customAnchor={anchor} side="right" align="start" class="w-48 p-1" data-control="connect-picker">
    <p class="px-2 pt-1 pb-1.5 text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">Connect to new</p>
    <div role="menu" aria-label="Connect to new">
      {#each GEN_MEDIUMS as medium, i (medium)}
        {@const Icon = ADDABLE_ICON[medium]}
        <button
          bind:this={items[i]}
          type="button"
          role="menuitem"
          class="flex min-h-11 w-full items-center gap-2 px-2 text-left text-xs text-foreground outline-none hover:bg-muted focus-visible:bg-muted md:min-h-8"
          onclick={() => onpick(medium)}
          onkeydown={(e) => keydown(e, i)}
        >
          <Icon size={15} strokeWidth={1.7} />
          {ADDABLE_LABEL[medium]}
        </button>
      {/each}
    </div>
  </Popover.Content>
</Popover.Root>
