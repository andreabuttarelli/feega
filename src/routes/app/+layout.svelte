<script lang="ts">
  import '$lib/styles/tailwind.css';
  import AppHeader from '$lib/components/app/AppHeader.svelte';

  let { data, children } = $props();

  const menuProjectId = $derived(data.projects[0]?.id ?? null);
</script>

<div class="app-shell ui-app">
  {#if menuProjectId}
    <AppHeader {menuProjectId} profile={data.profile} org={data.org} workspaces={data.workspaces} creditBalance={data.creditBalance} />
  {/if}
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

  .app-main {
    padding: var(--content-pad-top) var(--content-pad-x) var(--content-pad-bottom);
  }

  @media (max-width: 640px) {
    .app-main {
      padding: 16px 16px var(--content-pad-bottom);
    }
  }
</style>
