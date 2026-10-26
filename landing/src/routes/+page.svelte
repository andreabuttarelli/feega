<script lang="ts">
  import Intro from '$lib/site/home/Intro.svelte';
  import Disciplines from '$lib/site/home/Disciplines.svelte';
  import Models from '$lib/site/home/Models.svelte';
  import Scene from '$lib/site/home/Scene.svelte';
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

<Intro />
<Disciplines />
<Models />
<Scene image="scene-1" />
<Scene image="scene-2" />
<Pricing />
<Agents />
<Faq />
