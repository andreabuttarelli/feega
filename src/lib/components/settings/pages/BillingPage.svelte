<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { Notice } from '$lib/components/ui/notice';
  import { ANNUAL_SAVING_PERCENT, CLOUD_CURRENCY_SYMBOL, CLOUD_PRICES, CloudInterval } from '$lib/cloud-pricing';
  import { CheckoutOutcome } from '$lib/billing-path';
  import { BillingBusy as Busy, BillingLinkError, checkoutLink, portalLink, type BillingLinkResult } from '$lib/settings/billing-links';
  import { BillingPlan } from '$lib/billing-plan';
  import type { load as sectionLoad } from '$lib/server/settings/pages/billing';
  import { formatDay } from './billing-format';
  import PixelBand from './PixelBand.svelte';
  import '../../../../../packages/site-theme/tokens.css';

  let { data, outcome = CheckoutOutcome.None }: { data: Awaited<ReturnType<typeof sectionLoad>>; outcome?: CheckoutOutcome } = $props();

  const INCLUDES = ['include1', 'include2', 'include3', 'include4'] as const;
  const EDITOR_LINES = ['editorLine1', 'editorLine2', 'editorLine3'] as const;
  const QUESTIONS = ['faq1', 'faq2', 'faq3', 'faq4'] as const;
  const INTERVAL_UNIT = { [CloudInterval.Monthly]: 'perEditorBilledMonthly', [CloudInterval.Annual]: 'perEditorBilledYearly' } as const;
  const INTERVALS = [CloudInterval.Monthly, CloudInterval.Annual] as const;

  let interval = $state(CloudInterval.Annual);
  let busy = $state(Busy.Idle);
  let failure = $state<BillingLinkError | null>(null);

  const isCloud = $derived(data.plan === BillingPlan.Cloud);
  const price = $derived(CLOUD_PRICES[interval]);
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
  {#if isCloud}
    <article class="plan current" data-testid="billing-current">
      <div class="strip pixels" aria-hidden="true"><PixelBand /></div>
      <div class="title">
        <h3>{$_('app.settings.billing.planCloud')}</h3>
        <span class="badge" class:warn={data.pastDue || !!data.endsAt}>{$_('app.settings.billing.currentPlan')} · {$_(`app.settings.billing.${status}`)}</span>
      </div>

      {#if data.interval}
        <p class="price" data-testid="billing-price">
          <span class="amount">{money(CLOUD_PRICES[data.interval].perMonth)}</span>
          <span class="unit">{$_(`app.settings.billing.${INTERVAL_UNIT[data.interval]}`)}</span>
        </p>
      {/if}

      <dl class="facts">
        <div>
          <dt>{$_('app.settings.billing.seatsOfEditors')}</dt>
          <dd data-testid="billing-seats">{data.seatsPaid} / {data.editors}</dd>
        </div>
        <div>
          <dt>{data.endsAt ? $_('app.settings.billing.endsOn') : $_('app.settings.billing.renews')}</dt>
          <dd data-testid="billing-renewal">{formatDay(data.endsAt ?? data.renewsAt) ?? $_('app.settings.billing.noRenewal')}</dd>
        </div>
      </dl>

      {#if data.pastDue}
        <p class="note">{$_('app.settings.billing.pastDueNote')}</p>
      {:else if data.endsAt}
        <p class="note">{$_('app.settings.billing.endingNote')}</p>
      {/if}

      <div class="action">
        {#if data.canManage}
          <button type="button" class="cta" disabled={busy !== Busy.Idle} onclick={manage} data-testid="billing-manage">
            {busy === Busy.Portal ? $_('app.settings.billing.managing') : $_('app.settings.billing.manage')}
          </button>
        {:else}
          <p class="hint">{$_('app.settings.billing.askOwner')}</p>
        {/if}
      </div>

      <ul data-testid="billing-includes">
        {#each INCLUDES as item (item)}<li>{$_(`app.settings.billing.${item}`)}</li>{/each}
      </ul>
    </article>

    {#if data.canManage}
      <div class="downgrade">
        <button type="button" class="link" disabled={busy !== Busy.Idle} onclick={manage} data-testid="billing-downgrade">{$_('app.settings.billing.downgrade')}</button>
        <p>{$_('app.settings.billing.downgradeHint')}</p>
      </div>
    {/if}
  {:else}
    <div class="toggle" role="group" aria-label={$_('app.settings.billing.intervalLabel')}>
      {#each INTERVALS as option (option)}
        <button type="button" class:on={interval === option} aria-pressed={interval === option} onclick={() => (interval = option)} data-testid="interval-{option}">
          {$_(`app.settings.billing.${option}`)}
          {#if option === CloudInterval.Annual}<em>{$_('app.settings.billing.save', { values: { percent: ANNUAL_SAVING_PERCENT } })}</em>{/if}
        </button>
      {/each}
    </div>

    <div class="plans">
      <article class="plan" data-testid="billing-plan">
        <div class="strip terminal" aria-hidden="true"><span>$</span>npx feega</div>
        <div class="title">
          <h3>{$_('app.settings.billing.planFree')}</h3>
          <span class="badge">{$_('app.settings.billing.current')}</span>
        </div>
        <p class="for">{$_('app.settings.billing.editorFor')}</p>
        <p class="price"><span class="amount">{money(0)}</span> <span class="unit">{$_('app.settings.billing.editorUnit')}</span></p>
        <div class="action"><span class="cta outline">{$_('app.settings.billing.editorCta')}</span></div>
        <p class="start">{$_('app.settings.billing.freeLine')}</p>
        <ul>
          {#each EDITOR_LINES as item (item)}<li>{$_(`app.settings.billing.${item}`)}</li>{/each}
        </ul>
      </article>

      <article class="plan" data-testid="billing-upgrade">
        <div class="strip pixels" aria-hidden="true"><PixelBand /></div>
        <div class="title">
          <h3>{$_('app.settings.billing.planCloud')}</h3>
        </div>
        <p class="for">{$_('app.settings.billing.cloudFor')}</p>
        <p class="price" data-testid="billing-price">
          <span class="amount">{money(price.perMonth)}</span>
          <span class="unit">{$_('app.settings.billing.perEditorMonth')}</span>
        </p>
        <div class="action">
          <button type="button" class="cta" disabled={!data.canManage || busy !== Busy.Idle} onclick={upgrade} data-testid="billing-upgrade-button">
            {busy === Busy.Checkout ? $_('app.settings.billing.upgrading') : $_('app.settings.billing.upgrade')}
          </button>
        </div>
        <p class="start">
          {interval === CloudInterval.Annual
            ? $_('app.settings.billing.billedYearly', { values: { amount: money(price.perYear) } })
            : $_('app.settings.billing.billedMonthly')}
        </p>
        <ul data-testid="billing-includes">
          {#each INCLUDES as item (item)}<li>{$_(`app.settings.billing.${item}`)}</li>{/each}
        </ul>
      </article>
    </div>

    <dl class="summary">
      <div>
        <dt>{$_('app.settings.billing.editors')}</dt>
        <dd>{data.editors}</dd>
      </div>
      <div>
        <dt>{$_('app.settings.billing.seatsPaid')}</dt>
        <dd>{data.seatsPaid}</dd>
      </div>
      <div>
        <dt>{$_('app.settings.billing.renews')}</dt>
        <dd>{$_('app.settings.billing.noRenewal')}</dd>
      </div>
    </dl>
  {/if}

  <section class="faq" data-testid="billing-faq">
    <h3>{$_('app.settings.billing.faqTitle')}</h3>
    <div class="list">
      {#each QUESTIONS as item, index (item)}
        <details open={index === 0}>
          <summary><span>{$_(`app.settings.billing.${item}q`)}</span><span aria-hidden="true">+</span></summary>
          <p>{$_(`app.settings.billing.${item}a`)}</p>
        </details>
      {/each}
    </div>
  </section>
</div>

<style>
  .billing {
    display: flex;
    flex-direction: column;
    gap: 24px;
    margin-top: 16px;
    color: var(--sx-ink);
    font-size: var(--sx-fs-small);
    line-height: 1.45;
  }

  p {
    margin: 0;
  }

  .toggle {
    display: inline-flex;
    align-self: center;
    gap: 4px;
    padding: 4px;
    border-radius: 999px;
    background: var(--sx-pill);
  }

  .toggle button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 18px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .toggle button.on {
    background: var(--sx-ink);
    color: var(--sx-bg);
  }

  .toggle em {
    font-style: normal;
    font-size: 13px;
    color: var(--sx-accent);
  }

  .plans {
    display: grid;
    gap: 16px;
  }

  .plan {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 28px 24px;
    border-radius: var(--sx-radius-lg);
    background: var(--sx-bg);
    color: var(--sx-ink);
  }

  .plan.current {
    box-shadow: inset 0 0 0 1px var(--sx-accent);
  }

  .facts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 16px;
    margin: 0;
  }

  .facts dt {
    font-size: 13px;
    opacity: 0.65;
  }

  .facts dd {
    margin: 4px 0 0;
    font-size: var(--sx-fs-lead);
    letter-spacing: -0.02em;
  }

  .plan.current .note {
    padding: 12px 14px;
    border-radius: var(--sx-radius-md);
    background: var(--sx-tint-accent);
    box-shadow: inset 0 0 0 1px var(--sx-accent);
  }

  .plan.current .hint {
    opacity: 0.7;
  }

  .downgrade {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px 16px;
    padding: 0 24px;
    font-size: 13px;
    opacity: 0.7;
  }

  .link {
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
  }

  .link:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .link:focus-visible {
    outline: 2px solid var(--sx-accent);
    outline-offset: 2px;
  }

  .strip {
    height: 140px;
    margin: -12px -12px 8px;
    border-radius: var(--sx-radius-md);
    background: #111;
  }

  .strip.pixels {
    padding: 12px;
  }

  .strip.terminal {
    display: flex;
    align-items: center;
    padding: 0 20px;
    font-family: var(--sx-mono);
    font-size: 14px;
    color: rgba(240, 238, 233, 0.8);
  }

  .strip.terminal span {
    margin-right: 10px;
    color: var(--sx-accent);
  }

  .title {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }

  h3 {
    margin: 0;
    font-size: 26px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .badge {
    padding: 4px 12px;
    border-radius: 999px;
    background: var(--sx-tint-accent);
    box-shadow: inset 0 0 0 1px var(--sx-accent);
    color: var(--sx-accent);
    font-size: 13px;
  }

  .badge.warn {
    background: transparent;
    color: var(--sx-accent-soft);
    box-shadow: inset 0 0 0 1px var(--sx-accent-soft);
  }

  .for {
    margin: -8px 0 8px;
    opacity: 0.7;
  }

  .price {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 8px;
  }

  .amount {
    font-size: 48px;
    white-space: nowrap;
    line-height: 1;
    letter-spacing: -0.05em;
  }

  .unit {
    font-size: 18px;
    opacity: 0.65;
  }

  .action {
    display: flex;
  }

  .cta {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    min-height: 48px;
    padding: 0 24px;
    border: 0;
    border-radius: 100px;
    background: var(--sx-accent);
    color: #fff;
    font: inherit;
    font-size: 18px;
    font-weight: 500;
    letter-spacing: -0.02em;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .cta.outline {
    background: transparent;
    box-shadow: inset 0 0 0 1px rgba(240, 238, 233, 0.4);
    cursor: default;
  }

  .cta:hover:not(:disabled):not(.outline) {
    background: #ff6a26;
  }

  .cta:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .cta:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 3px;
  }

  .start {
    display: grid;
    gap: 8px;
    align-content: start;
    color: #fff;
  }

  .start .note {
    padding: 12px 14px;
    border-radius: var(--sx-radius-md);
    background: var(--sx-tint-accent);
    box-shadow: inset 0 0 0 1px var(--sx-accent);
  }

  .start .hint {
    opacity: 0.7;
  }

  ul {
    display: grid;
    align-content: start;
    gap: 12px;
    margin: 8px 0 0;
    padding: 16px 0 0;
    border-top: 1px solid rgba(240, 238, 233, 0.15);
    list-style: none;
  }

  li {
    position: relative;
    padding-left: 24px;
  }

  li::before {
    content: '';
    position: absolute;
    top: 0.5em;
    left: 2px;
    width: 9px;
    height: 5px;
    border-bottom: 1.5px solid var(--sx-accent);
    border-left: 1.5px solid var(--sx-accent);
    transform: rotate(-45deg);
  }

  .summary {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    margin: 0;
    padding: 20px 24px;
    border-radius: var(--sx-radius-lg);
    background: var(--sx-bg);
  }

  .summary dt {
    font-size: 13px;
    opacity: 0.65;
  }

  .summary dd {
    margin: 4px 0 0;
    font-size: var(--sx-fs-lead);
    letter-spacing: -0.02em;
  }

  .faq {
    display: grid;
    gap: 24px;
    margin-top: 24px;
    padding: 28px 24px;
    border-radius: var(--sx-radius-lg);
    background: var(--sx-bg);
  }

  .faq h3 {
    font-size: 28px;
    line-height: 1.1;
  }

  details {
    border-top: 1px solid rgba(240, 238, 233, 0.2);
  }

  details:last-child {
    border-bottom: 1px solid rgba(240, 238, 233, 0.2);
  }

  summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    min-height: 56px;
    list-style: none;
    cursor: pointer;
    font-size: 18px;
  }

  summary span:first-child {
    text-transform: lowercase;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary:focus-visible {
    outline: 2px solid var(--sx-accent);
    outline-offset: 2px;
  }

  details[open] summary span:last-child {
    transform: rotate(45deg);
  }

  details p {
    padding-bottom: 20px;
    max-width: 640px;
    opacity: 0.7;
  }

  @media (min-width: 810px) {
    .plans {
      grid-template-columns: 1fr 1fr;
    }

    .plan {
      display: grid;
      grid-row: span 7;
      grid-template-rows: subgrid;
      align-content: start;
      padding: 40px;
    }

    .summary {
      grid-template-columns: repeat(3, 1fr);
    }

    .faq {
      grid-template-columns: 1fr 2fr;
      gap: 32px;
      padding: 40px;
    }
  }

  @media (min-width: 1200px) {
    h3 {
      font-size: 30px;
    }

    .amount {
      font-size: 64px;
    }

    .plan {
      padding: 48px;
    }
  }
</style>
