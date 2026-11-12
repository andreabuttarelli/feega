<script lang="ts">
  import LiveAgents from '$lib/site/LiveAgents.svelte';
  import Hero from '$lib/site/home/Hero.svelte';
  import OpenSource from '$lib/site/home/OpenSource.svelte';
  import Codebase from '$lib/site/home/Codebase.svelte';
  import Motion from '$lib/site/home/Motion.svelte';
  import Generate from '$lib/site/home/Generate.svelte';
  import Pricing from '$lib/site/home/Pricing.svelte';
  import Agents from '$lib/site/home/Agents.svelte';
  import Story from '$lib/site/home/Story.svelte';
  import Faq from '$lib/site/home/Faq.svelte';
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
<Codebase />
<Motion />
<Generate />

<div class="cool">
  <Agents />
  <Pricing />
</div>

<Story />
<Faq />
</div>

<LiveAgents />

<style>
  .site-home {
    background: linear-gradient(#161616 0%, #000 5.37446%);
  }

  .cool {
    background: #3d3d3d;
  }
</style>
