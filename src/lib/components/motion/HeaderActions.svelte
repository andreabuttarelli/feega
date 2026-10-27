<script lang="ts">
  import Ellipsis from '@lucide/svelte/icons/ellipsis';
  import type { MotionDoc } from '@feega/motion-core/motion/doc';
  import { ACTIONS, Action, tipText, type ActionId } from '$lib/motion/actions';
  import { barActions, headerActions } from '$lib/motion/clip-bar';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
  import IconButton from './IconButton.svelte';

  type Props = { doc: MotionDoc; selection: readonly string[]; extra?: readonly ActionId[]; onrun: (id: ActionId) => void };

  let { doc, selection, extra = [], onrun }: Props = $props();

  const MORE_LABEL = 'More actions';
  const split = $derived(headerActions(barActions(doc, selection, extra)));
</script>

<div class="header-actions" role="toolbar" aria-label="Element actions" data-testid="header-actions">
  {#each split.inline as id (id)}
    <IconButton action={id} size={15} onclick={() => onrun(id)} />
  {/each}
  {#if split.groups.length}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger class="more" aria-label={MORE_LABEL} title={MORE_LABEL} data-testid="header-more"><Ellipsis size={15} /></DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" class="header-menu">
        {#each split.groups as group, g (g)}
          {#if g > 0}<DropdownMenu.Separator />{/if}
          {#each group as id (id)}
            {@const action = ACTIONS[id]}
            {@const keys = tipText(id).keys}
            <DropdownMenu.Item class={id === Action.Delete ? 'header-danger' : ''} onSelect={() => onrun(id)} data-action={id}>
              <action.icon size={14} />
              <span class="header-item">{action.name}</span>
              {#if keys}<DropdownMenu.Shortcut>{keys}</DropdownMenu.Shortcut>{/if}
            </DropdownMenu.Item>
          {/each}
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  {/if}
</div>

<style>
  .header-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .header-actions :global(.more) {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-ink-2);
    cursor: pointer;
  }

  :global(.header-menu) {
    min-width: 232px;
  }

  :global(.header-menu .header-item) {
    flex: 1;
    white-space: nowrap;
  }

  :global(.header-menu .header-danger) {
    color: var(--color-destructive);
  }

  .header-actions :global(.more:hover),
  .header-actions :global(.more[data-state='open']) {
    background: var(--ui-hover);
    color: var(--ui-ink);
  }
</style>
