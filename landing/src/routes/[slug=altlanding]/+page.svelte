<script lang="ts">
  import AltLanding from '$lib/site/alt-landings/AltLanding.svelte';
  import { altLandingPath } from '$lib/site/alt-landings';
  import { altLandingJsonLd } from '$lib/site/structured-data';

  let { data } = $props();

  const variant = $derived(data.variant);
</script>

<svelte:head>
  <title>{variant.meta.title}</title>
  <meta name="description" content={variant.meta.description} />
  <meta property="og:title" content={variant.meta.title} />
  <meta property="og:description" content={variant.meta.description} />
  <meta name="twitter:title" content={variant.meta.title} />
  <meta name="twitter:description" content={variant.meta.description} />
  {@html altLandingJsonLd({ name: variant.title, description: variant.meta.description, path: altLandingPath(variant.slug), faq: variant.faq })}
</svelte:head>

<AltLanding {variant} />
