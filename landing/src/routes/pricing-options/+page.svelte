<script lang="ts">
  import { page } from '$app/state';
  import PricingA from '$lib/site/pricing/PricingA.svelte';
  import PricingB from '$lib/site/pricing/PricingB.svelte';
  import PricingC from '$lib/site/pricing/PricingC.svelte';
  import { PLAN_LOW, PLAN_STANDARD } from '$lib/site/pricing/plan';

  const OPTIONS = { A: PricingA, B: PricingB, C: PricingC };

  const Option = $derived(OPTIONS[(page.url.searchParams.get('o') ?? 'A') as keyof typeof OPTIONS]);
  const plan = $derived(page.url.searchParams.get('p') === '9' ? PLAN_LOW : PLAN_STANDARD);
</script>

<svelte:head><meta name="robots" content="noindex" /></svelte:head>

<div class="site-home"><div class="cool"><Option {plan} /></div></div>

<style>
  .cool {
    background: #3d3d3d;
  }
</style>
