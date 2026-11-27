<script lang="ts">
  import Pixel from '$lib/site/alternatives/Pixel.svelte';
  import TierBadge from '$lib/site/plugins/TierBadge.svelte';
  import { PLUGINS_PATH } from '$lib/site/plugins/plugins';
  import { primaryCta } from '$lib/site/install';
  import { lower } from '$lib/site/lower';
  import { eventAttrs } from '$lib/site/analytics/attrs';

  let { data } = $props();

  const plugin = $derived(data.plugin);
  const open = primaryCta();
</script>

<svelte:head>
  <title>{plugin.name} plugin | Feega</title>
  <meta name="description" content={plugin.summary} />
  <meta property="og:title" content="{plugin.name} plugin | Feega" />
  <meta property="og:description" content={plugin.summary} />
</svelte:head>

<div class="raised">
  <main class="page site-wide">
    <a class="back" href={PLUGINS_PATH}>← plugins</a>

    <header>
      <span class="icon"><Pixel icon={plugin.icon} size={8} /></span>
      <div>
        <h1>{lower(plugin.name)}</h1>
        <p class="meta">by {plugin.author} · v{plugin.version}</p>
        {#if plugin.credit}<p class="meta">built on <a href={plugin.credit.url} rel="noopener">{lower(plugin.credit.name)}</a> · {lower(plugin.credit.license)}</p>{/if}
      </div>
      <TierBadge tier={plugin.tier} />
    </header>

    <p class="lead">{plugin.description}</p>

    <a class="cta" href={open.href} {...eventAttrs('download_click', { target: 'download_page', place: 'plugin' })}>open in feega</a>

    <section>
      <h2>what it can do</h2>
      <ul>
        {#each plugin.permissions as line (line)}<li>{line}</li>{/each}
      </ul>
    </section>
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

  .back {
    color: var(--sx-ink-2);
    text-decoration: none;
    font-size: 16px;
  }

  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 20px;
    margin-top: 32px;
  }

  .icon {
    display: grid;
    place-items: center;
    width: 88px;
    height: 88px;
    border-radius: 10px;
    background: var(--sx-grey-1);
  }

  h1 {
    margin: 0;
    font-size: 56px;
    line-height: 0.95;
    letter-spacing: -0.05em;
    font-weight: 400;
  }

  .meta {
    margin: 8px 0 0;
    font-family: var(--sx-mono);
    font-size: 13px;
    opacity: 0.6;
  }

  .meta a {
    color: inherit;
  }

  .lead {
    max-width: 760px;
    margin: 32px 0;
    font-size: 20px;
    line-height: 1.4;
    opacity: 0.8;
  }

  .cta {
    display: inline-block;
    padding: 12px 22px;
    border-radius: 999px;
    background: var(--sx-accent);
    color: #000;
    text-decoration: none;
    font-weight: 500;
  }

  section {
    margin-top: 64px;
  }

  h2 {
    margin: 0 0 16px;
    font-size: 32px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  ul {
    max-width: 760px;
    margin: 0;
    padding-left: 20px;
  }

  li {
    margin: 6px 0;
  }

  @media (min-width: 810px) {
    .page {
      padding: 160px 0 var(--site-section);
      font-size: 18px;
    }

    h1 {
      font-size: 96px;
    }
  }
</style>
