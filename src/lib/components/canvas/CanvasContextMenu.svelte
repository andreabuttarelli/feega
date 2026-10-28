<script lang="ts">
  import Layers from '@lucide/svelte/icons/layers';
  import { menuFor, type SelectionActionId } from '$lib/canvas/selection-actions';
  import { SELECTION_ACTION_ICON } from '$lib/canvas/selection-action-icons';
  import FloatingMenu from './FloatingMenu.svelte';
  import { Kbd, MENU_ITEM } from '$lib/components/ui/shell';

  const MENU = '[data-testid="canvas-menu"]';

  type Layer = { id: string; label: string };

  let {
    at,
    summaries,
    available,
    layers = [],
    onpick,
    onlayer = () => {},
    onclose
  }: {
    at: { x: number; y: number };
    summaries: { id: string; type: string; data: Record<string, unknown> }[];
    available: ReadonlySet<SelectionActionId>;
    layers?: Layer[];
    onpick: (id: SelectionActionId) => void;
    onlayer?: (id: string) => void;
    onclose: () => void;
  } = $props();

  const items = $derived(menuFor(available, summaries));
  const pickable = $derived(layers.length > 1 ? layers : []);

  function pick(id: SelectionActionId) {
    onpick(id);
    onclose();
  }

  function pickLayer(id: string) {
    onlayer(id);
    onclose();
  }

  function outside(e: PointerEvent) {
    if (!(e.target as HTMLElement).closest(MENU)) {
      onclose();
    }
  }
</script>

<svelte:window onpointerdown={outside} onkeydown={(e) => e.key === 'Escape' && onclose()} />

{#if items.length || pickable.length}
  <FloatingMenu {at}>
    {#if pickable.length}
      <div class="px-2 pt-2 pb-1 text-ui-caption text-ui-text-3" role="presentation">Select layer</div>
      {#each pickable as layer (layer.id)}
        <button type="button" role="menuitem" class={MENU_ITEM} data-layer={layer.id} onclick={() => pickLayer(layer.id)}>
          <Layers aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate">{layer.label}</span>
        </button>
      {/each}
    {/if}
    {#each items as item (item.id)}
      {@const Icon = SELECTION_ACTION_ICON[item.id]}
      <button type="button" role="menuitem" class={MENU_ITEM} data-action={item.id} onclick={() => pick(item.id)}>
        <Icon aria-hidden="true" />
        <span class="min-w-0 flex-1 truncate">{item.label}</span>
        {#if item.shortcut}<Kbd shortcut={item.shortcut} class="text-ui-text-3" />{/if}
      </button>
    {/each}
  </FloatingMenu>
{/if}
