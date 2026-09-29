<script lang="ts">
  import { _ } from 'svelte-i18n';
  import '$lib/styles/settings-shell.css';
  import CreditAmount from '$lib/components/CreditAmount.svelte';
  import { Panel } from '$lib/components/ui/panel';
  import { Field, FieldLayout } from '$lib/components/ui/field';
  import { Button } from '$lib/components/ui/button';
  import { Notice } from '$lib/components/ui/notice';
  import { invalidateAll } from '$app/navigation';
  import { CheckoutOutcome } from '$lib/billing-path';
  import { DISPLAY_UNITS_PER_CREDIT } from '$lib/components/credit-amount-format';

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

  const planAction = (price: number) => {
    if (data.currentPlanUsd === price) {
      return null;
    }
    return data.currentPlanUsd == null ? 'subscribe' : 'switchPlan';
  };
</script>

{#if data.checkoutOutcome === CheckoutOutcome.Paid}
  <Notice tone="success">{$_('app.account.billing.paymentReceived')}</Notice>
{:else if data.checkoutOutcome === CheckoutOutcome.Canceled}
  <Notice>{$_('app.account.billing.checkoutCanceled')}</Notice>
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
      {#if data.credits.atRisk.length}
        <span class="text-[0.8125rem] text-muted-foreground">
          {#each data.credits.atRisk as risk (risk.expiresAt)}
            <CreditAmount amount={risk.amount} /> expire {new Date(risk.expiresAt).toLocaleDateString()}
          {/each}
        </span>
      {/if}
    </Field>

    <Field
      label={$_('app.account.billing.ladderTitle')}
      hint={$_('app.account.billing.ladderDesc')}
      layout={data.purchasesReady ? FieldLayout.Stack : FieldLayout.Row}
    >
      {#if !data.purchasesReady}
        <span class="text-[0.8125rem] text-muted-foreground">{$_('app.account.billing.purchasesNotReady')}</span>
      {:else}
        <table class="ladder">
          <tbody>
            {#each data.credits.ladder as rung (rung.price)}
              {@const action = planAction(rung.price)}
              <tr>
                <td>€{rung.price}/mo</td>
                <td>{$_('app.account.billing.creditsIncluded', { values: { credits: rung.credits / DISPLAY_UNITS_PER_CREDIT } })}</td>
                <td>
                  {#if action}
                    <form method="POST" action={`?/upgrade`}>
                      <input type="hidden" name="usd" value={rung.price} />
                      <Button size="sm" type="submit">{$_(`app.account.billing.${action}`)}</Button>
                    </form>
                  {:else}
                    <span class="text-[0.8125rem] font-semibold">{$_('app.account.billing.currentPlan')}</span>
                  {/if}
                </td>
                <td>
                  <form method="POST" action={`?/buyOneTime`}>
                    <input type="hidden" name="usd" value={rung.price} />
                    <Button variant="secondary" size="sm" type="submit">{$_('app.account.billing.topUp', { values: { credits: rung.credits / DISPLAY_UNITS_PER_CREDIT } })}</Button>
                  </form>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </Field>

    {#if data.hasBilling}
      <Field label={$_('app.settings.billing.manage')} hint={$_('app.settings.billing.manageInvoicesDesc')} layout={FieldLayout.Row}>
        <div class="flex flex-wrap gap-2">
          <form method="POST" action={`?/billingPortal`}><input type="hidden" name="flow" value="invoices" /><Button variant="secondary" size="sm" type="submit">{$_('app.settings.billing.invoices')}</Button></form>
          <form method="POST" action={`?/billingPortal`}><input type="hidden" name="flow" value="payment_method" /><Button variant="secondary" size="sm" type="submit">{$_('app.settings.billing.changePayment')}</Button></form>
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

<style>
  .ladder {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
    margin-top: 0.5rem;
  }
  .ladder th,
  .ladder td {
    padding: 0.6rem 0;
    text-align: left;
    border-top: 1px solid var(--line, #e5e5e5);
  }
  .ladder th {
    font-weight: 500;
    opacity: 0.7;
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
    border-top: 1px solid var(--line, #e5e5e5);
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
