<script lang="ts">
  import { afterNavigate } from '$app/navigation';
  import { navigating, page } from '$app/state';
  import WorkbenchPageShimmer from '$lib/components/WorkbenchPageShimmer.svelte';
  import Menu from '@lucide/svelte/icons/menu';
  import * as Sheet from '$lib/components/ui/sheet/index.js';
  import type { Snippet } from 'svelte';
  import type { AppShell as Shell } from '$lib/server/dashboard/app-shell';
  import AppSidebar from './AppSidebar.svelte';

  let { data, children }: { data: Shell; children: Snippet } = $props();

  let drawerOpen = $state(false);

  const projectId = $derived(data.projects[0]?.id ?? null);

  const SKELETON_AFTER_MS = 150;
  const DASHBOARD_ROUTE = '/app';

  let slowNav = $state(false);

  $effect(() => {
    if (!navigating.to?.route.id?.startsWith(DASHBOARD_ROUTE)) {
      slowNav = false;
      return;
    }
    const timer = setTimeout(() => (slowNav = true), SKELETON_AFTER_MS);
    return () => {
      clearTimeout(timer);
      slowNav = false;
    };
  });

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

  <main class="app-main" aria-busy={slowNav}>
    {#if slowNav}
      <div data-testid="app-content-skeleton"><WorkbenchPageShimmer variant="page" /></div>
    {:else}
      {@render children()}
    {/if}
  </main>
</div>

<style>
  .app-shell {
    min-height: 100dvh;
    background: var(--ui-panel);
    color: var(--ui-text);
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
    background: var(--ui-panel);
  }

  .app-bar :global(.burger) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: var(--ui-radius-full);
    background: transparent;
    color: var(--ui-icon-ink);
  }

  .app-bar :global(.burger:hover) {
    background: var(--ui-wash);
    color: var(--ui-text);
  }

  .app-bar :global(.burger:focus-visible) {
    outline: none;
    box-shadow: var(--ui-ring);
  }

  .wordmark {
    font-size: var(--ui-text-lg);
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--ui-text);
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
    background: var(--ui-panel-sunken) !important;
    color: var(--ui-text);
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
      background: var(--ui-panel-sunken);
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
