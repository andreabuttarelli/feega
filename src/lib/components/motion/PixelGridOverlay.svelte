<script lang="ts">
  import { pixelGridShown, type GridToggle } from '$lib/motion/pixel-grid';

  let { width, height, toggle }: { width: number; height: number; toggle: GridToggle } = $props();

  const ZOOM_POLL_MS = 200;

  let host = $state<HTMLDivElement | null>(null);
  let shownWidth = $state(0);
  const shown = $derived(pixelGridShown(shownWidth / width, toggle));

  $effect(() => {
    const el = host;
    if (!el) {
      return;
    }
    const read = () => (shownWidth = el.getBoundingClientRect().width);
    read();
    const timer = setInterval(read, ZOOM_POLL_MS);
    return () => clearInterval(timer);
  });
</script>

<div class="host" bind:this={host} aria-hidden="true">
  {#if shown}
    <svg class="grid" data-testid="pixel-grid" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <pattern id="pixel-cell" width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M 1 0 L 0 0 0 1" class="cell" />
        </pattern>
      </defs>
      <rect width={width} height={height} fill="url(#pixel-cell)" />
    </svg>
  {/if}
</div>

<style>
  .host,
  .grid {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .cell {
    fill: none;
    stroke: color-mix(in oklab, var(--ui-ink) 14%, transparent);
    stroke-width: 0.08;
  }
</style>
