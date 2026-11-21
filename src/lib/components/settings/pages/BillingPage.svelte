
<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { Notice } from '$lib/components/ui/notice';
  import { ANNUAL_SAVING_PERCENT, CLOUD_CURRENCY_SYMBOL, CLOUD_PRICES, CloudInterval } from '$lib/cloud-pricing';
  import { CheckoutOutcome } from '$lib/billing-path';
  import { BillingBusy as Busy, BillingLinkError, checkoutLink, portalLink, type BillingLinkResult } from '$lib/settings/billing-links';
  import { BillingPlan } from '$lib/billing-plan';
  import type { load as sectionLoad } from '$lib/server/settings/pages/billing';
  import { formatDay } from './billing-format';

  let { data, outcome = CheckoutOutcome.None }: { data: Awaited<ReturnType<typeof sectionLoad>>; outcome?: CheckoutOutcome } = $props();

  const INCLUDES = ['include1', 'include2', 'include3', 'include4'] as const;
  const QUESTIONS = ['faq1', 'faq2', 'faq3', 'faq4'] as const;
  const INTERVALS = [CloudInterval.Monthly, CloudInterval.Annual] as const;

  let interval = $state(CloudInterval.Annual);
  let busy = $state(Busy.Idle);
  let failure = $state<BillingLinkError | null>(null);

  const isCloud = $derived(data.plan === BillingPlan.Cloud);
  const price = $derived(CLOUD_PRICES[interval]);
  const seatShare = $derived(data.editors > 0 ? Math.min(100, Math.round((data.seatsPaid / data.editors) * 100)) : 0);
  const status = $derived(data.pastDue ? 'statusPastDue' : data.endsAt ? 'statusEnding' : 'statusActive');
  const money = (amount: number) => `${CLOUD_CURRENCY_SYMBOL}${amount}`;

  async function go(kind: Busy, open: () => Promise<BillingLinkResult>) {
    busy = kind;
    failure = null;
    const link = await open();
    if (link.url) {
      window.location.assign(link.url);
      return;
    }
    failure = link.error ?? BillingLinkError.Unavailable;
    busy = Busy.Idle;
  }

  const upgrade = () => go(Busy.Checkout, () => checkoutLink(interval));
  const manage = () => go(Busy.Portal, portalLink);
</script>

