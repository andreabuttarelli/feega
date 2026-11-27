<script lang="ts">
  import ComponentIcon from '@lucide/svelte/icons/component';
  import House from '@lucide/svelte/icons/house';
  import LayoutGrid from '@lucide/svelte/icons/layout-grid';
  import X from '@lucide/svelte/icons/x';
  import { ViewIcon, type ViewKind, type ViewTab } from './views';

  type Props = { tabs: ViewTab[]; onselect: (kind: ViewKind) => void; onclose: (kind: ViewKind) => void };

  let { tabs, onselect, onclose }: Props = $props();

  const ICONS = { [ViewIcon.House]: House, [ViewIcon.Grid]: LayoutGrid, [ViewIcon.Component]: ComponentIcon };
</script>

<div class="views" role="tablist" aria-label="Views" data-testid="view-tabs">
  {#each tabs as tab (tab.id)}
    {@const Icon = ICONS[tab.icon]}
    <span class="view" class:on={tab.active}>
      <button type="button" role="tab" aria-selected={tab.active} data-testid={`view-${tab.id}`} onclick={() => onselect(tab.kind)}><Icon size={13} />{tab.title}</button>
      {#if tab.closable}<button type="button" class="close" data-testid={`view-close-${tab.id}`} title="Close" aria-label={`Close ${tab.title}`} onclick={() => onclose(tab.kind)}><X size={12} /></button>{/if}
    </span>
  {/each}
</div>

<style>
  .views {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: none;
    max-width: 40%;
    overflow: hidden;
    padding-left: 4px;
    border-left: 1px solid var(--ui-divider);
    font-size: var(--ui-text-xs);
  }

  .view {
    display: flex;
    align-items: center;
    height: 26px;
    min-width: 0;
    border-radius: var(--ui-radius-sm);
    color: var(--ui-text-2);
  }

  .view.on {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  button {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 100%;
    padding: 0 8px;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    white-space: nowrap;
    cursor: pointer;
  }

  .view.on > button:first-child {
    font-weight: 600;
  }

  .close {
    justify-content: center;
    width: 20px;
    padding: 0;
    border-radius: var(--ui-radius-sm);
  }

  .close:hover {
    background: var(--ui-divider);
  }
</style>
