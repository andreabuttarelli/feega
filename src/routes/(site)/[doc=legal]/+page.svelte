<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>{data.title}</title>
  <meta name="description" content={data.description} />
  <meta property="og:title" content={data.title} />
  <meta property="og:description" content={data.description} />
  <meta name="twitter:title" content={data.title} />
  <meta name="twitter:description" content={data.description} />
</svelte:head>

<article class="site-legal">
  {@html data.html}
</article>
