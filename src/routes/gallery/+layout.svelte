<script lang="ts">
  import '$lib/styles/tailwind.css';
  import { GALLERY_PATH } from '$lib/gallery/model';

  let { data, children } = $props();
</script>

<div class="gallery-shell ui-app">
  <header class="bar">
    <a class="wordmark" href="/">feega</a>
    <a class="section" href={GALLERY_PATH}>Gallery</a>
    <span class="spacer"></span>
    {#if data.session}
      <a class="link" href="/app">Open app</a>
    {:else}
      <a class="link" href="/login">Sign in</a>
    {/if}
  </header>
  <main>
    {@render children()}
  </main>
</div>

<style>
  .gallery-shell {
    min-height: 100dvh;
    background: var(--ui-bg);
    color: var(--ui-ink);
    letter-spacing: -0.01em;
  }

  .bar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: var(--ui-space-4);
    height: var(--ui-bar-h);
    padding: 0 var(--ui-space-4);
    background: var(--ui-bg);
    border-bottom: 1px solid var(--ui-line);
  }

  .wordmark {
    font-size: var(--ui-text-lg);
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .section {
    font-size: var(--ui-text-md);
    color: var(--ui-ink-2);
  }

  .spacer {
    flex: 1;
  }

  .link {
    font-size: var(--ui-text-md);
    color: var(--ui-ink);
  }

  main {
    max-width: 1280px;
    margin: 0 auto;
    padding: var(--ui-space-6) var(--ui-space-4) var(--ui-space-8);
  }

  @media (min-width: 1024px) {
    .bar {
      padding: 0 var(--ui-space-8);
    }

    main {
      padding: var(--ui-space-8);
    }
  }
</style>
