<script lang="ts">
  import CompareSlider from './CompareSlider.svelte';

  let { left, right, leftLabel, rightLabel, onclose }: { left: string; right: string; leftLabel: string; rightLabel: string; onclose: () => void } = $props();

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
  <CompareSlider {left} {right} {leftLabel} {rightLabel} />
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
