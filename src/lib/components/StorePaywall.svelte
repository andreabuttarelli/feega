<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { Button } from '$lib/components/ui/button';
  import { Notice } from '$lib/components/ui/notice';
  import { formatCredits } from '$lib/components/credit-amount-format';
  import { packProductId } from '$lib/store-products';
  import { nativeBridge, type StorePurchase } from '$lib/native-bridge';
  import { nativeKeys } from '$lib/native-keys';
  import type { Plan, TopUp } from '$lib/credit-ladder';

  let {
    orgId,
    plan,
    topUps,
    currentPlan,
    onPurchased
  }: {
    orgId: string;
    plan: Plan;
    topUps: readonly TopUp[];
    currentPlan: Plan | null;
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
  {@const shown = currentPlan ?? plan}
  <table class="ladder">
    <tbody>
      <tr>
        <td>{$_('app.account.billing.planPrice', { values: { price: shown.price } })}</td>
        <td>{$_('app.account.billing.creditsIncluded', { values: { credits: formatCredits(shown.credits) } })}</td>
        <td>
          {#if currentPlan}
            <span class="text-[0.8125rem] font-semibold">{$_('app.account.billing.currentPlan')}</span>
          {:else}
            <Button size="sm" disabled={busy} onclick={() => run(() => bridge.purchase(orgId, plan.lookupKey))}>{$_('app.account.billing.subscribe')}</Button>
          {/if}
        </td>
      </tr>
    </tbody>
  </table>
  <div class="flex flex-wrap gap-2">
    {#each topUps as topUp (topUp.price)}
      <Button variant="secondary" size="sm" disabled={busy} onclick={() => run(() => bridge.purchase(orgId, packProductId(topUp.price)))}>
        {$_('app.account.billing.topUp', { values: { price: topUp.price, credits: formatCredits(topUp.credits) } })}
      </Button>
    {/each}
  </div>
  <Button variant="secondary" size="sm" disabled={busy} onclick={() => run(() => bridge.restore(orgId))}>{$_('app.account.billing.restorePurchases')}</Button>
{/if}
