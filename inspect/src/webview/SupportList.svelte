<script lang="ts">
  import Check from '@lucide/svelte/icons/check';
  import { SUPPORT_ITEMS, type SupportItem, supportSummary } from '../support';

  let { done, onact }: { done: SupportItem[]; onact: (item: SupportItem) => void } = $props();

  const summary = $derived(supportSummary(done));
</script>

<div class="support" data-testid="support-list">
  <ul>
    {#each SUPPORT_ITEMS as item (item.id)}
      {@const ticked = done.includes(item.id)}
      <li>
        <button type="button" class="item" class:ticked data-testid={`support-${item.id}`} onclick={() => onact(item.id)}>
          <span class="box" aria-hidden="true">{#if ticked}<Check size={11} />{/if}</span>
          <span class="label">{item.label}</span>
          <span class="karma">+{item.karma}</span>
        </button>
      </li>
    {/each}
  </ul>

  <p class="karma-total" data-testid="support-karma">karma {summary.karma}</p>
  {#if summary.complete}<p class="thanks" data-testid="support-thanks">Thank you. Feega stays free because of you.</p>{/if}
  <p class="hint">We can't check these. Tick what you did.</p>
</div>

<style>
  .support {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: left;
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 28px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-sm);
    text-align: left;
    cursor: pointer;
  }

  .item:hover,
  .item:focus-visible {
    background: var(--ui-input);
  }

  .box {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 14px;
    height: 14px;
    border-radius: var(--ui-radius-sm);
    box-shadow: inset 0 0 0 1px var(--ui-divider);
  }

  .ticked .box {
    background: var(--ui-text);
    color: var(--ui-panel);
    box-shadow: none;
  }

  .label {
    flex: 1;
  }

  .karma,
  .karma-total,
  .hint {
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }

  p {
    margin: 0;
  }

  .karma-total {
    color: var(--ui-text-2);
    padding: 0 8px;
  }

  .thanks {
    padding: 0 8px;
    color: var(--ui-text);
    font-size: var(--ui-text-sm);
  }

  .hint {
    padding: 0 8px;
  }
</style>