{#if outcome === CheckoutOutcome.Paid}
  <Notice tone="success">{$_('app.settings.billing.paid')}</Notice>
{:else if outcome === CheckoutOutcome.Canceled}
  <Notice>{$_('app.settings.billing.canceled')}</Notice>
{/if}
{#if failure}
  <Notice tone="error">{$_(`app.settings.billing.error.${failure}`)}</Notice>
{/if}
{#if !data.canManage}
  <Notice>{$_('app.settings.billing.ownerOnly')}</Notice>
{/if}

<div class="billing" data-testid="billing-page" data-plan={data.plan}>
  <section class="tile plan" data-testid="billing-plan">
    <p class="eyebrow">{$_('app.settings.billing.currentPlan')}</p>
    <div class="plan-head">
      <h2>{isCloud ? $_('app.settings.billing.planCloud') : $_('app.settings.billing.planFree')}</h2>
      {#if isCloud}
        <span class="pill" class:warn={data.pastDue || !!data.endsAt}>{$_(`app.settings.billing.${status}`)}</span>
      {/if}
    </div>
    <p class="muted">{isCloud ? $_('app.settings.billing.cloudLine') : $_('app.settings.billing.freeLine')}</p>

    {#if isCloud}
      <div class="seats" data-testid="billing-seats">
        <div class="seat-numbers">
          <span class="big">{data.seatsPaid}<small> / {data.editors}</small></span>
          <span class="muted">{$_('app.settings.billing.seatsPaid')}</span>
        </div>
        <div class="bar" role="presentation"><span style:width="{seatShare}%"></span></div>
        <p class="muted small">{$_('app.settings.billing.viewersFree')}</p>
      </div>

      <dl class="facts">
        <div>
          <dt>{data.endsAt ? $_('app.settings.billing.endsOn') : $_('app.settings.billing.renews')}</dt>
          <dd data-testid="billing-renewal">{formatDay(data.endsAt ?? data.renewsAt) ?? $_('app.settings.billing.noRenewal')}</dd>
        </div>
        <div>
          <dt>{$_('app.settings.billing.editors')}</dt>
          <dd>{data.editors}</dd>
        </div>
      </dl>

      {#if data.pastDue}
        <p class="note warn">{$_('app.settings.billing.pastDueNote')}</p>
      {:else if data.endsAt}
        <p class="note warn">{$_('app.settings.billing.endingNote')}</p>
      {/if}

      <div class="actions">
        <button type="button" class="pill-button" disabled={!data.canManage || busy !== Busy.Idle} onclick={manage} data-testid="billing-manage">
          {busy === Busy.Portal ? $_('app.settings.billing.managing') : $_('app.settings.billing.manage')}
        </button>
        <span class="muted small">{$_('app.settings.billing.manageHint')}</span>
      </div>
    {:else}
      <dl class="facts">
        <div>
          <dt>{$_('app.settings.billing.editors')}</dt>
          <dd>{data.editors}</dd>
        </div>
      </dl>
    {/if}
  </section>

  {#if !isCloud}
    <section class="tile cloud" data-testid="billing-upgrade">
      <h2>{$_('app.settings.billing.cloudTitle')}</h2>
      <p class="muted">{$_('app.settings.billing.cloudFor')}</p>

      <div class="toggle" role="group" aria-label={$_('app.settings.billing.intervalLabel')}>
        {#each INTERVALS as option (option)}
          <button type="button" class:on={interval === option} aria-pressed={interval === option} onclick={() => (interval = option)} data-testid="interval-{option}">
            {$_(`app.settings.billing.${option}`)}
            {#if option === CloudInterval.Annual}<em>{$_('app.settings.billing.save', { values: { percent: ANNUAL_SAVING_PERCENT } })}</em>{/if}
          </button>
        {/each}
      </div>

      <p class="price" data-testid="billing-price">
        <span class="amount">{money(price.perMonth)}</span>
        <span class="muted">{$_('app.settings.billing.perEditorMonth')}</span>
      </p>
      <p class="muted small">
        {interval === CloudInterval.Annual
          ? $_('app.settings.billing.billedYearly', { values: { amount: money(price.perYear) } })
          : $_('app.settings.billing.billedMonthly')}
      </p>

      <button type="button" class="pill-button" disabled={!data.canManage || busy !== Busy.Idle} onclick={upgrade} data-testid="billing-upgrade-button">
        {busy === Busy.Checkout ? $_('app.settings.billing.upgrading') : $_('app.settings.billing.upgrade')}
      </button>
    </section>
  {/if}

  <section class="tile includes" data-testid="billing-includes">
    <h2>{$_('app.settings.billing.includesTitle')}</h2>
    <ul>
      {#each INCLUDES as item (item)}<li>{$_(`app.settings.billing.${item}`)}</li>{/each}
    </ul>
  </section>

  <section class="tile faq" data-testid="billing-faq">
    <h2>{$_('app.settings.billing.faqTitle')}</h2>
    {#each QUESTIONS as item (item)}
      <details>
        <summary>{$_(`app.settings.billing.${item}q`)}</summary>
        <p class="muted">{$_(`app.settings.billing.${item}a`)}</p>
      </details>
    {/each}
  </section>
</div>

<style>
  .billing {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--ui-space-4);
    align-items: start;
  }

  .tile {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-3);
    padding: var(--ui-space-6);
    border-radius: 12px;
    background: var(--ui-panel-sunken);
    color: var(--ui-text);
  }

  .plan {
    grid-column: 1 / -1;
  }

  h2 {
    margin: 0;
    font-size: clamp(24px, 3vw, 32px);
    font-weight: 500;
    letter-spacing: -0.04em;
    line-height: 1.05;
  }

  p {
    margin: 0;
  }

  .eyebrow {
    font-size: var(--ui-text-sm);
    color: var(--ui-text-tertiary);
  }

  .muted {
    color: var(--ui-text-secondary);
  }

  .small {
    font-size: var(--ui-text-sm);
  }

  .plan-head {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--ui-space-3);
  }

  .pill {
    padding: 3px 10px;
    border-radius: 999px;
    font-size: var(--ui-text-sm);
    background: color-mix(in srgb, var(--ui-ok) 16%, transparent);
    color: var(--ui-ok);
  }

  .pill.warn {
    background: color-mix(in srgb, var(--ui-warn) 16%, transparent);
    color: var(--ui-warn);
  }

  .seats {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
    margin-top: var(--ui-space-2);
  }

  .seat-numbers {
    display: flex;
    align-items: baseline;
    gap: var(--ui-space-3);
  }

  .big {
    font-size: 44px;
    font-weight: 500;
    letter-spacing: -0.05em;
    line-height: 1;
  }

  .big small {
    font-size: 20px;
    color: var(--ui-text-tertiary);
    letter-spacing: -0.02em;
  }

  .bar {
    height: 6px;
    border-radius: 999px;
    background: var(--ui-input);
    overflow: hidden;
  }

  .bar span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--ui-text);
  }

  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ui-space-6);
    margin: var(--ui-space-2) 0 0;
    padding-top: var(--ui-space-3);
    border-top: 1px solid var(--ui-divider);
  }

  .facts dt {
    font-size: var(--ui-text-sm);
    color: var(--ui-text-tertiary);
  }

  .facts dd {
    margin: 2px 0 0;
    font-size: var(--ui-text-lg);
  }

  .note.warn {
    padding: 10px 14px;
    border-radius: 8px;
    font-size: var(--ui-text-sm);
    color: var(--ui-warn);
    background: color-mix(in srgb, var(--ui-warn) 10%, transparent);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--ui-space-3);
    margin-top: var(--ui-space-2);
  }

  .cloud {
    box-shadow: inset 0 0 0 1px var(--ui-divider-strong);
  }

  .toggle {
    display: inline-flex;
    align-self: flex-start;
    gap: 2px;
    padding: 3px;
    border-radius: 999px;
    background: var(--ui-input);
  }

  .toggle button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 14px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: var(--ui-text-sm);
    cursor: pointer;
  }

  .toggle button.on {
    background: var(--ui-text);
    color: var(--ui-panel);
  }

  .toggle em {
    font-style: normal;
    font-size: 11px;
    color: var(--brand-orange);
  }

  .price {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: var(--ui-space-2);
    margin-top: var(--ui-space-2);
  }

  .amount {
    font-size: 56px;
    font-weight: 500;
    letter-spacing: -0.05em;
    line-height: 1;
  }

  .pill-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 22px;
    border: 0;
    border-radius: 999px;
    background: var(--ui-text);
    color: var(--ui-panel);
    font: inherit;
    font-weight: 500;
    cursor: pointer;
    transition: opacity var(--ui-dur-fast, 120ms);
  }

  .pill-button:hover:not(:disabled) {
    opacity: 0.88;
  }

  .pill-button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .pill-button:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
  }

  .cloud .pill-button {
    margin-top: var(--ui-space-3);
  }

  ul {
    display: grid;
    gap: var(--ui-space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    position: relative;
    padding-left: 26px;
  }

  li::before {
    content: '';
    position: absolute;
    top: 0.5em;
    left: 2px;
    width: 9px;
    height: 5px;
    border-bottom: 1.5px solid var(--brand-orange);
    border-left: 1.5px solid var(--brand-orange);
    transform: rotate(-45deg);
  }

  details {
    padding: var(--ui-space-3) 0;
    border-top: 1px solid var(--ui-divider);
  }

  summary {
    cursor: pointer;
    list-style: none;
    font-size: var(--ui-text-md);
  }

  summary::-webkit-details-marker {
    display: none;
  }

  details p {
    margin-top: var(--ui-space-2);
  }

  @media (min-width: 810px) {
    .billing {
      grid-template-columns: 1fr 1fr;
    }

    .faq {
      grid-column: 1 / -1;
    }
  }
</style>
