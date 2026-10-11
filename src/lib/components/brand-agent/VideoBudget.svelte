<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { BudgetCard } from '$lib/motion/budget-card';

  let { budget, oncontinue }: { budget: BudgetCard; oncontinue: () => void } = $props();

  const values = $derived({ spent: budget.spent_usd.toFixed(2), raise: budget.raise_usd.toFixed(2) });
</script>

<section class="budget" data-testid="video-budget" aria-label={$_('chat.panel.budget.title', { values })}>
  <header><strong>{$_('chat.panel.budget.title', { values })}</strong></header>
  <p>{$_('chat.panel.budget.body', { values })}</p>
  <footer>
    <button type="button" class="go" data-testid="budget-continue" onclick={oncontinue}>{$_('chat.panel.budget.continue', { values })}</button>
  </footer>
</section>

<style>
  .budget {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    border: 1px solid var(--line, #ededef);
    background: var(--paper-2, #fafafa);
    font-size: 12.5px;
  }
  p {
    margin: 0;
    line-height: 1.45;
  }
  footer {
    display: flex;
    justify-content: flex-end;
  }
  .go {
    min-height: 30px;
    padding: 0 12px;
    border: 1px solid var(--ink, #1d1d1f);
    background: var(--ink, #1d1d1f);
    color: var(--paper, #fff);
    font: inherit;
    cursor: pointer;
  }
</style>
