<script lang="ts">
  import type { RunListing } from '$lib/canvas/run-graph';

  let {
    runs,
    staleCount,
    onrunstale
  }: {
    runs: RunListing[];
    staleCount: number;
    onrunstale: () => void;
  } = $props();

  let open = $state(false);

  const cost = (usd: number | null) => (usd === null ? '—' : `$${usd.toFixed(3)}`);
</script>

<div class="runs" data-testid="runs-panel">
  <div class="bar">
    {#if staleCount}
      <button type="button" data-testid="run-all-stale" onclick={onrunstale}>Run all out of date ({staleCount})</button>
    {/if}
    <button type="button" aria-expanded={open} onclick={() => (open = !open)}>Runs</button>
  </div>
  {#if open}
    <ol>
      {#each runs as run (run.id)}
        <li>
          <span class="name">{run.name}</span>
          <span class="status" data-status={run.status}>{run.status}</span>
          <span class="cost">{cost(run.costUsd)}</span>
        </li>
      {:else}
        <li class="empty">No runs yet</li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .runs {
    position: absolute;
    z-index: 10;
    right: 12px;
    bottom: 12px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    font-size: 12px;
    color: var(--ui-text);
  }

  .bar {
    display: flex;
    gap: 6px;
  }

  @media (max-width: 767px) {
    .runs {
      bottom: var(--mobile-stack-top, 12px);
    }
  }

  button {
    font: inherit;
    padding: 4px 10px;
    border: 1px solid var(--line, rgba(0, 0, 0, 0.12));
    background: var(--ui-panel);
    color: inherit;
    cursor: pointer;
  }

  ol {
    list-style: none;
    margin: 0;
    padding: 4px 0;
    width: 280px;
    max-height: 260px;
    overflow-y: auto;
    border: 1px solid var(--line, rgba(0, 0, 0, 0.12));
    background: var(--ui-panel);
  }

  li {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 8px;
    padding: 4px 10px;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .status[data-status='failed'],
  .status[data-status='expired'] {
    color: var(--destructive, #c00);
  }

  .cost,
  .empty {
    opacity: 0.6;
  }
</style>
