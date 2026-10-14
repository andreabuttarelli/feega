<script lang="ts">
  import PageTitle from '$lib/components/PageTitle.svelte';
  import CanvasRows from '$lib/components/app/CanvasRows.svelte';

  let { data } = $props();
</script>

<svelte:head><title>Canvases · feega</title></svelte:head>

<div class="canvases">
  <div class="head">
    <PageTitle text="canvases" />
    <form method="POST" action="/app?/project">
      <button type="submit" class="primary" data-testid="new-canvas">new canvas</button>
    </form>
  </div>

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
    gap: 48px;
    max-width: 720px;
    margin: 0 auto;
    color: var(--ui-ink);
  }

  .head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--ui-space-4);
  }

  .primary {
    height: 36px;
    padding: 0 var(--ui-space-4);
    border: 0;
    border-radius: 9999px;
    background: var(--ui-accent);
    color: #fff;
    font: inherit;
    font-size: var(--ui-text-sm);
    cursor: pointer;
  }

  .primary:focus-visible {
    outline: none;
    box-shadow: var(--ui-focus);
  }

  .empty {
    margin: 0;
    font-size: var(--ui-text-md);
    color: var(--ui-text-3);
  }
</style>
