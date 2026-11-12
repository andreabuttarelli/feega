<script lang="ts">
  import { APP_URL, DOCS_URL } from '../links';
  import PriceTag from './PriceTag.svelte';
  import PricingFaq from './PricingFaq.svelte';
  import Estimator from './Estimator.svelte';
  import { Tone, COMPARE_ROWS, OUT_OF_CREDITS, money, topUpLine, trialLine, type CloudPlan } from './plan';

  let { plan }: { plan: CloudPlan } = $props();
</script>

<section class="pricing site-wide" id="pricing" aria-labelledby="pricing-title">
  <h2 id="pricing-title">Local or Cloud.<br />Same editor, you pick where AI runs.</h2>

  <div class="table">
    <table>
      <caption class="sr">Local and Cloud compared</caption>
      <thead>
        <tr>
          <td></td>
          <th scope="col">
            <span class="name">Local</span>
            <PriceTag amount={money(0)} unit="forever" cta="Run locally" href={DOCS_URL} tone={Tone.Quiet} />
          </th>
          <th scope="col" class="cloud">
            <span class="name">{plan.name}</span>
            <PriceTag amount={money(plan.price)} unit="/ {plan.period}" cta="Start free" href={APP_URL} />
          </th>
        </tr>
      </thead>
      <tbody>
        {#each COMPARE_ROWS as row (row.feature)}
          <tr>
            <th scope="row">{row.feature}</th>
            <td>{#if row.local}<span class="yes" aria-label="Included"></span>{:else}<span class="no" aria-label="Not included">—</span>{/if}</td>
            <td class="cloud">{#if row.cloud}<span class="yes" aria-label="Included"></span>{:else}<span class="no" aria-label="Not included">—</span>{/if}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <p class="notes">{trialLine()} {topUpLine(plan)} {OUT_OF_CREDITS}</p>

  <Estimator {plan} />

  <PricingFaq {plan} />
</section>

<style>
  .pricing {
    padding: var(--site-section) 16px;
    color: var(--site-ink);
  }

  h2 {
    margin: 0;
    font-size: 34px;
    line-height: 36px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .table {
    margin-top: 48px;
    overflow: hidden;
    border-radius: 10px;
    background: #000;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  thead th {
    padding: 20px 12px 24px;
    text-align: left;
    vertical-align: top;
    font-weight: inherit;
  }

  thead td:first-child {
    width: 38%;
  }

  .name {
    display: block;
    margin-bottom: 16px;
    font-size: 20px;
    letter-spacing: -0.03em;
  }

  thead :global(.amount) {
    font-size: 36px;
  }

  thead :global(.price) {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  thead :global(.tag) {
    gap: 16px;
  }

  thead :global(.cta) {
    padding: 0 10px;
    font-size: 14px;
    white-space: nowrap;
  }

  tbody th,
  tbody td {
    padding: 14px 12px;
    border-top: 1px solid rgba(240, 238, 233, 0.12);
    text-align: left;
    font-weight: inherit;
    line-height: 1.35;
  }

  tbody th {
    padding-left: 16px;
    opacity: 0.85;
  }

  .cloud {
    background: rgba(255, 81, 0, 0.07);
  }

  .yes {
    display: inline-block;
    width: 12px;
    height: 7px;
    border-bottom: 2px solid #ff5100;
    border-left: 2px solid #ff5100;
    transform: rotate(-45deg) translateY(-2px);
  }

  .no {
    opacity: 0.35;
  }

  .notes {
    margin: 20px 0 0;
    max-width: 760px;
    opacity: 0.7;
    line-height: 1.45;
  }

  @media (min-width: 810px) {
    .pricing {
      padding: var(--site-section) 0;
    }

    h2 {
      font-size: 40px;
      line-height: 42px;
    }

    thead th {
      padding: 28px 24px;
    }

    thead :global(.amount) {
      font-size: 56px;
    }

    thead :global(.price) {
      flex-direction: row;
      align-items: baseline;
      gap: 8px;
    }

    thead :global(.cta) {
      padding: 0 24px;
      font-size: 17px;
    }

    tbody th,
    tbody td {
      padding: 16px 24px;
    }

    tbody th {
      padding-left: 28px;
    }
  }

  @media (min-width: 1200px) {
    h2 {
      font-size: 48px;
      line-height: 50px;
    }

    thead :global(.amount) {
      font-size: 64px;
    }
  }
</style>
