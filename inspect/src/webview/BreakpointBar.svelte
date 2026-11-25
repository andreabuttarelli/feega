<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Check from '@lucide/svelte/icons/check';
  import { Select } from 'bits-ui';

  type Props = { badge: string; theme?: string | null; items: { id: string; label: string }[]; choice: string; onchoose: (id: string) => void };

  let { badge, theme = null, items, choice, onchoose }: Props = $props();
</script>

<div class="reach-row" data-row="breakpoint">
  <Select.Root type="single" value={choice} onValueChange={(v) => v && onchoose(v)} items={items.map((i) => ({ value: i.id, label: i.label }))}>
    <Select.Trigger class="select reach" aria-label="Breakpoint" data-field="breakpoint" data-choice={choice}>
      <span class="badge" data-testid="breakpoint-badge">{badge}</span>
      <span class="caret"><ChevronDown size={12} /></span>
    </Select.Trigger>
    <Select.Portal>
      <Select.Content class="dropdown-menu" sideOffset={4}>
        {#each items as item (item.id)}
          <Select.Item class="dropdown-item" value={item.id} label={item.label} data-breakpoint-item={item.id}>
            {#snippet children({ selected })}<span class="check">{#if selected}<Check size={12} />{/if}</span>{item.label}{/snippet}
          </Select.Item>
        {/each}
      </Select.Content>
    </Select.Portal>
  </Select.Root>
  {#if theme}<span class="badge" data-testid="theme-badge">{theme}</span>{/if}
</div>

<style>
  .reach-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--ui-divider);
  }

  .reach-row :global(.select) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    box-shadow: none;
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-sm);
    cursor: pointer;
  }

  .badge {
    color: var(--ui-accent);
    font-weight: 600;
  }
</style>
