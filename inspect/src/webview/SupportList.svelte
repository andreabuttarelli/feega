<script lang="ts">
  import Check from '@lucide/svelte/icons/check';
  import { SUPPORT_ITEMS, type SupportItem, supportSummary } from '../support';
  import Pixel from '@feega/pixel-icons/Pixel.svelte';
  import { SUPPORT_ICONS } from './support-icons';

  let { done, onact }: { done: SupportItem[]; onact: (item: SupportItem) => void } = $props();

  const summary = $derived(supportSummary(done));
</script>

<div class="support" data-testid="support-list">
  <ul>
    {#each SUPPORT_ITEMS as item (item.id)}
      {@const ticked = done.includes(item.id)}
      <li>
        <button type="button" class="item" class:ticked data-testid={`support-${item.id}`} onclick={() => onact(item.id)}>
          <Pixel icon={SUPPORT_ICONS[item.id]} size={2} />
          <span class="label">{item.label}</span>
          <span class="karma" class:done={ticked} data-testid={`support-badge-${item.id}`}>{#if ticked}<Check size={12} strokeWidth={3} />{:else}+{item.karma}{/if}</span>
        </button>
      </li>
    {/each}
  </ul>

  {#if summary.karma > 0}<p class="karma-total" data-testid="support-karma">karma {summary.karma}</p>{/if}
  {#if summary.complete}<p class="thanks" data-testid="support-thanks">Thank you. Feega stays free because of you.</p>{/if}
  <p class="hint">We can't check these. Tick what you did.</p>
</div>

<style>
  .support {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    text-align: left;
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    height: 36px;
    padding: 0 12px;
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

  .label {
    flex: 1;
  }

  .karma {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 36px;
    height: 20px;
    padding: 0 6px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    box-shadow: inset 0 0 0 1px var(--ui-divider);
  }

  .karma.done {
    background: #1f9d55;
    box-shadow: none;
    color: #fff;
  }

  .karma,
  .karma-total,
  .hint {
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }

  p {
    margin: 0;
    text-align: center;
  }

  .karma-total {
    color: var(--ui-text-2);
  }

  .thanks {
    color: var(--ui-text);
    font-size: var(--ui-text-sm);
  }
</style>
