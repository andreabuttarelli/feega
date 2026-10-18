<script lang="ts">
  import './site.css';
  import SiteHeader from './SiteHeader.svelte';
  import SiteFooter from './SiteFooter.svelte';

  const ROWS = 6;
  const COLUMNS = 6;
  const cells = Array.from({ length: ROWS * COLUMNS }, (_, i) => i);
</script>

<svelte:head>
  <title>Feega - Better marketing on canvas</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="site" id="top">
  <SiteHeader />
  <main class="not-found">
    <div class="wall" aria-hidden="true">
      {#each cells as i (i)}
        <span>404</span>
      {/each}
    </div>
    <h1 class="sr-only">Page not found</h1>
    <a class="home" href="/">Back to home</a>
  </main>
  <SiteFooter />
</div>

<style>
  .not-found {
    height: 1012px;
    padding: 72px 12px 0;
  }

  .wall {
    display: grid;
    grid-template-columns: repeat(6, auto);
    grid-auto-flow: column;
    grid-template-rows: repeat(6, 25.2px);
    justify-content: space-between;
    row-gap: 115.2px;
    font-size: 28px;
    line-height: 0.9;
    letter-spacing: -0.04em;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  .home {
    display: inline-block;
    margin-top: 70px;
    border-bottom: 1px solid var(--site-ink);
  }

  @media (min-width: 1200px) {
    .not-found {
      max-width: 1500px;
      margin: 0 auto;
      padding: 80px 20px 0;
    }

    .wall {
      grid-template-rows: repeat(6, 39.6px);
      row-gap: 94.2px;
      font-size: 44px;
    }
  }
</style>
