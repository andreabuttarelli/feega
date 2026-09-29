<script lang="ts">
  import { CircleDollarSign } from '@lucide/svelte';
  import { formatCredits } from './credit-amount-format';

  let { amount, approx = false }: { amount: number; approx?: boolean } = $props();

  const displayed = $derived(formatCredits(amount, { approx }));
  const label = $derived(`${formatCredits(amount)} credits`);
</script>

<span class="credit-amount" aria-label={label} title={label}>
  <CircleDollarSign class="credit-icon" aria-hidden="true" strokeWidth={1.8} />
  <span aria-hidden="true">{displayed}</span>
</span>

<style>
  .credit-amount {
    display: inline-flex;
    align-items: center;
    gap: 0.3em;
    font-variant-numeric: tabular-nums;
  }
  .credit-amount :global(.credit-icon) {
    flex: none;
    width: 1.05em;
    height: 1.05em;
    color: var(--ink-soft);
  }
</style>
