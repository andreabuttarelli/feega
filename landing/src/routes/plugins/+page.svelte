<script lang="ts">
  import PluginCard from '$lib/site/plugins/PluginCard.svelte';
  import { PLUGINS_META } from '$lib/site/seo';

  let { data } = $props();
</script>

<svelte:head>
  <title>{PLUGINS_META.title}</title>
  <meta name="description" content={PLUGINS_META.description} />
  <meta property="og:title" content={PLUGINS_META.title} />
  <meta property="og:description" content={PLUGINS_META.description} />
  <meta name="twitter:title" content={PLUGINS_META.title} />
  <meta name="twitter:description" content={PLUGINS_META.description} />
</svelte:head>

<div class="raised">
  <main class="page site-wide">
    <h1>plugins</h1>
    <p class="lead">add controls to Feega. you choose which ones are on, and each one lists what it can touch.</p>

    <div class="grid">
      {#each data.plugins as plugin (plugin.id)}
        <PluginCard {plugin} />
      {/each}
    </div>
  </main>
</div>

<style>
  .raised {
    background: var(--site-raised);
  }

  .page {
    padding: 140px 12px var(--site-section);
    color: var(--site-ink);
    font-size: 16px;
    line-height: 1.45;
  }

  h1 {
    margin: 0;
    font-size: 72px;
    line-height: 0.95;
    letter-spacing: -0.05em;
  }

  .lead {
    max-width: 760px;
    margin: 20px 0 48px;
    font-size: 20px;
    line-height: 1.35;
    opacity: 0.7;
  }

  .grid {
    display: grid;
    gap: 16px;
  }

  @media (min-width: 810px) {
    .page {
      padding: 160px 0 var(--site-section);
      font-size: 18px;
    }

    h1 {
      font-size: 120px;
    }

    .lead {
      font-size: 26px;
    }

    .grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>
