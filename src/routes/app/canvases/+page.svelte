<script lang="ts">
  import PageHeader from '$lib/components/app/PageHeader.svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  import CanvasRows from '$lib/components/app/CanvasRows.svelte';

  let { data } = $props();
</script>

<svelte:head><title>Canvases · feega</title></svelte:head>

<div class="canvases">
  <PageHeader title="canvases">
    {#snippet actions()}
      <form method="POST" action="/app?/project">
        <Button type="submit" data-testid="new-canvas">new canvas</Button>
      </form>
    {/snippet}
  </PageHeader>

  {#if data.canvases.length}
    <CanvasRows canvases={data.canvases} testid="canvases-list" />
  {:else}
    <p class="empty">no canvases yet. start one with new canvas, or describe an idea on the home.</p>
  {/if}
</div>

<style>
  .canvases {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-8);
    max-width: 720px;
    margin: 0 auto;
    color: var(--ui-text);
  }

  .empty {
    margin: 0;
    font-size: var(--ui-type-body);
    color: var(--ui-text-tertiary);
  }
</style>
