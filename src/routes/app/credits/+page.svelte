<script lang="ts">
  import { apiEnhance } from '$lib/dashboard/api-enhance';
  import { _ } from 'svelte-i18n';
  import '$lib/styles/settings-shell.css';
  import CreditAmount from '$lib/components/CreditAmount.svelte';
  import { Panel } from '$lib/components/ui/panel';
  import { Field, FieldLayout } from '$lib/components/ui/field';
  import { Button } from '$lib/components/ui/button';
  import { Notice } from '$lib/components/ui/notice';
  import { invalidateAll } from '$app/navigation';
  import { CheckoutOutcome } from '$lib/billing-path';
  import { formatCredits } from '$lib/components/credit-amount-format';
  import LegalFooter from '$lib/components/LegalFooter.svelte';
  import PageTitle from '$lib/components/PageTitle.svelte';
  import PageHead from '$lib/components/PageHead.svelte';
  import StorePaywall from '$lib/components/StorePaywall.svelte';
  import { BillingChannel } from '$lib/billing-channel';

  let { data, form } = $props();

  const BALANCE_POLL_MS = 3000;
  const BALANCE_POLL_LIMIT = 20;

  $effect(() => {
    if (data.checkoutOutcome !== CheckoutOutcome.Paid) {
      return;
    }

    const startingBalance = data.credits.balance;
    let polls = 0;
    const timer = setInterval(async () => {
      polls += 1;
      await invalidateAll();
      if (data.credits.balance !== startingBalance || polls >= BALANCE_POLL_LIMIT) {
        clearInterval(timer);
      }
    }, BALANCE_POLL_MS);
    return () => clearInterval(timer);
  });
</script>

<div class="credits-page">
<PageHead title="Credits" subtitle={$_('app.account.billing.poolDesc')} />
<PageTitle text="Credits" />

