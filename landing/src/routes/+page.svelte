<script lang="ts">
  import Hero from '$lib/site/home/Hero.svelte';
  import OpenSource from '$lib/site/home/OpenSource.svelte';
  import Codebase from '$lib/site/home/Codebase.svelte';
  import Pricing from '$lib/site/pricing/Pricing.svelte';
  import { PLAN } from '$lib/site/pricing/plan';
  import FreeSection from '$lib/site/home/FreeSection.svelte';
  import Closing from '$lib/site/home/Closing.svelte';
  import { HOME_JSON_LD } from '$lib/site/structured-data';

  import { HOME_META } from '$lib/site/seo';
</script>

<svelte:head>
  <title>{HOME_META.title}</title>
  <meta name="description" content={HOME_META.description} />
  <meta property="og:title" content={HOME_META.title} />
  <meta property="og:description" content={HOME_META.description} />
  <meta name="twitter:title" content={HOME_META.title} />
  <meta name="twitter:description" content={HOME_META.description} />
  {@html HOME_JSON_LD}
</svelte:head>

<div class="site-home">
<Hero />
<OpenSource />
<div class="chapters">
  <Codebase />
</div>

<div class="cool">
  <FreeSection />
  <Pricing plan={PLAN} />
</div>



<Closing />
</div>


<style>
  .site-home {
    background: linear-gradient(#161616 0%, #000 5.37446%);
  }

  .cool {
    background: var(--site-raised);
  }
</style>
