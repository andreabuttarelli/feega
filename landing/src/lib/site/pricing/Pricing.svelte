<script lang="ts">
  import PriceGrid from './PriceGrid.svelte';
  import PricingFaq from './PricingFaq.svelte';
  import { PRICING_PATH } from '../paths';
  import { eventAttrs } from '../analytics/attrs';
  import type { CloudPlan } from './plan';

  let { plan }: { plan: CloudPlan } = $props();
</script>

<section class="pricing site-wide" id="pricing" aria-labelledby="pricing-title">
  <h2 id="pricing-title" data-agent-id="pricing-title">the extension is free. Feega Cloud is coming soon.</h2>

  <PriceGrid {plan} />

  <PricingFaq />

  <a class="full" href={PRICING_PATH} {...eventAttrs('pricing_cta', { plan: 'full_pricing' })}>see full pricing →</a>
</section>

<style>
  .pricing {
    padding: var(--site-section) 12px;
    color: var(--site-ink);
    font-size: 16px;
    line-height: 1.45;
  }

  h2 {
    margin: 0 0 48px;
    max-width: 900px;
    text-wrap: balance;
    font-size: 34px;
    line-height: 36px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .full {
    display: inline-block;
    margin-top: 24px;
    padding: 4px 0;
    border-bottom: 1px solid currentColor;
  }

  .full:focus-visible {
    outline: 2px solid #ff5100;
    outline-offset: 3px;
  }

  @media (min-width: 810px) {
    .pricing {
      padding: var(--site-section) 0;
      font-size: 18px;
    }

    h2 {
      font-size: 40px;
      line-height: 42px;
    }
  }

  @media (min-width: 1200px) {
    h2 {
      font-size: 48px;
      line-height: 50px;
    }
  }
</style>
