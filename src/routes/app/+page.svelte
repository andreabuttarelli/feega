<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js';
  import CanvasRows from '$lib/components/app/CanvasRows.svelte';
  import NewCanvasButton from '$lib/components/app/NewCanvasButton.svelte';
  import FeegaFile from '$lib/components/canvas/FeegaFile.svelte';
  import { DashboardPage, PAGE_PATH } from '$lib/dashboard/pages';

  let { data } = $props();

  let feegaFile = $state<FeegaFile | null>(null);
  const recents = $derived(data.dashboard.canvases);
</script>

<svelte:head><title>Home · feega</title></svelte:head>

<div class="home">
  <div class="create" data-testid="home-create">
    <Button variant="secondary" data-testid="home-import-feega" onclick={() => feegaFile?.pick()}>import .feega</Button>
    <NewCanvasButton projects={data.projects} action="?/project" />
    <FeegaFile bind:this={feegaFile} page={PAGE_PATH[DashboardPage.Home]} />
  </div>

  <div class="scroll" data-testid="home-scroll">
    <div class="column">
      {#if recents.length}
        <section class="recents" aria-labelledby="recents-heading">
          <h2 id="recents-heading">recents</h2>
          <CanvasRows canvases={recents} testid="home-recents" />
        </section>
      {:else}
        <p class="empty" data-testid="home-empty">
          nothing here yet. start a blank canvas with new canvas.
        </p>
      {/if}
    </div>
  </div>
</div>

<style>
  .home {
    display: flex;
    flex-direction: column;
    height: calc(100svh - var(--ui-bar-h) - var(--content-pad-top) - var(--content-pad-bottom));
    color: var(--ui-text);
  }

  .scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
  }

  .create {
    display: flex;
    margin-bottom: var(--ui-space-4);
    justify-content: flex-end;
    gap: var(--ui-space-2);
  }

  @media (max-width: 640px) {
    .create {
      display: grid;
      grid-template-columns: 1fr 1fr;
      justify-content: stretch;
    }

    .create :global(button),
    .create form {
      width: 100%;
    }
  }

  .column {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-8);
    width: 100%;
    max-width: 720px;
    margin: var(--ui-space-8) auto 0;
    animation: rise var(--ui-dur-slow) var(--ui-ease) both;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }

  .recents {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
  }

  h2 {
    margin: 0;
    font-family: var(--sans);
    font-size: var(--ui-type-section);
    font-weight: var(--ui-weight-semibold);
    text-transform: uppercase;
    letter-spacing: var(--ui-tracking-caps);
    color: var(--ui-text-tertiary);
  }

  .empty {
    margin: 0;
    max-width: 44ch;
    font-size: var(--ui-type-body);
    line-height: var(--ui-leading);
    color: var(--ui-text-tertiary);
  }

  @media (prefers-reduced-motion: reduce) {
    .column {
      animation: none;
    }
  }

  @media (max-width: 640px) {
    .column {
      gap: var(--ui-space-6);
      margin-top: var(--ui-space-6);
    }
  }
</style>
