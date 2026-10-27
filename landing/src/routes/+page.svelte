<script lang="ts">
  import Hero from '$lib/site/home/Hero.svelte';
  import Collage from '$lib/site/home/Collage.svelte';
  import Tools from '$lib/site/home/Tools.svelte';
  import Imagine from '$lib/site/home/Imagine.svelte';
  import Canvas from '$lib/site/home/Canvas.svelte';
  import Models from '$lib/site/home/Models.svelte';
  import Scenes from '$lib/site/home/Scenes.svelte';
  import Pricing from '$lib/site/home/Pricing.svelte';
  import Agents from '$lib/site/home/Agents.svelte';
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

<Hero />
<Collage />
<Tools />
<Imagine />
<Canvas />
<div class="warm">
  <Models />
  <Scenes />
</div>

<div class="cool">
  <Pricing />
  <Agents />
  <Faq />
</div>

<style>
  .warm {
    background: #ff5100;
    color: #000;
  }

  .cool {
    background: #3d3d3d;
  }
</style>
