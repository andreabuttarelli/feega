<script lang="ts">
  import { page } from '$app/stores';

  let { children } = $props();

  const canonical = $derived($page.url.origin + $page.url.pathname);
</script>

<svelte:head>
  <link rel="canonical" href={canonical} />
  <meta property="og:locale" content="en_US" />
</svelte:head>

{@render children()}
