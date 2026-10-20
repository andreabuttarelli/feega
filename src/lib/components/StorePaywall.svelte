<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { Button } from '$lib/components/ui/button';
  import { Notice } from '$lib/components/ui/notice';
  import { DISPLAY_UNITS_PER_CREDIT } from '$lib/components/credit-amount-format';
  import { packProductId } from '$lib/store-products';
  import { nativeBridge, type StorePurchase } from '$lib/native-bridge';
  import { nativeKeys } from '$lib/native-keys';
  import type { CreditRung } from '$lib/credit-ladder';

  let {
    orgId,
    ladder,
    currentPlanUsd,
    onPurchased
  }: {
    orgId: string;
    ladder: readonly CreditRung[];
    currentPlanUsd: number | null;
    onPurchased: () => void;
  } = $props();

  const bridge = nativeBridge(globalThis, nativeKeys())?.store ?? null;
  const Outcome = { None: 'none', Purchased: 'purchased', Failed: 'failed' } as const;

  let busy = $state(false);
  let outcome = $state<(typeof Outcome)[keyof typeof Outcome]>(Outcome.None);

  async function run(action: () => Promise<StorePurchase>) {
    busy = true;
    outcome = Outcome.None;
    try {
      const result = await action();
      if (result.purchased) {
        outcome = Outcome.Purchased;
        onPurchased();
      }
    } catch {
      outcome = Outcome.Failed;
    } finally {
      busy = false;
    }
  }
</script>

{#if !bridge}
  <span class="text-[0.8125rem] text-muted-foreground">{$_('app.account.billing.storeUnavailable')}</span>
{:else}
  {#if outcome === Outcome.Failed}
    <Notice tone="error">{$_('app.account.billing.storeFailed')}</Notice>
  {:else if outcome === Outcome.Purchased}
    <Notice tone="success">{$_('app.account.billing.storePurchased')}</Notice>
  {/if}
  <table class="ladder">
    <tbody>
      {#each ladder as rung (rung.price)}
        <tr>
          <td>€{rung.price}/mo</td>
          <td>{$_('app.account.billing.creditsIncluded', { values: { credits: rung.credits / DISPLAY_UNITS_PER_CREDIT } })}</td>
          <td>
            {#if currentPlanUsd === rung.price}
              <span class="text-[0.8125rem] font-semibold">{$_('app.account.billing.currentPlan')}</span>
            {:else}
              <Button size="sm" disabled={busy} onclick={() => run(() => bridge.purchase(orgId, rung.lookupKey))}>{$_('app.account.billing.subscribe')}</Button>
            {/if}
          </td>
          <td>
            <Button variant="secondary" size="sm" disabled={busy} onclick={() => run(() => bridge.purchase(orgId, packProductId(rung.price)))}>
              {$_('app.account.billing.topUp', { values: { credits: rung.credits / DISPLAY_UNITS_PER_CREDIT } })}
            </Button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  <Button variant="secondary" size="sm" disabled={busy} onclick={() => run(() => bridge.restore(orgId))}>{$_('app.account.billing.restorePurchases')}</Button>
{/if}
