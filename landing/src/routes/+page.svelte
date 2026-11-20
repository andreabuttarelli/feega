<script lang="ts">
  import Hero from '$lib/site/home/Hero.svelte';
  import OpenSource from '$lib/site/home/OpenSource.svelte';
  import Codebase from '$lib/site/home/Codebase.svelte';
  import Pricing from '$lib/site/pricing/Pricing.svelte';
  import { PLAN } from '$lib/site/pricing/plan';
  import FreeSection from '$lib/site/home/FreeSection.svelte';
  import InstallCta from '$lib/site/InstallCta.svelte';
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



<section class="closing site-wide">
  <h2>start designing in your code</h2>
  <InstallCta id="closing-install" />
</section>
</div>


<style>
  .closing {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
    padding: 96px 20px;
    text-align: center;
  }

    .closing h2 {
    margin: 0;
    font-family: 'Instrument Serif', serif;
    font-size: 48px;
    font-weight: 400;
    line-height: 0.95;
    letter-spacing: -0.04em;
    color: #fff;
  }

  @media (min-width: 810px) {
      .closing h2 {
      font-size: 72px;
    }
  }

  .site-home {
    background: linear-gradient(#161616 0%, #000 5.37446%);
  }

  .cool {
    background: var(--site-raised);
  }
</style>
