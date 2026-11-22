<script lang="ts">
  import { PLAN } from '$lib/site/pricing/plan';
  import PriceGrid from '$lib/site/pricing/PriceGrid.svelte';
  import PricingFaq from '$lib/site/pricing/PricingFaq.svelte';
  import { PRICING_META } from '$lib/site/seo';
  import { FAQ } from '$lib/site/home';
  import { faqJsonLd } from '$lib/site/structured-data';
</script>

<svelte:head>
  <title>{PRICING_META.title}</title>
  <meta name="description" content={PRICING_META.description} />
  <meta property="og:title" content={PRICING_META.title} />
  <meta property="og:description" content={PRICING_META.description} />
  <meta name="twitter:title" content={PRICING_META.title} />
  <meta name="twitter:description" content={PRICING_META.description} />
  {@html faqJsonLd(FAQ)}
</svelte:head>

<div class="raised">
<main class="page site-wide">
  <h1>pricing</h1>
  <p class="lead">the Feega extension is free. Feega Cloud, with GitHub sync, collaboration, sections and templates, is coming soon.</p>

  <PriceGrid plan={PLAN} details="show" />

  <PricingFaq />
</main>
</div>

<style>
  .raised {
    background: var(--site-raised);
  }

  .page {
    padding: 140px 12px var(--site-section);
    color: var(--site-ink);
    font-size: 16px;
    line-height: 1.45;
  }

  h1 {
    margin: 0;
    font-size: 72px;
    line-height: 0.95;
    letter-spacing: -0.05em;
  }

  .lead {
    max-width: 760px;
    margin: 20px 0 48px;
    font-size: 20px;
    line-height: 1.35;
    opacity: 0.7;
  }

  @media (min-width: 810px) {
    .page {
      padding: 160px 0 var(--site-section);
      font-size: 18px;
    }

    h1 {
      font-size: 120px;
    }

    .lead {
      font-size: 26px;
    }
  }
</style>
