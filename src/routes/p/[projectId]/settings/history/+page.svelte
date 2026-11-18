<script lang="ts">
  import { page } from '$app/state';
  import { _ } from 'svelte-i18n';
  import { Panel } from '$lib/components/ui/panel';
  import HistoryPanel from '$lib/components/canvas/HistoryPanel.svelte';

  type CanvasRow = { id: string; name: string };

  let { data } = $props();

  const canvases = $derived((data.canvases ?? []) as CanvasRow[]);
  const opened = $derived(page.params.canvasId ?? null);

  let chosen = $state<string | null>(null);

  const canvasId = $derived(chosen ?? opened ?? canvases[0]?.id ?? null);
</script>

<Panel title={$_('app.nav2.history')} description={$_('app.settings.history.desc')}>
  {#if canvases.length > 1}
    <select class="canvas-pick" aria-label={$_('app.settings.history.canvas')} value={canvasId} onchange={(e) => (chosen = e.currentTarget.value)}>
      {#each canvases as canvas (canvas.id)}
        <option value={canvas.id}>{canvas.name}</option>
      {/each}
    </select>
  {/if}

  {#if canvasId}
    {#key canvasId}
      <div class="history">
        <HistoryPanel projectId={data.project.id} {canvasId} />
      </div>
    {/key}
  {:else}
    <p class="empty">{$_('app.settings.history.empty')}</p>
  {/if}
</Panel>

<style>
  .canvas-pick {
    width: 100%;
    height: 32px;
    margin: 0 0 12px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    font-size: 13px;
  }

  .history {
    max-height: 70vh;
    overflow: auto;
  }

  .empty {
    margin: 0;
    font-size: 13px;
    color: var(--ui-text-secondary);
  }
</style>