{#if data.checkoutOutcome === CheckoutOutcome.Paid}
  <Notice tone="success">{$_('app.account.billing.paymentReceived')}</Notice>
{:else if data.checkoutOutcome === CheckoutOutcome.Canceled}
  <Notice>{$_('app.account.billing.checkoutCanceled')}</Notice>
{/if}

{#if data.seats?.endsAt}
  <Notice>{$_('app.account.billing.planEnds', { values: { date: new Date(data.seats.endsAt).toLocaleDateString(), editors: data.seats.editors - 1 } })}</Notice>
{/if}

{#if data.isOwner}
  {#if form?.retentionApplied}
    <Notice tone="success">{$_('app.settings.billing.retentionApplied')}</Notice>
  {:else if form?.canceled}
    <Notice>{#if form.endsAt}{$_('app.settings.billing.canceledOn', { values: { date: new Date(form.endsAt).toLocaleDateString() } })}{:else}{$_('app.settings.billing.canceledNoDate')}{/if}</Notice>
  {:else if form?.billingError}
    <Notice tone="error">{form.billingError}</Notice>
  {/if}
{/if}

<Panel title={$_('app.settings.billing.title')} description={$_('app.account.billing.poolDesc')}>
  {#if !data.isOwner}
    <div><Notice class="mb-0">{$_('app.settings.billing.membersNotice')}</Notice></div>
  {:else}
    <Field label={$_('app.settings.usage.balance')} layout={FieldLayout.Row}>
      <span class="text-base font-semibold"><CreditAmount amount={data.credits.balance} /></span>
    </Field>

    {#if data.agentEdits}
      <Field label={$_('app.account.billing.agentEdits')} layout={FieldLayout.Row}>
        <span class="text-[0.8125rem]" data-testid="credits-agent-edits">{$_('app.account.billing.agentEditsValue', { values: { used: formatCredits(data.agentEdits.used), limit: formatCredits(data.agentEdits.limit) } })}</span>
      </Field>
    {/if}

    <Field
      label={$_('app.account.billing.ladderTitle')}
      hint={$_('app.account.billing.ladderDesc')}
      layout={data.purchasesReady ? FieldLayout.Stack : FieldLayout.Row}
    >
      {#if data.billingChannel === BillingChannel.Store}
        <StorePaywall orgId={data.org.id} plan={data.plan} topUps={data.topUps} currentPlan={data.currentPlan} onPurchased={invalidateAll} />
      {:else if !data.purchasesReady}
        <span class="text-[0.8125rem] text-muted-foreground">{$_('app.account.billing.purchasesNotReady')}</span>
      {:else}
        {@const plan = data.currentPlan ?? data.plan}
        <table class="ladder" data-testid="credits-plan">
          <tbody>
            <tr>
              <td>
                {#if data.currentPlan && data.seats?.billing === 'per_editor'}
                  {$_('app.account.billing.planTotal', { values: { price: plan.price, editors: data.seats.editors, total: plan.price * data.seats.editors } })}
                {:else}
                  {$_('app.account.billing.planPrice', { values: { price: plan.price } })}
                {/if}
              </td>
              <td>{$_('app.account.billing.creditsIncluded', { values: { credits: formatCredits(plan.credits * (data.currentPlan && data.seats?.billing === 'per_editor' ? data.seats.editors : 1)) } })}</td>
              <td>
                {#if data.currentPlan}
                  <span class="flex items-center gap-2">
                    <span class="text-[0.8125rem] font-semibold">{$_('app.account.billing.currentPlan')}</span>
                    {#if data.hasBilling}
                      <form method="POST" action={`?/billingPortal`} use:apiEnhance><Button variant="secondary" size="sm" type="submit">{$_('app.account.billing.manage')}</Button></form>
                    {/if}
                  </span>
                  {#if data.seats && data.seats.editors > 1 && !data.seats.endsAt}
                    <span class="block text-[0.8125rem] text-muted-foreground" data-testid="credits-cancel-warning">{$_('app.account.billing.cancelWarning', { values: { editors: data.seats.editors - 1 } })}</span>
                  {/if}
                {:else}
                  <form method="POST" action={`?/subscribe`} use:apiEnhance>
                    <Button size="sm" type="submit">{$_('app.account.billing.subscribe')}</Button>
                  </form>
                {/if}
              </td>
            </tr>
          </tbody>
        </table>
      {/if}
    </Field>

    {#if data.purchasesReady && data.billingChannel === BillingChannel.Web}
      <Field label={$_('app.account.billing.topUpsTitle')} hint={$_('app.account.billing.topUpsDesc')} layout={FieldLayout.Row}>
        <div class="flex flex-wrap gap-2" data-testid="credits-top-ups">
          {#each data.topUps as topUp (topUp.price)}
            <form method="POST" action={`?/buyOneTime`} use:apiEnhance>
              <input type="hidden" name="credits" value={topUp.credits} />
              <Button variant="secondary" size="sm" type="submit">{$_('app.account.billing.topUp', { values: { price: topUp.price, credits: formatCredits(topUp.credits) } })}</Button>
            </form>
          {/each}
        </div>
      </Field>
    {/if}

    {#if data.hasBilling && data.billingChannel === BillingChannel.Web}
      <Field label={$_('app.settings.billing.manage')} hint={$_('app.settings.billing.manageInvoicesDesc')} layout={FieldLayout.Row}>
        <div class="flex flex-wrap gap-2">
          <form method="POST" action={`?/billingPortal`} use:apiEnhance><input type="hidden" name="flow" value="invoices" /><Button variant="secondary" size="sm" type="submit">{$_('app.settings.billing.invoices')}</Button></form>
          <form method="POST" action={`?/billingPortal`} use:apiEnhance><input type="hidden" name="flow" value="payment_method" /><Button variant="secondary" size="sm" type="submit">{$_('app.settings.billing.changePayment')}</Button></form>
        </div>
      </Field>
    {/if}
  {/if}
</Panel>

{#if data.brands.length}
  <Panel title={$_('app.account.billing.breakdownTitle')}>
    <div>
    <table class="brand-usage">
      <thead>
        <tr><th>{$_('app.account.billing.brandCol')}</th><th>{$_('app.account.billing.creditsCol')}</th></tr>
      </thead>
      <tbody>
        {#each data.brands as b (b.id)}
          <tr>
            <td>{b.name}</td>
            <td class="num"><CreditAmount amount={b.credits} /></td>
          </tr>
        {/each}
      </tbody>
    </table>
    </div>
  </Panel>
{/if}

<div class="legal-wrap">
  <LegalFooter />
</div>
</div>

<style>
  .credits-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 56rem;
    width: 100%;
    margin: 0 auto;
    padding: 2rem 1rem 3rem;
  }
  .legal-wrap {
    margin-top: 1.5rem;
  }
  .credits-page :global(.ladder) {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
    margin-top: 0.5rem;
  }
  .credits-page :global(.ladder th),
  .credits-page :global(.ladder td) {
    padding: 0.6rem 0;
    text-align: left;
    border-top: 1px solid var(--ui-divider, #e5e5e5);
  }
  .credits-page :global(.ladder th) {
    font-weight: 500;
    opacity: 0.7;
  }
  @media (max-width: 640px) {
    .credits-page :global(.ladder tr) {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
      padding: 0.75rem 0;
      border-top: 1px solid var(--ui-divider, #e5e5e5);
    }
    .credits-page :global(.ladder td) {
      padding: 0;
      border-top: 0;
    }
  }

  .brand-usage {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }
  .brand-usage th,
  .brand-usage td {
    padding: 0.6rem 0;
    text-align: left;
    border-top: 1px solid var(--ui-divider, #e5e5e5);
  }
  .brand-usage thead th {
    border-top: 0;
  }
  .brand-usage th {
    font-weight: 500;
    opacity: 0.7;
  }
  .brand-usage .num,
  .brand-usage th:last-child {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
