<script lang="ts">
  import Hero from '$lib/site/home/Hero.svelte';
  import Features from '$lib/site/home/Features.svelte';
  import Imagine from '$lib/site/home/Imagine.svelte';
  import Subscriptions from '$lib/site/home/Subscriptions.svelte';
  import Canvas from '$lib/site/home/Canvas.svelte';
  import Providers from '$lib/site/home/Providers.svelte';
  import Switch from '$lib/site/home/Switch.svelte';
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
<div class="lift">
  <Hero />
  <Features />
  <Imagine />
  <Subscriptions />
</div>
<Canvas />
<Providers />
<Switch />

<div class="cool">
  <Pricing />
  <Agents />
</div>

<Story />
<Faq />
</div>

<style>
  .lift {
    background: linear-gradient(#161616 0, #000 690px);
  }

  .cool {
    background: #3d3d3d;
  }
</style>
