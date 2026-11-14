<script lang="ts">
  import { apiEnhance } from '$lib/dashboard/api-enhance';
  import { _ } from 'svelte-i18n';
  import '$lib/styles/settings-shell.css';
  import Check from '@lucide/svelte/icons/check';
  import CreditAmount from '$lib/components/CreditAmount.svelte';
  import { Panel } from '$lib/components/ui/panel';
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
  import { CREDITS_PER_USD_GRANT, FREE_AGENT_LAYERS_PER_WEEK } from '$lib/credit-ladder';
  import { UsageKind } from '$lib/credits/usage-breakdown';
  import { paymentNotice, planEndNotice } from '$lib/team-seat-copy';

  let { data, form } = $props();

  const BALANCE_POLL_MS = 3000;
  const BALANCE_POLL_LIMIT = 20;
  const PER_EDITOR = 'per_editor';
  const LEGACY = 'legacy';
  const BUYS_KINDS = [
    { kind: UsageKind.Image, key: 'app.account.billing.buysImages' },
    { kind: UsageKind.Video, key: 'app.account.billing.buysVideos' }
  ];

  const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  const euros = (credits: number) => (credits / CREDITS_PER_USD_GRANT).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const share = (part: number, whole: number) => `${whole ? Math.max(2, (part / whole) * 100) : 0}%`;

  const payment = $derived(paymentNotice(data.seats));
  const planEnd = $derived(planEndNotice(data.seats, date));
  const perEditor = $derived(data.currentPlan && data.seats?.billing === PER_EDITOR);
  const legacyPlan = $derived(data.currentPlan && data.seats?.billing === LEGACY);
  const editors = $derived(perEditor ? data.seats!.editors : 1);
  const web = $derived(data.purchasesReady && data.billingChannel === BillingChannel.Web);
  const store = $derived(data.billingChannel === BillingChannel.Store);
  const buys = $derived(
    BUYS_KINDS.flatMap(({ kind, key }) => {
      const used = data.usage.byKind.find((k) => k.kind === kind);
      if (!used?.calls || !used.credits) {
        return [];
      }
      const count = Math.floor(data.credits.balance / (used.credits / used.calls));
      return [$_(key, { values: { count } })];
    })
  );
  const agentEdits = $derived(data.currentPlan ? null : data.agentEdits);

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

