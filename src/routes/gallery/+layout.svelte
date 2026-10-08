<script lang="ts">
  import '$lib/styles/tailwind.css';
  import AppShell from '$lib/components/app/AppShell.svelte';
  import { GALLERY_PATH } from '$lib/gallery/model';

  let { data, children } = $props();
</script>

{#if data.shell}
  <AppShell data={data.shell}>
    <div class="gallery-page" data-testid="gallery-in-app">{@render children()}</div>
  </AppShell>
{:else}
  <div class="public ui-app" data-testid="gallery-public">
    <header class="bar">
      <a class="wordmark" href="/">feega</a>
      <a class="section" href={GALLERY_PATH}>Gallery</a>
      <span class="spacer"></span>
      <a class="link" href="/login">Sign in</a>
    </header>
    <main class="gallery-page">{@render children()}</main>
  </div>
{/if}

<style>
  .public {
    min-height: 100dvh;
    background: var(--ui-bg);
    color: var(--ui-ink);
  }

  .bar {
    display: flex;
    align-items: center;
    gap: var(--ui-space-4);
    height: var(--ui-bar-h);
    padding: 0 var(--ui-space-4);
    font-size: var(--ui-text-md);
  }

  .wordmark {
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .section,
  .link {
    color: var(--ui-ink-2);
  }

  .link:hover,
  .section:hover {
    color: var(--ui-ink);
  }

  .spacer {
    flex: 1;
  }

  .gallery-page {
    max-width: 1280px;
    margin: 0 auto;
    padding: var(--ui-space-6) var(--ui-space-4) var(--ui-space-8);
  }

  @media (min-width: 1024px) {
    .bar {
      padding: 0 var(--ui-space-8);
    }

    main.gallery-page {
      padding: var(--ui-space-8);
    }
  }
</style>
