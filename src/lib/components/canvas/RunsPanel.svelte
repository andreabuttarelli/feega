<script lang="ts">
  import type { RunListing } from '$lib/canvas/run-graph';
  import History from '@lucide/svelte/icons/history';
  import { tip } from '$lib/motion/tooltip';

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

  const RUNS_LABEL = 'Runs';
  const ACTIVE_STATUSES = ['running', 'queued'];
  const activeCount = $derived(runs.filter((run) => ACTIVE_STATUSES.includes(run.status)).length);

  const cost = (usd: number | null) => (usd === null ? '—' : `$${usd.toFixed(3)}`);
</script>

<div class="runs" data-testid="runs-panel">
  <div class="bar">
    {#if staleCount}
      <button type="button" data-testid="run-all-stale" onclick={onrunstale}>Run all out of date ({staleCount})</button>
    {/if}
    <button type="button" class="runs-toggle" aria-label={RUNS_LABEL} aria-expanded={open} use:tip={{ name: RUNS_LABEL, keys: '' }} onclick={() => (open = !open)}>
      <History size={16} />
      {#if activeCount}<span class="count" data-testid="runs-active">{activeCount}</span>{/if}
    </button>
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
    height: 32px;
    padding: 0 14px;
    border: 0;
    border-radius: var(--ui-radius-full);
    background: var(--ui-panel-raised);
    box-shadow: var(--ui-shadow-float);
    color: inherit;
    cursor: pointer;
  }

  .runs-toggle {
    position: relative;
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    padding: 0;
    color: var(--ui-icon-ink);
  }
  .runs-toggle:hover {
    color: var(--ui-text);
  }

  .count {
    position: absolute;
    top: -2px;
    right: -2px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-accent-solid);
    color: var(--ui-on-accent);
    font-size: 10px;
    line-height: 16px;
    text-align: center;
  }

  ol {
    position: absolute;
    right: 0;
    bottom: calc(100% + 8px);
    list-style: none;
    margin: 0;
    padding: 4px 0;
    width: min(280px, calc(100vw - 24px));
    max-height: min(260px, calc(100dvh - 140px));
    overflow-y: auto;
    border-radius: var(--ui-radius-md);
    background: var(--ui-panel-raised);
    box-shadow: var(--ui-shadow-float);
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
