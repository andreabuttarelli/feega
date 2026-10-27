<script lang="ts">
  import CompareSlider from './CompareSlider.svelte';
  import type { RunDifference } from '$lib/canvas/run-diff';

  let {
    left,
    right,
    leftLabel,
    rightLabel,
    diff = null,
    onclose
  }: { left: string; right: string; leftLabel: string; rightLabel: string; diff?: RunDifference[] | null; onclose: () => void } = $props();

  const show = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value));

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onclose();
    }
  }
</script>

<svelte:window onkeydowncapture={onKey} />

<div class="overlay" role="dialog" aria-label="Compare outputs" data-testid="compare-overlay">
  <button type="button" class="close" onclick={onclose}>Close</button>
  <div class="body">
    <CompareSlider {left} {right} {leftLabel} {rightLabel} />
    {#if diff && diff.length > 0}
      <table class="diff" data-testid="params-diff">
        <thead>
          <tr><th></th><th>{leftLabel}</th><th>{rightLabel}</th></tr>
        </thead>
        <tbody>
          {#each diff as row (row.field)}
            <tr><th>{row.field}</th><td>{show(row.a)}</td><td>{show(row.b)}</td></tr>
          {/each}
        </tbody>
      </table>
    {:else if diff}
      <p class="same" data-testid="params-same">Same prompt, model and settings</p>
    {/if}
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgb(0 0 0 / 0.92);
    font-family: var(--sans);
  }

  .body {
    display: grid;
    gap: 12px;
    max-width: 100%;
    max-height: 100%;
    overflow: auto;
  }

  .diff {
    border-collapse: collapse;
    color: #fff;
    font-size: var(--ui-text-xs);
    text-align: left;
  }

  .diff th,
  .diff td {
    padding: 4px 10px;
    border: 1px solid rgb(255 255 255 / 0.2);
    vertical-align: top;
    overflow-wrap: anywhere;
  }

  .same {
    margin: 0;
    color: rgb(255 255 255 / 0.7);
    font-size: var(--ui-text-xs);
  }

  .close {
    position: absolute;
    top: 16px;
    right: 16px;
    height: 28px;
    padding: 0 10px;
    border: 1px solid rgb(255 255 255 / 0.3);
    border-radius: var(--ui-radius-sm);
    background: none;
    color: #fff;
    font: inherit;
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }
</style>
