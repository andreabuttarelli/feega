<script lang="ts">
  import '$lib/site/site.css';
  import SiteHeader from '$lib/site/SiteHeader.svelte';
  import SiteFooter from '$lib/site/SiteFooter.svelte';
  import { page } from '$app/state';
  import { SITE_URL } from '$lib/site/links';
  import { pageTitle } from '$lib/site/llms';
  import { breadcrumbJsonLd } from '$lib/site/structured-data';

  let { children } = $props();

  const OG_IMAGE = `${SITE_URL}/og.gif`;
  const OG_VIDEO = `${SITE_URL}/og.mp4`;
  const canonical = $derived(SITE_URL + page.url.pathname);
  const crumb = $derived(page.url.pathname === '/' ? undefined : pageTitle(page.url.pathname));
</script>

<svelte:head>
  <link rel="preload" href="/site/fonts/bdo-grotesk-variable.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
  <link rel="canonical" href={canonical} />
  <link rel="icon" href="/site/favicon.png" />
  <link rel="apple-touch-icon" href="/site/favicon.png" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="feega" />
  {#if crumb}{@html breadcrumbJsonLd(crumb, page.url.pathname)}{/if}
  <meta property="og:url" content={canonical} />
  <meta property="og:image" content={OG_IMAGE} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/gif" />
  <meta property="og:video" content={OG_VIDEO} />
  <meta property="og:video:type" content="video/mp4" />
  <meta property="og:video:width" content="1200" />
  <meta property="og:video:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content={OG_IMAGE} />
  <meta name="robots" content="max-image-preview:large" />
</svelte:head>

<div class="site" id="top">
  <SiteHeader />
  <main>
    {@render children()}
  </main>
  <SiteFooter />
</div>
