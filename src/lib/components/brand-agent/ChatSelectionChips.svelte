<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { SHOWN_CHIPS, visibleChips, type SelectionChip } from '$lib/chat-selection';

  let { chips, onremove }: { chips: SelectionChip[]; onremove?: (id: string) => void } = $props();

  const row = $derived(visibleChips(chips, SHOWN_CHIPS));
  const hidden = $derived(chips.slice(SHOWN_CHIPS).map((chip) => chip.name).join(', '));
</script>

{#if chips.length}
  <ul class="chips" aria-label={$_('chat.panel.selection.list')}>
    {#each row.shown as chip (chip.id)}
      <li class="chip" data-testid="selection-chip" data-kind={chip.kind}>
        <span class="type">{chip.type}</span>
        <span class="name" title={chip.name}>{chip.name}</span>
        {#if onremove}
          <button type="button" class="remove" aria-label={$_('chat.panel.selection.remove', { values: { name: chip.name } })} onclick={() => onremove?.(chip.id)}>
            <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" /></svg>
          </button>
        {/if}
      </li>
    {/each}
    {#if row.more}
      <li class="chip more" data-testid="selection-chip-more" title={hidden}>{$_('chat.panel.selection.more', { values: { count: row.more } })}</li>
    {/if}
  </ul>
{/if}

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    min-height: 24px;
    padding: 0 4px 0 8px;
    border: 1px solid var(--line-2, #d2d2d7);
    border-radius: var(--ui-radius-sm);
    background: var(--paper-2, #f5f5f7);
    font-size: 12px;
    color: var(--ink, #1d1d1f);
  }
  .more {
    padding-right: 8px;
    color: var(--ink-soft, #6e6e73);
  }
  .type {
    flex: 0 0 auto;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    color: var(--ink-faint, #86868b);
  }
  .name {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .remove {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: 0;
    border-radius: var(--ui-radius-xs);
    background: none;
    color: var(--ink-soft, #6e6e73);
    cursor: pointer;
  }
  .remove:hover {
    background: var(--paper-3, #eee);
    color: var(--ink, #1d1d1f);
  }
  .remove:focus-visible {
    outline: 2px solid var(--accent, #c485fe);
    outline-offset: 1px;
  }
  @media (hover: none) {
    .remove {
      width: 32px;
      height: 32px;
    }
  }
</style>
