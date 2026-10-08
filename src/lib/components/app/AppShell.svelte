<script lang="ts">
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import Menu from '@lucide/svelte/icons/menu';
  import * as Sheet from '$lib/components/ui/sheet/index.js';
  import type { Snippet } from 'svelte';
  import type { AppShell as Shell } from '$lib/server/dashboard/app-shell';
  import AppSidebar from './AppSidebar.svelte';

  let { data, children }: { data: Shell; children: Snippet } = $props();

  let drawerOpen = $state(false);

  const projectId = $derived(data.projects[0]?.id ?? null);

  afterNavigate(() => {
    drawerOpen = false;
  });
</script>

{#snippet sidebar()}
  <AppSidebar
    pathname={page.url.pathname}
    {projectId}
    projects={data.projects}
    profile={data.profile}
    org={data.org}
    workspaces={data.workspaces}
    creditBalance={data.creditBalance}
  />
{/snippet}

<div class="app-shell ui-app">
  <aside class="app-side">
    {@render sidebar()}
  </aside>

  <header class="app-bar" data-testid="app-bar">
    <Sheet.Root bind:open={drawerOpen}>
      <Sheet.Trigger class="burger" aria-label="Menu">
        <Menu size={18} strokeWidth={1.7} />
      </Sheet.Trigger>
      <Sheet.Content side="left" class="app-drawer" showCloseButton={false}>
        <Sheet.Title class="sr-only">Menu</Sheet.Title>
        {@render sidebar()}
      </Sheet.Content>
    </Sheet.Root>
    <a class="wordmark" href="/app">feega</a>
  </header>

  <main class="app-main">
    {@render children()}
  </main>
</div>

<style>
  .app-shell {
    min-height: 100dvh;
    background: var(--ui-bg);
    color: var(--ui-ink);
  }

  .app-side {
    display: none;
  }

  .app-bar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    height: var(--ui-bar-h);
    padding: 0 var(--ui-space-2);
    background: var(--ui-bg);
  }

  .app-bar :global(.burger) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 0;
    background: transparent;
    color: var(--ui-ink);
  }

  .app-bar :global(.burger:hover) {
    background: var(--ui-hover);
  }

  .app-bar :global(.burger:focus-visible) {
    outline: none;
    box-shadow: var(--ui-focus);
  }

  .wordmark {
    font-size: var(--ui-text-lg);
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--ui-ink);
    text-decoration: none;
  }

  :global(.app-drawer[data-side='left']) {
    border-right: 0 !important;
  }

  :global(.app-drawer) {
    width: 280px !important;
    max-width: 85vw !important;
    padding: 0;
    gap: 0;
    border: 0 !important;
    background: var(--ui-bg) !important;
    color: var(--ui-ink);
  }

  .app-main {
    padding: var(--content-pad-top) var(--content-pad-x) var(--content-pad-bottom);
  }

  @media (min-width: 1024px) {
    .app-shell {
      display: grid;
      grid-template-columns: var(--app-side-w) minmax(0, 1fr);
      --app-side-w: 220px;
    }

    .app-side {
      display: block;
      position: sticky;
      top: 0;
      height: 100dvh;
      background: var(--ui-surface);
    }

    .app-bar {
      display: none;
    }

    .app-main {
      padding: var(--ui-space-8) var(--ui-space-8) var(--content-pad-bottom);
    }
  }

  @media (max-width: 640px) {
    .app-main {
      padding: var(--ui-space-2) var(--ui-space-4) var(--content-pad-bottom);
    }
  }
</style>
