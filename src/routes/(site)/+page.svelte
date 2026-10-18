<script lang="ts">
  import Intro from '$lib/site/home/Intro.svelte';
  import Disciplines from '$lib/site/home/Disciplines.svelte';
  import Models from '$lib/site/home/Models.svelte';
  import Scene from '$lib/site/home/Scene.svelte';
  import Pricing from '$lib/site/home/Pricing.svelte';
  import Agents from '$lib/site/home/Agents.svelte';
  import Faq from '$lib/site/home/Faq.svelte';
  import { HOME_JSON_LD } from '$lib/site/structured-data';

  const TITLE = 'Feega - Better marketing on canvas';
  const DESCRIPTION = 'An infinite canvas where agents plan, create and ship your organic content & ads, and you stay in control of everything.';
</script>

<svelte:head>
  <title>{TITLE}</title>
  <meta name="description" content={DESCRIPTION} />
  <meta property="og:title" content={TITLE} />
  <meta property="og:description" content={DESCRIPTION} />
  <meta name="twitter:title" content={TITLE} />
  <meta name="twitter:description" content={DESCRIPTION} />
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
