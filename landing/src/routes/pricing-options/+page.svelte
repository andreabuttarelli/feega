<script lang="ts">
  import { page } from '$app/state';
  import Pricing from '$lib/site/pricing/Pricing.svelte';
  import { PLAN_LOW, PLAN_STANDARD } from '$lib/site/pricing/plan';

  const plan = $derived(page.url.searchParams.get('p') === '9' ? PLAN_LOW : PLAN_STANDARD);
</script>

<svelte:head><meta name="robots" content="noindex" /></svelte:head>

<div class="site-home"><div class="cool"><Pricing {plan} /></div></div>

<style>
  .cool {
    background: #3d3d3d;
  }
</style>
