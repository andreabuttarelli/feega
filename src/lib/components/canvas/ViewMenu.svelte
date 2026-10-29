<script lang="ts">
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
  import Eye from '@lucide/svelte/icons/eye';
  import { VIEW_ITEMS, frameViews } from '$lib/canvas/view-menu.svelte';
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger class="view-trigger" data-testid="view-menu" aria-label="View" title="View">
    <Eye size={16} />
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="end" collisionPadding={8} class="w-[230px]">
    <DropdownMenu.Label>View</DropdownMenu.Label>
    {#each VIEW_ITEMS as item (item.view)}
      <DropdownMenu.CheckboxItem data-testid="view-{item.view}" checked={frameViews.isOn(item.view)} onCheckedChange={() => frameViews.flip(item.view)}>
        <span class="view-label">{item.label}</span>
        <kbd class="view-keys">{item.keys}</kbd>
      </DropdownMenu.CheckboxItem>
    {/each}
  </DropdownMenu.Content>
</DropdownMenu.Root>

<style>
  :global(.view-trigger) {
    display: grid;
    place-items: center;
    width: var(--ui-control-h);
    height: var(--ui-control-h);
    flex-shrink: 0;
    border: 0;
    border-radius: var(--ui-radius-full);
    background: transparent;
    color: var(--ui-icon-ink);
    cursor: pointer;
  }

  :global(.view-trigger:hover) {
    background: var(--ui-wash);
    color: var(--ui-text);
  }

  .view-label {
    flex: 1;
  }

  .view-keys {
    font: inherit;
    font-size: 11px;
    color: var(--ui-text-muted);
  }
</style>