{#if data.isOwner}
  {#if form?.retentionApplied}
    <Notice tone="success">{$_('app.settings.billing.retentionApplied')}</Notice>
  {:else if form?.canceled}
    <Notice>{#if form.endsAt}{$_('app.settings.billing.canceledOn', { values: { date: new Date(form.endsAt).toLocaleDateString() } })}{:else}{$_('app.settings.billing.canceledNoDate')}{/if}</Notice>
  {:else if form?.billingError}
    <Notice tone="error">{form.billingError}</Notice>
  {/if}
{/if}

{#if !data.isOwner}
  <Notice>{$_('app.settings.billing.membersNotice')}</Notice>
{:else}
  <section class="card plan" data-testid="credits-plan">
    <div class="plan-head">
      <div class="plan-id">
        <span class="eyebrow">{$_('app.account.billing.yourPlan')}</span>
        <h2>{data.currentPlan ? $_('app.account.billing.planPaid') : $_('app.account.billing.planFree')}</h2>
        {#if data.currentPlan}
          {@const plan = data.currentPlan}
          <p class="price">
            {#if perEditor}
              {$_('app.account.billing.planTotal', { values: { price: plan.price, editors, total: plan.price * editors } })}
            {:else if legacyPlan}
              {$_('app.account.billing.planFlat', { values: { price: plan.price } })}
            {:else}
              {$_('app.account.billing.planPrice', { values: { price: plan.price } })}
            {/if}
          </p>
          <p class="muted">{$_('app.account.billing.paidSummary', { values: { credits: formatCredits(plan.credits * editors) } })}</p>
          {#if data.seats?.renewsAt && !data.seats.endsAt}
            <p class="muted">{$_('app.account.billing.renewsOn', { values: { date: date(data.seats.renewsAt) } })}</p>
          {/if}
        {:else}
          <p class="muted">{$_('app.account.billing.freeSummary', { values: { limit: formatCredits(FREE_AGENT_LAYERS_PER_WEEK) } })}</p>
        {/if}
      </div>
      {#if payment && data.hasBilling && !store}
        <form method="POST" action={`?/billingPortal`} use:apiEnhance><input type="hidden" name="flow" value="payment_method" /><Button type="submit">{$_('app.settings.billing.changePayment')}</Button></form>
      {:else if data.currentPlan && data.hasBilling && !store}
        <form method="POST" action={`?/billingPortal`} use:apiEnhance><Button type="submit">{$_('app.account.billing.manage')}</Button></form>
      {:else if data.currentPlan || store}
        <span hidden></span>
      {:else if data.purchasesReady}
        <form method="POST" action={`?/subscribe`} use:apiEnhance><Button type="submit">{$_('app.account.billing.subscribe')} · {$_('app.account.billing.perEditorMonth', { values: { price: data.plan.price } })}</Button></form>
      {:else}
        <span class="muted">{$_('app.account.billing.purchasesNotReady')}</span>
      {/if}
    </div>

    {#if payment}
      <Notice tone="error" class="mb-0">{payment}</Notice>
    {:else if planEnd}
      <Notice class="mb-0">{planEnd}</Notice>
    {/if}

    {#if data.seats && data.seats.editors > 1 && !data.seats.endsAt && data.currentPlan}
      <p class="muted" data-testid="credits-cancel-warning">{$_('app.account.billing.cancelWarning', { values: { editors: data.seats.editors - 1 } })}</p>
    {/if}

    {#if !data.currentPlan && !store}
      <div class="compare">
        <span class="eyebrow">{$_('app.account.billing.compareTitle')}</span>
        <div class="compare-grid">
          <div class="tier">
            <div class="tier-head"><strong>{$_('app.account.billing.planFree')}</strong><span>{$_('app.account.billing.freePrice')}</span></div>
            <ul>
              <li>{$_('app.account.billing.featAgentEditsFree', { values: { limit: formatCredits(FREE_AGENT_LAYERS_PER_WEEK) } })}</li>
              <li>{$_('app.account.billing.featCreditsFree')}</li>
              <li>{$_('app.account.billing.featEditorsFree')}</li>
              <li>{$_('app.account.billing.featNeverExpire')}</li>
            </ul>
          </div>
          <div class="tier tier-plan">
            <div class="tier-head"><strong>{$_('app.account.billing.planPaid')}</strong><span>{$_('app.account.billing.perEditorMonth', { values: { price: data.plan.price } })}</span></div>
            <ul>
              <li><Check size={14} />{$_('app.account.billing.featAgentEditsPlan')}</li>
              <li><Check size={14} />{$_('app.account.billing.featCreditsPlan', { values: { credits: formatCredits(data.plan.credits) } })}</li>
              <li><Check size={14} />{$_('app.account.billing.featEditorsPlan', { values: { price: data.plan.price } })}</li>
              <li><Check size={14} />{$_('app.account.billing.featNeverExpire')}</li>
            </ul>
          </div>
        </div>
      </div>
    {/if}
  </section>

  <div class="pair">
    <section class="card">
      <span class="eyebrow">{$_('app.account.billing.balanceTitle')}</span>
      <p class="big"><CreditAmount amount={data.credits.balance} /></p>
      <p class="muted">{$_('app.account.billing.balanceEuro', { values: { euros: euros(data.credits.balance) } })}</p>
      {#if buys.length}
        <p class="muted">{$_('app.account.billing.balanceBuys')} <strong class="ink">{buys.join(' · ')}</strong></p>
      {/if}
    </section>

    {#if agentEdits}
      <section class="card" data-testid="credits-agent-edits">
        <span class="eyebrow">{$_('app.account.billing.agentEdits')}</span>
        <p class="big">{$_('app.account.billing.agentEditsOf', { values: { used: formatCredits(agentEdits.used), limit: formatCredits(agentEdits.limit) } })}</p>
        <div class="meter" role="progressbar" aria-valuemin={0} aria-valuemax={agentEdits.limit} aria-valuenow={agentEdits.used}>
          <span style:width={`${(agentEdits.used / agentEdits.limit) * 100}%`}></span>
        </div>
        <p class="muted">
          {#if agentEdits.resetsAt}{$_('app.account.billing.agentEditsResets', { values: { date: date(agentEdits.resetsAt) } })}{:else}{$_('app.account.billing.agentEditsFresh')}{/if}
        </p>
        <p class="muted">{$_('app.account.billing.agentEditsCapped')}</p>
      </section>
    {/if}
  </div>

  {#if store}
    <Panel title={$_('app.account.billing.topUpsTitle')}>
      <div><StorePaywall orgId={data.org.id} plan={data.plan} topUps={data.topUps} currentPlan={data.currentPlan} onPurchased={invalidateAll} /></div>
    </Panel>
  {:else if web}
    <section class="section">
      <div class="section-head">
        <h2>{$_('app.account.billing.topUpsTitle')}</h2>
        <p class="muted">{$_('app.account.billing.topUpsDesc')}</p>
      </div>
      <div class="top-ups" data-testid="credits-top-ups">
        {#each data.topUps as topUp (topUp.price)}
          <form class="card top-up" method="POST" action={`?/buyOneTime`} use:apiEnhance data-testid="credits-top-up">
            <input type="hidden" name="credits" value={topUp.credits} />
            <span class="top-up-price">€{topUp.price}</span>
            <span class="muted">{$_('app.account.billing.topUpCredits', { values: { credits: formatCredits(topUp.credits) } })}</span>
            <Button variant="secondary" type="submit" class="w-full shadow-[inset_0_0_0_1px_var(--ui-divider-strong)]">{$_('app.account.billing.topUpBuy')}</Button>
          </form>
        {/each}
      </div>
    </section>
  {/if}
{/if}

<section class="section">
  <div class="section-head">
    <h2>{$_('app.account.billing.usageTitle')}</h2>
    {#if data.usage.total}
      <p class="muted">{$_('app.account.billing.usageTotal', { values: { credits: formatCredits(data.usage.total) } })}</p>
    {/if}
  </div>
  {#if !data.usage.total}
    <div class="card empty">{$_('app.account.billing.usageEmpty')}</div>
  {:else}
    <div class="pair">
      <div class="card">
        <span class="eyebrow">{$_('app.account.billing.usageByProject')}</span>
        <ul class="bars">
          {#each data.usage.byProject as row (row.id)}
            <li>
              <div class="bar-label"><span>{row.name ?? $_('app.account.billing.usageNoProject')}</span><CreditAmount amount={row.credits} /></div>
              <div class="bar"><span style:width={share(row.credits, data.usage.byProject[0].credits)}></span></div>
            </li>
          {/each}
        </ul>
      </div>
      <div class="card">
        <span class="eyebrow">{$_('app.account.billing.usageByKind')}</span>
        <ul class="bars">
          {#each data.usage.byKind as row (row.kind)}
            <li>
              <div class="bar-label"><span>{$_(`app.account.billing.kind.${row.kind}`)}</span><CreditAmount amount={row.credits} /></div>
              <div class="bar"><span style:width={share(row.credits, data.usage.byKind[0].credits)}></span></div>
            </li>
          {/each}
        </ul>
      </div>
    </div>
  {/if}
</section>

{#if data.isOwner && data.hasBilling && data.billingChannel === BillingChannel.Web}
  <div class="links">
    <form method="POST" action={`?/billingPortal`} use:apiEnhance><input type="hidden" name="flow" value="invoices" /><button type="submit" class="link">{$_('app.settings.billing.invoices')}</button></form>
    <form method="POST" action={`?/billingPortal`} use:apiEnhance><input type="hidden" name="flow" value="payment_method" /><button type="submit" class="link">{$_('app.settings.billing.changePayment')}</button></form>
  </div>
{/if}

<div class="legal-wrap">
  <LegalFooter />
</div>
</div>

<style>
  .credits-page {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    max-width: 56rem;
    width: 100%;
    margin: 0 auto;
    padding: 2rem 1rem 3rem;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1.25rem;
    border-radius: var(--ui-radius-md);
    border: 1px solid var(--ui-divider);
    background: var(--ui-panel-sunken);
    color: var(--ui-text);
    min-width: 0;
  }

  .eyebrow {
    font-size: var(--ui-text-sm);
    color: var(--ui-text-3);
  }

  .muted {
    margin: 0;
    font-size: var(--ui-text-md);
    color: var(--ui-text-2);
  }

  .ink {
    color: var(--ui-text);
    font-weight: 500;
  }

  h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .plan h2 {
    font-size: 1.5rem;
    letter-spacing: -0.03em;
  }

  .plan-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .plan-id {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .price {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 500;
  }

  .compare {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .compare-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .tier {
    padding: 1rem;
    border-radius: var(--ui-radius-md);
    border: 1px solid var(--ui-divider);
  }

  .tier-plan {
    border-color: var(--ui-accent);
    background: var(--ui-accent-wash);
  }

  .tier-head {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
    font-size: var(--ui-text-md);
    margin-bottom: 0.5rem;
  }

  .tier-head span {
    color: var(--ui-text-2);
  }

  .tier ul {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--ui-text-md);
    color: var(--ui-text-2);
  }

  .tier-plan ul {
    color: var(--ui-text);
  }

  .tier li {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .tier-plan li :global(svg) {
    color: var(--ui-accent);
    flex: none;
  }

  .pair {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: 1.25rem;
  }

  .big {
    margin: 0;
    font-size: 1.75rem;
    font-weight: 600;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
  }

  .meter,
  .bar {
    height: 6px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-divider);
    overflow: hidden;
  }

  .meter span,
  .bar span {
    display: block;
    height: 100%;
    border-radius: var(--ui-radius-full);
    background: var(--ui-accent);
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .top-ups {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
  }

  .top-up {
    align-items: flex-start;
  }

  .top-up-price {
    font-size: 1.5rem;
    font-weight: 600;
    letter-spacing: -0.03em;
  }

  .empty {
    align-items: center;
    color: var(--ui-text-2);
    font-size: var(--ui-text-md);
  }

  .bars {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin: 0.25rem 0 0;
    padding: 0;
    list-style: none;
  }

  .bar-label {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
    font-size: var(--ui-text-md);
  }

  .bar-label span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .links {
    display: flex;
    gap: 1.25rem;
    flex-wrap: wrap;
  }

  .link {
    padding: 0;
    border: 0;
    background: none;
    color: var(--ui-text-2);
    font-size: var(--ui-text-md);
    text-decoration: underline;
    cursor: pointer;
  }

  .link:hover {
    color: var(--ui-text);
  }

  .legal-wrap {
    margin-top: 1.5rem;
  }

  @media (max-width: 640px) {
    .compare-grid,
    .top-ups {
      grid-template-columns: 1fr;
    }
  }
</style>
