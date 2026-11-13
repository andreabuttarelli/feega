<script lang="ts">
  import '$lib/site/site.css';
  import SiteHeader from '$lib/site/SiteHeader.svelte';
  import SiteFooter from '$lib/site/SiteFooter.svelte';
  import CanvasEnding from '$lib/site/CanvasEnding.svelte';
  import { page } from '$app/state';
  import { SITE_URL } from '$lib/site/links';
  import { pageTitle } from '$lib/site/llms';
  import { breadcrumbJsonLd } from '$lib/site/structured-data';
  import { OG } from '$lib/site/seo';

  let { children } = $props();

  const canonical = $derived(SITE_URL + page.url.pathname);
  const crumb = $derived(page.url.pathname === '/' ? undefined : pageTitle(page.url.pathname));
</script>

<svelte:head>
  <link rel="preload" href="/site/fonts/bdo-grotesk-variable.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
  <link rel="canonical" href={canonical} />
  <link rel="icon" href="/site/favicon.svg" type="image/svg+xml" />
  <link rel="icon" href="/site/favicon.ico" sizes="16x16 32x32 48x48" />
  <link rel="icon" href="/site/favicon.png" sizes="48x48" type="image/png" />
  <link rel="apple-touch-icon" href="/site/apple-touch-icon.png" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Feega" />
  {#if crumb}{@html breadcrumbJsonLd(crumb, page.url.pathname)}{/if}
  <meta property="og:url" content={canonical} />
  <meta property="og:image" content={OG.image.url} />
  <meta property="og:image:width" content={String(OG.image.width)} />
  <meta property="og:image:height" content={String(OG.image.height)} />
  <meta property="og:image:type" content={OG.image.type} />
  <meta property="og:image:alt" content={OG.image.alt} />
  <meta property="og:video" content={OG.video.url} />
  <meta property="og:video:secure_url" content={OG.video.url} />
  <meta property="og:video:type" content={OG.video.type} />
  <meta property="og:video:width" content={String(OG.video.width)} />
  <meta property="og:video:height" content={String(OG.video.height)} />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content={OG.image.url} />
  <meta name="twitter:image:alt" content={OG.image.alt} />
  <meta name="robots" content="max-image-preview:large" />
</svelte:head>

<div class="site" id="top">
  <SiteHeader />
  <main>
    {@render children()}
  </main>
  {#if page.url.pathname === '/'}
    <CanvasEnding pick=".mark"><SiteFooter /></CanvasEnding>
  {:else}
    <SiteFooter />
  {/if}
</div>
