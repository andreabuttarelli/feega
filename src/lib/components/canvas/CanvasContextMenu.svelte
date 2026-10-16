<script lang="ts">
  import { CANVAS_MENU, shownFor, type SelectionActionId } from '$lib/canvas/selection-actions';
  import { SELECTION_ACTION_ICON } from '$lib/canvas/selection-action-icons';
  import { Kbd, MENU_CONTENT, MENU_ITEM } from '$lib/components/ui/shell';

  const MENU = '[data-testid="canvas-menu"]';

  let {
    at,
    summaries,
    onpick,
    onclose
  }: {
    at: { x: number; y: number };
    summaries: { id: string; type: string; data: Record<string, unknown> }[];
    onpick: (id: SelectionActionId) => void;
    onclose: () => void;
  } = $props();

  const items = $derived(CANVAS_MENU.filter((a) => summaries.length >= a.minNodes && shownFor(a.id, summaries)));

  function pick(id: SelectionActionId) {
    onpick(id);
    onclose();
  }

  function outside(e: PointerEvent) {
    if (!(e.target as HTMLElement).closest(MENU)) {
      onclose();
    }
  }
</script>

<svelte:window onpointerdown={outside} onkeydown={(e) => e.key === 'Escape' && onclose()} />

{#if items.length}
  <div class={MENU_CONTENT} role="menu" data-testid="canvas-menu" style={`position: fixed; z-index: 30; min-width: 200px; left: ${at.x}px; top: ${at.y}px`}>
    {#each items as item (item.id)}
      {@const Icon = SELECTION_ACTION_ICON[item.id]}
      <button type="button" role="menuitem" class={MENU_ITEM} onclick={() => pick(item.id)}>
        <Icon aria-hidden="true" />
        <span class="min-w-0 flex-1 truncate">{item.label}</span>
        {#if item.shortcut}<Kbd shortcut={item.shortcut} class="text-ui-text-3" />{/if}
      </button>
    {/each}
  </div>
{/if}
